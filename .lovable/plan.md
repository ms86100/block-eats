

# Buyer Journey Regression & Readiness Audit — Round 6

Post Rounds 1-5 (cumulative ~60 issues fixed). This audit focuses on residual gaps, regressions introduced by prior fix rounds, and previously unexamined edge cases and flows.

---

## Issue #1 — SellerDetailPage: Custom Cart Footer Overlaps BottomNav

**Scenario:** Buyer visits a seller page with items in cart from that seller.
**Expected:** Cart footer and bottom navigation are separate, non-overlapping UI elements.
**Actual:** `SellerDetailPage.tsx` lines 544-563 render a custom `fixed bottom-0` cart footer. `showNav={true}` (line 220) keeps the BottomNav visible. Both are z-50/fixed-bottom, causing overlap. The cart footer renders at `pb-[max(1rem,env(safe-area-inset-bottom))]` while BottomNav has its own `pb-[env(safe-area-inset-bottom)]`. On iOS, these visually collide.
**Failure Type:** UX — layout overlap
**Root Cause:** The custom cart footer does not account for BottomNav height. R5 restored `showNav={true}` but the custom footer was kept.
**Proposed Fix:** Remove the custom cart footer from `SellerDetailPage.tsx` (lines 543-564). The global `FloatingCartBar` is suppressed (`showCart={false}`), so either re-enable `showCart={true}` and remove the custom footer, or add `bottom-16` to the custom footer to sit above the BottomNav.

---

## Issue #2 — FulfillmentSelector Always Shows Both Options Regardless of Seller Mode

**Scenario:** Buyer adds product from a seller whose `fulfillment_mode` is `self_pickup` only → goes to cart → sees fulfillment selector.
**Expected:** Only "Self Pickup" option visible, or "Delivery" is disabled with explanation.
**Actual:** `FulfillmentSelector.tsx` renders both "Self Pickup" and "Delivery" buttons unconditionally. While `useCartPage.ts` auto-selects the correct default, the buyer can manually tap "Delivery" even if the seller doesn't support it. No validation prevents placing a delivery order for a pickup-only seller.
**Failure Type:** Functional — allows invalid fulfillment selection
**Root Cause:** `FulfillmentSelector` has no awareness of seller's `fulfillment_mode`. It always shows both options.
**Proposed Fix:** Pass a `sellerFulfillmentMode` prop to `FulfillmentSelector`. When mode is `self_pickup`, disable/hide the Delivery button. When mode is `delivery`, disable/hide the Self Pickup button.

---

## Issue #3 — Multi-Seller Cart: Fulfillment Mode Conflict Not Handled

**Scenario:** Buyer has items from Seller A (delivery only) and Seller B (self_pickup only) → goes to cart.
**Expected:** Clear indication that fulfillment modes differ, or split instructions.
**Actual:** `useCartPage.ts` line 50 only checks `firstSeller`'s `fulfillment_mode` to set the default. If Seller A is delivery-only and Seller B is pickup-only, the global fulfillment selection applies to both, which is incorrect.
**Failure Type:** Functional — invalid fulfillment for one seller in multi-cart
**Root Cause:** Single `fulfillmentType` state applied across all seller groups.
**Proposed Fix:** For multi-seller carts, either: (a) force `self_pickup` as the safe default and show a note, or (b) validate that all sellers support the selected mode before allowing checkout. Show a warning if modes conflict.

---

## Issue #4 — Empty Cart State Missing `showCart={false}` Prop

**Scenario:** Buyer navigates to cart → removes all items → empty cart state shown.
**Expected:** No FloatingCartBar visible since we're on the cart page.
**Actual:** `CartPage.tsx` line 25: the empty state `AppLayout` passes `showHeader={false}` but does NOT pass `showCart={false}`. The non-empty state (line 44) correctly passes `showCart={false}`. Since the cart is empty (itemCount === 0), the FloatingCartBar hides itself, so this is a latent issue that would surface if there's a race condition where items are removed server-side but the cart-count query hasn't updated yet.
**Failure Type:** UX — latent inconsistency
**Root Cause:** Missing `showCart={false}` on the empty-state AppLayout.
**Proposed Fix:** Add `showCart={false}` to line 25: `<AppLayout showHeader={false} showCart={false}>`.

