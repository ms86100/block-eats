

# Platform Stability & Trust Audit — Round 3

Assessment date: 2026-03-01. Code reviewed AS-IS. No new features proposed.

---

## A. Critical Risk Areas

### P0 — Immediate Production Risk

**P0-1: Razorpay webhook can mark a cancelled order as `paid`**
- **Component**: `razorpay-webhook/index.ts` line 160-166, `useCartPage.ts` lines 278-289
- **What can break**: When Razorpay payment fails, `handleRazorpayFailed` immediately cancels all pending orders client-side (`status: 'cancelled'`). But the webhook `payment.captured` handler (line 160) updates orders with `.eq('id', orderId)` — it does NOT check `status != 'cancelled'`. If the buyer dismisses Razorpay (triggering cancel), then Razorpay actually captures the payment a few seconds later (real scenario with UPI delays), the webhook sets `payment_status: 'paid'` on a cancelled order. The buyer sees "cancelled" but was charged.
- **Who**: Buyer (charged for a cancelled order)
- **Why it matters**: Financial dispute. The `auto-cancel-orders` function won't catch it because the order is already `cancelled`, not `placed`.
- **Fix**: Add `.neq('status', 'cancelled')` to the webhook's order update query at line 165. If the order was already cancelled, log and skip.

**P0-2: Delivery OTP uses `Math.random()` — not `crypto.getRandomValues()`**
- **Component**: `manage-delivery/index.ts` line 18-20
- **What can break**: The delivery OTP (which gates parcel handover) uses `Math.floor(1000 + Math.random() * 9000)`. This was fixed for visitor OTPs (P2-3 in prior audit) but the delivery function was missed. With only 9000 combinations and no server-side rate limit on OTP verification attempts beyond the 5-attempt lockout, this is brute-forceable.
- **Who**: Buyer (delivery fraud), Platform (trust)
- **Why it matters**: A malicious delivery partner could brute-force the OTP before the lockout kicks in with a scripted attack.
- **Fix**: Replace with `crypto.getRandomValues()` pattern identical to the visitor OTP fix.

**P0-3: `manage-delivery` webhook HMAC verification uses non-constant-time comparison**
- **Component**: `manage-delivery/index.ts` line 36-48
- **What can break**: `verifyHMAC` uses `===` to compare base64 signatures (line 44). This was explicitly fixed in `gate-token` (C5 from prior audit) and `razorpay-webhook`, but `manage-delivery` was missed. Timing attacks on the 3PL webhook endpoint could allow signature forgery.
- **Who**: Platform (spoofed delivery status updates)
- **Fix**: Replace `===` with byte-level XOR comparison, matching the pattern in `gate-token/index.ts` line 57-67.

### P1 — High Risk, Likely to Cause Support Tickets

**P1-1: `handleRazorpayFailed` cancels orders without checking if webhook already marked them `paid`**
- **Component**: `useCartPage.ts` lines 278-289
- **What can break**: The client cancels orders with `.eq('payment_status', 'pending')`, which is correct. But between the Razorpay failure callback and the Supabase update, the webhook could have already set `payment_status: 'paid'`. The `.eq('payment_status', 'pending')` guard protects against this specific case. However, if there's a network delay on the client side, the user sees "Payment was not completed. Your order has been cancelled" toast even though the order may actually be paid. No mechanism to re-check.
- **Who**: Buyer (confused by misleading toast)
- **Fix**: After the cancel attempt, re-fetch the order's `payment_status`. If it's `paid`, show "Payment verified! Your order is confirmed." instead.

**P1-2: `process-notification-queue` retries push delivery but in-app notification is already inserted**
- **Component**: `process-notification-queue/index.ts` lines 52-65 and 97-99
- **What can break**: The in-app notification is inserted (line 53-61) BEFORE attempting push delivery (line 71). If push fails and the item is retried, the in-app notification has already been created. On the next retry, a second in-app notification is inserted (no deduplication). The user sees duplicate entries in their notification inbox.
- **Who**: All users (duplicate notifications)
- **Fix**: Use `upsert` with a unique constraint on `(user_id, type, reference_path, created_at::date)`, or move the in-app insert after the push succeeds, or add an `INSERT ... ON CONFLICT DO NOTHING` using `notification_queue.id` as a reference key.

**P1-3: Cart query returns items with unavailable products filtered client-side only**
- **Component**: `useCart.tsx` line 48
- **What can break**: The cart query fetches ALL cart items, then filters out `is_available === false` on the client. This means the `itemCount` badge on the cart icon shows the server count, but the actual rendered items may be fewer. If a product becomes unavailable between page loads, the count badge shows "3" but the cart page shows 2 items.
- **Who**: Buyer (confusing count discrepancy)
- **Fix**: Add `.eq('product.is_available', true)` to the server query, or update the `cart-count` query to use the same filter.

**P1-4: `create-razorpay-order` uses service role key for `auth.getUser(token)` — security risk**
- **Component**: `create-razorpay-order/index.ts` lines 51-53, 73
- **What can break**: The function creates a service role client (line 52) but uses it to call `auth.getUser(token)` (line 73). With the service role key, `getUser` bypasses JWT verification — any valid-looking token structure would be accepted. This means a malicious actor with a crafted JWT could create Razorpay orders for any user.
- **Who**: Platform (fraudulent orders)
- **Fix**: Use an anon-key client for auth validation (like `withAuth` from `_shared/auth.ts`), or create a separate user-scoped client for the auth check. Keep the service role client only for DB operations.

### P2 — Medium Risk

