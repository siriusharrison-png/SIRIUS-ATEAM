// Event Bubble Guard — isolates the Figma HTML-to-Design toolbar, preventing its events from disturbing the page.
//
// Problem: clicking the toolbar affects page overlays (dropdowns/drawers/dialogs) through two paths:
//   1) Click-outside: mousedown/click bubbles to document → triggers onClickOutside/onPointerDownOutside
//   2) Focus-steal: the toolbar button steals focus → overlay focusout → triggers onFocusOutside (Radix, etc.)
// Solution: intercept during the toolbar host's bubbling phase and also block the focus default action. Both paths are stopped.
//
// Design: fully automatic, no switch. Because interception applies only to events emitted by the toolbar host
// itself, it has zero impact on other page interactions — so "always on" has no side effects, and it avoids the
// contradiction of "toggling a switch causing the page to lose focus". Isolation begins when the toolbar appears
// and ends when it disappears.

// Toolbar host signature: custom tag + extension-injected id prefix, for redundancy.
const TOOLBAR_SELECTOR = 'figma-html-to-design-toolbar, [id^="__figma_h2d"]';

// Only guard the events that "click-outside to close" actually depends on; nothing more, to avoid interfering with the Figma plugin itself.
// Note: focusin/focusout are no longer guarded — focus-steal prevention is handled by the preventDefault on mousedown
// below (focus never leaves the page overlay at all), so intercepting focus-event propagation is redundant and would
// break the Figma plugin's internal focus tracking (especially when switching focus in DevTools).
const GUARDED_EVENTS = [
  "pointerdown",
  "mousedown",
  "click",
  "touchstart"
];

// Events that cause "focus-steal". Calling preventDefault on them keeps focus from leaving the page overlay,
// so onFocusOutside close logic is not triggered. Only the focus default action is cancelled; click is unaffected.
const FOCUS_STEALING = new Set(["mousedown", "pointerdown", "touchstart"]);

const guarded = new WeakSet();

function blockBubble(event) {
  // Block the "click-outside" path.
  event.stopPropagation();
  // Block the "focus-steal" path: cancel the focus default action, leave click alone, toolbar buttons stay clickable.
  // Not using stopImmediatePropagation, to avoid breaking the toolbar's own listeners.
  if (FOCUS_STEALING.has(event.type) && event.cancelable) {
    event.preventDefault();
  }
}

function guardToolbar(bar) {
  if (!(bar instanceof Element) || guarded.has(bar)) {
    return;
  }
  guarded.add(bar);
  for (const type of GUARDED_EVENTS) {
    // Third arg false = bubbling phase (the toolbar's own handlers run first, then we intercept).
    bar.addEventListener(type, blockBubble, false);
  }
}

function scanExisting() {
  document.querySelectorAll(TOOLBAR_SELECTOR).forEach(guardToolbar);
}

// The toolbar is injected only after being opened; use a MutationObserver to catch its appearance.
function start() {
  scanExisting();
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) {
          continue;
        }
        // The node itself is the toolbar, or contains it.
        if (node.matches?.(TOOLBAR_SELECTOR)) {
          guardToolbar(node);
        }
        node.querySelectorAll?.(TOOLBAR_SELECTOR).forEach(guardToolbar);
      }
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

start();
