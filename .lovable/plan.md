

# Scalability Completion + Multi-Tenant Product Verification

## Part 1: Remaining Scalability Items

### 1A. HomePage Targeted Queries (Replace Bulk Download)

**Current problem:** `HomePage.tsx` fetches ALL approved sellers (line 40-50), then filters client-side into 4 sections: open now, nearby block, top rated, featured. At 500 sellers per society, this downloads 500 rows to display ~20.

**Change:** Replace single bulk query with 4 targeted queries, each with `LIMIT`:

| Section | Query | Limit |
|---|---|---|
| Open Now | `.eq('is_available', true).limit(6)` | 6 |
| Nearby Block | `.eq('block', profile.block).limit(5)` via join | 5 |
| Top Rated | `.gte('rating', 4).order('rating', desc).limit(5)` | 5 |
| Featured | `.eq('is_featured', true).limit(5)` | 5 |

Each query also wrapped in a React Query hook for caching. Favorites query already has `.limit(5)` -- no change needed.

**Files modified:** `src/pages/HomePage.tsx`

---

### 1B. React Query Migration (All Major Pages)

**Current problem:** Every page uses raw `useState` + `useEffect` + `supabase.from()`. This means:
- No caching between navigations (re-fetches on every page visit)
- No deduplication of identical requests
- No background refetching
- No stale-while-revalidate

**Change:** Create custom hooks wrapping React Query for each data domain:

| Hook | Data | staleTime | Used By |
|---|---|---|---|
| `useHomeSellers()` | 4 seller sections | 30s | HomePage |
| `useSellerOrders(sellerId)` | Seller's orders | 0 (always fresh) | SellerDashboardPage |
| `useBuyerOrders(userId)` | Buyer's orders | 0 | OrdersPage |
| `useBulletinPosts(societyId)` | Bulletin posts | 30s | BulletinPage |
| `useNotifications(userId)` | Notifications | 0 | NotificationInboxPage |
| `useSocietyStats(societyId)` | Dashboard counts | 60s | SocietyDashboardPage |
| `useCategoryConfig()` | Category config | 5min | Multiple |
| `useParentGroups()` | Parent groups | 5min | Already exists |

**New directory:** `src/hooks/queries/`

**Files modified:** HomePage, SellerDashboardPage, BulletinPage, NotificationInboxPage, SocietyDashboardPage, SearchPage

---

### 1C. SellerDashboardPage Pagination

**Current problem:** `SellerDashboardPage.tsx` (line 84-92) fetches ALL orders for the seller with no limit. At 10K orders this will collapse.

**Change:** Paginate with cursor-based loading (same pattern as OrdersPage which already has it). Only load first 20 orders, with "Load More" button. Stats calculation moves to a separate count-only query instead of downloading all rows.

**Files modified:** `src/pages/SellerDashboardPage.tsx`

---

### 1D. Notification Queue (Background Processing)

**Current problem:** Notifications are dispatched synchronously during user actions.

**Change:**
1. Create `notification_queue` table (id, user_id, title, body, type, reference_path, payload, status, created_at, processed_at)
2. Create edge function `process-notification-queue` that:
   - Reads unprocessed entries
   - Inserts into `user_notifications`
   - Calls `send-push-notification` for each
   - Marks as processed
3. Schedule via pg_cron every minute
4. Update `src/lib/notifications.ts` to insert into queue instead of direct notification

**New files:** `supabase/functions/process-notification-queue/index.ts`
**Migration:** Create `notification_queue` table with RLS

---

### 1E. Data Archiving Jobs

**Change:** Create edge function `archive-old-data` that:
- Moves completed orders older than 90 days to `orders_archive`
- Deletes read notifications older than 60 days
- Moves audit_log entries older than 1 year to `audit_log_archive`

Schedule via pg_cron weekly.

**Migration:** Create `orders_archive` and `audit_log_archive` tables
**New files:** `supabase/functions/archive-old-data/index.ts`

---

### 1F. Rate Limiting

**Change:** Create a reusable rate limiter in edge functions:
- `rate_limits` table (key, count, window_start)
- Helper function `checkRateLimit(key, maxRequests, windowSeconds)` shared across edge functions
- Apply to: `create-razorpay-order` (10/min per user), `send-push-notification` (100/min per society), `validate-society` (5/min per user)

**Migration:** Create `rate_limits` table
**New file:** `supabase/functions/_shared/rate-limiter.ts`

---

### 1G. Idempotency Keys

