

# Buyer Journey Regression & Readiness Audit — Round 3

Post Round 1 (14 issues fixed) and Round 2 (12 issues fixed). This audit focuses on remaining gaps, regressions introduced by prior fixes, and previously unexamined areas.

---

## Issue #1 — SellerDetailPage: `onSelectProduct` Not Passed to ProductDetailSheet

**Scenario:** Buyer navigates to a seller's page → taps a product → detail sheet opens → scrolls to "Similar Products" → taps one.
**Expected:** The detail sheet updates to show the tapped similar product.
**Actual:** `SellerDetailPage.tsx` line 566-572 renders `<ProductDetailSheet>` without passing `onSelectProduct`. The similar products section is dead UI on this page.
**Failure Type:** Functional — dead CTA (regression from incomplete Round 2 fix)
**Root Cause:** The Round 2 fix added `onSelectProduct` to `MarketplaceSection`, `SearchPage`, and `CategoryGroupPage`, but missed `SellerDetailPage` — one of the most important buyer surfaces.
**Proposed Fix:** In `SellerDetailPage.tsx` line 566, pass `onSelectProduct={(sp) => { setSelectedProduct({...}); }}` matching the pattern used in `CategoryGroupPage`.

---

## Issue #2 — SellerDetailPage: Duplicate Cart Footer Overlaps FloatingCartBar

**Scenario:** Buyer has items in cart → visits a seller detail page.
**Expected:** A single cart indicator is visible.
**Actual:** `SellerDetailPage.tsx` lines 544-563 render a custom fixed-bottom cart footer. Simultaneously, `AppLayout` renders `FloatingCartBar` (line 41) since `showCart` defaults to `true` and `SellerDetailPage` does not pass `showCart={false}`. Both bars are visible and overlap at the bottom of the screen.
**Failure Type:** UX — layout overlap, duplicate CTAs
**Root Cause:** `SellerDetailPage` renders its own cart bar but does not suppress the global `FloatingCartBar` via `showCart={false}`.
**Proposed Fix:** Either pass `showCart={false}` to `AppLayout` in `SellerDetailPage`, or remove the custom cart footer and rely on the global `FloatingCartBar`.

---

## Issue #3 — PaymentMethodSelector Does Not Auto-Select Available Method

**Scenario:** Buyer adds product from a UPI-only seller (accepts_cod=false, accepts_upi=true) → goes to cart → sees payment methods.
**Expected:** UPI is automatically selected since COD is unavailable.
**Actual:** `useCartPage.ts` line 19 always initializes `paymentMethod` to `'cod'`. The Round 2 fix added a guard in `handlePlaceOrderInner` that blocks COD if not accepted, but the UI still shows COD as the selected (highlighted with ring) method on initial render, even though it's disabled. The buyer must manually tap UPI.
**Failure Type:** UX — confusing default state
**Root Cause:** `useState<PaymentMethod>('cod')` does not react to `acceptsCod`/`acceptsUpi` values.
**Proposed Fix:** Add a `useEffect` that auto-selects UPI when `!acceptsCod && acceptsUpi`, e.g.:
```
useEffect(() => {
  if (!acceptsCod && acceptsUpi) setPaymentMethod('upi');
}, [acceptsCod, acceptsUpi]);
```

---

## Issue #4 — Cart Page Renders pb-44 Padding Even When Sticky Footer May Vary

**Scenario:** Buyer opens cart page on a device with large safe area insets (e.g., iPhone 15 Pro Max).
**Expected:** Content scrolls cleanly above the sticky footer with no overlap or excessive gap.
**Actual:** `CartPage.tsx` line 44 uses a hardcoded `pb-44` (176px) for bottom padding. The sticky footer (lines 205-217) has dynamic height based on `env(safe-area-inset-bottom)` and conditionally rendered elements (community text, Apple disclaimer). On smaller devices or when community text wraps to multiple lines, content may be hidden behind the footer. On devices with small safe areas, there's an unnecessary gap.
**Failure Type:** UX — layout inconsistency across devices
**Root Cause:** Hardcoded padding does not adapt to actual footer height.
**Proposed Fix:** Use a `ref` on the footer to measure its height and apply it as `paddingBottom` dynamically, or increase `pb-44` to a safer value like `pb-52` to cover worst-case scenarios.

---

## Issue #5 — FeaturedBanners Rendered Twice on Home Page

