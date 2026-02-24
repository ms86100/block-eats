

## Category Page Cosmetic Transformation Plan

This is a purely visual overhaul of the Category page to match the Blinkit dark retail aesthetic described in your prompt. No functionality, data flow, or logic changes.

### Files to modify

**1. `src/pages/CategoryPage.tsx`** — Page layout and structure
- Widen left sidebar from 72px to ~100px
- Enlarge sidebar thumbnails from 44px (w-11) to 60px
- Update header: larger title (18px, font-semibold), dark circular back button (#333), remove search from header row (move to separate row or keep as-is but restyle)
- Filter bar pills: full pill shape (rounded-full), darker backgrounds (#333), white text, larger padding
- Subcategory chips: same pill treatment
- Product grid gap: increase to 10-12px
- Sidebar: darker background (`bg-[#0A0A0A]` in dark mode via class), green left border for active item, gray text for inactive

**2. `src/components/product/ProductListingCard.tsx`** — Product card redesign
- Card background: dark (#1C1C1C) via existing `bg-card`
- Card border-radius: 12px
- Image area: warm beige/cream background (`bg-[#FFF8E7]` or contextual class), rounded top only, aspect-ratio square, `object-contain` with padding
- Badges: teal "Bought Earlier" style, positioned top-left
- Veg badge: keep top-right
- Product name: white, 14px, font-medium, line-clamp-2
- Delivery time: orange clock icon + bold uppercase text
- Discount: colored text above price
- Price: bold 16px white, MRP strikethrough in gray
- Price per unit: small gray text below
- ADD button: vibrant green (#0FA84F), full-width or centered, 38-42px height, white bold text, rounded-lg
- Quantity stepper: same green, `[-] [1] [+]` layout

**3. `src/index.css`** — CSS variable tweaks (dark mode only)
- `--card`: adjust to `0 0% 12%` (~#1E1E1E) for slightly darker cards
- Add a utility class `.product-image-bg` for the warm beige image container
- No changes to light mode

### What stays the same
- All data fetching, filtering, sorting, cart logic
- All hooks, queries, and state management
- Navigation and routing behavior
- ProductListingCard memo comparator and analytics
- FloatingCartBar component (already styled correctly)

### Technical details

The changes are scoped to Tailwind classes and a few inline style overrides. The warm beige image background will use a utility class that only applies in dark mode, falling back to `bg-muted` in light mode. Sidebar width increase uses `w-[100px]`. Active sidebar indicator uses existing `bg-primary` (green) left border, widened to 4px. Filter pills switch from `rounded-md` to `rounded-full` with increased padding.

No new dependencies. No database changes. No new components.

