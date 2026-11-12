'use strict';
(() => {
  const root = document.documentElement;
  const system = matchMedia('(prefers-color-scheme: dark)');
  let preference;
  try { preference = localStorage.getItem('manifest-theme'); } catch (_) {}
  const apply = theme => {
    const dark = theme === 'dark';
    root.dataset.theme = dark ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#181716' : '#f5f0eb');
    const button = document.querySelector('.theme-toggle');
    if (button) {
      button.hidden = false;
      button.setAttribute('aria-pressed', String(dark));
      button.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
    }
  };
  const sync = () => apply(preference === 'dark' || preference === 'light' ? preference : system.matches ? 'dark' : 'light');
  sync();
  system.addEventListener('change', sync);
  window.addEventListener('storage', event => {
    if (event.key === 'manifest-theme' || event.key === null) {
      preference = event.newValue;
      sync();
    }
  });
  document.addEventListener('DOMContentLoaded', () => {
    sync();
    document.querySelector('.theme-toggle')?.addEventListener('click', () => {
      preference = root.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('manifest-theme', preference); } catch (_) {}
      sync();
    });
  });
})();
