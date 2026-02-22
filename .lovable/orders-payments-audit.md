
# Orders & Payments Module — Deep Audit Report

## Scope

5 pages, 14 components, 1 RPC function, 7 tables, 2 DB triggers, 1 edge function.

**Pages**: CartPage, OrdersPage, OrderDetailPage, FavoritesPage, MySubscriptionsPage

**Components**: ReorderButton, OrderCancellation, UrgentOrderTimer, OrderRejectionDialog, OrderItemCard, CouponInput, PaymentMethodSelector, RazorpayCheckout, ReviewForm, FulfillmentSelector, DeliveryStatusCard, OrderHelpSheet, OrderChat, FeedbackSheet

**Tables**: orders, order_items, cart_items, payment_records, reviews, favorites, coupons, coupon_redemptions

**DB Triggers**: validate_order_status_transition, enqueue_order_status_notification, enqueue_order_placed_notification, trg_update_seller_stats_on_order, decrement_stock_on_order, set_order_society_id, generate_delivery_code, trg_auto_assign_delivery

**RPC**: create_multi_vendor_orders

**Edge Function**: create-razorpay-order

---

## Feature & Rule Inventory

### Cart Management
- Cart items stored in `cart_items` table with `user_id`, `product_id`, `quantity`
- `society_id` auto-populated via `set_cart_item_society_id` trigger from user profile
- Quantity update to 0 triggers removal (UI-enforced)
- Remove item shows undo toast (optimistic update)
- Clear cart requires confirmation dialog
- RLS: user can only read/write own cart items within their society

### Checkout Flow
- Minimum order amount per seller enforced in UI (CartPage)
- Pre-checkout product availability validation queries products table
- Unavailable items flagged; cart refreshed with toast notification
- Confirmation dialog shows per-seller order summary
- Multi-seller cart creates separate orders via `create_multi_vendor_orders` RPC
- Submit guard prevents double-click (useSubmitGuard hook)
- Delivery fee: free above threshold (system_settings), applied to first order only in multi-vendor
- Fulfillment type selection (self_pickup/delivery) per seller

### Order Creation (create_multi_vendor_orders RPC)
- Validates buyer profile exists
- Groups cart items by seller_id
- Proportional coupon discount across items
- Platform fee from system_settings
- Cross-society distance via haversine_km
- Urgent orders get `auto_cancel_at = now() + 3min`
- Cart cleared atomically after all sub-orders created
- Idempotency key generated per order
- Payment record created with platform fee
- Stock decremented via `decrement_stock_on_order` trigger

### Payment
- COD default when seller has no `upi_id`
- UPI via Razorpay Route (create-razorpay-order edge function)
- Payment status webhook polling (15s timeout)
- Payment record tracks: amount, method, platform_fee, status

### Order Status Transitions (validate_order_status_transition trigger)
- Standard: placed → accepted → preparing → ready → picked_up → delivered → completed
- Service: enquired → quoted → accepted → scheduled → in_progress → completed
- Terminal: completed, cancelled, returned (no further transitions)
- Notifications auto-enqueued on status change

### Cancellation
- Buyer can cancel when status is `placed` or `accepted` only
- Reason required from predefined list; "other" requires text input
- `cancelled` is terminal (no undo possible)

### Urgent Orders
- Timer countdown from `auto_cancel_at` field
- Warning states at 60s and 30s
- Timeout triggers auto-cancel and refetch
- Sound hook for seller view (useUrgentOrderSound)

### Coupons
- Code uppercased and trimmed on input
- Society-scoped: seller + buyer must share society
- Validation: expiry, start date, usage limit, per-user limit, minimum order amount
- Percentage discount with max cap; flat discount capped at order total
- Multi-seller cart blocks coupon input in UI

### Reviews
- Available for `completed` AND `delivered` orders (FIXED — was completed-only)
- Rating required (1-5 stars)
- Duplicate blocked by DB unique constraint (order_id)
- Comment optional, max 500 chars
- Category-specific dimension ratings from category_config.review_dimensions
- RLS: buyer_id = auth.uid() AND order status IN (completed, delivered)
- society_id auto-set via trigger

### Favorites
- Stored in `favorites` table (user_id, seller_id, society_id)
- society_id auto-set via `set_favorite_society_id` trigger
- Filtered by user's home society (FIXED — was effectiveSocietyId)
- Only approved, available sellers displayed
- Remove with instant UI update (optimistic)

### Reorder
- Checks product availability before adding to cart
- Warns about existing cart items (confirm dialog)
- Clears existing cart on confirmation
- Skips unavailable items with count toast
- Navigates to /cart on success

### Order Detail
- Realtime subscription for order updates (postgres_changes)
- Chat available when order not completed/cancelled
- Unread message count badge on chat icon
- Copy order ID to clipboard
- Feedback prompt with localStorage flag
- Delivery status card for delivery fulfillment orders
- Bill summary shows discount and delivery fee breakdown

---

## Discovered Issues

### O1 — CRITICAL: Review RLS blocked reviews on "delivered" orders ✅ FIXED
- **Problem**: INSERT policy only allowed `orders.status = 'completed'`; UI also only checked `completed`
- **Impact**: If seller marks order `delivered` but never `completed`, buyer can never review
- **Fix**: Updated RLS policy to allow `completed` OR `delivered`; updated `canReview` in OrderDetailPage

### O2 — CRITICAL: Order cancellation "Undo" always fails ✅ FIXED
- **Problem**: Undo attempted `cancelled → placed` transition; DB trigger blocks this (terminal state)
- **Impact**: User sees "Could not undo cancellation" error after clicking Undo
- **Fix**: Removed undo action from cancellation toast; replaced with simple `toast.success`

### O3 — MEDIUM: Delivery fee inconsistency in multi-vendor orders (DOCUMENTED)
- **Problem**: `payment_records.amount` excludes delivery fee for order 1; `total_amount` includes it
- **Impact**: Delivery fee revenue unattributed in seller earnings
- **Status**: Document only — involves financial logic requiring product decision

### O4 — MEDIUM: Coupon applied only for single-seller carts (DOCUMENTED)
- **Problem**: RPC processes coupon params even for multi-seller carts if UI bypassed
- **Impact**: Low risk — UI prevents multi-seller coupon application
- **Status**: Document only

### O5 — LOW: Order cancellation undo UX misleads users ✅ FIXED (via O2)

### O6 — LOW: Favorites filtered by effectiveSocietyId ✅ FIXED
- **Problem**: Admin "view as" caused personal favorites to disappear
- **Fix**: Changed to `profile?.society_id` for consistent personal data

### O7 — INFO: Order items status lacks DB-level transition validation (DOCUMENTED)
- **Problem**: No trigger validates item status transitions
- **Impact**: UI prevents backward transitions; direct DB access could bypass
- **Status**: Not user-facing; document only
