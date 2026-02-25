

## Thorough Audit: Subcategory Management Issues

### Issues Identified

**Issue 1: Newly created categories not appearing in the subcategory dropdown**

The `SubcategoryManager` fetches categories via `fetchConfigs()` on mount. However, `fetchConfigs()` uses `useCallback` with an empty dependency array, meaning it captures the initial state. The real problem is **timing**: `fetchConfigs()` runs on mount and when the "Add Subcategory" button is clicked, but it queries `category_config` directly from the database. The user's screenshot shows categories like "Beverages" in the dropdown but NOT the newly created "tt" group's categories.

Looking at the database: the user created a **parent group** named "tt" but has NOT yet created any **categories** under it. The `category_config` table has zero rows with `parent_group = 'tt'`. The dropdown correctly shows all `category_config` rows -- the issue is the user expects the group "tt" to appear as a parent, but `SubcategoryManager` lists `category_config` rows (categories), not `parent_groups`.

This is correct behavior -- subcategories are children of **categories**, not groups. But the UX is confusing because the user may have only created a group and not a category within it.

**Issue 2: Add form is sparse compared to Edit category form**

The Edit Category dialog in `CategoryManager.tsx` (lines 230-313) has a rich form with: Display Name, Generate AI Image, Icon (with emoji picker), Color, Form Hints (name/description/price/duration placeholders), and configuration toggles (show veg, show duration). The Add Subcategory dialog in `SubcategoryManager.tsx` (lines 271-338) only has: Parent Category selector, Display Name, Slug, Icon (text input), Display Order, and Active toggle. The user wants **parity** between the two.

### Root Cause Summary

1. The subcategory dropdown works correctly -- it shows all `category_config` rows from the database. The "tt" entry is a **group**, not a category. No categories exist under it yet.
2. The subcategory form lacks the rich fields (image, color, seller form hints, toggles) that the category edit form has.
3. The `subcategories` table schema only has: `id, category_config_id, slug, display_name, display_order, icon, is_active, created_at, updated_at`. It is missing columns for: `image_url`, `color`, `name_placeholder`, `description_placeholder`, `price_label`, `duration_label`, `show_veg_toggle`, `show_duration_field`.

### Fix Plan

#### Step 1: Database Migration -- Add missing columns to `subcategories` table

Add the following columns to the `subcategories` table to support the full configuration the user wants:

```sql
ALTER TABLE public.subcategories
  ADD COLUMN IF NOT EXISTS image_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS color text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS name_placeholder text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS description_placeholder text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS price_label text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS duration_label text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS show_veg_toggle boolean DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS show_duration_field boolean DEFAULT NULL;
```

Using `NULL` defaults means subcategory settings are optional -- when NULL, the parent category's settings are inherited. Only non-NULL values override the parent.

#### Step 2: Rewrite `SubcategoryManager.tsx` Add/Edit dialog

Replace the current sparse subcategory dialog with a rich form matching the category edit dialog. The new dialog will include:

- **Parent Category selector** (for Add mode; read-only badge for Edit mode)
- **Display Name** with auto-slug generation
- **Category Image** section with "Generate AI Image" button (reusing the existing `GenerateImageButton` pattern from `CategoryManager.tsx` but adapted for subcategories)
- **Icon** with the same emoji picker grid used in `CategoryManager`
- **Color** with the same preset dropdown used in `CategoryManager`
- **Slug** field (auto-generated, editable)
- **Display Order** + **Active** toggle
- **Seller Form Hints** section: Name Placeholder, Description Placeholder, Price Label, Duration Label
- **Configuration Toggles**: Show Veg/Non-Veg, Show Duration Field

The form will use `ScrollArea` for overflow and match the visual style of the category edit dialog (same `rounded-2xl`, section dividers, label sizes).

#### Step 3: Create subcategory image generation edge function

Create a new edge function `generate-subcategory-image` (or reuse `generate-category-image` with a `targetTable` parameter) that:
- Takes `subcategoryName`, `subcategoryId`, and optionally `parentCategoryName`
- Generates an AI image using the same Lovable AI gateway
- Uploads to a `subcategory-images` storage bucket
- Updates the `subcategories.image_url` column

Alternatively, we can adapt the existing `generate-category-image` function to accept a `type` parameter and handle both category and subcategory image generation, storing subcategory images in the same `category-images` bucket with a `sub/` prefix.

#### Step 4: Create storage bucket for subcategory images

```sql
INSERT INTO storage.buckets (id, name, public) 
VALUES ('subcategory-images', 'subcategory-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view subcategory images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'subcategory-images');

CREATE POLICY "Admins can upload subcategory images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'subcategory-images' AND public.is_admin(auth.uid()));
```

#### Step 5: Update `Subcategory` interface and form state

Update the `Subcategory` interface in `SubcategoryManager.tsx` to include the new fields. Update `formData` state to include all new configurable options.

#### Step 6: Wire subcategory form hints into seller product forms

Update `useSubcategories.ts` to return the new fields. In `useSellerProducts.ts`, when a subcategory is selected, override the parent category's form hints with the subcategory's non-null values. This ensures the subcategory settings cascade correctly to seller-facing forms.

#### Step 7: Update `CategoryPage.tsx` subcategory filter chips

Update the subcategory filter chips in `CategoryPage.tsx` to display the subcategory icon/image/color if available.

### What will NOT change
- No changes to RLS policies (existing admin-only write, public read policies are correct)
- No changes to the `category_config` table or its management
- No changes to the parent group management
- The existing category edit dialog remains untouched
- All existing CRUD functionality remains intact
- The `useSubcategories` hook's query key and caching strategy remain the same

### Files to be modified
| File | Change |
|------|--------|
| `supabase/migrations/new.sql` | Add 8 columns to subcategories table + storage bucket |
| `src/components/admin/SubcategoryManager.tsx` | Full dialog rewrite with rich form, emoji picker, color selector, AI image, form hints, toggles |
| `src/hooks/useSubcategories.ts` | Update interface to include new fields |
| `src/hooks/useSellerProducts.ts` | Cascade subcategory form hints over parent category |
| `supabase/functions/generate-category-image/index.ts` | Add subcategory support (or new edge function) |

