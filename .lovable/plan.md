
# Orders & Payments Module — Deep Audit Plan

## Scope

5 pages, 8 components, 1 RPC function, 7 tables, 2 DB triggers, 1 edge function.

**Pages**: Cart, Orders, Order Detail, Favorites, Subscriptions

**Components**: ReorderButton, OrderCancellation, UrgentOrderTimer, OrderRejectionDialog, OrderItemCard, CouponInput, PaymentMethodSelector, RazorpayCheckout, ReviewForm, FulfillmentSelector, DeliveryStatusCard, OrderHelpSheet, OrderChat, FeedbackSheet

---

## Phase 1: Discovered Issues

### O1 -- CRITICAL: Review RLS blocks reviews on "delivered" orders

The `reviews` INSERT RLS policy enforces `orders.status = 'completed'`. However, the UI (`OrderDetailPage` line 160) shows the "Write Review" CTA when `order.status === 'completed'` -- this part works. But the `canReorder` check on line 162 includes `delivered`, and crucially, the `canReview` check on line 160 only checks `completed`. So reviews on `delivered` orders are NOT attempted from the UI. **However**, the separate `ReorderButton` appears for both `completed` and `delivered` -- this is correct behavior.

**Re-analysis**: After re-reading the code, `canReview` (line 160) is `isBuyerView && order.status === 'completed' && !hasReview`. This ONLY checks `completed`. So the CTA does NOT appear for `delivered`. But the order lifecycle has `delivered` as a non-terminal state (`delivered -> completed` is allowed). If a seller marks an order as `delivered` but never marks it `completed`, the buyer can NEVER leave a review. This is a business logic gap.

**Fix**: Update the RLS policy to also allow `orders.status = 'delivered'` and update `canReview` in `OrderDetailPage` to include `delivered`.

### O2 -- CRITICAL: Order cancellation "Undo" always fails

`OrderCancellation` (line 77-84) attempts to undo a cancellation by reverting `status` to `previousStatus`. The `validate_order_status_transition` trigger defines `cancelled` as a terminal state with `_allowed := ARRAY[]::text[]`. This means the undo UPDATE will always raise: `Invalid order status transition: cancelled -> placed`. The user sees "Order cancelled" toast with an Undo action that silently fails (the error is caught and shows "Could not undo cancellation").

**Fix**: Remove the Undo action from the cancellation toast, since the DB enforces cancellation as terminal. Alternatively, add a brief grace window in the trigger (within 5 seconds of cancellation), but this adds complexity.

### O3 -- MEDIUM: Delivery fee inconsistency in multi-vendor orders

In `create_multi_vendor_orders` RPC, the delivery fee is added to `total_amount` only for the first order (`_final_amount + _delivery_fee`), then `_delivery_fee := 0` for subsequent orders. However, the `payment_records.amount` is set to `_final_amount` (without delivery fee) for ALL orders. This means:
- Order 1: `total_amount = subtotal + delivery_fee`, `payment.amount = subtotal` (mismatch)
- Order 2+: `total_amount = subtotal`, `payment.amount = subtotal` (match)

The seller earnings page reads from `payment_records`, so the delivery fee revenue is unattributed.

**Fix**: The payment record for order 1 should include delivery fee in the amount, or delivery fee should be tracked separately. Document only -- no auto-fix since this involves financial logic.

### O4 -- MEDIUM: Coupon applied only for single-seller carts

When `sellerGroups.length > 1`, the UI shows "Coupons are not available for multi-seller carts" but the RPC still processes `_coupon_id` and `_coupon_discount` parameters if passed. If a user somehow bypasses the UI restriction, a coupon could be applied to a multi-seller cart. The redemption is only recorded for the first order.

**Status**: Low risk since the UI prevents it. Document only.

### O5 -- LOW: Order cancellation undo UX misleads users

Related to O2. The 5-second undo toast creates a false expectation. When clicked, the user sees "Could not undo cancellation" with no explanation. Users may think this is a bug.

**Fix**: Part of O2 fix -- remove the undo action entirely.

### O6 -- LOW: Favorites filtered by effectiveSocietyId

`FavoritesPage` line 41 filters favorites by `effectiveSocietyId`. If an admin uses "view as" another society, their personal favorites from their home society disappear. This is likely unintended for personal data.

**Fix**: Use `profile?.society_id` instead of `effectiveSocietyId` for favorites filtering.

### O7 -- INFO: Order items status has no DB-level transition validation

`OrderItemCard` allows sellers to change item status via a dropdown with forward-only transitions enforced in the UI (line 112: `isDisabled = statusIndex <= currentIndex`), but also allows jumping to `cancelled` (line 119). There is no database trigger validating item status transitions, unlike the order-level `validate_order_status_transition`. A direct DB update could set any status.

