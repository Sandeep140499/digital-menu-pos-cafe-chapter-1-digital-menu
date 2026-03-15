# Mobile viewport QA – why it works in DevTools but breaks on real iPhone

## What we saw

- Layout looks correct in **Chrome DevTools** responsive mode.
- On **real iPhone Safari**: layout shifts, cards overlap, bottom bar overlaps content, first card looks fine but scrolling feels broken.

## Root causes (QA analysis)

### 1. `100vh` vs dynamic viewport on iOS

- **Desktop / DevTools:** The viewport height is stable. `100vh` = visible area and doesn’t change while you scroll.
- **iPhone Safari:** The URL bar and bottom bar show/hide on scroll. Safari changes the “visible” viewport, so:
  - `100vh` is the **largest** viewport (with UI hidden), not the current visible area.
  - When the user scrolls, the browser recalculates layout and the “visible” height changes.
- **Result:** Content height and bottom padding are wrong, so the layout jumps and content can sit under the fixed cart bar.

**Fix:** Use **dynamic viewport height** so the layout follows the real visible area:

- `min-h-screen` → `min-h-[100dvh]`
- Any `100vh` / `80vh` → `100dvh` / `80dvh` where it affects page or modal height.

`dvh` = “dynamic viewport height” (updates when Safari’s UI shows/hides). Fallback: keep `100vh` for older browsers.

### 2. Fixed bottom cart bar and main content padding

- The cart bar is **fixed** at the bottom, so it doesn’t take space in the document flow.
- If main content only uses something like `pb-[max(12rem, calc(6rem+env(safe-area-inset-bottom)))]`, that value can change when Safari’s UI or safe area changes, and it wasn’t clearly tied to the bar height.
- **Result:** On iPhone, the last cards can sit **under** the cart bar, or the layout shifts when the bar/safe area is recalculated.

**Fix:**

- Reserve a **fixed** amount of space at the bottom of main so the bar never covers content:
  - e.g. `pb-[7.5rem]` (120px) on mobile so the fixed bar (~80px + safe area) always has room.
- Keep the bar’s own padding for safe area:  
  `pb-[max(1rem, calc(env(safe-area-inset-bottom)+80px))]` so the bar sits above the home indicator.

### 3. Category panel (popup) height and scroll

- If the category list uses a height based on `vh` or no `max-height`, on iPhone the panel can be too tall or scroll can feel wrong when the viewport height changes.
- **Result:** Modal/panel doesn’t fit the visible area, or scroll physics feel broken.

**Fix:**

- Give the scrollable part of the category panel a **dynamic** max height and internal scroll:
  - `max-h-[80dvh]` and `overflow-y: auto` on the list container.
- Same idea for other modals (e.g. Location, Cart): use `max-h-[80dvh]` instead of `80vh`.

### 4. Half / Full buttons too wide on small screens

- Fixed `min-width` (e.g. 72px) on both buttons can force the row to overflow on narrow phones.
- **Result:** Buttons get cut off or overlap the scrollbar.

**Fix:**

- On small devices: flexible width (e.g. `min-w-0 flex-1`), from `sm` up: fixed `min-w-[72px]` again so they stay readable and tappable.

---

## Summary of code changes

| Area | Change |
|------|--------|
| Page wrapper | `min-h-screen` → `min-h-[100dvh]` |
| Main content | Bottom padding → fixed reserve for cart bar: `pb-[7.5rem]` on mobile |
| Cart bar | Keep safe-area padding; main padding ensures content doesn’t sit under bar |
| Category panel list | `max-h-[80dvh]` + `overflow-y: auto` |
| Modals (Location, Cart) | `max-h-[80vh]` → `max-h-[80dvh]` |
| Half/Full buttons | Flexible width on mobile (`min-w-0 flex-1`), fixed from `sm` |
| Global / loading | `#root`, `.app-loading`, other full-height pages: use `100dvh` with `100vh` fallback |

---

## How to verify (QA checklist)

1. **Real device**
   - Test on **iPhone (Safari)** and optionally Android Chrome.
   - Not only Chrome DevTools device mode.

2. **Scroll**
   - Scroll the menu; URL bar show/hide should not cause layout jump or content under the cart bar.

3. **Bottom bar**
   - Last category cards should stay fully above the fixed cart bar with no overlap.

4. **Category panel**
   - Open a category with many items; list should scroll inside the panel with no viewport “jump” or broken scroll.

5. **Half/Full**
   - On a narrow width, both buttons should remain visible and tappable without horizontal overflow.

After these changes, the menu should behave correctly on iPhone 12/13, iPhone Safari, Android Chrome, and tablets when checked end-to-end on device.
