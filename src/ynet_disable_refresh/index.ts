// Hack to enable the declare global.
export {};

declare global {
  interface Window {
    pageRefreshDisable?: () => void;
  }
}

function init() {
  console.log('user script');
  if (window.pageRefreshDisable) {
    window.pageRefreshDisable();

    console.info('User script: Article refresh disabled');
  }
}

if (
  document.readyState === 'complete' ||
  document.readyState === 'interactive'
) {
  init();
} else {
  document.addEventListener('DOMContentLoaded', init);
}