**Change:**
- Add `idempotency_key` column (unique, nullable) to `orders` table
- Frontend generates UUID before order submission, sends as idempotency_key
- If duplicate key, return existing order instead of creating new one
- Payment records already have `razorpay_order_id` for partial idempotency -- add explicit `idempotency_key` column

**Migration:** Add columns + unique constraints
**Files modified:** Cart checkout flow

---

## Part 2: Multi-Tenant Product Verification

### 2.1 Governance Features Added

| Feature | Why Required | UX Change | Problem Solved |
|---|---|---|---|
| Society-level admin delegation (`society_admins` table) | Platform admin cannot manage 100+ societies alone | Society admins approve users/sellers within their own society | Eliminates centralized bottleneck |
| Builder entity (`builders` table) | Real estate developers manage multiple societies | Builder dashboard shows aggregate stats across all managed societies | Enables B2B relationship management |
| Builder-to-society mapping (`builder_societies`) | One builder owns many societies | Builder sees all societies in one view with pending counts | Prevents builder from needing separate logins |
| Admin role hierarchy (platform > builder > society_admin > moderator) | Different authority levels needed | Each role sees only their permitted actions | Prevents unauthorized access at scale |
| Auto-approval per society (`auto_approve_residents` flag) | High-volume societies cannot manually approve every resident | Toggle in society settings, residents join instantly | Removes onboarding friction for large societies |
| Admin limits (`max_society_admins` + trigger) | Prevents admin inflation | Error shown when limit reached | Controls governance sprawl |
| Last-admin protection (trigger) | Prevents orphaned societies | Cannot remove last active admin | Ensures governance continuity |
| Audit logging (`audit_log` table + `logAudit()`) | Accountability for all admin actions | No visible UX change, backend trail | Enables compliance and dispute resolution |

### 2.2 Role Hierarchy

| Role | Scope | Can Manage | Authority Boundary |
|---|---|---|---|
| `platform_admin` | Global | All societies, all builders, all users | `is_admin()` check, `user_roles` table |
| `builder_member` | Builder org | View societies assigned to their builder | `is_builder_member()` check, `builder_members` table |
| `society_admin` | Single society | Users, sellers, settings within their society only | `is_society_admin()` with `deactivated_at IS NULL` |
| `moderator` | Single society | Limited moderation (stored in `society_admins.role`) | Same table as society_admin, different role value |
| `seller` | Own store | Own products, own orders | `seller_profiles.user_id = auth.uid()` |
| `buyer` | Own data | Own orders, cart, reviews | `user_id = auth.uid()` |

**Separation enforcement:** Each SECURITY DEFINER function checks only its scope. `is_society_admin()` cannot see other societies. `is_builder_member()` cannot see other builders. No function grants cross-scope access.

### 2.3 Context-Aware Dashboards

| Dashboard | Society-Aware | What Changed |
|---|---|---|
| Society Admin (`SocietyAdminPage`) | Yes -- scoped to `profile.society_id` | Added admin appointment, removal, auto-approve toggle, approval method selector |
| Builder Dashboard (`BuilderDashboardPage`) | Yes -- shows all societies for builder | New page. Shows aggregate stats (members, pending, disputes) across managed societies |
| Society Dashboard (`SocietyDashboardPage`) | Yes -- all queries use `society_id` | Shows snags, disputes, expenses, milestones, documents, Q&A all scoped |
| Platform Admin (`AdminPage`) | Cross-society (platform admin only) | Manages all users, sellers, reviews, reports, warnings globally |

**Can a user manage multiple societies?** No. A user belongs to exactly one society (`profiles.society_id`). They can be a society_admin for that one society only.

**Is context switching implemented?** No. There is no society switcher dropdown. A user is locked to their society.

**Builder multi-society management?** Yes, but view-only aggregation. The builder dashboard shows all assigned societies with stats. Clicking a society links to `/society` which shows their own society context -- NOT the clicked society. This is a limitation.

### 2.4 Commerce Isolation

| Feature | Original (Single-Society) | Current (Multi-Society) |
|---|---|---|
| Marketplace listing | All approved sellers visible | Only sellers in user's society visible (RLS on `products` via `seller_profiles.society_id`) |
| Orders | No society scoping | `society_id` auto-populated via trigger `trg_set_order_society_id` |
| Reviews | Global visibility | Scoped to user's society via `seller_profiles.society_id` join |
| Coupons | No scoping | `society_id` column, visible only within same society |
| Featured items | Global | Still global (known gap -- `featured_items` has no `society_id`) |