**Scenario:** Buyer opens Home page.
**Expected:** One set of featured banners appears.
**Actual:** `HomePage.tsx` line 102 renders `<FeaturedBanners />` directly. Then `MarketplaceSection.tsx` line 113 ALSO renders `<FeaturedBanners />`. Both are visible on the home page, resulting in duplicate banner carousels.
**Failure Type:** UX — duplicate content
**Root Cause:** `FeaturedBanners` is rendered both as a direct child of `HomePage` and inside `MarketplaceSection`.
**Proposed Fix:** Remove the `<FeaturedBanners />` from either `HomePage.tsx` line 102 or `MarketplaceSection.tsx` line 113. Since `MarketplaceSection` positions it between category grids and product listings (which seems intentional for layout flow), remove the one in `HomePage.tsx`.

---

## Issue #6 — ReorderButton (OrderCard) Bypasses Cart Query Invalidation

**Scenario:** Buyer taps "Reorder" on an order card → items are inserted into cart → navigates to cart page.
**Expected:** Cart shows the reordered items immediately.
**Actual:** `ReorderButton.tsx` line 98-102 inserts items directly via `supabase.from('cart_items').insert(cartInserts)` and then calls `navigate('/cart')`. It does NOT invalidate the `cart-items` or `cart-count` React Query cache. The cart page may show stale data (previous items or empty) until the query's `staleTime` (10 minutes per `useCart.tsx` line 48) expires.
**Failure Type:** Data inconsistency — stale cart after reorder
**Root Cause:** Direct DB operations bypass the React Query cache. Neither `ReorderButton` nor `ReorderLastOrder` call `queryClient.invalidateQueries({ queryKey: ['cart-items'] })`.
**Proposed Fix:** After successful insert in both `ReorderButton` and `ReorderLastOrder`, invalidate cart queries:
```
queryClient.invalidateQueries({ queryKey: ['cart-items'] });
queryClient.invalidateQueries({ queryKey: ['cart-count'] });
```

---

## Issue #7 — Coupon Discount Applied Before Delivery Fee in Final Amount Calculation

**Scenario:** Buyer has a `₹50` coupon, cart total is `₹80`, delivery fee is `₹30`.
**Expected:** Clear, consistent calculation: subtotal (80) - coupon (50) + delivery (30) = ₹60.
**Actual:** `useCartPage.ts` line 31: `const finalAmount = (appliedCoupon ? Math.max(0, totalAmount - appliedCoupon.discountAmount) : totalAmount) + effectiveDeliveryFee;`. If the coupon discount exceeds the subtotal, `Math.max(0, ...)` caps at 0, then delivery fee is added. This means for a ₹100 coupon on ₹80 subtotal with ₹30 delivery: the buyer pays ₹30 (delivery only). This might be intentional, but the bill details section (lines 161-165) doesn't show the capped discount clearly — it shows the full coupon amount which may exceed the subtotal, misleading the buyer.
**Failure Type:** UX — misleading bill breakdown
**Root Cause:** Bill details show raw `appliedCoupon.discountAmount` even if it exceeds the subtotal.
**Proposed Fix:** Cap the displayed discount to `Math.min(appliedCoupon.discountAmount, totalAmount)` in line 162.

---

## Issue #8 — OrderProgressOverlay Has No Timeout or Escape Hatch

**Scenario:** Buyer taps "Confirm Order" → overlay appears → backend RPC hangs or takes >30 seconds.
**Expected:** Overlay times out or provides a way to dismiss/retry.
**Actual:** `OrderProgressOverlay` (line 22) renders a full-screen overlay with "Please don't close this screen" text. There is no timeout, no cancel button, and no escape mechanism. If `createOrdersForAllSellers` hangs, the buyer is stuck on a spinner indefinitely. The only way out is to force-close the app.
**Failure Type:** UX — no escape from loading state
**Root Cause:** No timeout or dismiss mechanism in the overlay.
**Proposed Fix:** Add a timeout (e.g., 30 seconds) that shows a "This is taking longer than expected" message with a "Go back" button that calls `setIsPlacingOrder(false)`.

---

## Issue #9 — VerificationPendingScreen Uses `window.location.reload()` on Approval

