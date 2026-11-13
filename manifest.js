'use strict';
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const workHero = document.querySelector('.work-hero');
  if (workHero) {
    const shapes = [...workHero.querySelectorAll('.work-arch-shape > i')];
    const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
    let time = 0, last = 0, frame = 0, visible = true;
    const running = () => visible && !document.hidden && !reduce.matches && !document.body.classList.contains('motion-paused');
    const draw = () => shapes.forEach((shape, index) => {
      // Match assets/hero.js: independent axis speeds, gentle wobble, and pointer tilt.
      const phase = time + index * 4;
      shape.style.transform = `rotateX(${.4 + phase * .12 + pointer.sy * .22}rad) rotateY(${-.35 + phase * .2 + pointer.sx * .32}rad) rotateZ(${Math.sin(phase * .21) * .18}rad)`;
    });
    const tick = now => {
      frame = 0;
      if (!running()) { last = 0; return; }
      const delta = Math.min(.05, last ? (now - last) / 1000 : .016);
      last = now;
      time += delta;
      const ease = 1 - Math.exp(-3.5 * delta);
      pointer.sx += (pointer.x - pointer.sx) * ease;
      pointer.sy += (pointer.y - pointer.sy) * ease;
      draw();
      frame = requestAnimationFrame(tick);
    };
    const sync = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      last = 0;
      if (running()) frame = requestAnimationFrame(tick);
    };
    window.addEventListener('pointermove', event => {
      if (!running()) return;
      const rect = workHero.getBoundingClientRect();
      pointer.x = Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1));
      pointer.y = Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1));
    }, { passive: true });
    reduce.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);
    new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); }).observe(workHero);
    draw();
    sync();
  }
  const ribbon = document.querySelector('.trust-carousel');
  if (ribbon) {
    const track = ribbon.querySelector('.trust-track');
    // Hover tint: a mask of each logo filled with a brand highlight color. Masks can't load
    // over file://, so the tint is skipped there and logos only grow on hover.
    if (location.protocol !== 'file:') {
      ribbon.querySelectorAll('.trust-mark > img').forEach((img) => {
        const tint = document.createElement('span');
        tint.className = 'trust-tint';
        tint.setAttribute('aria-hidden', 'true');
        tint.style.setProperty('--logo-mask', `url("${img.src}")`);
        img.after(tint);
        img.parentElement.classList.add('has-tint');
      });
    }
    const copy = ribbon.querySelector('.trust-group').cloneNode(true);
    copy.setAttribute('aria-hidden', 'true');
    copy.removeAttribute('aria-label');
    // The duplicate set stays clickable for the mouse but out of the tab order.
    copy.querySelectorAll('a').forEach((link) => link.setAttribute('tabindex', '-1'));
    track.append(copy);
    ribbon.classList.add('is-animated');
    const pause = ribbon.querySelector('.trust-pause');
    pause.hidden = false;
    let locallyPaused = false;
    const syncMotion = () => {
      const paused = locallyPaused || reduce.matches || document.body.classList.contains('motion-paused');
      ribbon.classList.toggle('is-paused', paused);
      pause.setAttribute('aria-pressed', String(paused));
      pause.setAttribute('aria-label', paused ? 'Resume logo carousel' : 'Pause logo carousel');
      pause.querySelector('[data-trust-pause-label]').textContent = paused ? 'Resume' : 'Pause';
      pause.querySelector('[aria-hidden]').textContent = paused ? '▶' : 'Ⅱ';
      pause.hidden = reduce.matches || document.body.classList.contains('motion-paused');
    };
    pause.addEventListener('click', () => { locallyPaused = !locallyPaused; syncMotion(); });
    reduce.addEventListener('change', syncMotion);
    new MutationObserver(syncMotion).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    syncMotion();
  }
  // Story cards are authored in HTML so every story remains readable without JavaScript.
  const stories = document.querySelector('.project-stories');
  if (stories) {
    const cards = [...stories.querySelectorAll('.story-card')];
    const previousPreview = stories.querySelector('.story-preview-prev');
    const nextPreview = stories.querySelector('.story-preview-next');
    let activeStory = 0;
    const showStory = (index, announce = true) => {
      activeStory = (index + cards.length) % cards.length;
      cards.forEach((card, i) => {
        const active = i === activeStory;
        card.classList.toggle('is-active', active);
        card.inert = !active;
        card.setAttribute('aria-hidden', String(!active));
      });
      [[previousPreview, -1], [nextPreview, 1]].forEach(([button, direction]) => {
        const card = cards[(activeStory + direction + cards.length) % cards.length];
        button.querySelector('img').src = card.querySelector('.story-logo').src;
        button.setAttribute('aria-label', 'Show ' + card.dataset.storyName + ' story');
      });
      stories.querySelector('.stories-count').textContent = String(activeStory + 1).padStart(2, '0') + ' / ' + String(cards.length).padStart(2, '0');
      if (announce) stories.querySelector('[data-story-status]').textContent = cards[activeStory].dataset.storyName + ', project ' + (activeStory + 1) + ' of ' + cards.length;
    };
    stories.querySelectorAll('[data-story-prev]').forEach(button => button.addEventListener('click', () => showStory(activeStory - 1)));
    stories.querySelectorAll('[data-story-next]').forEach(button => button.addEventListener('click', () => showStory(activeStory + 1)));
    stories.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const focusInCard = event.target.closest('.story-card');
      showStory(event.key === 'Home' ? 0 : event.key === 'End' ? cards.length - 1 : activeStory + (event.key === 'ArrowRight' ? 1 : -1));
      if (focusInCard) cards[activeStory].querySelector('.story-read').focus({ preventScroll: true });
    });
    let touchStart = null;
    const viewport = stories.querySelector('.stories-viewport');
    viewport.addEventListener('touchstart', event => {
      touchStart = event.touches.length === 1 && !event.target.closest('a, button') ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
    }, { passive: true });
    viewport.addEventListener('touchend', event => {
      if (!touchStart) return;
      const dx = event.changedTouches[0].clientX - touchStart.x;
      const dy = event.changedTouches[0].clientY - touchStart.y;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) showStory(activeStory + (dx < 0 ? 1 : -1));
      touchStart = null;
    }, { passive: true });
    viewport.addEventListener('touchcancel', () => { touchStart = null; }, { passive: true });
    showStory(0, false);
    stories.classList.add('is-ready');
    stories.querySelector('.stories-controls').hidden = false;
    previousPreview.hidden = nextPreview.hidden = false;
  }

  const quote = document.getElementById('featured-quote');
  const quotes = window.MANIFEST_TESTIMONIALS || [];
  let current = 0;
  let switching = false;
  function showQuote(direction) {
    if (!quote || !quotes.length || switching) return;
    switching = true;
    current = (current + direction + quotes.length) % quotes.length;
    const container = document.querySelector('.testimonial-content');
    const paused = reduce.matches || document.body.classList.contains('motion-paused');
    const update = () => {
      const item = quotes[current];
      quote.textContent = item.quote;
      document.getElementById('featured-name').textContent = item.name;
      document.getElementById('featured-role').textContent = item.role;
      const avatar = document.getElementById('featured-avatar');
      if (avatar && item.avatar) { avatar.src = './assets/' + item.avatar; avatar.alt = 'Headshot of ' + item.name; }
      document.querySelector('.testimonial-count').textContent = String(current + 1).padStart(2, '0') + ' / ' + String(quotes.length).padStart(2, '0');
      container.classList.remove('is-changing');
      switching = false;
    };
    if (paused) update();
    else { container.classList.add('is-changing'); setTimeout(update, 180); }
  }
  document.querySelector('.testimonial-prev')?.addEventListener('click', () => showQuote(-1));
  document.querySelector('.testimonial-next')?.addEventListener('click', () => showQuote(1));
  document.querySelector('.testimonial-feature')?.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight') { event.preventDefault(); showQuote(1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); showQuote(-1); }
  });

  const filters = [...document.querySelectorAll('[data-filter]')];
  const cards = [...document.querySelectorAll('[data-work-category]')];
  filters.forEach(button => button.addEventListener('click', () => {
    const category = button.dataset.filter;
    let count = 0;
    filters.forEach(item => {
      const selected = item === button;
      item.classList.toggle('is-active', selected);
      item.setAttribute('aria-pressed', String(selected));
    });
    cards.forEach(card => {
      const visible = category === 'all' || card.dataset.workCategory === category;
      card.hidden = !visible;
      if (visible) { count++; card.classList.add('is-visible'); }
    });
    const status = document.getElementById('work-filter-status');
    if (status) status.textContent = count + (count === 1 ? ' story' : ' stories') + ' shown' + (category === 'all' ? '.' : ' in ' + category + '.');
  }));

  // Preserve source animation behavior while ensuring content remains usable if a device lacks observers.
  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('.reveal').forEach(node => node.classList.add('is-visible'));
  }

  // Contact page: brand shapes orbit behind the headline (CSS), drift toward the pointer,
  // and the shape matching a hovered or focused topic swells into the center.
  const orbit = document.querySelector('.contact-orbit');
  if (orbit) {
    const stage = orbit.parentElement;
    const rings = [...orbit.children];
    const isPaused = () => reduce.matches || document.body.classList.contains('motion-paused');
    const spotlight = (active) => rings.forEach((ring, index) => {
      ring.classList.toggle('is-active', index === active);
      ring.classList.toggle('is-dim', active >= 0 && index !== active);
    });
    stage.querySelectorAll('.experience-tags a').forEach((topic, index) => {
      const on = () => spotlight(index);
      const off = () => spotlight(-1);
      topic.addEventListener('pointerenter', on);
      topic.addEventListener('focus', on);
      topic.addEventListener('pointerleave', off);
      topic.addEventListener('blur', off);
    });
    if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
      stage.addEventListener('pointermove', (event) => {
        if (isPaused()) return;
        const box = stage.getBoundingClientRect();
        orbit.style.setProperty('--px', `${((event.clientX - box.left) / box.width - .5) * 70}px`);
        orbit.style.setProperty('--py', `${((event.clientY - box.top) / box.height - .5) * 50}px`);
      });
      stage.addEventListener('pointerleave', () => {
        orbit.style.setProperty('--px', '0px');
        orbit.style.setProperty('--py', '0px');
      });
    }
  }

  // When index.html is opened straight from disk there is no server to map folder links
  // like ../work/ to ../work/index.html, so do it at click time (covers links added by scripts too).
  if (location.protocol === 'file:') {
    const openFolderIndex = event => {
      const link = event.target.closest?.('a[href]');
      if (!link) return;
      const url = new URL(link.href);
      if (url.protocol !== 'file:' || !url.pathname.endsWith('/')) return;
      url.pathname += 'index.html';
      link.href = url.href;
    };
    document.addEventListener('click', openFolderIndex, true);
    document.addEventListener('auxclick', openFolderIndex, true);
  }
})();