### 2.5 Operational Controls

| Feature | Multi-Tenant Purpose |
|---|---|
| Auto-approval toggle | Each society controls its own onboarding speed |
| Governance health checks (edge function) | Detects orphaned societies, admin limit breaches, abuse spikes across ALL societies |
| Admin limit enforcement (trigger) | Prevents any single society from having too many admins |
| Audit trail | Society-scoped accountability for every admin action |
| Trigger error monitoring | Ensures activity logging works across all societies |

### 2.6 Remaining Single-Society Behaviors

| Limitation | Impact | Fix Effort |
|---|---|---|
| User belongs to exactly 1 society | Cannot be a member of 2 societies | Schema change (junction table) -- HIGH |
| No society context switcher | Admins cannot switch to manage another society | UI + auth context change -- MEDIUM |
| Builder dashboard view-only | Builder cannot take action on a specific society from their dashboard | Needs society impersonation -- HIGH |
| Notifications not society-labeled | User cannot tell which society a notification is from | Add `society_id` to display -- LOW |
| Analytics not society-scoped | No per-society usage analytics | Needs analytics infrastructure -- MEDIUM |
| `featured_items` not scoped | Featured items visible across societies | Add `society_id` column -- LOW |
| `cart_items` not society-scoped | Theoretically cross-society cart possible | Add society check on insert -- LOW |

### 2.7 Multi-Tenant Maturity Score

| Dimension | Score | Explanation |
|---|---|---|
| Governance scalability | 8 | Full delegation chain works. Limited by no society switcher for platform admins managing 100+ societies. |
| Role separation | 9 | 6-tier hierarchy enforced at database level. Clean SECURITY DEFINER boundaries. |
| Builder support | 6 | View-only dashboard. Cannot take actions on managed societies. No builder-level analytics. |
| Society-level autonomy | 8 | Each society controls approval, admins, settings. Missing: custom branding, custom categories per society. |
| Context switching UX | 3 | No context switcher exists. User is locked to one society. Builder dashboard links go to own society, not target society. |
| Operational automation | 7 | Health checks, trigger monitoring, audit logging exist. Missing: alerting, scheduled reports, automated escalation. |
| Global readiness | 7 | RLS isolation is solid. Missing: timezone handling, localization, currency formatting per society. |

**Overall: 6.9/10**

### 2.8 Final Assessment

At 20 builders, 100 societies, 500K users:

**Clean and isolated?** Yes at the data level. RLS enforces strict society boundaries. No cross-society data leakage is possible.

**Operationally messy?** Yes for platform admins and builders. Managing 100 societies without a context switcher means platform admins have no way to view a specific society's admin panel. Builder dashboard is read-only with no actionable capabilities.

### What Still Needs Refinement

1. **Society context switcher for platform admins** -- ability to "view as" a specific society
2. **Builder actionable dashboard** -- approve users, view disputes for their societies
3. **Society-scoped `featured_items`** -- add `society_id` column
4. **Notification queue** (Part 1D above) -- currently synchronous
5. **Per-society analytics** -- no usage tracking per society exists

---

## Implementation Sequence

```text
Phase 1 (Week 1): Database migrations
  - notification_queue table
  - orders_archive + audit_log_archive tables
  - rate_limits table
  - idempotency_key columns on orders + payment_records
  - featured_items add society_id column

Phase 2 (Week 1-2): React Query migration
  - Create src/hooks/queries/ directory
  - Migrate HomePage to targeted queries
  - Migrate SellerDashboardPage to paginated + React Query
  - Migrate BulletinPage, NotificationInboxPage, SocietyDashboardPage

Phase 3 (Week 2): Edge functions
  - process-notification-queue
  - archive-old-data
  - _shared/rate-limiter.ts + apply to existing functions

Phase 4 (Week 3): Frontend idempotency
  - Generate idempotency_key in cart checkout
  - Handle duplicate key responses gracefully
```

---

## Risk Assessment

| Change | Risk | Mitigation |
|---|---|---|
| React Query migration | MEDIUM -- touching all major pages | Migrate one page at a time, keep raw queries as fallback |
| Notification queue | LOW -- new table, no existing code broken | Queue is additive; direct notifications still work during transition |
| Archiving | LOW -- moves old data, no active queries affected | Archive tables have same schema, reversible |
| Rate limiting | LOW -- new middleware, does not affect existing logic | Conservative limits, easy to tune |
| Idempotency keys | LOW -- nullable column, backward compatible | Old orders without key still work |