**P2-1: Worker skills stored as JSON blob without validation**
- **Component**: `useWorkerRegistration.ts` line 141
- **What can break**: `skills: { name: name.trim(), phone: phone || null }` is stored as a JSON blob. The `name` and `phone` of the worker are embedded in `skills` rather than as first-class columns. If the worker data is ever queried for display (e.g., guard kiosk showing worker name), the caller must know to extract from the `skills` JSON. Any code reading `worker.name` directly will get `null`.
- **Who**: Admin, Security (worker lookup fails)
- **Fix**: This is a schema design choice, not a bug. But add a comment documenting that worker name/phone are in the `skills` JSON field, not top-level columns.

**P2-2: `useOrderDetail` fetches review status on every order load without caching**
- **Component**: `useOrderDetail.ts` line 122-123
- **What can break**: `fetchOrder` always queries the `reviews` table. For orders that are `placed` or `preparing`, a review is impossible but the query still fires. This is a wasted DB call on every realtime update.
- **Who**: Performance
- **Fix**: Only fetch review status when `order.status` is `completed` or `delivered`.

**P2-3: `signOut` clears ALL `app_search_filters*` keys from localStorage**
- **Component**: `useAuthState.ts` lines 143-145
- **What can break**: If two users are logged into different browser tabs (different sessions), signing out in one tab deletes search filters for ALL users stored in localStorage, including the other active user's filters.
- **Who**: Multi-tab users
- **Fix**: Only clear the key for the current user: `localStorage.removeItem(getFilterStorageKey(user.id))`.

---

## B. Trust & UX Failure Scenarios

**Scenario 1: "I cancelled but got charged anyway"**
- Buyer opens Razorpay, UPI payment times out on their screen, they dismiss the dialog. `handleRazorpayFailed` cancels the order. But UPI actually processed the payment — Razorpay sends `payment.captured` webhook. The webhook marks the already-cancelled order as `paid`. The buyer sees "cancelled" in the app. Their bank shows a debit. No auto-refund mechanism exists.
- Surfaces as: Urgent support ticket with bank statement screenshot.

**Scenario 2: "I keep getting the same notification"**
- Push delivery fails (device offline). `process-notification-queue` inserts in-app notification, then retries push. On retry, another in-app notification is inserted. User comes online and sees 3 copies of "Order Accepted!" in their notification inbox.
- Surfaces as: "Your app keeps spamming me" complaint.

**Scenario 3: "Someone else picked up my delivery"**
- Delivery partner brute-forces the 4-digit OTP (9000 combinations). The 5-attempt lockout exists but is per-assignment, not per-IP. A scripted attack could rotate through endpoints.
- Surfaces as: "I never got my order but it says delivered" dispute.

**Scenario 4: "My cart says 3 items but I only see 2"**
- Buyer adds 3 items. One becomes unavailable. Cart badge shows 3. Cart page shows 2. Buyer is confused and may think items were removed maliciously.
- Surfaces as: "Where did my item go?" confusion, mild trust erosion.

---

## C. Small, Safe Improvements

| # | Issue | Fix | Risk |
|---|-------|-----|------|
| C1 | P0-1: Webhook marks cancelled order as paid | Add `.neq('status', 'cancelled')` to `payment.captured` order update in `razorpay-webhook` | Zero — additive filter |
| C2 | P0-2: Delivery OTP uses Math.random() | Replace `generateOTP` in `manage-delivery/index.ts` with `crypto.getRandomValues()` | Zero — drop-in replacement |
| C3 | P0-3: manage-delivery HMAC uses `===` | Replace with byte-level XOR comparison (copy pattern from gate-token) | Zero — security hardening |
| C4 | P1-1: Misleading cancel toast on Razorpay fail | After cancel, re-fetch order; if `paid`, show success toast instead | Minimal — UX clarification |
| C5 | P1-2: Duplicate in-app notifications on retry | Add `notification_queue_id` column to `user_notifications`, use `ON CONFLICT DO NOTHING` | Zero — deduplication |
| C6 | P1-3: Cart count includes unavailable items | Sync `cart-count` query with the same `is_available` filter as `cart-items` | Zero — consistency fix |
| C7 | P1-4: create-razorpay-order auth bypass | Use `withAuth` from `_shared/auth.ts` instead of service-role `getUser()` | Zero — uses existing pattern |
| C8 | P2-2: Unnecessary review query on active orders | Guard `fetchReview` with `if (status === 'completed' \|\| status === 'delivered')` | Zero — performance |
| C9 | P2-3: signOut clears all users' filter keys | Scope deletion to current user's key only | Zero — correctness |

---

## D. Final Verdict

### Conditionally Safe

The platform is conditionally safe for production provided:

1. **P0-1 must be fixed** — The `payment.captured` webhook can resurrect a cancelled order as `paid`, causing a "charged but cancelled" scenario with no auto-refund path. This is a financial risk.
2. **P0-2 and P0-3 should be fixed** — Delivery OTP and webhook HMAC were missed in the prior audit's security hardening pass. These are quick fixes using patterns already implemented elsewhere in the codebase.
3. **P1-4 should be reviewed** — The `create-razorpay-order` function's auth check using service role key is a potential security gap that could allow unauthorized order creation.

### Known Limitations We Accept
- Cart count badge can briefly show stale counts (P1-3 is cosmetic)
- Worker name/phone stored in JSON `skills` field (schema design choice)
- Platform fee not deducted from Razorpay transfers (documented business decision)
- Push notification duplicates possible until C5 is shipped (in-app only, not critical)

### Residual Risk Ownership
- **Payment disputes from cancel-then-capture**: Operations team must monitor Razorpay dashboard for payments on cancelled orders until C1 is shipped
- **Delivery OTP brute-force**: Existing 5-attempt lockout provides partial protection, but C2 reduces the attack surface
- **3PL webhook spoofing**: Low practical risk since 3PL integrations may not be active yet, but C3 should ship before enabling any 3PL partners

