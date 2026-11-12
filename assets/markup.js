'use strict';
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const ns = 'http://www.w3.org/2000/svg';
  const paths = {
    underline: 'M2 18 C24 10 65 14 98 9',
    squiggle: 'M2 18 Q8 2 15 16 T29 16 T43 16 T57 16 T71 16 T85 16 T98 13',
    circle: 'M91 8 C69 -1 24 0 8 8 C-8 17 5 29 44 28 C78 30 104 22 97 12 C93 6 77 3 65 3'
  };
  const marks = [];
  // Prefer meaningful words; never alter links, hidden accessible copies, or rotating headlines.
  const important = /\b(partnership|momentum|impact|progress|growth|innovation|connection|community|communities|founders|ambition|strategy|strategic|evidence|perspective|company|corner|matters|move|work|real)\b/gi;
  function annotate(element, kind, hero = false) {
    if (!element || element.querySelector('.copy-mark')) return;
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return node.textContent.trim() && !node.parentElement.closest('svg, .sr-only, [aria-hidden="true"], .headline-swap, .copy-mark, .link-arrow')
          ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    let selected;
    for (const node of nodes) {
      const matches = [...node.textContent.matchAll(important)];
      if (matches.length) selected = { node, match: matches[matches.length - 1] };
    }
    if (!selected) {
      const node = nodes[nodes.length - 1];
      if (!node) return;
      const matches = [...node.textContent.matchAll(/[\p{L}\p{N}][\p{L}\p{N}’'&+–-]*/gu)];
      if (!matches.length) return;
      selected = { node, match: matches[matches.length - 1] };
    }
    element.classList.add('has-copy-mark');
    const { node, match } = selected;
    const word = node.splitText(match.index);
    word.splitText(match[0].length);
    const mark = document.createElement('span');
    mark.className = 'copy-mark';
    mark.dataset.mark = kind;
    if (hero) mark.style.setProperty('--mark-delay', '450ms');
    word.replaceWith(mark);
    mark.append(word);
    const svg = document.createElementNS(ns, 'svg');
    svg.classList.add('copy-mark-art');
    svg.setAttribute('viewBox', '0 0 100 30');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', paths[kind]);
    svg.append(path);
    mark.append(svg);
    marks.push(mark);
    sizeStroke(mark);
  }

  // Use actual rendered coordinates: normalized dash lengths plus non-scaling
  // strokes produce broken segments in some browsers when the SVG stretches.
  function sizeStroke(mark) {
    const svg = mark.querySelector('svg');
    const box = svg.getBoundingClientRect();
    if (!box.width || !box.height) return;
    svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
    let coordinate = 0;
    const d = paths[mark.dataset.mark].replace(/-?\d+(?:\.\d+)?/g, value =>
      String(Number(value) * (coordinate++ % 2 ? box.height / 30 : box.width / 100)));
    const path = svg.querySelector('path');
    path.setAttribute('d', d);
    path.style.setProperty('--mark-length', String(path.getTotalLength() + 1));
  }

  annotate(document.querySelector('main h1'), 'squiggle', true);
  // Limit emphasis to editorial headings, not every card, person's name, or menu item.
  const headings = [...document.querySelectorAll('main h2')].filter(el =>
    !el.closest('.testimonial-card, .spark-card, .story-card, .project-card, .related-stories, dialog, .sr-only') &&
    !/^(share this page|explore our services|related work|more from the blog)$/i.test(el.textContent.trim())
  );
  headings.slice(0, 4).forEach((el, i) => annotate(el, ['underline', 'squiggle', 'circle', 'underline'][i]));
  document.querySelectorAll('.stat-value').forEach((el, i) => { if (i < 2) annotate(el, 'circle'); });
  // A small number of story titles add scroll accents to the archive without marking every card.
  if (!headings.length) {
    document.querySelectorAll('.spark-card h2').forEach((el, i) => { if (i < 2) annotate(el, i ? 'squiggle' : 'underline'); });
  }
  annotate(document.querySelector('.manifest-footer-nav > div:first-child h2'), 'circle');

  if ('ResizeObserver' in window) {
    const resize = new ResizeObserver(entries => entries.forEach(entry => sizeStroke(entry.target)));
    marks.forEach(mark => resize.observe(mark));
  }
  document.fonts?.ready.then(() => marks.forEach(sizeStroke));

  const syncMotion = () => document.documentElement.classList.toggle('markup-static',
    reduced.matches || document.body.classList.contains('motion-paused'));
  syncMotion();
  reduced.addEventListener('change', syncMotion);
  window.addEventListener('motionchange', syncMotion);
  new MutationObserver(syncMotion).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  if (!('IntersectionObserver' in window)) {
    marks.forEach(mark => mark.classList.add('is-drawn'));
    return;
  }
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      sizeStroke(entry.target);
      entry.target.classList.add('is-drawn');
      observer.unobserve(entry.target);
    });
  }, { threshold: .25 });
  marks.forEach(mark => observer.observe(mark));
})();
