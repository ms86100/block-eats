

# Design Thinking Integrity Audit -- Implementation Plan

## Design Thinking Maturity Scores

| Phase | Score | Rationale |
|-------|-------|-----------|
| Empathize | Medium | Good empty states and offline banner, but error messages are generic; waiting states lack reassurance; no contextual help. |
| Define | Medium | Core flows are clear, but several screens mix responsibilities; some mandatory actions lack explanation (e.g., age checkbox, invite code). |
| Ideate | Low | Most flows are linear with no save/resume, no undo, limited recovery; seller onboarding is the only flow with drafts. |
| Prototype | Medium | Seller flow has drafts and incremental saves; buyer flows (cart, checkout) have no confirmation or preview before commitment. |
| Test | Low | No in-app feedback mechanism; no NPS/CSAT prompt; error handling is silent in many places; no post-action learning signals. |

---

## Key Gaps and Implementation Plan

### Gap 1 -- Verification Pending: No Reassurance or Next Steps (Empathize)
**Problem:** After signup, users land on `VerificationPendingScreen` with "Your community admin will verify your details shortly" -- no estimated time, no way to contact support, no "what to do next." Users feel abandoned.

**User impact:** Anxiety, app abandonment during the critical first session.

**Fix:**
- Add a "What happens next?" expandable section explaining the process in plain language
- Add a "Need help?" link to the Help page or a support email
- Add a subtle auto-refresh that checks verification status every 60s with a toast when approved

**Files:** `src/components/onboarding/VerificationPendingScreen.tsx`
**Risk:** Low
**Measure:** Reduction in support queries about "stuck verification"

---

### Gap 2 -- Checkout Has No Order Confirmation Step (Prototype)
**Problem:** Tapping "Place Order" on `CartPage` immediately creates the order. There is no confirmation dialog showing a summary (items, address, payment method, total). Users who accidentally tap have no recovery.

**User impact:** Mistrust, accidental orders, increased cancellations.

**Fix:**
- Add an `AlertDialog` confirmation before `handlePlaceOrder` fires
- Show: item count, total, payment method, delivery address in the dialog
- Two buttons: "Review Cart" (dismiss) and "Confirm Order"

**Files:** `src/pages/CartPage.tsx`
**Risk:** Low
**Measure:** Reduction in immediate cancellations (orders cancelled < 30s after placement)

---

### Gap 3 -- Error Messages Are Generic and System-Centric (Empathize)
**Problem:** Many `catch` blocks show `error.message` directly (e.g., "row-level security policy violation," "JWT expired"). These are meaningless to non-technical users.

**User impact:** Confusion, loss of trust, inability to self-recover.

**Fix:**
- Create a utility `friendlyError(error)` in `src/lib/utils.ts` that maps common Supabase/network errors to human-readable messages
- Map patterns: "JWT" -> "Your session expired. Please log in again.", "row-level security" -> "You don't have permission for this action.", "NetworkError" -> "Please check your internet connection."
- Replace raw `error.message` in key flows: auth, cart, orders, seller dashboard

**Files:** `src/lib/utils.ts` (new function), `src/pages/AuthPage.tsx`, `src/pages/CartPage.tsx`, `src/pages/OrderDetailPage.tsx`, `src/pages/SellerDashboardPage.tsx`
**Risk:** Low
**Measure:** Reduction in user-reported "weird error" support tickets

---

### Gap 4 -- No In-App Feedback Mechanism (Test)
**Problem:** There is zero mechanism for users to share feedback, report bugs, or rate their experience inside the app. The product cannot learn or iterate based on user signals.

**User impact:** Users with issues silently churn; product team has no qualitative signal.

**Fix:**
- Add a "Feedback" menu item on `ProfilePage` that opens a simple sheet
- Sheet contains: a 5-star emoji rating, a text area ("Tell us more"), and a submit button
- Store in a new `user_feedback` table (user_id, rating, message, page_context, created_at)
- Show a warm "Thank you" toast after submission

**Files:** New `src/components/feedback/FeedbackSheet.tsx`, `src/pages/ProfilePage.tsx` (add link), new DB migration for `user_feedback` table
**Risk:** Low
**Measure:** Volume of feedback submissions per week