---

## Issue #5 — Coupon Discount Not Recalculated When Cart Quantity Changes

**Scenario:** Buyer applies a percentage coupon (10% off) when cart total is ₹1000 (discount = ₹100) → increases item quantity → cart total becomes ₹1500.
**Expected:** Coupon discount recalculates to ₹150 (10% of ₹1500).
**Actual:** `appliedCoupon.discountAmount` is a static number set at application time in `CouponInput.tsx` line 115-116. When `totalAmount` changes due to quantity adjustments, the stored `discountAmount` remains the original value (₹100), not the recalculated ₹150.
**Failure Type:** Data inconsistency — stale coupon discount after cart modification
**Root Cause:** Coupon discount is calculated once at apply-time and stored as a static value, not recalculated reactively.
**Proposed Fix:** Either (a) store only `coupon.id`, `coupon.code`, `coupon.discount_type`, `coupon.discount_value`, and `coupon.max_discount_amount` in state and calculate the discount in `useCartPage` reactively based on current `totalAmount`, or (b) add a `useEffect` that recalculates `appliedCoupon.discountAmount` whenever `totalAmount` changes.

---

## Issue #6 — ReorderLastOrder Silently Replaces Cart Without Confirmation

**Scenario:** Buyer has items in cart → taps "Reorder from [seller]" on home page.
**Expected:** User sees a clear confirmation before their cart is cleared and replaced.
**Actual:** `ReorderLastOrder.tsx` line 74: the R5 fix replaced `window.confirm` with `toast.info('Replacing current cart with reorder items')`. The toast appears briefly but the cart is cleared immediately in line 95 (`await supabase.from('cart_items').delete().eq('user_id', user.id)`) without waiting for user acknowledgment. The buyer's existing cart is destroyed without consent.
**Failure Type:** UX — destructive action without confirmation
**Root Cause:** `toast.info` is non-blocking and doesn't wait for user action. The deletion proceeds immediately.
**Proposed Fix:** Use an `AlertDialog` (matching existing patterns in `CartPage.tsx`) that requires explicit "Replace Cart" / "Cancel" before proceeding. Keep the toast as a follow-up notification after confirmation.

---

## Issue #7 — Header NotificationBell Uses Direct DB Query Instead of React Query

**Scenario:** Buyer receives a notification while browsing → expects badge to update.
**Expected:** Badge updates via React Query cache invalidation (consistent with `useAppLifecycle`).
**Actual:** `Header.tsx` lines 48-71 use manual `useState` + `setInterval` polling (every 30s) for unread notification count. This is separate from any React Query cache and doesn't benefit from `useAppLifecycle`'s invalidation on app resume. It also creates a direct Supabase query that bypasses query deduplication.
**Failure Type:** Data inconsistency — notification count out of sync
**Root Cause:** Header manages notification state independently from React Query.
**Proposed Fix:** Create a `useUnreadNotificationCount` hook using React Query with key `['unread-notifications']` (already invalidated in `useAppLifecycle`). Replace the manual polling in Header with this hook.

---

## Issue #8 — SellerDetailPage Loading State Missing showCart/showNav

**Scenario:** Buyer navigates to a seller page, content is loading.
**Expected:** Loading skeleton shown with appropriate nav configuration.
**Actual:** `SellerDetailPage.tsx` line 192: loading state `<AppLayout showHeader={false}>` does not pass `showCart={false}`. The `FloatingCartBar` and `BottomNav` are visible during loading with default props. Once loaded, the page switches to `showCart={false}` (line 220). This causes a flash where the `FloatingCartBar` appears during load then disappears.
**Failure Type:** UX — UI flicker during loading
**Root Cause:** Loading and error states don't mirror the main render's AppLayout props.
**Proposed Fix:** Set `<AppLayout showHeader={false} showNav={true} showCart={false}>` consistently across loading, error, and main render states.

