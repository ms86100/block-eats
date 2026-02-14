

# Implementation Audit: Security Feature Set — Current State Assessment

All five features from the directive have been implemented in previous iterations. This plan addresses the remaining gaps and hardening needed.

---

## Feature-by-Feature Status

### 1. Silent Confirmation Mode — FULLY IMPLEMENTED
- **Edge function**: `gate-token` checks `society.security_mode`, inserts pending entry, sends notification, returns `awaiting_confirmation`
- **Guard UI**: `GuardConfirmationPoller.tsx` — realtime subscription on `gate_entries` with countdown timer
- **Resident UI**: `ResidentConfirmation.tsx` — realtime subscription, Approve/Deny buttons, countdown
- **Database**: `gate_entries` has `awaiting_confirmation`, `confirmation_expires_at`, `confirmed_by_resident_at`, `confirmation_denied_at`
- **Realtime**: Both `gate_entries` and `manual_entry_requests` added to `supabase_realtime` publication
- **Indexes**: `idx_gate_entries_pending_confirmation`, `idx_gate_entries_resident_confirmation`
- **Gap**: None critical. Flow is complete end-to-end.

### 2. Security Mode Tiers — FULLY IMPLEMENTED
- **Database**: `societies.security_mode` (text) and `societies.security_confirmation_timeout_seconds` (integer) exist
- **Admin UI**: `SecurityModeSettings.tsx` with Basic/Confirmation/AI Match (disabled) selector + configurable timeout
- **Validation**: `validate_security_mode()` trigger prevents invalid values
- **Edge function**: Reads `security_mode` and branches behavior
- **SocietyAdminPage**: Security tab contains `SecurityModeSettings` + `SecurityStaffManager`
- **Gap**: None.

### 3. Token Payload Encryption — FULLY IMPLEMENTED
- **AES-GCM encryption**: Payload (uid, sid, iat, exp only) encrypted with server-side key derived from service role key
- **HMAC signature**: Applied on top of encrypted blob
- **No PII in QR**: Token contains zero plaintext — name/flat fetched server-side after validation
- **Format**: `base64(iv):base64(ciphertext).base64(hmac)`
- **Gap**: None. PII fully removed from client-side token.

### 4. Security Officer Restricted Navigation — FULLY IMPLEMENTED
- **`useSecurityOfficer` hook**: RPC-based check using `is_security_officer()` SECURITY DEFINER function
- **`BottomNav`**: Already shows restricted `securityNavItems` (Verify, History, Profile) when `isSecurityOfficer === true`
- **Route guard**: `SecurityVerifyPage` checks `isSecurityOfficer` and renders "Access Restricted" if false
- **Gap found**: `BottomNav` restricted nav shows `/security/audit` (History) but this page checks `isSocietyAdmin || isAdmin`, NOT security officer role. Security officers would see "Access Restricted" on their own nav item.
- **Gap found**: No router-level guard exists — routes rely on in-page guards only (functional but not defense-in-depth).

### 5. Gate Entry Audit Dashboard — FULLY IMPLEMENTED
- **Page**: `SecurityAuditPage.tsx` at `/security/audit`
- **Hook**: `useGateAudit` with full filters (date range, entry type, status, resident name, officer)
- **Metrics**: `useGateAuditMetrics` — entries today, manual %, denied %, avg confirmation time
- **CSV export**: Client-side export function
- **Pagination**: Offset-based with page controls
- **Indexes**: `idx_gate_entries_audit` composite index on (society_id, entry_time DESC, entry_type, confirmation_status)
- **Gap found**: Access restricted to `isSocietyAdmin || isAdmin` — security officers cannot see their own entry history via this page (but can via the BottomNav link)

---

## Gaps Requiring Implementation

### Critical (2 items)

1. **Security Officer cannot access `/security/audit`** — BottomNav links them there but the page blocks non-admins. Fix: Add `isSecurityOfficer` check to `SecurityAuditPage.tsx` access control, with scope limited to entries `verified_by = auth.uid()` for officers (they should see their own entries, not all society entries).

