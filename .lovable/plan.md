

# Redesign Categories Page -- Blinkit-Style End-to-End

## What Changes

The Categories page (`/categories` tab in bottom nav) will be redesigned from its current simple grid layout into a Blinkit-style two-panel browsing experience.

### Current State
- Simple grid of category tiles grouped under parent group headings
- Each tile links to `/category/{parentGroup}?sub={category}`
- No sidebar navigation

### New Blinkit-Style Layout

**Left Sidebar (fixed, ~72px wide):**
- Vertical scrollable list of parent groups (e.g., Food, Services, Lifestyle)
- Each entry shows the group icon/emoji in a circular container + group name below
- Active group is highlighted with a green left border accent and tinted background
- Tapping a group scrolls/switches the right panel to show its sub-categories

**Right Panel (remaining width):**
- Shows sub-categories for the selected parent group in a 3-column grid
- Each sub-category tile shows icon/image + name
- Only categories with active products are shown (respects the existing `activeCategorySet` logic)
- Tapping a sub-category navigates to `/category/{parentGroup}?sub={category}`

**Sticky Header:**
- "All Categories" title with the existing AppLayout header
- No search bar needed here (search is on the home page and individual category pages)

## Technical Details

### File: `src/pages/CategoriesPage.tsx` (rewrite)

1. Add `useState` for `activeGroup` -- defaults to the first parent group with products
2. Keep existing data-fetching logic (parent groups, category configs, product-based filtering)
3. Replace the render with a two-panel flex layout:
   - Left: `w-[72px] shrink-0 border-r` sidebar with parent group icons, scrollable
   - Right: `flex-1 overflow-y-auto` grid of sub-categories for the active group
4. Active group indicator: left green border bar + `bg-primary/10` background
5. Sub-category tiles: circular icon container + name, 3 columns on mobile
6. Keep the animated empty state for when no products exist at all
7. Filter both sidebar groups and right-panel categories by `activeCategorySet`

### Visual Spec

```text
+--------+----------------------------------+
| [icon] |  Sub-categories for "Food"       |
| Food * |  +------+ +------+ +------+      |
|        |  |Bakery| |Snacks| |Home  |      |
| [icon] |  |  🍞  | |  🍿  | |Food  |      |
| Srvc   |  +------+ +------+ +------+      |
|        |                                   |
| [icon] |  +------+ +------+               |
| Life   |  |Grocer| | ...  |               |
|        |  +------+ +------+               |
+--------+----------------------------------+
|        Bottom Navigation Bar              |
+-------------------------------------------+
```

### No Other Files Changed
- All data hooks remain the same
- Routing stays the same (`/categories`)
- Bottom nav stays the same
- The category click still navigates to `/category/{parentGroup}?sub={category}`