---

## Issue #9 — Place Order Button Disabled State Doesn't Cover Minimum Order Violation

**Scenario:** Buyer has items below the seller's minimum order amount → sees warning banner → taps "Place Order".
**Expected:** Button is visually disabled or the action is blocked before the confirm dialog.
**Actual:** `CartPage.tsx` line 216: the "Place Order" button is only disabled when `c.isPlacingOrder` is true. A buyer below minimum order can tap "Place Order", see the confirm dialog, tap "Confirm Order", and only THEN see a `toast.error` from `useCartPage.ts` line 126. The confirm dialog gives false confidence.
**Failure Type:** UX — misleading enabled state
**Root Cause:** No check for minimum order violations in the button's `disabled` prop.
**Proposed Fix:** Add `c.hasBelowMinimumOrder` to the disabled condition. Compute `hasBelowMinimumOrder` in `useCartPage` as `sellerGroups.some(g => ...)`.

---

## Issue #10 — No Payment Method Available: No User-Facing Explanation

**Scenario:** Multi-seller cart where all sellers don't accept COD and UPI is disabled for multi-seller.
**Expected:** Clear message explaining why checkout is blocked.
**Actual:** `PaymentMethodSelector.tsx` shows both methods as disabled with individual "Not available for this seller" text. But there's no aggregate message telling the buyer why BOTH are disabled or what they can do about it. The "Place Order" button remains active.
**Failure Type:** UX — confusing dead end
**Root Cause:** No aggregate check or messaging when no payment method is available.
**Proposed Fix:** In `CartPage.tsx`, add a condition: if `!c.acceptsCod && !c.acceptsUpi`, show a banner explaining "No payment method is available for this cart combination. Try ordering from each seller separately." Also disable the Place Order button.

---

## Issue #11 — OrdersPage OrderList fetchOrders Always Refires on location.key Change

**Scenario:** Buyer is on Orders page → navigates to order detail → presses back → returns to Orders.
**Expected:** Orders refetch once on back navigation.
**Actual:** `OrdersPage.tsx` lines 160-168: The `useEffect` tracks `location.key` AND `fetchOrders` in its dependency array. But `fetchOrders` is recreated by `useCallback` whenever `sellerId` changes (from SellerSwitcher). In the "selling" tab, switching sellers causes `fetchOrders` identity to change, triggering the effect. Combined with `location.key`, this can cause duplicate fetches.
**Failure Type:** Regression — potential duplicate API calls
**Root Cause:** `fetchOrders` in the dependency array causes re-execution whenever its reference changes.
**Proposed Fix:** Remove `fetchOrders` from the dependency array and use a ref pattern, or extract `sellerId` into the dependency array directly and call `fetchOrders()` inside the effect.

---

## Issue #12 — CategoryGroupPage "Not Found" When Using Direct Category Slug

**Scenario:** Buyer navigates directly to `/category/food` via URL or deep link.
**Expected:** Category group page loads with Food & Groceries content.
**Actual:** `CategoryGroupPage.tsx` line 59: `const parentGroup = category ? getGroupBySlug(category) : undefined;`. The `getGroupBySlug` function works correctly. However, the `enabled` condition for the products query (line 64) requires `!!category && !!effectiveSocietyId`. If `effectiveSocietyId` is `null` (user not yet loaded), the page shows "Category not found" before data loads.
**Failure Type:** UX — premature error state
**Root Cause:** The products query is disabled while `effectiveSocietyId` is loading, but the "not found" check at line 156 runs synchronously.
**Proposed Fix:** Gate the "not found" state behind `!groupsLoading && !configsLoading` AND check that auth context has finished loading (i.e., `effectiveSocietyId !== undefined`).