**Scenario:** Buyer's account gets approved while they're on the verification pending screen.
**Expected:** Smooth transition to the home page with all state preserved.
**Actual:** `VerificationPendingScreen.tsx` line 35 calls `window.location.reload()` when approval is detected. This performs a hard page reload, losing all in-memory state, React Query cache, and triggering a full re-render of the entire app. On mobile (Capacitor), this can cause a flash of white screen.
**Failure Type:** UX — jarring transition
**Root Cause:** Full page reload instead of React state update.
**Proposed Fix:** Instead of `window.location.reload()`, call a `refetchProfile()` or `invalidateQueries` on the auth/profile query so React re-renders naturally. The `useAuth` hook should detect the new `verification_status` and re-render `HomePage` without a reload.

---

## Issue #10 — Empty Cart Page Back Arrow Always Links to Home

**Scenario:** Buyer navigates from Orders → Cart (via floating bar) → removes all items → empty cart page shown.
**Expected:** Back button returns to the previous page (Orders).
**Actual:** `CartPage.tsx` line 26 renders `<Link to="/">` — always navigates to Home regardless of navigation history. This breaks the expected back-navigation behavior.
**Failure Type:** UX — broken navigation context
**Root Cause:** Hardcoded `to="/"` instead of using `navigate(-1)` or the browser's history.
**Proposed Fix:** Replace `<Link to="/">` with a `<button onClick={() => navigate(-1)}>` or keep the link but add `useNavigate(-1)` behavior.

---

## Issue #11 — Multi-Seller Cart: Both COD and UPI Disabled

**Scenario:** Buyer has a multi-seller cart (2+ sellers). First seller accepts COD only, second seller accepts UPI only.
**Expected:** At least one payment method is available, or a clear message is shown.
**Actual:** `useCartPage.ts` line 36: `acceptsUpi` is forced to `false` for multi-seller carts (`sellerGroups.length <= 1 && ...`). `acceptsCod` (line 34) only checks the FIRST seller. If the first seller has `accepts_cod = false`, then both `acceptsCod` and `acceptsUpi` are `false`, leaving no payment method available. The buyer sees both payment options disabled with no explanation.
**Failure Type:** Functional — checkout blocked with no guidance
**Root Cause:** `acceptsCod` only considers the first seller, and `acceptsUpi` is unconditionally disabled for multi-seller carts.
**Proposed Fix:** For multi-seller carts with COD, check if ALL sellers accept COD: `const acceptsCod = sellerGroups.every(g => g.items[0]?.product?.seller?.accepts_cod ?? true)`. If no payment method is available, show a clear message explaining why and suggesting the buyer split their cart.

---

## Issue #12 — Delivery Fee Calculated on Pre-Coupon Amount

**Scenario:** Buyer has cart total ₹500, coupon discount ₹200, free delivery threshold ₹400.
**Expected:** Delivery fee based on final payable amount (₹300 after coupon), which is below threshold, so delivery fee applies.
**Actual:** `useCartPage.ts` line 30: `const effectiveDeliveryFee = fulfillmentType === 'delivery' ? (totalAmount >= settings.freeDeliveryThreshold ? 0 : settings.baseDeliveryFee) : 0`. Uses `totalAmount` (pre-coupon) not the post-coupon amount. In this scenario, ₹500 >= threshold so delivery is FREE, even though the buyer is only paying ₹300. This could be intentional (reward for total cart value), but it's inconsistent with what the buyer perceives.
**Failure Type:** Potential data inconsistency
**Root Cause:** Delivery fee threshold uses pre-coupon subtotal.
**Proposed Fix:** Document this as intended behavior if it is, or change to use post-coupon amount for the threshold comparison: `const effectiveSubtotal = appliedCoupon ? Math.max(0, totalAmount - appliedCoupon.discountAmount) : totalAmount`.

---

## Priority Matrix

| Priority | Issues |
|----------|--------|
| **P0 — Blocks functionality** | #5 (duplicate banners), #11 (no payment method available for mixed multi-seller) |
| **P1 — Functional gaps** | #1 (SellerDetail similar products dead), #2 (duplicate cart footers), #6 (stale cart after reorder), #8 (no overlay timeout) |
| **P2 — UX issues** | #3 (auto-select payment method), #4 (footer padding), #7 (misleading coupon display), #9 (hard reload on approval), #10 (back button always to home) |
| **P3 — Minor / Needs clarification** | #12 (delivery fee pre/post coupon — may be intentional) |

