'use strict';
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
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
