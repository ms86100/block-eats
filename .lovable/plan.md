

# Fix: Empty Categories (like "Groceries") Should Not Be Displayed

## Problem

The "Groceries" category appears as a clickable pill on the Food category page (`/category/food`), but has zero products. Clicking it shows "No items found." Per the agreed-upon rule, categories with no products should be hidden from the buyer.

## Root Cause

The CategoryGroupPage renders sub-category pills (line 174) directly from `useCategoryConfigs()`, which returns ALL active categories from the `category_config` table -- regardless of whether they have any products. There is no filtering against actual product data.

The CategoriesPage already has this filtering logic (using `activeCategorySet`), but the CategoryGroupPage does not.

## Solution

Filter the sub-category pills on the CategoryGroupPage to only show categories that have at least one product visible to the buyer. Since `useCategoryProducts` already fetches all products for this parent group (including cross-society nearby products), we can derive the active categories from the product data.

### Changes

**File: `src/pages/CategoryGroupPage.tsx`**

1. Compute an `activeCategorySet` from `allProducts` (which already includes nearby cross-society products)
2. Filter `subCategories` to only include categories present in that set
3. Hide the "All" tab if only one category has products (matching the existing rule)
4. Remove the pills bar entirely if no categories have products

This is a small, focused change -- about 5-10 lines added to derive the set and filter the array. No new hooks or database queries needed since the product data is already loaded.

## Technical Details

```text
Before (line ~35):
  subCategories = groupedConfigs[category] (all active configs)

After:
  activeCats = new Set(allProducts.map(p => p.category))
  subCategories = groupedConfigs[category].filter(c => activeCats.has(c.category))
```

The "All" pill visibility also needs to respect the rule: hide it when only 1 category has products.

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/CategoryGroupPage.tsx` | Filter sub-category pills by products that actually exist |

## Impact

- "Groceries" pill will no longer appear since it has 0 products
- Only Bakery, Home Food, and Snacks will show (the categories with actual products)
- No database changes needed
- No new files needed

