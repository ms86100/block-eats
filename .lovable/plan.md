

# Marketplace Product Listing Redesign

## The Problem

Currently, when a user taps a category (e.g., "Food & Groceries") from the homepage, they land on `CategoryGroupPage` which shows **a list of seller cards** -- not products. This is like tapping "Biryani" on Zomato and seeing a list of restaurant logos instead of actual dishes with photos and prices.

The big apps (Zomato, Blinkit, Zepto, Amazon) all follow a **product-first** listing pattern:
- **Zomato**: Tap a cuisine -> see dishes from multiple restaurants, with images, prices, ratings, delivery time
- **Blinkit/Zepto**: Tap a category -> see a grid of product cards with images, price, "Add" buttons
- **Amazon**: Tap a category -> see product cards in a grid with image carousels, ratings, price

Our current flow: Homepage -> Category -> Seller list -> Tap seller -> See products. That is **3 taps** to see a single product. It should be **1 tap**.

## The Solution

Redesign `CategoryGroupPage` from a seller-centric listing to a **product-first listing** with carousels, sub-category tabs, and inline cart controls -- similar to how Blinkit/Zepto organize products within a category.

---

## Detailed Implementation

### Task 1: Redesign CategoryGroupPage to Product-First Layout

**Current state:** Shows seller cards only.
**New state:** Shows products organized by sub-category, with horizontal carousels per sub-category and a "See All" grid view.

**Layout structure (inspired by Blinkit/Zepto):**

```text
+------------------------------------------+
| <- Back    Food & Groceries    Search     |
+------------------------------------------+
| [All] [Home Food] [Bakery] [Snacks] ...  |  <- Sub-category pill tabs (horizontal scroll)
+------------------------------------------+
|                                          |
| -- Home Food (29 items) ---------- See All|
| [Card] [Card] [Card] [Card] ->          |  <- Horizontal carousel
|                                          |
| -- Bakery (3 items) ------------- See All|
| [Card] [Card] [Card] ->                 |  <- Horizontal carousel
|                                          |
| -- Snacks (3 items) ------------- See All|
| [Card] [Card] [Card] ->                 |  <- Horizontal carousel
|                                          |
| -- Top Sellers in Food -----------       |
| [SellerCard] [SellerCard] ->             |  <- Seller carousel at bottom
+------------------------------------------+
```

When a sub-category tab is tapped, switch to a **grid view** showing all products in that sub-category (2 columns, vertical product cards with image, name, price, seller name, "Add" button).

**Product card design (vertical, carousel-optimized):**
- 140px wide, image on top (square, rounded corners)
- Veg/Non-veg badge overlay on image
- Product name (1 line, truncated)
- Price in bold
- Seller name in muted small text
- Prep time if available (e.g., "~30 min")
- "Add +" button or quantity stepper at the bottom

**Files modified:**
- `src/pages/CategoryGroupPage.tsx` -- Complete redesign from seller-list to product-first layout with carousels

**Data fetching changes:**
- Fetch all products for the parent group (join with seller_profiles for seller name, rating)
- Group products by sub-category client-side
- Keep existing seller fetch for the "Top Sellers" section at the bottom

### Task 2: Create Reusable ProductCarousel Component

A horizontal scroll carousel component that can be reused on:
- CategoryGroupPage (per sub-category)
- HomePage (popular products section)
- SearchPage (category browse mode)

**Props:**
- `title` (string) -- section header
- `products` (array) -- product data with seller info
- `onSeeAll` (callback) -- when "See All" is tapped
- `variant` -- `'compact'` (small cards) or `'featured'` (larger cards with more detail)

Uses `embla-carousel-react` (already installed) for smooth swipe behavior with snap points.

**New file:** `src/components/product/ProductCarousel.tsx`

### Task 3: Create Vertical ProductGridCard Component

A compact vertical card designed for grid/carousel display (different from the existing horizontal `ProductCard` which is designed for seller detail page lists).

**Design:**
- Square image (aspect-ratio 1:1)
- Bestseller/Recommended badge overlay
- Veg badge
- Product name (truncated)
- Price
- Seller name (small, tappable)
- Prep time indicator
- "Add +" / quantity stepper
- Category emoji in corner

**New file:** `src/components/product/ProductGridCard.tsx`

### Task 4: Add Product Carousels to HomePage

Replace the current "seller-only" homepage with a mixed layout:

**Current:** Category icons -> Open Now sellers -> Nearby sellers -> Featured sellers
**New additions (inserted between existing sections):**
- "Popular Right Now" -- horizontal carousel of top-ordered products (from real order data)
- "Quick Bites" -- carousel filtered to food category products
- Keep existing seller sections but add product carousels between them

This gives the homepage a Zomato/Blinkit feel where users see actual products with prices immediately.

**File modified:** `src/pages/HomePage.tsx`
**New hook:** `src/hooks/queries/usePopularProducts.ts` -- fetches top products by order count

### Task 5: Add Service Listings to CategoryGroupPage

For non-product categories (services, classes, personal, professional, etc.), the same page should adapt its card design:

**Service card differences:**
- Instead of "Add +", show "Book" or "Contact" based on category behavior flags
- Show duration instead of price per item (e.g., "1 hr session")
- Show seller's availability hours
- Show "Starting from ₹X" pricing
- For workers (maid, cook, driver), show experience/availability

This uses the existing `CategoryBehavior` flags (`requiresTimeSlot`, `enquiryOnly`, `hasDuration`) to determine which card variant to render.

**Handled within:** `src/components/product/ProductGridCard.tsx` (behavior-aware rendering)

### Task 6: Enhance Search Page Category Browse Mode

When a user taps a category bubble on the SearchPage without typing a search term, show the products in carousel layout (same as CategoryGroupPage) instead of the current flat list.

**File modified:** `src/pages/SearchPage.tsx` -- When `selectedCategory` is set and no search term, render carousels grouped by sub-category instead of flat list.

---

## Technical Details

### Data Flow

```text
CategoryGroupPage
  |
  +-- Fetch products WHERE category IN (sub-categories of parent group)
  |     JOIN seller_profiles for seller_name, rating, fulfillment_mode
  |     Scoped by society_id
  |
  +-- Group by category client-side
  |
  +-- Render ProductCarousel per sub-category
  |     Each carousel uses ProductGridCard
  |
  +-- "See All" -> switches to grid view (2-col) for that sub-category
  |
  +-- Bottom section: Top Sellers carousel (existing SellerCard)
```

### Carousel Implementation

Using `embla-carousel-react` (already installed at v8.6.0):

```text
- Snap alignment: start
- Slide spacing: 12px
- Slide width: 152px (compact) or 200px (featured)
- Drag-free scrolling enabled
- Touch/swipe support built-in
```

### Files Summary

| Action | File | Purpose |
|--------|------|---------|
| Create | `src/components/product/ProductGridCard.tsx` | Vertical product card for grids/carousels |
| Create | `src/components/product/ProductCarousel.tsx` | Reusable horizontal carousel wrapper |
| Create | `src/hooks/queries/usePopularProducts.ts` | Fetch popular products by order volume |
| Rewrite | `src/pages/CategoryGroupPage.tsx` | Product-first layout with carousels |
| Modify | `src/pages/HomePage.tsx` | Add product carousels between seller sections |
| Modify | `src/pages/SearchPage.tsx` | Carousel layout for category browse mode |

### No Database Changes Required
All data already exists in the `products` and `seller_profiles` tables. We just need smarter queries and better UI presentation.

