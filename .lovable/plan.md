

## Dynamic, Category-Agnostic License System

### What This Changes

Currently, the platform only enforces license requirements for the "food" category via hardcoded `primaryGroup === 'food'` checks. This plan replaces that with a fully database-driven system where admins can configure license requirements for ANY category (Food, Medical, Beauty, etc.) -- no code changes needed when new regulated categories are added.

### Answering Your Confirmations

1. **Multiple license types per group in the future?** Yes. The `seller_licenses` table links via `group_id`, so a single parent group can have its config updated, and a seller can hold multiple license records across different groups. To support multiple license types per single group later, you'd just add a `license_types` config table -- no schema redesign needed.

2. **Backend-validated enforcement?** Yes. We will add an RLS policy + database trigger that prevents product insertion when a seller's parent group has `license_mandatory = true` and no approved license exists. This cannot be bypassed from the frontend.

3. **Block product creation and order acceptance?** Yes. A validation trigger on the `products` table will reject inserts/updates when mandatory license is not approved. The UI will also show a clear block message, but the real enforcement lives in the database.

---

### Database Changes

**1. Add license config columns to `parent_groups` table:**

```text
requires_license    boolean  (default false)
license_type_name   text     (e.g. "FSSAI Certificate", "Clinical License")
license_description text     (guidance text for sellers)
license_mandatory   boolean  (default false -- blocks selling until approved)
```

**2. Create `seller_licenses` table:**

```text
id               uuid PK
seller_id        uuid FK -> seller_profiles.id
group_id         uuid FK -> parent_groups.id
license_type     text (copied from group config at submission)
license_number   text (optional, e.g. 14-digit FSSAI number)
document_url     text (storage URL)
status           text (pending / approved / rejected) default 'pending'
admin_notes      text (nullable)
submitted_at     timestamptz default now()
reviewed_at      timestamptz (nullable)
```

With RLS policies:
- Sellers can INSERT/SELECT/UPDATE their own licenses
- Admins can SELECT/UPDATE all licenses

**3. Backend enforcement trigger on `products` table:**

A BEFORE INSERT/UPDATE trigger that checks: if the seller's parent group has `license_mandatory = true`, and no approved license exists in `seller_licenses` for that seller + group, then RAISE EXCEPTION to block the operation.

**4. Seed existing food group:**

Set `requires_license = true`, `license_type_name = 'FSSAI Certificate'`, `license_description = 'Upload your FSSAI registration certificate...'`, `license_mandatory = true` on the food parent group.

**5. Migrate existing food license data:**

Move any `food_license_url` / `food_license_status` / `fssai_number` data from `seller_profiles` into the new `seller_licenses` table for continuity.

---

### Component Changes

**New: `src/components/seller/LicenseUpload.tsx`**
- Generic, category-agnostic license upload component
- Props: `sellerId`, `groupId` -- fetches license config from `parent_groups` dynamically
- Shows license type name, description, upload UI, status badge, license number input
- Replaces `FoodLicenseUpload.tsx`

**New: `src/components/admin/LicenseManager.tsx`**
- Unified admin view for ALL license submissions (not just food)
- Shows license type, seller name, status, approve/reject buttons
- Admin can configure which parent groups require licenses (toggle per group)
- Replaces `FoodLicenseManager.tsx`

---

### Page Modifications

**`src/pages/SellerSettingsPage.tsx`:**
- Remove `primaryGroup === 'food'` checks (lines 508, 539)
- Remove `fssai_number` from form data
- Instead: fetch parent group config, if `requires_license === true`, render `LicenseUpload`
- Remove import of `FoodLicenseUpload`

**`src/pages/SellerProductsPage.tsx`:**
- Keep veg/non-veg toggle gated on food category (it's a UI display preference, not license logic)
- Add a banner warning when mandatory license is not approved, explaining products cannot be saved

**`src/pages/AdminPage.tsx`:**
- Replace `<FoodLicenseManager />` with `<LicenseManager />`
- Remove `FoodLicenseManager` import

**`src/pages/BecomeSellerPage.tsx`:**
- Update declaration text: replace "(including FSSAI for food-related categories)" with generic "as required for your business category"

**`src/pages/TermsPage.tsx`:**
- Update FSSAI-specific text to be generic: "Sellers in regulated categories must hold valid licenses as configured by the platform"

---

### Files to Delete
- `src/components/seller/FoodLicenseUpload.tsx`
- `src/components/admin/FoodLicenseManager.tsx`

### Files to Create
- `src/components/seller/LicenseUpload.tsx`
- `src/components/admin/LicenseManager.tsx`

### Files to Modify
- `src/pages/SellerSettingsPage.tsx`
- `src/pages/SellerProductsPage.tsx`
- `src/pages/AdminPage.tsx`
- `src/pages/BecomeSellerPage.tsx`
- `src/pages/TermsPage.tsx`

### Database Migrations
1. ALTER `parent_groups` -- add license config columns
2. CREATE `seller_licenses` table with RLS + unique constraint on (seller_id, group_id)
3. CREATE validation trigger on `products` table for backend enforcement
4. SEED food group with license config
5. MIGRATE existing food license data from `seller_profiles` to `seller_licenses`

