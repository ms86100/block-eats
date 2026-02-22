

# Phase 1-5: Mutation Resilience & Enforcement Hardening

## Overview

Five structural fixes to move Sociva from "dynamic SaaS" to "enforcement-grade SaaS." Prioritized by architectural risk.

---

## Phase 1: Backend Feature Flag Enforcement (Medium-High Priority)

### Problem
`is_feature_enabled_for_society()` exists but is not used in any RLS policy. Feature gates only block UI rendering. Direct API calls can still write to feature-gated tables.

### Solution

**Step 1: Create helper function**

```sql
CREATE OR REPLACE FUNCTION public.can_access_feature(_feature_key text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT public.is_feature_enabled_for_society(
    public.get_user_society_id(auth.uid()),
    _feature_key
  )
$$;
```

**Step 2: Add RESTRICTIVE write-blocking policies**

Apply to each feature-gated table (INSERT, UPDATE, DELETE only -- SELECT remains open for historical data):

| Feature Key | Tables |
|---|---|
| `snag_management` | `snag_tickets` |
| `disputes` | `dispute_tickets`, `dispute_comments` |
| `bulletin` | `bulletin_posts`, `bulletin_comments`, `bulletin_votes`, `bulletin_rsvps`, `help_requests`, `help_responses` |
| `finances` | `society_expenses` |
| `maintenance` | `maintenance_dues` |
| `construction_progress` | `construction_milestones` |
| `visitor_management` | `visitor_entries`, `authorized_persons` |
| `vehicle_parking` | `society_vehicles` |
| `parcel_management` | `society_parcels` |
| `workforce_management` | `society_workers`, `worker_flat_assignments` |
| `worker_marketplace` | `worker_job_requests` |

Each policy follows this pattern:
```sql
CREATE POLICY "feature_gate_<table>_insert"
ON public.<table>
AS RESTRICTIVE
FOR INSERT TO authenticated
WITH CHECK (public.can_access_feature('<feature_key>'));
```

Repeat for UPDATE and DELETE where applicable.

**Step 3: Edge function feature checks**

Add feature validation before mutations in `manage-delivery`:
```typescript
const { data: enabled } = await serviceClient.rpc(
  'is_feature_enabled_for_society',
  { _society_id: societyId, _feature_key: 'delivery' }
);
if (!enabled) return jsonResponse({ error: 'Feature disabled' }, 403);
```

### Files Changed
- 1 new migration (RLS policies + `can_access_feature` function)
- `supabase/functions/manage-delivery/index.ts` (add feature check)

---

## Phase 2: Rate Limiting Standardization (Medium Priority)

### Problem
Only `gate-token` uses the shared rate limiter. Other mutation endpoints are unprotected.

### Solution

Add `checkRateLimit` calls to these edge functions:

| Function | Key Pattern | Limit |
|---|---|---|
| `create-razorpay-order` | `order:${userId}` | 10/min |
| `manage-delivery` (non-webhook) | `delivery:${userId}` | 20/min |
| `delete-user-account` | `delete-account:${userId}` | 3/hour |
| `seed-test-data` | `seed:${userId}` | 5/hour |
| `generate-product-image` | `gen-image:${userId}` | 10/min |
| `generate-category-image` | `gen-cat-image:${userId}` | 10/min |

### Files Changed
- `supabase/functions/create-razorpay-order/index.ts`
- `supabase/functions/manage-delivery/index.ts`
- `supabase/functions/delete-user-account/index.ts`
- `supabase/functions/seed-test-data/index.ts`
- `supabase/functions/generate-product-image/index.ts`
- `supabase/functions/generate-category-image/index.ts`

---

## Phase 3: 3PL Webhook Signature Validation (Medium Priority)

### Problem
`manage-delivery` webhook action accepts any payload without signature verification.

### Solution

Add HMAC-SHA256 signature validation to the webhook handler:

```typescript
async function handleWebhook(req: Request, db: any) {
  const signature = req.headers.get('x-webhook-signature');
  const body = await req.text();

  // Get 3PL webhook secret from system_settings
  const { data: setting } = await db
    .from('system_settings')
    .select('value')
    .eq('key', '3pl_webhook_secret')
    .maybeSingle();

  if (setting?.value && signature) {
    const isValid = await verifyHMAC(body, signature, setting.value);
    if (!isValid) {
      // Log and reject
      return jsonResponse({ error: 'Invalid signature' }, 401);
    }
  } else if (setting?.value && !signature) {
    // Secret configured but no signature provided
    return jsonResponse({ error: 'Missing signature' }, 401);
  }
  // If no secret configured, allow (backward compat during setup)

  // ... existing webhook logic
}
```

Also add rate limiting to the webhook endpoint: 60 req/min per IP.

### Files Changed
- `supabase/functions/manage-delivery/index.ts`

---

## Phase 4: Realtime Role Change Handling (Low-Medium Priority)

### Problem
Backend immediately blocks access on role removal, but UI retains stale state until page refresh.

### Solution

Add realtime subscriptions in `useAuthState.ts` for role/permission tables:

```typescript
// Subscribe to role changes for current user
const roleChannel = supabase
  .channel('role-changes')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'user_roles',
    filter: `user_id=eq.${session.user.id}`,
  }, () => fetchProfile(session.user.id))
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'security_staff',
    filter: `user_id=eq.${session.user.id}`,
  }, () => fetchProfile(session.user.id))
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'society_admins',
    filter: `user_id=eq.${session.user.id}`,
  }, () => fetchProfile(session.user.id))
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'builder_members',
    filter: `user_id=eq.${session.user.id}`,
  }, () => fetchProfile(session.user.id))
  .subscribe();
```

Requires enabling realtime on `user_roles`, `security_staff`, `society_admins`, `builder_members` tables (migration).

### Files Changed
- 1 new migration (enable realtime on 4 tables)
- `src/contexts/auth/useAuthState.ts` (add realtime subscriptions)

---

## Phase 5: Edge Function Auth Centralization (Low Priority)

### Problem
Each edge function manually extracts and validates Bearer tokens with duplicated code.

### Solution

Create `supabase/functions/_shared/auth.ts`:

```typescript
export async function withAuth(
  req: Request,
  corsHeaders: Record<string, string>
): Promise<{ userId: string; userClient: any } | Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace('Bearer ', '');
  const { data, error } = await userClient.auth.getClaims(token);
  if (error || !data?.claims) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return { userId: data.claims.sub as string, userClient };
}
```

Refactor authenticated edge functions to use:
```typescript
const authResult = await withAuth(req, corsHeaders);
if (authResult instanceof Response) return authResult;
const { userId } = authResult;
```

### Files Changed
- New file: `supabase/functions/_shared/auth.ts`
- Refactor: `manage-delivery`, `gate-token`, `create-razorpay-order`, `delete-user-account`, `generate-product-image`, `generate-category-image`

---

## Sequencing

| Phase | Priority | Effort | Description |
|---|---|---|---|
| 1 | Immediate | Medium | Feature flag backend enforcement via RLS |
| 2 | High | Low | Rate limiting on mutation endpoints |
| 3 | High | Low | 3PL webhook signature validation |
| 4 | Medium | Low | Realtime role change subscriptions |
| 5 | Low | Medium | Auth middleware centralization |