2. **Duplicate/conflicting RLS policies on `gate_entries`** — There are overlapping SELECT policies:
   - "Residents can view own entries" (user_id = auth.uid())  
   - "Security officers can view society entries"
   - "Society admins can view all entries"  
   - "Society admins view gate entries" (combined policy on public role)
   
   The duplicate public-role policies may cause unexpected behavior. Should consolidate to a clean set on `authenticated` role only.

### High Priority (1 item)

3. **No router-level route guard for security pages** — Currently, `/security/verify` and `/security/audit` use `ProtectedRoute` (auth-only) and rely on in-page role checks. Should add a dedicated `SecurityRoute` wrapper at the router level for defense-in-depth.

### Medium Priority (2 items)

4. **Hardening docs not updated** — `.lovable/hardening-docs/security-architecture.md` was created but the role-access-matrix.md needs updating with the security_officer role scope.

5. **Manual entry poller for guard** — After sending a manual entry request, the guard sees "Waiting for resident confirmation..." but there's no realtime subscription polling for the response. The guard has no way to know when the resident approves/denies without refreshing the page.

---

## Implementation Plan

### Fix 1: Security Audit Page Access for Officers
**File**: `src/pages/SecurityAuditPage.tsx`
- Change access check from `isSocietyAdmin || isAdmin` to also include security officers via `useSecurityOfficer` hook
- When security officer: scope the query to `verified_by = profile.id` (they only see their own verifications)
- When society admin/platform admin: show all entries (current behavior)

### Fix 2: Consolidate RLS Policies
**Migration**: Remove duplicate `public` role policies on `gate_entries`, keeping only the clean `authenticated` role policies. The overlapping policies create confusion and potential security surface issues.

### Fix 3: SecurityRoute Wrapper
**File**: `src/App.tsx`
- Create a `SecurityRoute` component that checks `useSecurityOfficer || isSocietyAdmin || isAdmin`
- Wrap `/security/verify` and `/security/audit` routes with it
- This provides router-level defense-in-depth alongside in-page guards

### Fix 4: Update Hardening Docs
**File**: `.lovable/hardening-docs/role-access-matrix.md`
- Add security_officer role column with explicit page access matrix

### Fix 5: Manual Entry Realtime Polling
**File**: `src/pages/SecurityVerifyPage.tsx`
- Add realtime subscription on `manual_entry_requests` filtered by `requested_by = profile.id` and `status != 'pending'`
- When status changes to `approved` or `denied`, show green/red result to guard
- Reset manual entry form on completion

---

## Technical Details

### Files to Modify
| File | Change |
|---|---|
| `src/pages/SecurityAuditPage.tsx` | Add useSecurityOfficer, scope queries for officers |
| `src/pages/SecurityVerifyPage.tsx` | Add realtime subscription for manual entry responses |
| `src/App.tsx` | Add SecurityRoute wrapper component |
| `.lovable/hardening-docs/role-access-matrix.md` | Update with security_officer column |
| Migration SQL | Clean up duplicate RLS policies on gate_entries |

### No New Tables or Edge Functions Required
All database schema, indexes, edge functions, and core components already exist.

### Production Readiness Assessment

| Dimension | Score | Notes |
|---|---|---|
| Architectural Integrity | 9/10 | Solid 4-tier feature system, encrypted tokens, SECURITY DEFINER RPCs |
| Multi-Tenant Isolation | 9/10 | Society-scoped RLS everywhere, effectiveSocietyId on all reads |
| Security Robustness | 8/10 | AES-GCM + HMAC, rate limiting, RPC-based role checks. Duplicate RLS policies need cleanup |
| Scalability Readiness | 9/10 | Comprehensive indexes, paginated queries, React Query caching |
| UX Completeness | 7/10 | Manual entry lacks realtime guard feedback, audit page blocks officers |
| Operational Maturity | 8/10 | Admin UI for staff management exists, audit logging in place |

**Verdict: READY WITH CRITICAL FIXES REQUIRED** — 5 targeted fixes, no architectural changes needed.

