'use strict';
(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover:hover) and (pointer:fine)');
  const body = document.body;
  const hero = $('.cap-hero');
  const heroInner = $('.cap-hero-inner');
  const heroMark = $('.hero-mark');
  const header = $('#site-header');
  const capMenu = $('#cap-menu');
  const capButton = $('#cap-nav-button');
  const capWrap = $('.cap-nav-wrap');
  const mobileMenu = $('#mobile-menu');
  const mobileButton = $('#mobile-menu-toggle');
  const langButton = $('#language-button');
  const langMenu = $('#language-menu');
  const lightbox = $('#media-lightbox');
  const motionButton = $('#motion-toggle');
  const footerMotion = $('#footer-motion');
  const projects = $('#projects');
  const panels = $$('.project-panel');
  const offers = $$('.offer-panel');
  const videos = $$('[data-loop-video]');
  const videoStates = new Map();
  const artStates = new Map();
  let savedMotion = false;
  try { savedMotion = sessionStorage.getItem('manifest-motion-paused') === 'true'; } catch (_) {}
  let paused = reduced.matches || savedMotion;
  let projectIndex = 0;
  let projectBusy = false;
  let scrollPending = false;
  let menuTimer;
  let ambient = '';
  let currentOffer = -1;
  let wheelFrame = 0;
  let wheelTarget = scrollY;
  let wheelLast = 0;
  let lightboxItems = [];
  let lightboxIndex = 0;
  let lightboxTrigger;

  body.classList.add('js-motion');

  function syncLock() {
    body.classList.toggle('locked', mobileMenu.classList.contains('open') || lightbox.open);
  }

  function setCapMenu(open) {
    clearTimeout(menuTimer);
    capMenu.classList.toggle('open', open);
    capMenu.inert = !open;
    capButton.setAttribute('aria-expanded', String(open));
  }
  capButton.addEventListener('click', event => setCapMenu(event.detail > 0 && finePointer.matches ? true : capButton.getAttribute('aria-expanded') !== 'true'));
  capWrap.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') setCapMenu(true); });
  capWrap.addEventListener('pointerleave', () => { menuTimer = setTimeout(() => setCapMenu(false), 180); });
  capWrap.addEventListener('focusout', event => { if (!capWrap.contains(event.relatedTarget)) setCapMenu(false); });
  $$('[data-cap-nav]').forEach(link => link.addEventListener('click', () => setCapMenu(false)));

  function setMobileMenu(open) {
    mobileButton.setAttribute('aria-expanded', String(open));
    mobileButton.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    mobileMenu.classList.toggle('open', open);
    mobileMenu.inert = !open;
    if (open) { setCapMenu(false); stopWheel(); }
    syncLock();
  }
  mobileButton.addEventListener('click', () => setMobileMenu(mobileButton.getAttribute('aria-expanded') !== 'true'));
  $$('a', mobileMenu).forEach(link => link.addEventListener('click', () => setMobileMenu(false)));
  mobileMenu.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const links = $$('a', mobileMenu);
    if ((!event.shiftKey && document.activeElement === links.at(-1)) || (event.shiftKey && document.activeElement === links[0])) {
      event.preventDefault(); mobileButton.focus();
    }
  });
  mobileButton.addEventListener('keydown', event => {
    if (event.key === 'Tab' && mobileMenu.classList.contains('open')) {
      event.preventDefault();
      const links = $$('a', mobileMenu);
      (event.shiftKey ? links.at(-1) : links[0]).focus();
    }
  });
  langButton?.addEventListener('click', () => {
    const open = langButton.getAttribute('aria-expanded') !== 'true';
    langButton.setAttribute('aria-expanded', String(open));
    langMenu.hidden = !open;
  });
  document.addEventListener('click', event => {
    if (!capWrap.contains(event.target)) setCapMenu(false);
    if (langMenu && !$('.language-wrap')?.contains(event.target)) { if(langMenu){langMenu.hidden = true; langButton?.setAttribute('aria-expanded', 'false');} }
  });

  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !entry.target.closest('[hidden]')) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: .08, rootMargin: '0px 0px -20px 0px' });
  $$('.reveal').forEach(element => revealObserver.observe(element));

  function videoCanPlay(video) {
    const state = videoStates.get(video);
    return !paused && !document.hidden && !lightbox.open && state.visible && !state.manualPause && !video.closest('[hidden]');
  }
  function syncVideo(video) {
    const play = videoCanPlay(video);
    if (play) {
      const promise = video.play();
      if (promise) promise.catch(() => updateVideoButton(video));
    } else video.pause();
    updateVideoButton(video);
  }
  function updateVideoButton(video) {
    const tile = video.closest('.project-media');
    const button = $('.media-video-toggle', tile);
    const isPlaying = !video.paused;
    button.setAttribute('aria-label', isPlaying ? 'Pause project video' : 'Play project video');
    button.setAttribute('aria-pressed', String(isPlaying));
    button.firstElementChild.textContent = isPlaying ? 'Ⅱ' : '▷';
    tile.classList.toggle('video-paused', !isPlaying);
  }
  const videoObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const state = videoStates.get(entry.target);
      state.visible = entry.isIntersecting;
      syncVideo(entry.target);
    });
  }, { threshold: .08 });
  videos.forEach(video => {
    video.muted = true;
    videoStates.set(video, { visible: false, manualPause: false });
    videoObserver.observe(video);
    video.addEventListener('play', () => updateVideoButton(video));
    video.addEventListener('pause', () => updateVideoButton(video));
    $('.media-video-toggle', video.parentElement).addEventListener('click', () => {
      const state = videoStates.get(video);
      if (video.paused) {
        if (paused && !reduced.matches) setMotion(false);
        state.manualPause = false;
        // An explicit play action still works with system reduced motion enabled.
        video.play().catch(() => updateVideoButton(video));
      } else { state.manualPause = true; video.pause(); }
    });
  });

  function syncArt(state) {
    if (!state.animation || !state.ready) return;
    if (!paused && !document.hidden && state.visible && state.index === currentOffer) state.animation.play();
    else state.animation.pause();
  }
  function loadArt(element) {
    const state = artStates.get(element);
    if (state.animation || !window.lottie) return;
    const layer = document.createElement('div');
    layer.className = 'lottie-layer';
    layer.setAttribute('aria-hidden', 'true');
    element.append(layer);
    state.animation = window.lottie.loadAnimation({
      container: layer, renderer: 'svg', loop: true, autoplay: false,
      path: element.dataset.lottie,
      rendererSettings: { preserveAspectRatio: 'xMidYMid meet', progressiveLoad: true }
    });
    state.animation.addEventListener('DOMLoaded', () => {
      state.ready = true;
      state.animation.goToAndStop(paused ? Math.min(60, state.animation.totalFrames - 1) : 0, true);
      element.classList.add('lottie-ready');
      syncArt(state);
    });
    state.animation.addEventListener('data_failed', () => layer.remove());
  }
  const artLoadObserver = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) { loadArt(entry.target); artLoadObserver.unobserve(entry.target); }
  }), { rootMargin: '250px 0px' });
  const artVisibilityObserver = new IntersectionObserver(entries => entries.forEach(entry => {
    const state = artStates.get(entry.target);
    state.visible = entry.isIntersecting;
    syncArt(state);
  }), { threshold: .1 });
  $$('[data-lottie]').forEach((element, index) => {
    artStates.set(element, { index, ready: false, visible: false, animation: null });
    artLoadObserver.observe(element);
    artVisibilityObserver.observe(element);
  });

  function setMotion(value) {
    paused = reduced.matches || value;
    try { sessionStorage.setItem('manifest-motion-paused', String(paused)); } catch (_) {}
    body.classList.toggle('motion-paused', paused);
    motionButton.setAttribute('aria-pressed', String(paused));
    motionButton.setAttribute('aria-label', reduced.matches ? 'Reduced motion enabled' : paused ? 'Play animations' : 'Pause animations');
    motionButton.disabled = reduced.matches;
    footerMotion.disabled = reduced.matches;
    $('.pause-icon', motionButton).textContent = paused ? '▷' : 'Ⅱ';
    $('.motion-tooltip', motionButton).textContent = reduced.matches ? 'Reduced motion' : paused ? 'Play motion' : 'Pause motion';
    footerMotion.textContent = reduced.matches ? 'Reduced motion enabled' : paused ? 'Play motion' : 'Pause motion';
    $$('img[data-still]').forEach(image => {
      if (!image.dataset.animated) image.dataset.animated = image.getAttribute('src');
      image.src = paused ? image.dataset.still : image.dataset.animated;
    });
    if (paused) $$('.reveal').forEach(element => element.classList.add('is-visible'));
    videos.forEach(syncVideo);
    artStates.forEach(syncArt);
    stopWheel();
    queueScroll();
  }
  motionButton.addEventListener('click', () => setMotion(!paused));
  footerMotion.addEventListener('click', () => setMotion(!paused));
  reduced.addEventListener('change', event => setMotion(event.matches));
  document.addEventListener('visibilitychange', () => { videos.forEach(syncVideo); artStates.forEach(syncArt); });

  function updateScroll() {
    scrollPending = false;
    const y = scrollY;
    const vh = innerHeight;
    const max = document.documentElement.scrollHeight - vh;
    document.documentElement.style.setProperty('--progress', String(max > 0 ? y / max : 0));
    header.classList.toggle('scrolled', y > 60);
    const heroBottom = hero.getBoundingClientRect().bottom;
    if (!paused && heroBottom > 0) {
      $('.cap-hero h1').style.transform = 'translate3d(0,' + (y * .09) + 'px,0)';
      heroInner.style.opacity = String(clamp(1 - y / hero.offsetHeight * 1.5));
    } else if (paused) { $('.cap-hero h1').style.transform = ''; heroInner.style.opacity = ''; }
    const customerTop = $('.customer-section').getBoundingClientRect().top;
    const offersTop = $('.offers').getBoundingClientRect().top;
    const inColorSection = customerTop < vh * .6 && offersTop > vh * .5;
    const nextAmbient = inColorSection ? 'var(--cap-accent)' : 'var(--paper)';
    if (ambient !== nextAmbient) { ambient = nextAmbient; body.style.setProperty('--page-surface', ambient); }
    header.style.setProperty('--header-color', heroBottom > 96 ? 'var(--cap-accent)' : ambient);
    if (!paused && innerWidth > 560) {
      const mosaic = $('.project-mosaic', panels[projectIndex]);
      const box = mosaic.getBoundingClientRect();
      if (box.top < vh && box.bottom > 0) {
        const progress = clamp((vh * .5 - box.top) / (vh + box.height), -1, 1);
        $$('.mosaic-column', mosaic).forEach(column => column.style.setProperty('--column-offset', (progress * Number(column.dataset.depth)) + 'px'));
      }
    }
    let nextOffer = -1;
    offers.forEach((offer, index) => {
      const box = offer.getBoundingClientRect();
      if (box.top < vh * .8 && box.bottom > 120) nextOffer = index;
    });
    if (nextOffer !== currentOffer) {
      currentOffer = nextOffer;
      offers.forEach((offer, index) => offer.classList.toggle('offer-active', index === currentOffer));
      artStates.forEach(syncArt);
    }
  }
  function queueScroll() {
    if (!scrollPending) { scrollPending = true; requestAnimationFrame(updateScroll); }
  }
  addEventListener('scroll', queueScroll, { passive: true });
  addEventListener('resize', () => {
    if (innerWidth > 800 && mobileMenu.classList.contains('open')) setMobileMenu(false);
    queueScroll();
  }, { passive: true });
  hero.addEventListener('pointermove', event => {
    if (paused || event.pointerType !== 'mouse') return;
    const x = clamp((event.clientX - innerWidth / 2) * .025, -15, 15);
    const y = clamp((event.clientY - innerHeight / 2) * .025, -12, 12);
    heroMark.style.setProperty('--mark-x', x + 'px');
    heroMark.style.setProperty('--mark-y', y + 'px');
  });
  hero.addEventListener('pointerleave', () => {
    heroMark.style.setProperty('--mark-x', '0px');
    heroMark.style.setProperty('--mark-y', '0px');
  });

  // Retain native document positions and anchor links while easing mouse-wheel movement.
  function stopWheel() {
    if (wheelFrame) cancelAnimationFrame(wheelFrame);
    wheelFrame = 0; wheelLast = 0; wheelTarget = scrollY;
  }
  function wheelTick(time) {
    const dt = wheelLast ? Math.min(50, time - wheelLast) : 16;
    wheelLast = time;
    const difference = wheelTarget - scrollY;
    if (Math.abs(difference) < .7) {
      scrollTo({ top: wheelTarget, behavior: 'instant' });
      wheelFrame = 0; wheelLast = 0; return;
    }
    scrollTo({ top: scrollY + difference * (1 - Math.exp(-dt / 75)), behavior: 'instant' });
    wheelFrame = requestAnimationFrame(wheelTick);
  }
  addEventListener('wheel', event => {
    if (paused || lightbox.open || mobileMenu.classList.contains('open') || event.ctrlKey || event.metaKey || event.shiftKey || !finePointer.matches || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    event.preventDefault();
    if (!wheelFrame) wheelTarget = scrollY;
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1);
    wheelTarget = clamp(wheelTarget + delta, 0, document.documentElement.scrollHeight - innerHeight);
    if (!wheelFrame) wheelFrame = requestAnimationFrame(wheelTick);
  }, { passive: false });
  addEventListener('pointerdown', stopWheel, { passive: true });

  function showProject(index) {
    if (projectBusy || panels.length < 2) return;
    const nextIndex = (index + panels.length) % panels.length;
    if (nextIndex === projectIndex) return;
    projectBusy = true;
    const previous = panels[projectIndex];
    previous.classList.add('changing');
    $('.project-prev').disabled = true;
    $('.project-next').disabled = true;
    stopWheel();
    setTimeout(() => {
      if (previous.contains(document.activeElement)) projects.focus({ preventScroll: true });
      previous.hidden = true;
      $$('video', previous).forEach(video => video.pause());
      projectIndex = nextIndex;
      const next = panels[projectIndex];
      next.classList.add('changing');
      next.hidden = false;
      $('#project-index').textContent = String(projectIndex + 1);
      $('.project-prev-name').textContent = panels[(projectIndex - 1 + panels.length) % panels.length].dataset.client;
      $('.project-next-name').textContent = panels[(projectIndex + 1) % panels.length].dataset.client;
      $('#project-announcement').textContent = next.dataset.client + ', project ' + (projectIndex + 1) + ' of ' + panels.length;
      $$('.reveal', next).forEach(element => { if (paused) element.classList.add('is-visible'); else revealObserver.observe(element); });
      // Scroll only when keyboard navigation switches a project from deep in its gallery.
      if (projects.getBoundingClientRect().top < -160) projects.scrollIntoView({ behavior: paused ? 'instant' : 'smooth', block: 'start' });
      requestAnimationFrame(() => requestAnimationFrame(() => { next.classList.remove('changing'); queueScroll(); }));
      setTimeout(() => {
        previous.classList.remove('changing');
        $('.project-prev').disabled = false;
        $('.project-next').disabled = false;
        projectBusy = false;
        videos.forEach(syncVideo);
      }, paused ? 0 : 300);
    }, paused ? 0 : 260);
  }
  if (panels.length > 1) {
    projects.setAttribute('aria-roledescription', 'carousel');
    $('.project-prev').addEventListener('click', () => showProject(projectIndex - 1));
    $('.project-next').addEventListener('click', () => showProject(projectIndex + 1));
    projects.addEventListener('keydown', event => {
      if (event.key === 'ArrowRight') { event.preventDefault(); showProject(projectIndex + 1); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); showProject(projectIndex - 1); }
    });
  }

  function showImage(index) {
    lightboxIndex = (index + lightboxItems.length) % lightboxItems.length;
    const source = lightboxItems[lightboxIndex];
    const image = $('#lightbox-image');
    image.src = source.dataset.lightbox;
    image.alt = $('img', source).alt;
    $('#lightbox-caption').textContent = image.alt + ' · ' + (lightboxIndex + 1) + ' / ' + lightboxItems.length;
  }
  $$('[data-lightbox]').forEach(tile => tile.addEventListener('click', () => {
    lightboxItems = $$('[data-lightbox]', panels[projectIndex]);
    lightboxTrigger = tile;
    showImage(lightboxItems.indexOf(tile));
    stopWheel();
    lightbox.showModal();
    syncLock();
    videos.forEach(syncVideo);
  }));
  $('.lightbox-close').addEventListener('click', () => lightbox.close());
  $('.lightbox-prev').addEventListener('click', () => showImage(lightboxIndex - 1));
  $('.lightbox-next').addEventListener('click', () => showImage(lightboxIndex + 1));
  lightbox.addEventListener('click', event => { if (event.target === lightbox) lightbox.close(); });
  lightbox.addEventListener('close', () => {
    syncLock();
    videos.forEach(syncVideo);
    if (lightboxTrigger) lightboxTrigger.focus({ preventScroll: true });
  });
  lightbox.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight') { event.preventDefault(); showImage(lightboxIndex + 1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); showImage(lightboxIndex - 1); }
  });
  document.addEventListener('keydown', event => {
    if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) stopWheel();
    if (event.key === 'Escape') {
      const wasMobileOpen = mobileMenu.classList.contains('open');
      const wasCapOpen = capMenu.classList.contains('open');
      setCapMenu(false); setMobileMenu(false);
      if(langMenu){langMenu.hidden = true; langButton?.setAttribute('aria-expanded', 'false');}
      if (wasMobileOpen) mobileButton.focus();
      else if (wasCapOpen) capButton.focus();
    }
  });
  addEventListener('pageshow', queueScroll);
  addEventListener('pagehide', () => { videos.forEach(video => video.pause()); artStates.forEach(state => state.animation?.pause()); });

  // Native fragment alignment uses a sticky element's current visual position.
  // Use its natural place in the stack for repeatable service deep links.
  function alignServiceAnchor(hash, behavior = 'smooth') {
    const index = offers.findIndex(offer => '#' + offer.id === hash);
    if (index < 0) return false;
    const stack = $('.offer-stack');
    const top = stack.getBoundingClientRect().top + scrollY;
    const precedingHeight = offers.slice(0, index).reduce((sum, offer) => sum + offer.offsetHeight, 0);
    const pin = getComputedStyle(offers[index]).position === 'sticky' ? parseFloat(getComputedStyle(body).getPropertyValue('--offer-top')) : 96;
    stopWheel();
    scrollTo({ top: top + precedingHeight - pin, behavior: paused ? 'instant' : behavior });
    return true;
  }
  $$('.service-pill').forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    const hash = link.getAttribute('href');
    history.pushState(null, '', hash);
    alignServiceAnchor(hash);
  }));
  const alignInitialAnchor = () => {
    requestAnimationFrame(() => { alignServiceAnchor(location.hash, 'instant'); queueScroll(); });
  };
  if (document.readyState === 'complete') alignInitialAnchor();
  else addEventListener('load', alignInitialAnchor, { once: true });
  document.fonts.ready.then(alignInitialAnchor);
  addEventListener('popstate', () => requestAnimationFrame(() => alignServiceAnchor(location.hash, 'instant')));
  setMotion(paused);
  updateScroll();
})();