---

### Gap 5 -- Seller Rejection Has No Guidance (Empathize + Test)
**Problem:** When a seller application is rejected, there is no visible explanation or "what to do next" guidance. The `BecomeSellerPage` shows existing seller status but doesn't surface rejection reasons or offer a retry path.

**User impact:** Frustration, feeling of unfairness, permanent drop-off from seller funnel.

**Fix:**
- On the seller dashboard / become-seller page, if `verification_status === 'rejected'`, show a card explaining:
  - "Your application was not approved"
  - The rejection reason (from `rejection_reason` column if it exists)
  - "You can update your details and resubmit"
  - A button to re-enter the seller onboarding flow

**Files:** `src/pages/BecomeSellerPage.tsx`, `src/pages/SellerDashboardPage.tsx`
**Risk:** Low
**Measure:** Seller resubmission rate after rejection

---

### Gap 6 -- Onboarding Lacks Contextual Explanation for Mandatory Fields (Define)
**Problem:** During signup, fields like "Block," "Flat Number," and "Invite Code" are required but have no tooltip or helper text explaining why. The age confirmation checkbox ("I confirm I am 18+") appears without context on why age matters.

**User impact:** Hesitation, privacy concerns, form abandonment.

**Fix:**
- Add brief helper text under sensitive fields:
  - Block/Flat: "Used for delivery and identity verification within your society"
  - Invite Code: "Your society admin can share this code with you"
  - Age: "Required to comply with marketplace regulations"

**Files:** `src/pages/AuthPage.tsx`
**Risk:** Low
**Measure:** Signup completion rate improvement

---

### Gap 7 -- Order Status Has No Proactive Communication (Test)
**Problem:** After placing an order, the `OrderDetailPage` shows a static status timeline. There is no proactive reassurance message like "Your seller usually responds within 5 minutes" or "Preparing typically takes 15-20 min."

**User impact:** Anxiety during wait times, unnecessary seller calls/chats.

**Fix:**
- Below the status timeline card, add a contextual reassurance message based on current status:
  - "Placed": "Waiting for seller to accept. Most sellers respond within 5 minutes."
  - "Accepted": "Great! Your order has been confirmed."
  - "Preparing": "Your order is being prepared. Sit tight!"
  - "Ready": "Your order is ready! Head to pickup or wait for delivery."

**Files:** `src/pages/OrderDetailPage.tsx`
**Risk:** Low
**Measure:** Reduction in chat messages during "placed" status

---

### Gap 8 -- Cart Cannot Be Saved or Shared (Ideate)
**Problem:** The cart exists only in local state. If a user closes the app or switches devices, the cart is lost. There is no "save for later" or wishlist integration from the cart.

**User impact:** Frustration, lost purchase intent, re-browsing friction.

**Fix:**
- Persist cart to the database (already uses `useCart` hook -- check if it's DB-backed or localStorage)
- If localStorage only: migrate to a `cart_items` table with `user_id`, `product_id`, `quantity`
- Add a "Save for later" action on individual cart items that moves them to favorites

**Files:** `src/hooks/useCart.tsx`, potential DB migration
**Risk:** Medium (requires checking current cart persistence mechanism)
**Measure:** Cart recovery rate across sessions

---

## Implementation Priority

| Priority | Gap | Effort | Impact |
|----------|-----|--------|--------|
| 1 | Gap 2 -- Order Confirmation Dialog | Small | High |
| 2 | Gap 3 -- Friendly Error Messages | Small | High |
| 3 | Gap 1 -- Verification Reassurance | Small | High |
| 4 | Gap 7 -- Order Status Reassurance | Small | Medium |
| 5 | Gap 6 -- Signup Field Context | Small | Medium |
| 6 | Gap 5 -- Seller Rejection Guidance | Small | Medium |
| 7 | Gap 4 -- Feedback Mechanism | Medium | High |
| 8 | Gap 8 -- Cart Persistence | Medium | Medium |

All changes are additive, non-breaking, and focused on clarity, empathy, and feedback -- consistent with Design Thinking principles.

