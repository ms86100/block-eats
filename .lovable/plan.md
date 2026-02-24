

# Seller-Customizable Plug-and-Play Listing Form

A system that lets sellers extend their product listing form with optional attribute blocks (variants, size chart, service duration, etc.) without admin intervention, DB migrations, or changes to checkout/payment/delivery logic.

---

## Architecture Overview

The system has four layers:

1. **Block Library** (platform-defined, DB table) -- the menu of available blocks
2. **Seller Form Config** (per-seller, DB table) -- which blocks a seller has chosen and their order
3. **Seller Form Builder** (drag-and-drop UI) -- where sellers pick and arrange blocks
4. **Buyer Renderer** (dynamic UI) -- renders only the blocks the seller filled in

All custom attribute data is stored in the existing `products.specifications` JSONB column. No new product columns are added.

---

## Data Model

### New Table: `attribute_block_library`

Platform-curated library of reusable attribute blocks.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid PK | Block identifier |
| `block_type` | text UNIQUE NOT NULL | Machine key (e.g. `variants`, `size_chart`, `service_duration`) |
| `display_name` | text NOT NULL | Human label ("Variants", "Size Chart") |
| `description` | text | Help text shown to seller |
| `icon` | text | Emoji or icon name |
| `category_hints` | text[] | Suggested categories (soft guidance, not enforcement) |
| `schema` | jsonb NOT NULL | JSON Schema defining the block's data shape and validation rules |
| `renderer_type` | text NOT NULL | How buyer UI renders it: `key_value`, `table`, `tags`, `badge_list`, `text` |
| `display_order` | integer DEFAULT 0 | Default sort in library palette |
| `is_active` | boolean DEFAULT true | Platform can retire blocks without data loss |
| `created_at` | timestamptz DEFAULT now() | |

Example `schema` for the Variants block:
```text
{
  "type": "object",
  "properties": {
    "options": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "label": { "type": "string" },
          "values": { "type": "array", "items": { "type": "string" } }
        }
      }
    }
  }
}
```

### New Table: `seller_form_configs`

Stores a seller's chosen block arrangement per category (or default).

| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid PK | |
| `seller_id` | uuid FK -> seller_profiles NOT NULL | |
| `category` | text NULL | Category-specific config (NULL = default for all categories) |
| `blocks` | jsonb NOT NULL | Ordered array of `{ block_type, display_order }` |
| `created_at` | timestamptz DEFAULT now() | |
| `updated_at` | timestamptz | |

**Unique constraint**: `(seller_id, COALESCE(category, '__default__'))` -- one config per seller per category.

### Storage in `products.specifications` (existing column)

When a seller fills in attribute blocks, the data is saved as:

```text
{
  "blocks": [
    {
      "type": "variants",
      "data": {
        "options": [
          { "label": "Size", "values": ["S", "M", "L"] },
          { "label": "Color", "values": ["Red", "Blue"] }
        ]
      }
    },
    {
      "type": "service_duration",
      "data": { "duration_minutes": 60, "unit": "minutes" }
    }
  ]
}
```

---

## RLS Policies

### `attribute_block_library`
- **SELECT**: Public (anyone can read the library)
- **INSERT/UPDATE/DELETE**: Platform admin only (`is_admin(auth.uid())`)