---

## Issue #13 — SellerDetailPage Products Don't Filter by approval_status on Seller Side

**Scenario:** Seller has a mix of approved and pending products.
**Expected:** Only approved products visible to the buyer.
**Actual:** `SellerDetailPage.tsx` line 81: Products query filters by `is_available=true` and `approval_status=approved`. This is CORRECT. No issue here. **However**, the `filteredProducts` at line 141 does not re-validate `approval_status` — if the cached products include a newly-rejected product that hasn't been re-fetched, it would still display. This is a stale-data edge case.
**Failure Type:** Data inconsistency — stale cache edge case
**Root Cause:** No realtime subscription or background refresh for seller products on buyer view.
**Proposed Fix:** Add `staleTime` configuration (e.g., 2 minutes) to the seller products fetch, or invalidate on focus.

---

## Issue #14 — ProductDetailSheet Similar Products Missing society_id Filter

**Scenario:** Buyer opens a product detail → scrolls to "Similar in [category]" section.
**Expected:** Similar products are from the same society (or cross-society if enabled).
**Actual:** `useProductDetail.ts` lines 52-55: The similar products query filters by `category`, `is_available`, `approval_status`, and excludes current product. But it does NOT filter by `society_id`. A buyer could see similar products from other societies they can't order from.
**Failure Type:** Data inconsistency — cross-society products shown without scoping
**Root Cause:** Missing society filter in similar products query. The R4 fix mentioned adding `society_id` filtering but looking at the current code, it's not there.
**Proposed Fix:** Add `.eq('seller:seller_profiles.society_id', effectiveSocietyId)` or filter client-side after fetching.

---

## Issue #15 — Confirm Dialog Shows "Cash on Delivery" When UPI Is Selected

**Scenario:** Buyer selects UPI payment → taps "Place Order" → confirm dialog opens.
**Expected:** Dialog shows "UPI" as the payment method.
**Actual:** `CartPage.tsx` line 228: `{c.paymentMethod === 'cod' ? 'Cash on Delivery' : 'UPI'}`. This is correct IF paymentMethod is properly set. However, due to the `useEffect` auto-selection (useCartPage line 43-46), there's a render cycle where `paymentMethod` could briefly be `'cod'` before the effect fires. The confirm dialog could show the wrong method if opened during this transition.
**Failure Type:** UX — potentially incorrect confirmation display (edge case)
**Root Cause:** Initial state is `'cod'` and the auto-select effect runs after first render.
**Proposed Fix:** Initialize `paymentMethod` lazily based on initial `acceptsCod`/`acceptsUpi` values, or guard the confirm dialog to not open until the payment method has settled.

---

## Issue #16 — Favorites Page Does Not Refresh on Back Navigation

**Scenario:** Buyer favorites a seller → navigates back to Favorites page.
**Expected:** Newly favorited seller appears in the list.
**Actual:** `FavoritesPage.tsx` line 16-19: `useEffect` only runs on initial mount (`[user]` dependency). There's no refresh mechanism on back navigation, no React Query usage, no `location.key` tracking. The favorites list is stale until full page remount.
**Failure Type:** Data inconsistency — stale favorites list
**Root Cause:** Manual state management with no back-navigation refresh.
**Proposed Fix:** Convert to React Query with appropriate `staleTime`, or add `location.key` tracking to refetch on back navigation.

---

## Issue #17 — Cart Item Undo Uses addItem Which Shows "Added to cart" Toast

**Scenario:** Buyer removes an item from cart → sees toast with "Undo" → taps "Undo".
**Expected:** Item silently restored to cart.
**Actual:** `CartPage.tsx` line 122: Undo calls `c.addItem(item.product as any)`. `addItem` in `useCart.tsx` line 139 calls `toast.success('Added to cart')`. So the buyer sees TWO toasts: the original "[Item] removed" and then "Added to cart" from the undo.
**Failure Type:** UX — duplicate/confusing toast sequence
**Root Cause:** `addItem` always shows a success toast, including when called from undo.
**Proposed Fix:** Add an optional `silent` parameter to `addItem` that suppresses the toast, or create a separate `restoreItem` function.

