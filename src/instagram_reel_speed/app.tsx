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

const MAX_ATTEMPTS = 6;
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
    pathname.includes('/reels/') ||
    pathname.includes('/stories/') ||
    ACCOUNT_REEL_URL_REGEX.test(pathname)
  );
}

function positionControl(vid: HTMLVideoElement, panel: IPanelResult) {
  const rect = vid.getBoundingClientRect();

  const panelRect = panel.wrapper.getBoundingClientRect();

  if (rect.bottom + panelRect.height > window.innerHeight) {
    panel.wrapper.style.top = window.innerHeight - panelRect.height + 'px';
  } else {
    panel.wrapper.style.top = rect.bottom + 'px';
  }

  if (rect.right + panelRect.width > window.innerWidth) {
    panel.wrapper.style.left = window.innerWidth - panelRect.width + 'px';
  } else {
    panel.wrapper.style.left = rect.left + 'px';
  }
}

function findPlayingVideo(): HTMLVideoElement | null {
  return (
    Array.from(document.querySelectorAll('video')).find((v) => !v.paused) ??
    null
  );
}

function update(panel: IPanelResult, vid: HTMLVideoElement) {
  setVid(vid);

  vid.playbackRate = getSpeed();

  vid.addEventListener(
    'ratechange',
    () => {
      const speed = getSpeed();
      if (smallDiff(vid.playbackRate, speed)) {
        return;
      }

      requestIdleCallback(() => {
        vid.playbackRate = speed;
      });
    },
    { once: true },
  );

  vid.addEventListener(
    'ended',
    () => {
      // Video ended, need to attach to the next one.
      attachNextVideo(panel);
    },
    { once: true },
  );

  requestIdleCallback(() => {
    panel.show();

    positionControl(vid, panel);
  });
}

function attachNextVideo(panel: IPanelResult, attempt = 0) {
  if (attempt > MAX_ATTEMPTS) {
    console.debug(
      `Failed to find next video after ${MAX_ATTEMPTS} attempts, giving up.`,
    );
    panel.hide();
    return;
  }

  setTimeout(() => {
    const vid = findPlayingVideo();

    if (vid) {
      update(panel, vid);
    } else {
      attachNextVideo(panel, attempt + 1);
    }
  }, 500);
}

function reset(panel: IPanelResult) {
  if (!isInstagramSingleMediaViewPath(window.location.pathname)) {
    panel.hide();
    return;
  }

  observe(document.body, () => {
    const vid =
      findPlayingVideo() ?? document.querySelector<HTMLVideoElement>('video');

    if (!vid) {
      panel.hide();
      return;
    }

    update(panel, vid);

    // We found a video, can stop observing.
    return true;
  });
}

function closeShareFollowDialog(root: Document | HTMLElement) {
  const dialog = root.querySelector('div[role="dialog"]');

  if (dialog) {
    console.log('added dialog', dialog);
  }

  if (
    dialog &&
    dialog.textContent?.toLowerCase().includes('shared this with you')
  ) {
    const buttons =
      dialog.querySelectorAll<HTMLButtonElement>('[role="button"]');

    const closeButton = Array.from(buttons).find((btn) =>
      btn.textContent.toLowerCase().includes('not now'),
    );

    if (closeButton) {
      closeButton.click();
    }
  }
}

function init() {
  const panel = getPanel({
    theme: 'dark',
    style: [globalCss, stylesheet].join('\n'),
  });
  panel.setMovable(true);

  const attachNext = () => attachNextVideo(panel);

  render(() => <SpeedControl />, panel.body);

  const debouncedPositionControl = debounce(() => {
    const vid = getVid();

    if (vid) {
      positionControl(vid, panel);
    }
  }, 100);

  window.addEventListener('resize', debouncedPositionControl, false);
  window.addEventListener('focus', debouncedPositionControl, false);
  window.addEventListener('load', debouncedPositionControl, false);

  document.addEventListener(
    'DOMContentLoaded',
    debouncedPositionControl,
    false,
  );

  closeShareFollowDialog(document.body);
  observe(
    document.body,
    (mutations: MutationRecord[]) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType !== Node.ELEMENT_NODE) {
              continue;
            }

            const el = node as HTMLElement;

            if (el.querySelector('div[role="dialog"]')) {
              closeShareFollowDialog(el);

              return true;
            }
          }
        }
      }
    },
    { childList: true, subtree: true },
  );

  window.addEventListener('popstate', attachNext, false);
  onNavigate(attachNext);

  reset(panel);
}

init();
