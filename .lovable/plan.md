

# Mobile UI/UX Readiness Audit -- Round 7 (Deep Dive)

## Mobile Design Thinking Maturity Assessment

| Phase | Rating | Justification |
|-------|--------|---------------|
| Empathize | High | Rounds 5-6 addressed key touch targets, spacing, and truncation. Remaining: Favorites back arrow lacks tap target sizing; search filter chips are below 44px. |
| Define | High | Primary actions are clear across all pages. Remaining: Orders page "Load More" has low visibility (same pattern fixed on seller dashboard in R6 but not here). |
| Ideate | High | Back navigation, draft saving, and undo patterns are solid. Remaining: Bulletin FAB position conflicts with floating cart bar at `bottom-24`. |
| Prototype | High | Confirmation dialogs on destructive actions are comprehensive. Remaining: Seller order action buttons use `size="sm"` in the fixed bottom bar, reducing tap safety for critical status changes. |
| Test | High | Toast feedback, skeletons, and reassurance messages are thorough. No new gaps identified. |

---

## Key Gaps

### Gap 1 -- Favorites Page Back Arrow Missing Tap Target (Empathize)
**File:** `src/pages/FavoritesPage.tsx` (lines 59-61)
**Issue:** The back arrow is a bare `<ArrowLeft size={22}>` inside a `<Link>` with no explicit width, height, or padding. Effective tap area is approximately 22x22px -- well below the 44px minimum. Compare to CartPage which correctly uses `w-8 h-8 rounded-full bg-muted`.
**User impact:** Users struggle to tap the back button, especially one-handed.
**Fix:** Wrap in a styled container: `className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-muted shrink-0"` and reduce icon to `size={18}`.

### Gap 2 -- Orders Page "Load More" Low Visibility (Define)
**File:** `src/pages/OrdersPage.tsx` (line 174)
**Issue:** Uses `variant="outline" size="sm"` -- the same low-visibility pattern that was fixed on `SellerDashboardPage.tsx` in Round 6. Inconsistent patterns create confusion.
**User impact:** Users may not notice the button, thinking all orders are loaded.
**Fix:** Change to `variant="secondary" size="default" className="w-full"` to match the seller dashboard pattern.

### Gap 3 -- Bulletin FAB Overlaps Floating Cart Bar (Ideate)
**File:** `src/pages/BulletinPage.tsx` (lines 206, 222)
**Issue:** The "Create Post" FAB uses `fixed bottom-24 right-4`. The floating cart bar uses `fixed bottom-16` with `pb-2`. When the cart has items, the FAB and cart bar overlap or sit too close together, creating tap confusion.
**User impact:** Accidental taps on the wrong element; visual clutter in a critical zone.
**Fix:** Increase FAB position from `bottom-24` to `bottom-28` to clear the cart bar consistently.

### Gap 4 -- Seller Order Action Bar Buttons Too Small (Prototype)
**File:** `src/pages/OrderDetailPage.tsx` (lines 424, 435)
**Issue:** The "Reject" and "Mark [Status]" buttons in the fixed bottom action bar use `size="sm"` (h-9, 36px). These are the most critical seller actions (accepting/rejecting orders) and should meet the 44px minimum for safe, deliberate taps.
**User impact:** Sellers may accidentally tap Reject instead of Accept, or miss the button entirely during busy periods.
**Fix:** Remove `size="sm"` (defaulting to `size="default"` which is h-10/40px) and add `h-12` for a comfortable 48px touch target on these critical actions.

### Gap 5 -- Search Filter Chips Below Minimum Tap Height (Empathize)
**File:** `src/pages/SearchPage.tsx` (lines 622-666)
**Issue:** Veg/Non-veg toggle buttons and sort shortcuts use `py-1.5` (6px vertical padding) with `text-xs` (12px), giving an effective height of ~30px. These are frequently tapped during browsing.
**User impact:** Mis-taps between adjacent filter chips while scrolling and browsing.
**Fix:** Increase from `py-1.5` to `py-2` for ~36px height (acceptable for inline filter chips in a horizontal scroll context).

---

## Implementation Priority

| Priority | Gap | Effort | Impact |
|----------|-----|--------|--------|
| 1 | Gap 4 -- Seller action bar buttons | Small | High (order safety) |
| 2 | Gap 1 -- Favorites back arrow | Small | High (navigation) |
| 3 | Gap 2 -- Orders Load More | Small | Medium (consistency) |
| 4 | Gap 3 -- Bulletin FAB position | Small | Medium (overlap) |
| 5 | Gap 5 -- Search filter chip height | Small | Low (browsing comfort) |

---

## Technical Details

### Gap 1 -- Favorites back arrow
In `FavoritesPage.tsx` (line 59-61):
```diff
- <Link to="/profile">
-   <ArrowLeft size={22} className="text-foreground" />
- </Link>
+ <Link to="/profile" className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-muted shrink-0">
+   <ArrowLeft size={18} />
+ </Link>
```

### Gap 2 -- Orders Load More
In `OrdersPage.tsx` (line 174):
```diff
- <Button variant="outline" size="sm" onClick={loadMore} disabled={isLoadingMore}>
+ <Button variant="secondary" size="default" className="w-full" onClick={loadMore} disabled={isLoadingMore}>
```

### Gap 3 -- Bulletin FAB position
In `BulletinPage.tsx` (lines 206, 222):
```diff
- className="fixed bottom-24 right-4 z-40 w-12 h-12 rounded-full shadow-lg"
+ className="fixed bottom-28 right-4 z-40 w-12 h-12 rounded-full shadow-lg"
```

### Gap 4 -- Seller action bar buttons
In `OrderDetailPage.tsx` (lines 424, 435):
```diff
- size="sm"
+ className="h-12"
```
Apply to both the Reject and next-status buttons.

### Gap 5 -- Search filter chip height
In `SearchPage.tsx` (lines 624, 637, 658):
```diff
- px-3 py-1.5 rounded-lg text-xs
+ px-3 py-2 rounded-lg text-xs
```
Apply to Veg, Non-veg, and sort shortcut buttons.

