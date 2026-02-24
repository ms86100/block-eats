

# Audit-Proof Hardening: Delivery & Payment Gaps

This plan implements all the gaps identified in your audit review across delivery partner management and payment integration, without changing any existing UI design or core business logic.

---

## Summary of Changes

### Database Migration (single migration)

**Delivery Assignments table -- new columns:**
- `failure_owner` (text, nullable) -- values: `seller_fault`, `rider_fault`, `buyer_unavailable`, `guard_rejected`
- `assigned_at` (timestamptz, nullable) -- when partner was assigned
- `at_gate_at` (timestamptz, nullable) -- when rider arrived at gate
- `max_otp_attempts` (integer, default 5) -- configurable max OTP retries
- `otp_attempt_count` (integer, default 0) -- current OTP attempt count

**Payment Records table -- new columns:**
- `payment_mode` (text, default `'cod'`) -- values: `cod`, `upi`, `card`
- `payment_collection` (text, default `'online'`) -- values: `online`, `doorstep`
- `razorpay_payment_id` (text, nullable, UNIQUE) -- prevents duplicate webhook processing

**Orders table -- new trigger:**
- `freeze_order_amount_after_payment` -- blocks updates to `total_amount` when `razorpay_order_id` is not null (payment initiated = amount frozen)

**Validation triggers:**
- `validate_failure_owner` on `delivery_assignments` -- enforces allowed values
- `validate_payment_mode` on `payment_records` -- enforces `cod | upi | card`
- `validate_payment_collection` on `payment_records` -- enforces `online | doorstep`

---

### Edge Function Updates

**`supabase/functions/manage-delivery/index.ts`:**
- `handleAssign`: set `assigned_at` timestamp when partner is assigned
- `handleUpdateStatus`: set `at_gate_at` when status becomes `at_gate`; accept `failure_owner` param on `failed` status
- `handleComplete`: increment `otp_attempt_count` on each attempt; reject if `otp_attempt_count >= max_otp_attempts` (lockout); block OTP regeneration after `delivered` or `at_gate` status

**`supabase/functions/razorpay-webhook/index.ts`:**
- Add duplicate webhook protection: check if `payment_records.razorpay_payment_id` already exists before processing `payment.captured`; skip if duplicate
- Add `razorpay_event_id` tracking to prevent replay attacks (store `payload.event_id` in payment_records metadata or a dedicated column)

---

### Files Changed

| File | Change |
|------|--------|
| New migration SQL | 6 new columns, 3 validation triggers, 1 amount-freeze trigger |
| `supabase/functions/manage-delivery/index.ts` | SLA timestamps, OTP lockout, failure attribution |
| `supabase/functions/razorpay-webhook/index.ts` | Duplicate webhook guard, event_id tracking |

---

## Technical Details

### Migration SQL (outline)

```text
-- delivery_assignments: SLA timestamps + failure attribution + OTP lockout
ALTER TABLE delivery_assignments
  ADD COLUMN IF NOT EXISTS failure_owner text,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS at_gate_at timestamptz,
  ADD COLUMN IF NOT EXISTS max_otp_attempts integer DEFAULT 5,
  ADD COLUMN IF NOT EXISTS otp_attempt_count integer DEFAULT 0;

-- payment_records: mode/collection + unique razorpay_payment_id
ALTER TABLE payment_records
  ADD COLUMN IF NOT EXISTS payment_mode text DEFAULT 'cod',
  ADD COLUMN IF NOT EXISTS payment_collection text DEFAULT 'online',
  ADD COLUMN IF NOT EXISTS razorpay_payment_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_records_razorpay_payment_id
  ON payment_records (razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL;

-- Validation triggers for new columns
-- Freeze order amount trigger (blocks total_amount change when razorpay_order_id set)
```

### OTP Lockout Logic (manage-delivery)

On each `handleComplete` call:
1. Increment `otp_attempt_count`
2. If `otp_attempt_count >= max_otp_attempts` --> return 423 Locked
3. On successful OTP --> clear hash, mark delivered

### Duplicate Webhook Guard (razorpay-webhook)

On `payment.captured`:
1. Check `payment_records` for existing `razorpay_payment_id`
2. If found --> return `{ already_processed: true }` with 200
3. If not --> proceed with update, setting the unique `razorpay_payment_id`

---

## What This Does NOT Change

- No UI changes
- No changes to order status flow or RLS policies
- No changes to existing Razorpay checkout flow
- No changes to cart, review, or cancellation logic

