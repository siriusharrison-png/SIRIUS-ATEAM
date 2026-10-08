# Event Bubble Guard — Summary for Figma

**Type:** Chrome extension (Manifest V3), companion to the Figma **"HTML to Design"** extension
**Version:** 0.2.0
**Config:** Zero-config — always on, no toggle, no options

## Problem it solves

When using the Figma "HTML to Design" toolbar (Select element / Capture), clicking the toolbar dismisses any open overlay on the page — dropdowns, drawers, popovers — before you can capture it. This happens through two paths:

1. **Click-outside** — `mousedown`/`click` bubbles to `document`, triggering the page's `onClickOutside` / `onPointerDownOutside` handlers.
2. **Focus-steal** — the toolbar button takes focus, firing `focusout` on the overlay, triggering `onFocusOutside` (e.g. Radix).

Event Bubble Guard blocks both paths, but **only for events originating from the Figma toolbar host** (`<figma-html-to-design-toolbar>` / `[id^="__figma_h2d"]`). It calls `stopPropagation()` on the toolbar's pointer events and `preventDefault()` on focus-stealing ones (`mousedown`/`pointerdown`/`touchstart`), while leaving `click` intact so toolbar buttons still work. A `MutationObserver` guards the toolbar as soon as it is injected.

Because interception is scoped to the toolbar's own events, it has zero effect on the rest of the page — which is why it can safely run always-on with no switch.

## Limitations

- **Modal dialogs (not handled)** — True modals block everything outside themselves (`aria-hidden` on siblings + focus trap) by design; the toolbar can't be clicked while one is open. This is inherent to the dialog and the extension does not fight it.
- **Empty Figma "Capture page" result (out of scope)** — Caused by how the Figma extension serializes the page; unrelated to this extension (the behavior persists when it is disabled, and depends on whether the target page is capturable at all).
- **Scope** — Effective only for "click-outside to close" overlays (dropdowns, drawers, popovers).

## Compatibility

- Chromium browsers (Chrome / Edge), Manifest V3
- Requires the Figma "HTML to Design" browser extension
