

# Blunt Production Risk Assessment — As Implemented Today

## THE MOST SERIOUS PROBLEM (Will Break First)

### Identity Mismatch: `partner_id` points to wrong table

**This is the #1 thing that will break in production.**

`delivery_assignments.partner_id` is a foreign key to `delivery_partners` (a table for 3PL provider configs like "Dunzo" or "Porter").

But the `DeliveryPartnerDashboardPage.tsx` sets `partner_id: partnerProfile.id` where `partnerProfile` comes from `delivery_partner_pool` — a completely different table for individual human riders.

These are two separate tables with separate UUIDs:
- `delivery_partners` = provider organizations (3PL or native)
- `delivery_partner_pool` = individual people who deliver

When a rider accepts a delivery, the code writes a `delivery_partner_pool.id` into a column that has a FK constraint to `delivery_partners.id`. **This INSERT/UPDATE will fail with a foreign key violation every single time** unless by freak UUID collision.

**Consequence:** No rider can ever accept a delivery. The entire delivery flow is dead on arrival.

Then the auth fix in the edge function (`assignment.partner_id !== callerId`) compares this pool ID against `auth.uid()` — a third, different ID. **GPS tracking auth will always return 403 Forbidden** because the partner_id is a pool record ID, not a user's auth ID. The auth check is comparing apples to oranges.

---

## SECOND MOST SERIOUS: Sync Trigger Chain Fragility

The `sync_delivery_to_order_status` trigger maps:
- `picked_up` → order `picked_up` (requires order at `ready`)
- `at_gate` → order `on_the_way` (requires order at `picked_up`)
- `delivered` → order `delivered` (requires order at `on_the_way`)

This is a strict chain. If ANY step fails silently (e.g., the order wasn't at exactly the right status), every subsequent step also fails silently. The UPDATE just matches zero rows — no error, no log, no alert.

**Real scenario:** Rider marks `picked_up` but order was still at `preparing` (seller was slow). The sync to `picked_up` silently fails. Now `at_gate` and `delivered` will also silently fail. Order is stuck at `preparing` forever while the delivery shows `delivered`.

There is no monitoring, no error logging, no admin alert for this. It will happen and nobody will know until a buyer complains.

---

## THIRD: `useCategoryStatusFlow` Depends on `seller.primary_group` — Not Always Available

The hook reads `sellerPrimaryGroup` from the order's seller join. If this field is null or empty (seller hasn't set a primary group, which is likely for many sellers), the hook short-circuits and returns an empty flow.

When flow is empty, `useOrderDetail` falls back to hardcoded legacy logic. But the DB trigger still enforces `category_status_flows` rules. So the UI shows one set of transitions, the database enforces a different set. The seller clicks a button, gets "Invalid status transition," and has no idea why.

---

## FOURTH: `validate_order_status_transition` Actor Check is Bypassed by the Sync Trigger

The P1 fix checks `current_setting('role', true) != 'service_role'` to block non-service-role callers from setting delivery/system statuses. But the sync trigger runs as `SECURITY DEFINER`, which means it executes with the trigger creator's role, not `service_role`. Whether this actually resolves to `service_role` depends on how Supabase runs trigger functions — if it doesn't, the sync trigger's own UPDATEs to `orders` will be blocked by the actor check it's supposed to bypass.

This hasn't been tested. It might work. It might silently break the entire sync chain.

---

## FIFTH: Stale Detection is Circular

The "stale detection" in the edge function only fires when a new GPS update arrives. If GPS stops (phone died, app killed, no signal), no updates arrive, so no stale detection runs. The buyer sees a frozen "last seen X min ago" forever with no notification.

The `stalled_notified` flag is only checked and set inside the edge function. There is no cron job, no scheduled check, no external monitor. A delivery that goes completely silent generates zero alerts to anyone.

---

## SUMMARY: What Breaks and When

| Priority | Issue | When It Breaks |
|----------|-------|----------------|
| **P0** | `partner_id` FK mismatch — riders can't accept deliveries | First delivery attempt |
| **P0** | GPS auth compares pool ID vs auth UID — always 403 | First GPS send attempt |
| **P1** | Sync trigger silent failures cascade — orders get stuck | First time seller is slow |
| **P1** | Empty category flow + DB enforcement mismatch — seller gets cryptic errors | First seller without `primary_group` |
| **P2** | `SECURITY DEFINER` vs `service_role` — untested assumption | Unknown — depends on Supabase internals |
| **P2** | Stale detection never fires when GPS actually stops | First phone battery death mid-delivery |

## WHAT IS NOT BROKEN

- The `LiveDeliveryTracker` UI component is well-written and degrades gracefully
- The `useBackgroundLocationTracking` hook correctly handles Capacitor vs web, permission denied, throttling, and cleanup
- The ETA calculation with state-based overrides is reasonable for v1
- The `category_status_flows` table design and seeded data are correct
- The notification idempotency checks work
- Realtime subscriptions are correctly scoped and cleaned up

## VERDICT

The system has solid architecture but two **P0 bugs that make the entire delivery flow non-functional**. No rider can accept a delivery (FK violation) and no GPS data can be sent (auth identity mismatch). These must be fixed before any testing is even possible.

