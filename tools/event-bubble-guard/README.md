# Event Bubble Guard

A Chrome extension. When used alongside the Figma **"HTML to Design"** extension, clicking the floating Figma toolbar at the top of the page no longer dismisses dropdowns, drawers, popovers, or other overlays you have open on the page.

> Background: When using the Figma toolbar's Select element / Capture, if the page has an open dropdown or drawer, clicking the toolbar makes the page close it — so you can't select it. This extension fixes that.

---

## Install (~1 minute)

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** (top left)
4. Select this folder (the one containing `manifest.json`)
5. "Event Bubble Guard" appears in the list — installed

It works immediately. **No switch, no configuration.**

## Usage

Just use the Figma "HTML to Design" toolbar as normal:

- Open a dropdown, drawer, or popover on the page
- Click a button on the Figma toolbar → the overlay stays open and can be selected

## Scope (read first)

- ✅ **Works:** ordinary dropdowns, drawers, popovers (overlays that "close on outside click")
- ⚠️ **Does not work / not handled:**
  - **Modal dialogs:** These are designed to block everything outside themselves (adding `aria-hidden` to siblings and trapping focus), which makes the toolbar unclickable while the dialog is open. This is inherent to the dialog; the extension does not fight it.
  - **Figma's Capture page returns empty:** This is how the Figma extension serializes the page — unrelated to this extension (the behavior persists with this extension disabled, and depends on whether the target page can be captured by Figma at all).

---

## How it works (optional reading)

The content script acts only on the Figma toolbar host element `<figma-html-to-design-toolbar>`, during the **bubbling phase**, doing two things:

- `stopPropagation()` — the event no longer bubbles up to the page `document`, so the page's onClickOutside / onPointerDownOutside never receives a signal and the overlay is not closed as an "outside click";
- `preventDefault()` on pointer-down events like `mousedown` — prevents the toolbar from stealing focus away from the page overlay, avoiding the onFocusOutside behavior of libraries like Radix. `click` is unaffected, so toolbar buttons work as usual.

Because interception applies only to events emitted by the toolbar itself, it has zero impact on other page interactions — which is why it is fully automatic, always on, and switch-free.

## Files

| File | Purpose |
| --- | --- |
| `manifest.json` | Extension manifest |
| `content/content.js` | Core logic (isolating toolbar events) |
| `test/harness.html` | Local self-test page for verifying the isolation logic; not needed for normal use |
| `README.md` | This document |

## Compatibility

- Chromium-based browsers (Chrome / Edge, etc.), Manifest V3
- Requires the Figma "HTML to Design" browser extension