---

## Issue #18 — CouponInput Does Not Reset When Seller Changes

**Scenario:** Buyer has a single-seller cart, applies a coupon → adds item from different seller → coupon is cleared (R5 fix) → removes the second seller's items → back to single seller.
**Expected:** Coupon section shows fresh state, available coupons for the original seller.
**Actual:** The `appliedCoupon` is correctly cleared by the R5 effect. But `CouponInput.tsx` line 44-86 fetches available coupons based on `sellerId` prop. When the cart transitions from multi-seller back to single-seller, the `sellerId` changes back and `CouponInput` re-fetches. This is correct. However, the `code` input state (line 38) persists across remounts since it's the same component instance.
**Failure Type:** Minor UX — stale input text
**Root Cause:** Internal `code` state not reset when `sellerId` changes.
**Proposed Fix:** Add `key={sellerId}` to the `CouponInput` component in `CartPage.tsx` to force a remount on seller change.

---

## Issue #19 — ReorderButton in OrderCard Prevents Link Navigation

**Scenario:** Buyer taps on an order card that has a reorder row.
**Expected:** Tapping the reorder row triggers reorder; tapping elsewhere navigates to order detail.
**Actual:** `OrdersPage.tsx` line 83: `onClick={(e) => e.preventDefault()}` on the reorder row's parent `div`. This correctly prevents navigation when clicking the Reorder button. But if the buyer taps the empty space in the reorder row (not the button), navigation is still prevented with no action taken — a dead tap zone.
**Failure Type:** UX — dead tap zone
**Root Cause:** `e.preventDefault()` on the entire row, not just the button.
**Proposed Fix:** Move `e.stopPropagation()` (not `e.preventDefault()`) to the `ReorderButton` component's `onClick`, and remove the div-level handler.

---

## Issue #20 — SearchPage: Category/Product Not Found State Shows "Explore Marketplace" Link to Self

**Scenario:** Buyer searches for a product that doesn't exist.
**Expected:** Helpful empty state with actionable suggestion.
**Actual:** `SearchPage.tsx` shows results or empty results based on the search. But looking at line 67, the page has `showCart={false}`. If the buyer has items in cart, there's no way to access the cart from the search page since both the header cart icon and FloatingCartBar are hidden. The BottomNav still shows the Cart tab though.
**Failure Type:** UX — inconsistency in cart access
**Root Cause:** `showCart={false}` hides the FloatingCartBar but the BottomNav cart tab is still visible, creating an inconsistent experience.
**Proposed Fix:** Either show the FloatingCartBar on search (remove `showCart={false}`) or accept the inconsistency since BottomNav provides cart access.

---

## Issue #21 — OrderDetailPage: No Loading Guard for Order Items Display

**Scenario:** Buyer navigates to an order detail for an order with many items.
**Expected:** All items render correctly.
**Actual:** `OrderDetailPage.tsx` line 29: `const items = (order as any).items || [];`. The items are type-cast with `as any`. If the `order_items` relation fails to load (e.g., RLS issue), `items` silently defaults to `[]` and the order appears to have no items — no error is shown.
**Failure Type:** Data inconsistency — silent failure
**Root Cause:** No validation that items were actually loaded vs. genuinely empty.
**Proposed Fix:** Distinguish between "items loading failed" and "order has no items" by checking if the items field exists on the order response.

---

## Issue #22 — SellerDetailPage: No Skeleton/Loading for Products After Seller Loads

