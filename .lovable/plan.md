

# Hardcoded Logic and Fragile Implementation Audit v2

## Executive Summary

Following the Sprint 1-4 remediation, 18 of the original 23 gaps have been fully resolved. This fresh audit identifies **14 remaining or new issues** across the codebase. The overall posture is significantly improved -- financial logic, contact emails, pricing, and key copy are now config-driven. The remaining gaps are mostly medium/low severity, with two high-priority items that could still surface during an investor demo.

---

## Status of Original 23 Gaps

**Fully Resolved (18):** Gaps 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 18, 19, 21

**Partially Resolved (3):** Gaps 6 (categories dynamic but landing page slide copy still static), 20 (main copy fixed but empty state still generic), 23 (pickup vs. delivery labels fixed but seller address is just the seller name, not actual location)

**Not Resolved (2):** Gap 16 (i18n day labels -- flagged only), Gap 22 (CMS for legal -- markdown fields exist in settings but TermsPage/PrivacyPolicyPage still render hardcoded HTML as fallback with no admin preview)

---

## NEW FINDINGS

### HIGH (Visible During Demo)

#### H1. Pricing Page PRICE_TIER_MAP Hardcodes Actual Prices

**File:** `PricingPage.tsx` lines 53-57

```
const PRICE_TIER_MAP = {
  free: { price: 'Free', period: 'forever', badge: null },
  pro: { price: '199', period: '/month', badge: 'Popular' },
  enterprise: { price: '999', period: '/month', badge: 'Enterprise' },
};
```

The pricing page fetches package **names and features** from the database, but the **actual price display** (199/999) is hardcoded in a frontend mapping. If an admin changes the price_tier label in the DB, the display won't match. The `feature_packages` table has a `price_tier` column (free/pro/enterprise) but no `price_amount` column.

**Risk:** An investor asks "Can we change the Pro plan to 299?" -- the admin panel has no UI for this, and changing it requires a code deployment.

**Fix:** Add a `price_amount` numeric column and `price_period` text column to `feature_packages`. Render from DB. Fall back to the current map only if columns are null.

---

#### H2. Currency Symbol is Hardcoded as "₹" Across 52 Files

All 52 component files use the literal `₹` symbol. The `system_settings` table has a `currency_symbol` key defined in the marketplace config pattern, but it's never actually read or used for rendering.

**Risk:** Low for India-only launch, but blocks any future international expansion. More importantly, it contradicts the config-driven architecture claim.

**Fix:** Add `currency_symbol` to `useSystemSettings` and create a `formatPrice(amount, symbol)` utility. Replace bare `₹` references incrementally. Low urgency but architecturally correct.

---

#### H3. Platform Fee Still Zero in RPC with No Config Read

**File:** `create_multi_vendor_orders` RPC function

```sql
platform_fee, net_amount
) VALUES (
  ...
  0, _final_amount
);
```

While `platform_fee_percent` is now in `system_settings` and visible in the admin UI, the RPC that actually creates payment records still hardcodes `platform_fee = 0` and `net_amount = _final_amount`. The setting exists but is never consumed by the backend.

**Risk:** If an admin sets `platform_fee_percent = 5` in the settings UI, nothing changes in actual financial calculations. This is a "config exists but does nothing" gap.

**Fix:** Modify the RPC to read `platform_fee_percent` from `system_settings` and compute:
```sql
_fee_percent := COALESCE((SELECT value::numeric FROM system_settings WHERE key = 'platform_fee_percent'), 0);
_platform_fee := ROUND(_final_amount * _fee_percent / 100, 2);
_net := _final_amount - _platform_fee;
```

---

### MEDIUM (Polish, Edge Cases)

#### M1. FilterPresets Hardcodes "Under 150" Budget Filter

**File:** `FilterPresets.tsx` line 21

```
label: 'Under 150',
filters: { priceRange: [0, 150] as [number, number] },
```

This budget filter threshold should be configurable. For a premium society, 150 may be irrelevant.

**Fix:** Add `budget_filter_threshold` to `system_settings`. Read in FilterPresets.

---

#### M2. Landing Page Slide Copy is Still Hardcoded

**File:** `LandingPage.tsx` lines 80-213

While the "What You Can Do" categories section (Slide 3) is now dynamically fetched from `parent_groups`, the other 4 slides contain hardcoded marketing copy:
- Slide 1: "Your Society. Your Marketplace."
- Slide 2: "Only Verified Residents" (GPS verification, invite code, etc.)
- Slide 4: "Turn Your Passion Into Income" (Zero listing fee, etc.)
- Slide 5: "A marketplace built exclusively for our community"

These are reasonable defaults but cannot be customized per deployment.

**Fix:** Store landing page slides as JSON in `system_settings` (key: `landing_slides_json`). Fall back to current hardcoded slides if empty. Low urgency -- current copy is generic enough.

---

#### M3. CommunityRulesPage Violations Are Hardcoded

**File:** `CommunityRulesPage.tsx` lines 42-46

```
const VIOLATIONS = [
  { level: 'Warning', description: 'First-time minor violations', action: 'Written warning' },
  { level: 'Temporary Suspension', ... action: '7-day account suspension' },
  { level: 'Permanent Ban', ... action: 'Account permanently disabled' },
];
```

The rules section reads `society.rules_text` but the violation consequences table is always hardcoded. The "7-day" suspension duration is not configurable.

**Fix:** Add `violation_policy_json` to `system_settings` or render from `societies.rules_text` as a complete document.

---

#### M4. Seller Dashboard Empty State Copy is Generic but Not Configurable

**File:** `SellerDashboardPage.tsx` line 128

```
"Sell products, groceries, or services to your community"
```

