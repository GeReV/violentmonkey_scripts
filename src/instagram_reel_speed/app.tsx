import { For, render } from 'solid-js/web';
import { classNames, getPanel, IPanelResult } from '@violentmonkey/ui';
import { onNavigate } from '@violentmonkey/url';
// global CSS
import globalCss from './style.css';
// CSS modules
import styles, { stylesheet } from './style.module.css';
import { createEffect, createSignal } from 'solid-js';
import { debounce } from '../utils';
import { observe } from '@violentmonkey/dom';

const ACCOUNT_REEL_URL_REGEX = /^\/\w+\/reel\//;

function smallDiff(a: number, b: number) {
  return Math.abs(a - b) < 1e-6;
}

const [getVid, setVid] = createSignal<HTMLVideoElement | null>(null);
const [getSpeed, setSpeed] = createSignal(1);

function SpeedControl() {
  // Set video's playbackRate when speed or video changes.
  createEffect(() => {
    const vid = getVid();
    const speed = getSpeed();

    // Use an idle callback to apply the change, because otherwise it doesn't seem to work.
    // Seems to still miss occasionally.
    // Possibly Instagram code sets speed right before play?
    requestIdleCallback(() => {
      if (vid) {
        vid.playbackRate = speed;
      }
    });
  });

  const handleClick = (speed: number, _ev: MouseEvent) => {
    setSpeed(speed);
  };

  return (
    <div class={styles.container}>
      <For each={[1, 1.5, 1.75, 2]}>
        {(item) => (
          <button
            class={classNames([
              styles.btn,
              smallDiff(getSpeed(), item) && styles.btn_selected,
            ])}
            onclick={[handleClick, item]}
          >
            &times;{item}
          </button>
        )}
      </For>
      <span>&times;{getSpeed()}</span>
    </div>
  );
}

function isInstagramSingleMediaViewPath(pathname: string) {
  return (
    pathname.startsWith('/p/') ||
    pathname.includes('/reel/') ||
    pathname.includes('/stories/') ||
    ACCOUNT_REEL_URL_REGEX.test(pathname)
  );
}

function positionControl(vid: HTMLVideoElement, panel: IPanelResult) {
  const rect = vid.getBoundingClientRect();

  panel.wrapper.style.top = rect.bottom + 'px';
  panel.wrapper.style.left = rect.left + 'px';
}

function reset(panel: IPanelResult) {
  if (!isInstagramSingleMediaViewPath(window.location.pathname)) {
    panel.hide();
    return;
  }

  observe(document.body, () => {
    const vid = document.querySelector<HTMLVideoElement>('video');

    if (!vid) {
      panel.hide();
      return;
    }

    requestIdleCallback(() => {
      positionControl(vid, panel);

      setVid(vid);

      const speed = getSpeed();
      if (vid) {
        vid.playbackRate = speed;
      }

      panel.show();
    });

    // We found a video, can stop observing.
    return true;
  });
}

function init() {
  const panel = getPanel({
    theme: 'dark',
    style: [globalCss, stylesheet].join('\n'),
  });
  panel.setMovable(true);

  const resetPanel = () => reset(panel);

  render(() => <SpeedControl />, panel.body);

  const debouncedPositionControl = debounce(() => {
    const vid = getVid();

    if (vid) {
      positionControl(vid, panel);
    }
  }, 100);
  window.addEventListener('resize', debouncedPositionControl, false);
  window.addEventListener(
    'focus',
    () => {
      const vid = getVid();
      const rect = vid?.getBoundingClientRect();

      if (rect?.top == 0 && rect?.left == 0) {
        positionControl(vid, panel);
      }
    },
    false,
  );

  window.addEventListener('popstate', resetPanel, false);
  onNavigate(resetPanel);
  resetPanel();
}

init();