**Scenario:** Buyer navigates to seller page → seller info loads → products still loading.
**Expected:** Product section shows loading skeletons.
**Actual:** `SellerDetailPage.tsx`: Products are fetched in the same `Promise.all` as seller info (line 67). However, the `filteredProducts` display at line 493 just shows the products or "No products available" (line 528). If there's a brief moment between seller data arriving and products rendering, the "No products available" message flashes.
**Failure Type:** UX — potential flash of empty state
**Root Cause:** Both seller and products are fetched together, so this is unlikely in practice. But if products error silently, the user sees "No products available" with no retry option.
**Proposed Fix:** Add a "Retry" button to the empty products state, or handle the error case explicitly.

---

## Issue #23 — Clear Cart AlertDialog: Confirm Action Doesn't Reset Coupon

**Scenario:** Buyer applies a coupon → taps "Clear" → confirms "Clear All" in dialog.
**Expected:** Cart is cleared AND coupon is removed.
**Actual:** `CartPage.tsx` line 57: `onClick={c.clearCart}`. `clearCart` in `useCart.tsx` clears cart items but `useCartPage.ts` state `appliedCoupon` persists. If the buyer adds items back, the stale coupon state may cause incorrect pricing.
**Failure Type:** Data inconsistency — orphaned coupon state after cart clear
**Root Cause:** `clearCart` doesn't reset `appliedCoupon` in `useCartPage`.
**Proposed Fix:** In `CartPage.tsx`, wrap the clear action: `onClick={() => { c.setAppliedCoupon(null); c.clearCart(); }}`.

---

## Issue #24 — ProfilePage: No Pull-to-Refresh or Refresh Mechanism

**Scenario:** Buyer updates profile in a different session/device → opens profile page in the app.
**Expected:** Latest profile data displayed.
**Actual:** `ProfilePage.tsx` uses `useAuth()` which provides cached profile data from `AuthProvider`. There's no refresh button or pull-to-refresh mechanism on the profile page. The profile only refreshes on auth state change or app reload.
**Failure Type:** UX — stale profile data
**Root Cause:** Profile page relies solely on auth context cache with no manual refresh.
**Proposed Fix:** Add a refresh button that calls `refreshProfile()` from auth context, or implement React Query for profile data with appropriate staleness.

---

## Issue #25 — BottomNav Cart Badge Shows on Cart Page

**Scenario:** Buyer is on the cart page with items in cart.
**Expected:** Cart badge on BottomNav either hidden or contextually irrelevant on the cart page itself.
**Actual:** `BottomNav.tsx` line 59-61: The active state check highlights the Cart tab icon. Line 61: `const showCartBadge = to === '/cart' && itemCount > 0;`. The badge shows a number even while the buyer is actively on the cart page looking at those same items. This is redundant information.
**Failure Type:** UX — redundant badge on active page
**Root Cause:** No location-aware suppression of the cart badge.
**Proposed Fix:** Add `&& location.pathname !== '/cart'` to the `showCartBadge` condition. Or consider this acceptable since it confirms item count.

---

## Priority Matrix

| Priority | Issues |
|----------|--------|
| **P0 — Blocks functionality** | #2 (invalid fulfillment selection), #3 (multi-seller fulfillment conflict), #5 (stale coupon discount), #10 (no payment method, no message) |
| **P1 — Functional gaps** | #1 (footer overlap), #6 (cart replacement without confirmation), #9 (place order enabled below minimum), #14 (similar products cross-society), #23 (clear cart doesn't reset coupon) |
| **P2 — UX issues** | #4 (empty cart showCart), #7 (header notification sync), #8 (loading state flicker), #11 (duplicate fetches), #12 (premature not-found), #15 (confirm dialog flash), #16 (stale favorites), #17 (duplicate toast on undo), #18 (coupon input stale), #19 (dead tap zone), #25 (redundant badge) |
| **P3 — Minor** | #13 (stale seller products), #20 (search cart access), #21 (silent items failure), #22 (flash empty products), #24 (no profile refresh) |

