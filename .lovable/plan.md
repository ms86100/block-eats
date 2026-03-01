
# Production Risk Assessment — Post-Fix Status

## FIXES APPLIED

### P0 Fix 1: partner_id FK mismatch → RESOLVED
- Added `rider_id UUID REFERENCES delivery_partner_pool(id)` to `delivery_assignments`
- `DeliveryPartnerDashboardPage.tsx` now writes to `rider_id` (not `partner_id`) when a native rider accepts
- `partner_id` remains for 3PL provider assignment (its original purpose)

### P0 Fix 2: GPS auth identity mismatch → RESOLVED
- Added `user_id UUID REFERENCES auth.users(id)` to `delivery_partner_pool`
- On first dashboard load, rider's `user_id` is auto-linked to their pool record (matched by phone)
- Edge function now: authenticates via `getUser()`, looks up `rider_id` → pool → `user_id`, compares against `auth.uid()`
- Replaced broken `getClaims()` with standard `getUser()` pattern

### P1 Fix 3: Sync trigger silent failures → RESOLVED
- Sync trigger now uses `GET DIAGNOSTICS` to check row count after each UPDATE
- When 0 rows affected (order not at expected status), logs `RAISE WARNING` + inserts audit record into `delivery_tracking_logs`
- Added `set_config('app.delivery_sync', 'true', true)` flag to bypass actor enforcement in validation trigger

### P1 Fix 4: Category flow fallback mismatch → RESOLVED
- `useOrderDetail` now derives `parent_group` from `order_items → products → category_config` when `seller.primary_group` is null
- This matches the exact same derivation path used by the DB validation trigger
- UI and DB now always agree on which flow to enforce

### P2 Fix 5: SECURITY DEFINER vs service_role → RESOLVED
- Validation trigger now checks `app.delivery_sync` session flag (set by sync trigger) in addition to `service_role`
- Sync trigger sets this flag before its UPDATE calls, allowing delivery/system actor transitions to pass through

## REMAINING ACCEPTED RISKS

| Risk | Severity | Accepted? |
|------|----------|-----------|
| No active stall detection when GPS stops entirely | P2 | Yes — passive detection on next update is acceptable for v1 |
| No Google Maps visual — text-only tracking | P2 | Yes — acceptable for v1 |
| No timeout escalation for stuck-at-ready orders | P2 | Yes — operational, not safety-critical |

## VERDICT: ⚠️ Conditionally Ready
All P0 and P1 blockers resolved. System is testable and functional for production with accepted P2 risks.
