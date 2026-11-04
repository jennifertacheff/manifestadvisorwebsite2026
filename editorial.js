'use strict';
(() => {
  const $ = (selector, root = document) => root ? root.querySelector(selector) : null;
  const $$ = (selector, root = document) => root ? [...root.querySelectorAll(selector)] : [];
  const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
  const body = document.body;
  if (!body || !body.classList.contains('editorial-page')) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover:hover) and (pointer:fine)');
  const header = $('#site-header');
  const capMenu = $('#cap-menu');
  const capButton = $('#cap-nav-button');
  const capWrap = $('.cap-nav-wrap');
  const mobileMenu = $('#mobile-menu');
  const mobileButton = $('#mobile-menu-toggle');
  const langButton = $('#language-button');
  const langMenu = $('#language-menu');
  const languageWrap = $('.language-wrap');
  const motionButton = $('#motion-toggle');
  const footerMotion = $('#footer-motion');
  const progress = $('#reading-progress');
  const articleIntro = $('.article-intro-grid');
  const reveals = $$('.reveal');
  const videos = $$('[data-editorial-video]');
  const videoStates = new Map();
  const gifStates = new Map();
  const searchDialog = $('#sparks-search');
  const searchInput = $('#sparks-query');
  const searchResults = $('#search-results');
  const searchStatus = $('#search-status');
  const searchClear = $('[data-search-clear]', searchDialog);
  const shareStatus = $('#share-status');
  const shareURL = $('[data-share-url]');
  const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  // Define all shared state before initialization can call setMotion or syncLock.
  let userPaused = false;
  try { userPaused = sessionStorage.getItem('manifest-motion-paused') === 'true'; } catch (_) {}
  let paused = reduced.matches || userPaused;
  let pageHidden = false;
  let menuTimer = 0;
  let scrollPending = false;
  let wheelFrame = 0;
  let wheelTarget = scrollY;
  let wheelLast = 0;
  let lastPointerType = '';
  let revealObserver = null;
  let videoObserver = null;
  let sizeObserver = null;
  let searchIndex = null;
  let searchLoad = null;
  let searchError = false;
  let searchTrigger = null;
  let searchActiveIndex = -1;
  let searchBackdropDown = false;

  const mobileIsOpen = () => Boolean(mobileMenu?.classList.contains('open'));
  const searchIsOpen = () => Boolean(searchDialog?.open);
  const visibleFocusTarget = element => Boolean(element && element.isConnected && !element.closest('[hidden], [inert]') && element.getClientRects().length);

  function syncLock() {
    body.classList.toggle('locked', mobileIsOpen() || searchIsOpen());
    if (mobileIsOpen() || searchIsOpen()) stopWheel();
    videos.forEach(syncVideo);
  }

  function setCapMenu(open) {
    clearTimeout(menuTimer);
    if (!capMenu || !capButton) return;
    capMenu.classList.toggle('open', open);
    capMenu.inert = !open;
    capButton.setAttribute('aria-expanded', String(open));
  }

  function setLanguageMenu(open) {
    if (!langMenu || !langButton) return;
    langMenu.hidden = !open;
    langButton.setAttribute('aria-expanded', String(open));
  }

  function setMobileMenu(open) {
    if (!mobileMenu || !mobileButton) return;
    mobileButton.setAttribute('aria-expanded', String(open));
    mobileButton.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    mobileMenu.classList.toggle('open', open);
    mobileMenu.inert = !open;
    if (open) { setCapMenu(false); setLanguageMenu(false); }
    syncLock();
  }

  capButton?.addEventListener('click', event => {
    // A mouse hover may have opened the panel before the same pointer clicks.
    setCapMenu(event.detail > 0 && finePointer.matches && lastPointerType !== 'touch'
      ? true : capButton.getAttribute('aria-expanded') !== 'true');
  });
  capWrap?.addEventListener('pointerenter', event => {
    if (event.pointerType === 'mouse') setCapMenu(true);
  });
  capWrap?.addEventListener('pointerleave', event => {
    if (event.pointerType === 'mouse') menuTimer = setTimeout(() => setCapMenu(false), 180);
  });
  capWrap?.addEventListener('focusout', event => {
    if (!capWrap.contains(event.relatedTarget)) setCapMenu(false);
  });
  $$('[data-cap-nav]').forEach(link => link.addEventListener('click', () => setCapMenu(false)));
  mobileButton?.addEventListener('click', () => setMobileMenu(!mobileIsOpen()));
  $$('a', mobileMenu).forEach(link => link.addEventListener('click', () => setMobileMenu(false)));
  langButton?.addEventListener('click', () => setLanguageMenu(langButton.getAttribute('aria-expanded') !== 'true'));
  languageWrap?.addEventListener('focusout', event => {
    if (!languageWrap.contains(event.relatedTarget)) setLanguageMenu(false);
  });
  document.addEventListener('click', event => {
    if (capWrap && !capWrap.contains(event.target)) setCapMenu(false);
    if (languageWrap && !languageWrap.contains(event.target)) setLanguageMenu(false);
  });

  function revealAll() {
    reveals.forEach(element => {
      element.classList.add('is-visible');
      revealObserver?.unobserve(element);
    });
  }

  function videoCanPlay(video) {
    const state = videoStates.get(video);
    return Boolean(state && state.visible && !state.manualPause && (!paused || state.manualPlay)
      && !document.hidden && !pageHidden && !searchIsOpen() && !mobileIsOpen()
      && !video.closest('[hidden], [inert]'));
  }

  function updateVideoButton(video) {
    const state = videoStates.get(video);
    if (!state?.button) return;
    const playing = !video.paused && !video.ended;
    const label = playing ? 'Pause video' : 'Play video';
    state.button.setAttribute('aria-label', label);
    state.button.setAttribute('aria-pressed', String(playing));
    const spans = $$('span', state.button);
    if (spans[0]) spans[0].textContent = label;
    else state.button.textContent = label;
    if (spans[1]) spans[1].textContent = playing ? 'Ⅱ' : '▷';
    state.container?.classList.toggle('video-paused', !playing);
  }

  function syncVideo(video) {
    const state = videoStates.get(video);
    if (!state) return;
    if (!videoCanPlay(video)) {
      state.request += 1;
      state.pending = false;
      video.pause();
      updateVideoButton(video);
      return;
    }
    if (!video.paused || state.pending) { updateVideoButton(video); return; }
    const request = ++state.request;
    state.pending = true;
    let promise;
    try { promise = video.play(); }
    catch (_) { state.pending = false; updateVideoButton(video); return; }
    Promise.resolve(promise).then(() => {
      if (request === state.request) state.pending = false;
      if (!videoCanPlay(video)) video.pause();
      updateVideoButton(video);
    }, () => {
      if (request === state.request) state.pending = false;
      updateVideoButton(video);
    });
  }

  function elementIsVisible(element) {
    const box = element.getBoundingClientRect();
    return box.width > 0 && box.height > 0 && box.bottom > 0 && box.top < innerHeight
      && box.right > 0 && box.left < innerWidth;
  }

  videos.forEach(video => {
    const container = video.closest('.article-media') || video.parentElement;
    const button = $('[data-video-toggle]', container);
    const state = { button, container, visible: false, manualPause: false, manualPlay: false, pending: false, request: 0 };
    videoStates.set(video, state);
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    button?.addEventListener('click', () => {
      if (video.paused) {
        state.manualPause = false;
        state.manualPlay = true;
        state.visible = elementIsVisible(video);
      } else {
        state.manualPause = true;
        state.manualPlay = false;
      }
      // Explicit playback is allowed even when system reduced motion is enabled.
      syncVideo(video);
    });
    video.addEventListener('play', () => {
      // Native media controls are supported alongside the sibling button.
      if (!state.pending) {
        state.manualPause = false;
        state.manualPlay = true;
        state.visible = elementIsVisible(video);
      }
      if (!videoCanPlay(video)) syncVideo(video);
      updateVideoButton(video);
    });
    video.addEventListener('pause', () => {
      if (videoCanPlay(video)) { state.manualPause = true; state.manualPlay = false; }
      updateVideoButton(video);
    });
    video.addEventListener('ended', () => updateVideoButton(video));
    video.addEventListener('error', () => updateVideoButton(video));
  });

  $$('img[data-motion-still]').forEach(image => {
    gifStates.set(image, {
      animated: image.getAttribute('src'),
      still: image.dataset.motionStill,
      srcset: image.getAttribute('srcset')
    });
  });
  function syncGIFs() {
    const still = paused || document.hidden || pageHidden;
    gifStates.forEach((state, image) => {
      const source = still ? state.still : state.animated;
      if (!source) return;
      if (still) image.removeAttribute('srcset');
      else if (state.srcset) image.setAttribute('srcset', state.srcset);
      if (image.getAttribute('src') !== source) image.setAttribute('src', source);
    });
  }

  function setMotion(value, { persist = true } = {}) {
    if (persist) {
      userPaused = Boolean(value);
      try { sessionStorage.setItem('manifest-motion-paused', String(userPaused)); } catch (_) {}
    }
    paused = reduced.matches || userPaused;
    body.classList.toggle('motion-paused', paused);
    const label = reduced.matches ? 'Reduced motion enabled' : paused ? 'Play motion' : 'Pause motion';
    [motionButton, footerMotion].forEach(button => {
      if (!button) return;
      button.disabled = reduced.matches;
      button.setAttribute('aria-pressed', String(paused));
      button.setAttribute('aria-label', label);
    });
    const icon = $('.pause-icon', motionButton);
    const tooltip = $('.motion-tooltip', motionButton);
    if (icon) icon.textContent = paused ? '▷' : 'Ⅱ';
    if (tooltip) tooltip.textContent = reduced.matches ? 'Reduced motion' : label;
    if (footerMotion) footerMotion.textContent = label;
    if (paused) {
      revealAll();
      videoStates.forEach(state => { state.manualPlay = false; });
    }
    syncGIFs();
    videos.forEach(syncVideo);
    stopWheel();
    queueScroll();
    window.dispatchEvent(new CustomEvent('motionchange', { detail: { paused } }));
  }
  motionButton?.addEventListener('click', () => setMotion(!paused));
  footerMotion?.addEventListener('click', () => setMotion(!paused));
  const motionPreferenceChanged = () => setMotion(userPaused, { persist: false });
  if (reduced.addEventListener) reduced.addEventListener('change', motionPreferenceChanged);
  else reduced.addListener(motionPreferenceChanged);

  // Search data is fetched once, when the dialog is first opened. Failed loads can retry.
  const normalize = value => String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/ß/g, 'ss');
  function prepareSearchIndex(data) {
    if (!Array.isArray(data)) throw new Error('Invalid search index');
    const seen = new Set();
    return data.flatMap(record => {
      if (!record || typeof record.title !== 'string' || typeof record.path !== 'string') return [];
      try {
        const url = new URL(record.path, location.origin);
        const path = decodeURIComponent(url.pathname).normalize('NFC');
        if (url.origin !== location.origin || !path.startsWith('/sparks/') || !path.slice(8).replace(/\//g, '')) return [];
        const key = path.replace(/\/$/, '');
        if (seen.has(key)) return [];
        seen.add(key);
        const title = record.title.trim();
        if (!title) return [];
        const excerpt = typeof record.excerpt === 'string' ? record.excerpt.trim() : '';
        return [{ title, excerpt, path: url.pathname + url.search + url.hash,
          titleText: normalize(title), allText: normalize(title + ' ' + excerpt) }];
      } catch (_) { return []; }
    });
  }

  function setSearchActive(index) {
    searchActiveIndex = index;
    $$('.search-result', searchResults).forEach((link, position) => link.classList.toggle('is-active', position === index));
  }
  function focusSearchResult(index) {
    const links = $$('.search-result', searchResults);
    if (!links.length) return;
    const next = (index + links.length) % links.length;
    const link = links[next];
    setSearchActive(next);
    link.focus({ preventScroll: true });
    const box = link.getBoundingClientRect();
    const viewport = searchResults.getBoundingClientRect();
    if (box.top < viewport.top) searchResults.scrollTop -= viewport.top - box.top;
    else if (box.bottom > viewport.bottom) searchResults.scrollTop += box.bottom - viewport.bottom;
  }

  function renderSearch() {
    if (!searchInput || !searchResults || !searchStatus) return;
    if (searchClear) searchClear.hidden = searchInput.value.length === 0;
    searchResults.replaceChildren();
    searchActiveIndex = -1;
    if (searchLoad) { searchStatus.textContent = 'Loading Sparks…'; return; }
    if (searchError || !searchIndex) {
      searchStatus.textContent = 'Search is unavailable. Close and reopen to try again.';
      return;
    }
    const query = normalize(searchInput.value).trim();
    if (!query) {
      searchStatus.textContent = 'Search ' + searchIndex.length + ' Sparks by title or topic.';
      return;
    }
    const words = query.split(/\s+/);
    const matches = searchIndex.filter(record => words.every(word => record.allText.includes(word)))
      .map((record, order) => ({ record, order, score:
        (record.titleText === query ? 100 : 0) + (record.titleText.startsWith(query) ? 30 : 0)
        + (record.titleText.includes(query) ? 15 : 0) + words.filter(word => record.titleText.includes(word)).length * 3 }))
      .sort((a, b) => b.score - a.score || a.order - b.order);
    const shown = matches.slice(0, 20);
    const fragment = document.createDocumentFragment();
    shown.forEach(({ record }) => {
      const link = document.createElement('a');
      link.className = 'search-result';
      link.href = record.path;
      const title = document.createElement('strong');
      title.textContent = record.title;
      const excerpt = document.createElement('p');
      excerpt.textContent = record.excerpt;
      link.append(title, excerpt);
      fragment.append(link);
    });
    searchResults.append(fragment);
    searchStatus.textContent = matches.length === 0 ? 'No results. Try another word or topic.'
      : matches.length === 1 ? '1 Spark found.'
        : matches.length + ' Sparks found.' + (matches.length > 20 ? ' Showing the first 20.' : '');
  }

  function loadSearchIndex() {
    if (searchIndex || searchLoad) return searchLoad;
    searchError = false;
    searchResults?.setAttribute('aria-busy', 'true');
    searchLoad = (async () => {
      try {
        const response = await fetch('/assets/sparks/search-index.json', { credentials: 'same-origin', cache: 'no-cache' });
        if (!response.ok) throw new Error('Search request failed');
        const records = prepareSearchIndex(await response.json());
        if (!records.length) throw new Error('Search index is empty');
        searchIndex = records;
      } catch (_) { searchError = true; }
      finally {
        searchLoad = null;
        searchResults?.setAttribute('aria-busy', 'false');
        if (searchIsOpen()) renderSearch();
      }
    })();
    return searchLoad;
  }

  function openSearch(trigger) {
    if (!searchDialog || !searchInput || !searchResults || searchIsOpen()) return;
    searchTrigger = trigger || document.activeElement;
    setMobileMenu(false);
    setCapMenu(false);
    setLanguageMenu(false);
    stopWheel();
    searchDialog.showModal();
    syncLock();
    loadSearchIndex();
    renderSearch();
    searchInput.focus({ preventScroll: true });
  }
  function closeSearch() {
    if (!searchIsOpen()) return;
    searchDialog.close();
    syncLock();
  }
  function isOutsideSearch(event) {
    const box = searchDialog.getBoundingClientRect();
    return event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;
  }
  $$('[data-search-open]').forEach(button => button.addEventListener('click', event => {
    event.preventDefault(); openSearch(button);
  }));
  $$('[data-search-close]', searchDialog).forEach(button => button.addEventListener('click', event => {
    event.preventDefault(); closeSearch();
  }));
  searchClear?.addEventListener('click', event => {
    event.preventDefault();
    searchInput.value = '';
    renderSearch();
    searchInput.focus({ preventScroll: true });
  });
  searchInput?.addEventListener('input', renderSearch);
  searchInput?.addEventListener('focus', () => setSearchActive(-1));
  searchInput?.addEventListener('keydown', event => {
    if (event.isComposing) return;
    const links = $$('.search-result', searchResults);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (links.length) focusSearchResult(event.key === 'ArrowDown' ? 0 : links.length - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      links[0]?.click();
    }
  });
  searchResults?.addEventListener('focusin', event => {
    const link = event.target.closest('.search-result');
    if (link) setSearchActive($$('.search-result', searchResults).indexOf(link));
  });
  searchResults?.addEventListener('keydown', event => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const links = $$('.search-result', searchResults);
    const link = event.target.closest('.search-result');
    if (!link) return;
    event.preventDefault();
    const index = links.indexOf(link);
    if (event.key === 'ArrowUp' && index === 0) searchInput.focus({ preventScroll: true });
    else focusSearchResult(index + (event.key === 'ArrowDown' ? 1 : -1));
  });
  searchResults?.addEventListener('click', event => {
    if (event.target.closest('.search-result') && event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) closeSearch();
  });
  searchDialog?.addEventListener('pointerdown', event => {
    searchBackdropDown = event.target === searchDialog && isOutsideSearch(event);
  });
  searchDialog?.addEventListener('pointercancel', () => { searchBackdropDown = false; });
  searchDialog?.addEventListener('click', event => {
    if (searchBackdropDown && event.target === searchDialog && isOutsideSearch(event)) closeSearch();
    searchBackdropDown = false;
  });
  // Escape is handled by the native modal dialog; close runs for every dismissal path.
  searchDialog?.addEventListener('close', () => {
    searchBackdropDown = false;
    syncLock();
    const fallback = $$('[data-search-open]').find(visibleFocusTarget) || mobileButton;
    const target = visibleFocusTarget(searchTrigger) ? searchTrigger : fallback;
    if (visibleFocusTarget(target)) target.focus({ preventScroll: true });
  });

  const linkedInURL = () => 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(location.href);
  $$('[data-linkedin-share]').forEach(link => {
    link.href = linkedInURL();
    link.addEventListener('click', () => { link.href = linkedInURL(); });
  });

  function showShareFallback(message) {
    if (shareURL) {
      shareURL.value = location.href;
      shareURL.hidden = false;
      shareURL.focus({ preventScroll: true });
      shareURL.select();
      shareURL.setSelectionRange(0, shareURL.value.length);
    }
    if (shareStatus) shareStatus.textContent = message;
  }
  $$('[data-copy-link]').forEach(button => button.addEventListener('click', async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(location.href);
      if (shareURL) shareURL.hidden = true;
      if (shareStatus) shareStatus.textContent = 'Link copied.';
    } catch (_) {
      showShareFallback('The article link is selected. Copy it with your keyboard or device menu.');
    }
  }));
  $$('[data-native-share]').forEach(button => {
    button.hidden = typeof navigator.share !== 'function';
    button.addEventListener('click', async () => {
      if (typeof navigator.share !== 'function') return;
      button.disabled = true;
      try {
        await navigator.share({ title: $('h1')?.textContent.trim() || document.title, url: location.href });
        if (shareStatus) shareStatus.textContent = 'Article shared.';
      } catch (error) {
        if (shareStatus) shareStatus.textContent = error?.name === 'AbortError' ? '' : 'Sharing is unavailable. Use Copy link instead.';
      } finally { button.disabled = false; }
    });
  });

  $$('[data-embed-url]').forEach(button => button.addEventListener('click', () => {
    const container = button.closest('.article-embed');
    if (!container) return;
    try {
      const url = new URL(button.dataset.embedUrl);
      const hosts = ['youtube.com', 'www.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'];
      const match = /^\/embed\/([A-Za-z0-9_-]{11})\/?$/.exec(url.pathname);
      if (url.protocol !== 'https:' || !hosts.includes(url.hostname) || !match) throw new Error('Unsupported embed');
      const iframe = document.createElement('iframe');
      iframe.title = button.getAttribute('aria-label')?.replace(/^Load video:\s*/i, '') || 'YouTube video';
      url.searchParams.set('autoplay', '1');
      iframe.src = url.href;
      iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      iframe.allowFullscreen = true;
      iframe.referrerPolicy = 'strict-origin-when-cross-origin';
      iframe.tabIndex = 0;
      const link = document.createElement('a');
      link.href = 'https://www.youtube.com/watch?v=' + match[1];
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Watch on YouTube ↗';
      container.replaceChildren(iframe, link);
      iframe.focus({ preventScroll: true });
      queueScroll();
    } catch (_) {
      const message = document.createElement('p');
      message.textContent = 'This video cannot be loaded here. Use the original video link below.';
      message.setAttribute('role', 'status');
      button.replaceWith(message);
    }
  }));

  function updateScroll() {
    scrollPending = false;
    const maximum = Math.max(0, document.documentElement.scrollHeight - innerHeight);
    const ratio = maximum > 0 ? clamp(scrollY / maximum) : 0;
    document.documentElement.style.setProperty('--progress', String(ratio));
    if (progress) {
      progress.style.transform = 'scaleX(' + ratio + ')';
      if (progress.getAttribute('role') === 'progressbar') progress.setAttribute('aria-valuenow', String(Math.round(ratio * 100)));
    }
    header?.classList.toggle('scrolled', scrollY > 60);
    // The source switches to paper when IntroText reaches the viewport's top.
    // The state still updates with reduced motion; CSS disables the transition.
    if (articleIntro) body.classList.toggle('article-reading', articleIntro.getBoundingClientRect().top <= 1);
    if (!videoObserver) videos.forEach(video => {
      videoStates.get(video).visible = elementIsVisible(video);
      syncVideo(video);
    });
  }
  function queueScroll() {
    if (!scrollPending) { scrollPending = true; requestAnimationFrame(updateScroll); }
  }

  // Keep real document positions and native anchors; ease only ordinary mouse-wheel input.
  function stopWheel() {
    if (wheelFrame) cancelAnimationFrame(wheelFrame);
    wheelFrame = 0;
    wheelLast = 0;
    wheelTarget = scrollY;
  }
  function wheelTick(time) {
    if (paused || reduced.matches || document.hidden || pageHidden || mobileIsOpen() || searchIsOpen()) { stopWheel(); return; }
    const dt = wheelLast ? Math.min(50, time - wheelLast) : 16;
    wheelLast = time;
    wheelTarget = clamp(wheelTarget, 0, Math.max(0, document.documentElement.scrollHeight - innerHeight));
    const difference = wheelTarget - scrollY;
    if (Math.abs(difference) < .7) {
      scrollTo({ top: wheelTarget, behavior: 'instant' });
      wheelFrame = 0; wheelLast = 0;
      return;
    }
    scrollTo({ top: scrollY + difference * (1 - Math.exp(-dt / 75)), behavior: 'instant' });
    wheelFrame = requestAnimationFrame(wheelTick);
  }
  function needsNativeWheel(target) {
    if (!(target instanceof Element)) return false;
    if (target.closest('a, button, input, textarea, select, video, audio, iframe, summary, [contenteditable]:not([contenteditable="false"]), [role="slider"], [role="spinbutton"], [role="textbox"], [role="listbox"], [data-native-scroll], #cap-menu, #language-menu')) return true;
    for (let element = target; element && element !== body && element !== document.documentElement; element = element.parentElement) {
      if (element.scrollHeight > element.clientHeight + 1 && /auto|scroll|overlay/.test(getComputedStyle(element).overflowY)) return true;
    }
    return false;
  }
  addEventListener('wheel', event => {
    if (event.defaultPrevented || !event.cancelable || paused || reduced.matches || mobileIsOpen() || searchIsOpen()
      || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || !finePointer.matches || lastPointerType === 'touch'
      || event.sourceCapabilities?.firesTouchEvents || !event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY)
      || needsNativeWheel(event.target)) { stopWheel(); return; }
    const maximum = Math.max(0, document.documentElement.scrollHeight - innerHeight);
    if (!maximum) return;
    if (!wheelFrame) wheelTarget = scrollY;
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1);
    const target = clamp(wheelTarget + delta, 0, maximum);
    if (!wheelFrame && target === scrollY) return;
    event.preventDefault();
    wheelTarget = target;
    if (!wheelFrame) wheelFrame = requestAnimationFrame(wheelTick);
  }, { passive: false });
  addEventListener('pointerdown', event => { lastPointerType = event.pointerType; stopWheel(); }, { passive: true });
  addEventListener('pointermove', event => { if (event.pointerType === 'mouse') lastPointerType = 'mouse'; }, { passive: true });
  addEventListener('touchstart', stopWheel, { passive: true });
  document.addEventListener('focusin', stopWheel);
  addEventListener('scroll', queueScroll, { passive: true });
  addEventListener('resize', () => {
    stopWheel();
    if (innerWidth > 800 && mobileIsOpen()) {
      const needsFocus = mobileMenu.contains(document.activeElement);
      setMobileMenu(false);
      if (needsFocus) ($$('a', header).find(visibleFocusTarget))?.focus({ preventScroll: true });
    }
    queueScroll();
  }, { passive: true });
  document.addEventListener('keydown', event => {
    if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' ', 'Tab', 'Escape'].includes(event.key)) stopWheel();
    if (searchIsOpen()) return;
    if (event.key === 'Tab' && mobileIsOpen()) {
      const targets = [mobileButton, ...$$(focusableSelector, mobileMenu)].filter(visibleFocusTarget);
      if (targets.length) {
        event.preventDefault();
        const index = targets.indexOf(document.activeElement);
        const next = index < 0 ? (event.shiftKey ? targets.length - 1 : 0)
          : (index + (event.shiftKey ? -1 : 1) + targets.length) % targets.length;
        targets[next].focus();
      }
    }
    if (event.key === 'Escape') {
      const focus = mobileIsOpen() ? mobileButton : langMenu && !langMenu.hidden ? langButton : capMenu?.classList.contains('open') ? capButton : null;
      setMobileMenu(false); setCapMenu(false); setLanguageMenu(false);
      if (visibleFocusTarget(focus)) { event.preventDefault(); focus.focus({ preventScroll: true }); }
    }
  });
  document.addEventListener('visibilitychange', () => {
    stopWheel(); syncGIFs(); videos.forEach(syncVideo);
  });
  addEventListener('pagehide', () => {
    pageHidden = true;
    stopWheel(); syncGIFs(); videos.forEach(syncVideo);
  });
  addEventListener('pageshow', () => {
    pageHidden = false;
    videos.forEach(video => { videoStates.get(video).visible = elementIsVisible(video); });
    syncLock(); syncGIFs(); videos.forEach(syncVideo); queueScroll();
  });
  document.addEventListener('load', queueScroll, true);
  document.fonts?.ready.then(queueScroll).catch(() => {});

  body.classList.add('js-motion');
  if ('IntersectionObserver' in window) {
    revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting && !entry.target.closest('[hidden]')) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    }), { threshold: .08, rootMargin: '0px 0px -20px 0px' });
    reveals.forEach(element => revealObserver.observe(element));
    videoObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      const state = videoStates.get(entry.target);
      if (!state) return;
      state.visible = entry.isIntersecting;
      syncVideo(entry.target);
    }), { threshold: .08 });
    videos.forEach(video => videoObserver.observe(video));
  } else revealAll();
  if ('ResizeObserver' in window) {
    sizeObserver = new ResizeObserver(queueScroll);
    sizeObserver.observe(document.documentElement);
  }
  setCapMenu(false);
  setLanguageMenu(false);
  setMobileMenu(false);
  setMotion(userPaused, { persist: false });
  updateScroll();
})();
