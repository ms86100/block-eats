

# End-to-End Payment & Order Tracking System — Complete Audit Trail

This plan designs the full purchase-to-delivery audit trail, adding the missing pieces to your already-solid infrastructure so that every transaction step is traceable, verifiable, and suitable for financial reconciliation and internal audits.

---

## What Already Exists (No Changes Needed)

Your current system already covers most of the lifecycle. Here is what is in place and working correctly:

| Layer | Tables / Logic | Status |
|-------|---------------|--------|
| Product listing | `products`, `seller_profiles`, `category_config` | Complete |
| Cart & checkout | `cart_items`, `create_multi_vendor_orders` RPC | Complete |
| Order creation | `orders`, `order_items`, `idempotency_key` | Complete |
| Order status transitions | `validate_order_status_transition` trigger | Complete |
| Payment initiation | `create-razorpay-order` edge function | Complete |
| Payment confirmation | `razorpay-webhook`, HMAC verification | Complete |
| Payment records | `payment_records` with dedup via unique `razorpay_payment_id` | Complete |
| Amount freeze | `freeze_order_amount_after_payment` trigger | Complete |
| Delivery assignment | `trg_auto_assign_delivery`, `delivery_assignments` | Complete |
| Delivery OTP & lockout | `manage-delivery` edge function, `otp_attempt_count` | Complete |
| Delivery tracking | `delivery_tracking_logs` with source attribution | Complete |
| Failure attribution | `failure_owner` with DB validation trigger | Complete |
| Seller stats | `recompute_seller_stats`, `trg_update_seller_stats_on_order` | Complete |
| Notifications | `enqueue_order_status_notification` trigger | Complete |
| Audit log | `audit_log` table | Complete |

---

## What Is Missing (New Additions)

Three gaps prevent full audit-proof traceability from purchase to seller payout:

### Gap 1: Seller Settlement Ledger

There is no table to record when a seller's earnings from an order are released, held, or disputed. Without this, you cannot answer: "Was the seller paid for this order, when, and how much?"

### Gap 2: Order Audit Timeline View

While individual tables hold timestamps, there is no single queryable view that reconstructs the full lifecycle of a transaction (order created, payment initiated, payment confirmed, delivery assigned, delivered, seller settled) for audit purposes.

### Gap 3: Payment-Delivery Linkage for Reconciliation

The `payment_records` table and `delivery_assignments` table both reference `order_id`, but there is no enforced checkpoint that prevents seller settlement before delivery confirmation. This is a financial controls gap.

---

## Implementation Plan

### 1. New Table: `seller_settlements`

Tracks when money is released to a seller for a completed order.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid PK | Row identifier |
| `order_id` | uuid FK -> orders | Which order this settlement is for |
| `seller_id` | uuid FK -> seller_profiles | Which seller receives funds |
| `society_id` | uuid FK -> societies | Society scope |
| `gross_amount` | numeric | Order total before platform fee |
| `platform_fee` | numeric | Platform's cut |
| `delivery_fee_share` | numeric | Delivery fee portion (if any) |
| `net_amount` | numeric | Actual payout to seller |
| `settlement_status` | text | `pending`, `eligible`, `processing`, `settled`, `on_hold`, `disputed` |
| `eligible_at` | timestamptz | When settlement became eligible (delivery confirmed + cooldown) |
| `settled_at` | timestamptz | When payout was actually processed |
| `hold_reason` | text | Why settlement is on hold (dispute, return window, etc.) |
| `razorpay_transfer_id` | text | Razorpay Route transfer reference |
| `created_at` | timestamptz | Record creation |
| `updated_at` | timestamptz | Last update |

**Validation trigger**: `validate_settlement_status` enforces allowed values.

**Settlement eligibility trigger**: `trg_mark_settlement_eligible` fires on `orders.status` change to `delivered` or `completed`, creating a settlement record with status `eligible` and `eligible_at = now() + cooldown_period` (configurable via `system_settings`).

**Guard rule**: Settlement cannot move to `settled` unless `delivery_assignments.status = 'delivered'` for that order (enforced by trigger).

### 2. New Database View: `transaction_audit_trail`

A read-only view that joins all relevant tables into a single audit row per order, providing complete lifecycle visibility.