### `seller_form_configs`
- **SELECT**: Owner (`seller_id` matches user's seller profile) or admin
- **INSERT**: Owner only, with `seller_id` matching their profile
- **UPDATE**: Owner only
- **DELETE**: Owner only

---

## Seed Data (12 Blocks)

The migration will seed these blocks into `attribute_block_library`:

| block_type | display_name | renderer_type | category_hints |
|-----------|-------------|--------------|----------------|
| `variants` | Variants | `tags` | clothing, electronics, furniture |
| `size_chart` | Size Chart | `table` | clothing, footwear |
| `inventory` | Inventory | `key_value` | groceries, electronics |
| `service_duration` | Service Duration | `badge_list` | ac_service, plumber, electrician |
| `pricing_model` | Pricing Model | `key_value` | yoga, carpenter |
| `location` | Location / Service Area | `text` | plumber, electrician, carpenter |
| `availability` | Availability Window | `key_value` | home_food, bakery |
| `delivery_fulfillment` | Delivery and Fulfillment | `badge_list` | groceries, electronics |
| `custom_attributes` | Custom Details | `key_value` | (all) |
| `deposit` | Advance / Deposit | `key_value` | furniture, electronics |
| `return_policy` | Return / Cancellation | `text` | clothing, electronics, furniture |
| `compliance` | Certifications | `badge_list` | home_food, bakery, beauty |

---

## UI Components

### 1. Seller Form Builder (`src/components/seller/AttributeBlockBuilder.tsx`)

Shown inside the existing product creation/edit dialog in `SellerProductsPage.tsx`, below the base form fields.

- Fetches `attribute_block_library` and `seller_form_configs` for the current seller
- Displays a **collapsible "Customize Listing" section** with:
  - **Active blocks**: Drag-and-drop sortable list (using existing `@dnd-kit` dependency)
  - **Add block button**: Opens a sheet/popover showing available blocks filtered by category hints (soft -- all blocks are always available)
- Each active block expands to show its form fields (generated from the block's `schema`)
- Seller can remove any block at any time
- On save, the block arrangement is persisted to `seller_form_configs` and the filled data to `products.specifications`

### 2. Block Form Renderer (`src/components/seller/AttributeBlockForm.tsx`)

Takes a block's `schema` and renders the appropriate form inputs:
- `string` -> `Input`
- `array of strings` -> Tag input (comma-separated or chip input)
- `number` -> `Input type="number"`
- `boolean` -> `Switch`
- `object with properties` -> Nested fieldset

This is a small, self-contained component (~80 lines).

### 3. Buyer Attribute Renderer (`src/components/product/ProductAttributeBlocks.tsx`)

Reads `specifications.blocks` from a product and renders each block using the `renderer_type`:
- `key_value` -> Label-value pairs in a grid
- `table` -> Simple HTML table
- `tags` -> Row of Badge components
- `badge_list` -> Row of Badges with icons
- `text` -> Paragraph

Integrated into `ProductDetailSheet.tsx` inside the expandable "View product details" section, after the description.

### 4. Hook: `useAttributeBlocks` (`src/hooks/useAttributeBlocks.ts`)

Fetches the block library and the current seller's form config. Provides:
- `blocks` -- all active library blocks
- `sellerConfig` -- current seller's chosen blocks for the active category
- `saveConfig(blocks)` -- persist block arrangement
- `suggestedBlocks(category)` -- blocks matching category hints (sorted first)

---

## Integration Points

### SellerProductsPage.tsx (existing)

Minimal changes:
- Import and render `AttributeBlockBuilder` below the existing form fields inside the product dialog
- On save, include the block data in `specifications` field of the product insert/update
- On edit, pass existing `specifications.blocks` to the builder for pre-population

### ProductDetailSheet.tsx (existing)

Minimal changes:
- Import `ProductAttributeBlocks`
- Render it inside the `showDetails` expandable section, after the description
- Pass `product.specifications` (fetched from DB -- already part of the product query)

### CategoryPage.tsx / SearchPage.tsx

No changes needed. Custom attributes are display-only on the detail sheet. They do not affect search, sort, or filtering.

---

## What This Does NOT Change

- Base form fields remain immutable
- No new columns on `products` table
- Checkout, payment, delivery, and order logic are completely unaffected
- `products.specifications` is never read by any order/payment/delivery code
- Existing listings with NULL specifications continue to work
- No admin approval required for sellers to use blocks
- Removing a block from the form does not delete the data from `specifications` (non-destructive)

---

## Files to Create / Modify

| File | Type | Purpose |
|------|------|---------|
| New migration SQL | DB | `attribute_block_library` table, `seller_form_configs` table, RLS, seed data |
| `src/hooks/useAttributeBlocks.ts` | New | Hook for block library + seller config CRUD |
| `src/components/seller/AttributeBlockBuilder.tsx` | New | Drag-and-drop block builder for seller form |
| `src/components/seller/AttributeBlockForm.tsx` | New | Schema-driven form renderer per block |
| `src/components/product/ProductAttributeBlocks.tsx` | New | Buyer-side dynamic block renderer |
| `src/pages/SellerProductsPage.tsx` | Edit | Integrate block builder into product dialog, save/load specifications |
| `src/components/product/ProductDetailSheet.tsx` | Edit | Render attribute blocks in detail view |
| `src/integrations/supabase/types.ts` | Auto | Auto-updated after migration |

---

## Technical Details

### Validation Strategy

- **Client-side**: The `AttributeBlockForm` component validates input against the block's JSON Schema before save (using Zod schemas derived from the block schema)
- **Server-side**: The `specifications` column is JSONB with no DB-level schema enforcement (intentional -- allows forward/backward compatibility)
- **Unknown block types**: The buyer renderer silently skips any `block.type` it does not recognize (version-safe)

### Performance

- Block library is cached with 10-minute stale time (small, rarely changes)
- Seller form configs are fetched per-seller session
- No additional queries on buyer side -- `specifications` is already part of the product row

### Migration Safety

- All changes are additive (new tables, new seed data)
- No existing table modifications
- No data migration required
- Rollback = drop the two new tables