This was previously food-biased and was fixed to be generic. But it's still a hardcoded string that can't be customized per society or deployment.

**Fix:** Low priority. Could be stored in `system_settings` as `seller_empty_state_copy` but this is over-engineering for a fallback empty state.

---

#### M5. Pricing Page Always Shows FALLBACK_PLANS + DB Plans

**File:** `PricingPage.tsx` line 104

```
return [...FALLBACK_PLANS, ...dbPlans];
```

The pricing page **always** renders the two hardcoded "Free (Buyers)" and "Free (Sellers)" plans alongside whatever the database returns. Even if an admin removes or renames these tiers, the hardcoded ones persist.

**Fix:** Only show FALLBACK_PLANS when `dbPlans` is empty. Currently line 68 handles the empty case, but line 104 concatenates them regardless.

---

#### M6. Legal Pages Have Dual Rendering Path But No Markdown Renderer

**Files:** `TermsPage.tsx`, `PrivacyPolicyPage.tsx`

These pages check `settings.termsContentMd` and render it in a `<pre>` tag with `whitespace-pre-wrap`. This is not actually markdown rendering -- it's raw text display. Bold, headings, links won't render.

**Fix:** Install a lightweight markdown renderer (e.g., `react-markdown`) or render as `dangerouslySetInnerHTML` with sanitization. Alternatively, keep the HTML fallback as the primary path and treat the markdown field as a "future CMS" feature.

---

### LOW (Future-Proofing)

#### L1. Brand Name "Sociva" Hardcoded in 11 Files

The brand name appears in:
- `TermsPage.tsx` (multiple legal references)
- `PrivacyPolicyPage.tsx` (multiple legal references)
- `CommunityRulesPage.tsx` ("By using Sociva...")
- `ProfilePage.tsx` ("Sociva v2.0.0")
- `types/database.ts` (comment)
- `tooltip-guide.tsx` (localStorage key)

For white-labeling, the brand name needs to be configurable.

**Fix:** Add `platform_name` to `system_settings`. Replace hardcoded "Sociva" references. Low urgency unless white-labeling is imminent.

---

#### L2. AUTOPLAY_INTERVAL Hardcoded at 8000ms

**File:** `LandingPage.tsx` line 14

The landing page carousel auto-advances every 8 seconds. This is a UX decision that could be configurable, but is low priority.

---

#### L3. Seller Onboarding Placeholder Text is Group-Specific But Hardcoded

**File:** `BecomeSellerPage.tsx` lines 757-759

```
placeholder={
  selectedGroup === 'food' ? "e.g., Amma's Kitchen, Fresh Bakes"
  : selectedGroup === 'services' ? "e.g., QuickFix Repairs, Yoga with Priya"
  ...
}
```

These placeholder examples are hardcoded per group. They should ideally come from `parent_groups.placeholder_hint` or similar.

**Fix:** Add a `placeholder_examples` text column to `parent_groups`. Low priority.

---

#### L4. LocalStorage Keys Use "sociva_" Prefix

**Files:** `ProfilePage.tsx` ("sociva_large_font"), `tooltip-guide.tsx` ("sociva_tooltips_viewed")

For white-labeling, localStorage keys with brand names will leak the underlying platform identity.

**Fix:** Use a generic prefix like `app_` or make it configurable. Very low priority.

---

## Prioritized Implementation Plan

### Immediate (Before Next Demo)

| # | Gap | Effort | Impact |
|---|-----|--------|--------|
| H3 | Platform fee RPC reads from config | Low | Financial logic actually works end-to-end |
| M5 | Pricing page: don't duplicate free plans | Low | Prevents confusing duplicate tiers |

### Short-Term (Investor Readiness)

| # | Gap | Effort | Impact |
|---|-----|--------|--------|
| H1 | Price amounts from DB, not frontend map | Medium | Admin can change prices without code deploy |
| M6 | Markdown rendering for legal CMS | Low | Makes the CMS feature actually usable |
| M3 | Configurable violation policy | Low | Completes community rules config story |

### Medium-Term (Production Polish)

| # | Gap | Effort | Impact |
|---|-----|--------|--------|
| H2 | Currency symbol utility | Medium | Config-driven architecture consistency |
| M1 | Configurable budget filter | Low | Multi-market flexibility |
| M2 | Landing page slide CMS | Medium | White-label readiness |
| L1 | Platform name from config | Low | White-label readiness |

### Deferred (Future-Proofing)

| # | Gap | Effort | Impact |
|---|-----|--------|--------|
| L2 | Carousel interval config | Trivial | Minor UX control |
| L3 | Seller onboarding placeholders from DB | Low | Polish |
| L4 | Generic localStorage prefix | Trivial | White-label edge case |
| M4 | Seller empty state copy from config | Trivial | Over-engineering concern |

---

## Technical Implementation Notes

### H3 - Platform Fee RPC Fix (SQL migration)

```sql
-- Inside create_multi_vendor_orders, replace hardcoded 0:
_fee_percent := COALESCE(
  (SELECT value::numeric FROM system_settings WHERE key = 'platform_fee_percent'),
  0
);
_platform_fee := ROUND(_final_amount * _fee_percent / 100, 2);
_net := _final_amount - _platform_fee;

-- Then use _platform_fee and _net in the INSERT
```

### M5 - Pricing Page Fix (1-line change)

```typescript
// Line 104: Change from
return [...FALLBACK_PLANS, ...dbPlans];
// To
return dbPlans.length > 0 ? dbPlans : FALLBACK_PLANS;
```

### H1 - Price Amount from DB

Add `price_amount` (numeric, nullable) and `price_period` (text, nullable) columns to `feature_packages`. When non-null, use them for display instead of `PRICE_TIER_MAP`. Keep the map as fallback.