```text
CREATE VIEW transaction_audit_trail AS
SELECT
  o.id AS order_id,
  o.created_at AS order_placed_at,
  o.status AS order_status,
  o.total_amount,
  o.discount_amount,
  o.delivery_fee,
  o.fulfillment_type,
  o.payment_status,
  o.razorpay_order_id,
  o.razorpay_payment_id,

  -- Buyer info
  bp.name AS buyer_name,
  bp.flat_number AS buyer_flat,

  -- Seller info
  sp.business_name AS seller_name,
  sp.id AS seller_id,

  -- Items summary
  (SELECT count(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count,
  (SELECT sum(oi.quantity * oi.unit_price) FROM order_items oi WHERE oi.order_id = o.id) AS items_subtotal,

  -- Payment timeline
  pr.payment_mode,
  pr.payment_collection,
  pr.payment_status AS payment_record_status,
  pr.razorpay_payment_id AS payment_reference,
  pr.platform_fee,
  pr.created_at AS payment_initiated_at,

  -- Delivery timeline
  da.status AS delivery_status,
  da.assigned_at AS delivery_assigned_at,
  da.pickup_at AS delivery_picked_up_at,
  da.at_gate_at AS delivery_at_gate_at,
  da.delivered_at AS delivery_completed_at,
  da.failure_owner,
  da.failed_reason,
  da.rider_name,
  da.otp_attempt_count,

  -- Settlement
  ss.settlement_status,
  ss.net_amount AS seller_payout,
  ss.eligible_at AS settlement_eligible_at,
  ss.settled_at AS settlement_paid_at,
  ss.hold_reason AS settlement_hold_reason

FROM orders o
LEFT JOIN profiles bp ON bp.id = o.buyer_id
LEFT JOIN seller_profiles sp ON sp.id = o.seller_id
LEFT JOIN payment_records pr ON pr.order_id = o.id
LEFT JOIN delivery_assignments da ON da.order_id = o.id
LEFT JOIN seller_settlements ss ON ss.order_id = o.id;
```

This gives auditors a single query to trace any order end-to-end.

### 3. Settlement Eligibility Trigger

A new trigger on the `orders` table that automatically creates a `seller_settlements` record when an order reaches a terminal success state.

```text
-- On orders.status -> 'delivered' or 'completed':
-- 1. Look up payment_records for this order
-- 2. Create seller_settlements row with status = 'pending'
-- 3. Calculate net_amount = amount - platform_fee
-- 4. Set eligible_at = now() + settlement_cooldown (from system_settings, default 48h)
```

**Settlement cannot be marked `settled` if:**
- `delivery_assignments.status` is NOT `delivered` for that order
- `payment_records.payment_status` is NOT `paid` for that order

This is enforced by a `validate_settlement_release` trigger.

### 4. System Settings for Settlement Configuration

New entries in `system_settings`:

| Key | Default | Purpose |
|-----|---------|---------|
| `settlement_cooldown_hours` | `48` | Hours after delivery before settlement is eligible |
| `auto_settle_enabled` | `false` | Whether to auto-process settlements (future cron) |

### 5. RLS Policies for `seller_settlements`

- **Sellers**: Can SELECT their own settlements (`seller_id` matches their seller profile's `id`)
- **Admins / Society Admins**: Can SELECT all settlements in their scope
- **No direct INSERT/UPDATE/DELETE** from client -- all mutations happen via triggers or edge functions

### 6. Edge Function: `process-settlements` (Stub)

A new edge function that can be called by a cron job or admin action to process eligible settlements:

1. Query `seller_settlements` where `status = 'eligible'` and `eligible_at <= now()`
2. Verify delivery status is `delivered`
3. Verify payment status is `paid`
4. If seller has `razorpay_account_id`, initiate Razorpay Route transfer
5. Update settlement status to `processing` then `settled`
6. Log to `audit_log`

This function will be created as a stub with the core logic, ready for production activation.

---

## Files to Create / Modify

| File | Change |
|------|--------|
| New migration SQL | `seller_settlements` table, `transaction_audit_trail` view, settlement triggers, RLS policies, system_settings seed |
| `supabase/functions/process-settlements/index.ts` | New edge function for settlement processing |
| `src/integrations/supabase/types.ts` | Auto-updated after migration |

---

## What This Does NOT Change

- No UI changes
- No changes to existing order flow, payment flow, or delivery flow
- No changes to existing RLS policies on orders, payment_records, or delivery_assignments
- No changes to existing edge functions
- Existing triggers remain untouched

---

## Technical Details

### Settlement Status Machine

```text
pending -> eligible -> processing -> settled
pending -> on_hold -> eligible (after hold resolved)
pending -> disputed -> on_hold | eligible
```

### Validation Checkpoints (Audit Gates)

1. **Order placed**: `orders.created_at` + `order_items` rows exist
2. **Payment initiated**: `orders.razorpay_order_id` is set, `freeze_order_amount_after_payment` active
3. **Payment confirmed**: `payment_records.payment_status = 'paid'`, `razorpay_payment_id` unique
4. **Delivery assigned**: `delivery_assignments` row exists with `assigned_at`
5. **Delivery completed**: `delivery_assignments.status = 'delivered'`, `delivered_at` set
6. **Settlement eligible**: `seller_settlements.status = 'eligible'`, cooldown passed
7. **Settlement released**: `seller_settlements.status = 'settled'`, `settled_at` set

Each checkpoint is DB-enforced -- no frontend can skip a gate.

