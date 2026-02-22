

## Feature Audit and Preview Dashboard

### Problem
The admin manages features across 3 levels (Features, Packages, Assignments) but has no way to see the **end result** -- what a specific society actually gets after the 4-tier resolution runs. This makes it hard to verify or demo the system.

### Solution: Add two new views

---

### 1. Package Comparison Matrix (Packages Tab)
Add a visual comparison table below the existing package cards showing a side-by-side matrix of all packages vs all features, with green/red indicators. This instantly shows an admin "Basic gets 4 features, Pro gets 12, Enterprise gets all 18."

### 2. Society Feature Audit (Assignments Tab)
When an admin clicks on a builder assignment, show a **"Preview Society Features"** expandable section that:
- Lists all societies under that builder
- Lets admin pick a society
- Calls `get_effective_society_features()` for that society
- Shows the resolved feature list with color-coded sources:
  - **Core** (always on, blue badge)
  - **Package** (from assigned bundle, green/red)
  - **Override** (society admin changed it, orange badge)
  - **Default** (no builder, all enabled, gray)

This gives the admin a "what does this society actually see?" answer in one click.

---

### Technical Changes

**File: `src/components/admin/FeatureManagement.tsx`**

1. **Package Comparison Matrix** -- Add a "Compare Packages" button at the top of the Packages tab that toggles a comparison grid. The grid shows all features as rows and packages as columns, with check/cross icons and color coding.

2. **Society Feature Audit** -- In the Assignments tab, add an "Audit" button on each assignment card. Clicking it:
   - Fetches societies for that builder via `builder_societies` joined with `societies`
   - Lets admin select a society
   - Calls `get_effective_society_features` RPC for the selected society
   - Displays the resolved features in a clear list with source badges and enabled/disabled state
   - Shows a summary line: "X of 18 features enabled"

3. No database changes needed -- all data is already available via existing tables and the `get_effective_society_features` RPC.

### What the admin experiences
- Go to Admin > Features > Packages tab > click "Compare" > see a matrix showing exactly which features each tier includes
- Go to Assignments tab > click "Audit" on Prestige Group > select "Prestige Tranquility" > see "4 of 18 features enabled" with exact breakdown by source

### What helps the builder
- The builder dashboard can also reference this same audit data, but the immediate win is the admin can verify and demo the system confidently before selling packages to builders