**Status**: Not a user-facing issue since the UI prevents backward transitions. Document only.

---

## Phase 2: Test Suite

Create `src/test/orders-payments.test.ts` with approximately 70-80 test cases covering:

**Cart Management**
- Add item requires authenticated user
- Add item optimistic update + server sync
- Update quantity to 0 triggers removal
- Remove item with undo toast
- Clear cart confirmation dialog
- Cart persists across page navigation
- society_id auto-set via trigger

**Checkout Flow**
- Minimum order amount per seller enforced
- Pre-checkout product availability validation
- Unavailable items flagged and cart refreshed
- Confirmation dialog shows correct summary
- Multi-seller cart creates separate orders
- Submit guard prevents double-click
- Delivery fee calculation: free above threshold
- Delivery fee applied only to first order in multi-vendor

**Order Creation (RPC)**
- `create_multi_vendor_orders` validates buyer profile exists
- Proportional coupon discount calculation
- Platform fee computation from system_settings
- Cross-society distance calculation
- Urgent orders get `auto_cancel_at = now() + 3min`
- Cart cleared atomically after order creation
- Idempotency key generated per order
- Payment record created with platform fee

**Payment**
- COD default selection when UPI unavailable
- UPI blocked when seller has no `upi_id`
- Razorpay checkout: success polls payment_status
- Razorpay checkout: failure does not update client-side
- Payment status webhook polling (15s timeout)

**Order Status Transitions**
- Valid: placed->accepted->preparing->ready->picked_up->delivered->completed
- Valid: enquired->quoted->accepted->scheduled->in_progress->completed
- Invalid: cancelled->anything (terminal)
- Invalid: completed->anything (terminal)
- Invalid: placed->preparing (skip not allowed)
- Seller: Accept, Prepare, Ready, Complete flow
- Seller: Reject with reason required
- Delivery orders at "ready": seller action bar shows "Awaiting delivery"

**Cancellation**
- Buyer can cancel when status is placed or accepted
- Buyer cannot cancel when preparing or later
- Cancellation reason required
- "Other" reason requires text input
- Undo action fails due to terminal state constraint (O2)

**Urgent Orders**
- Timer countdown from auto_cancel_at
- Timer shows warning states (60s, 30s)
- Timeout triggers refetch + toast
- Sound hook activated for seller view

**Coupons**
- Code uppercased and trimmed
- Society-scoped to seller + buyer society
- Expiry date check (past = rejected)
- Start date check (future = rejected)
- Usage limit enforced
- Per-user limit enforced via coupon_redemptions count
- Minimum order amount enforced
- Percentage discount with max cap
- Flat discount capped at order total
- Multi-seller cart blocks coupon input

**Reviews**
- Review CTA only for completed orders (NOT delivered -- O1)
- Rating required (1-5 stars)
- Duplicate review blocked by DB constraint
- Comment optional, max 500 chars
- Category-specific dimension ratings loaded from DB
- Review RLS: buyer_id = auth.uid() AND order completed

**Favorites**
- Add favorite requires auth
- Remove favorite with instant UI update
- Favorites filtered by society (O6)
- Only approved, available sellers shown

**Reorder**
- Checks product availability before adding to cart
- Warns about existing cart items (confirm dialog)
- Clears existing cart on confirmation
- Skips unavailable items with count toast
- Navigates to /cart on success

**Order Detail**
- Realtime subscription for order updates
- Chat available when order not completed/cancelled
- Unread message count badge
- Copy order ID to clipboard
- Feedback prompt with localStorage flag
- Delivery status card for delivery orders
- Bill summary shows discount and delivery fee

---

## Phase 3: Auto-Fixes

### Fix O1 (Critical) -- Review eligibility for delivered orders
1. Update `OrderDetailPage` line 160: change `canReview` to include `delivered`
2. Add migration: UPDATE reviews INSERT policy to allow `orders.status IN ('completed', 'delivered')`

### Fix O2 (Critical) -- Remove broken cancellation undo
In `OrderCancellation.tsx`, remove the `action` property from the cancellation toast (lines 75-91). Replace with a simple `toast.success('Order cancelled')`.

### Fix O6 (Low) -- Favorites society filtering
In `FavoritesPage.tsx` line 41, change `effectiveSocietyId` to `profile?.society_id` to show the user's own favorites regardless of admin view-as state.

---

## Phase 4: Deliverables

1. `.lovable/orders-payments-audit.md` -- Feature and Rule Inventory with all 7 issues
2. `src/test/orders-payments.test.ts` -- Full test suite (~75 tests)
3. Code fixes for O1, O2, O6
4. RLS migration for O1 (reviews)
5. Re-run all tests to verify no regressions
