

## Problem

The category system has **hardcoded parent group keys** in two critical places, which means any new parent group created by an admin (like "Donation") will never show its sub-categories:

1. **`src/types/categories.ts`** - The `ParentGroup` type is a hardcoded union of 10 values. "Donation" is not included.
2. **`src/hooks/useCategoryBehavior.ts`** - The `groupedConfigs` object is initialized with only 10 hardcoded keys. Any category with a `parent_group` not in that list gets silently dropped.
3. **`src/types/categories.ts`** - `DEFAULT_GROUP_BEHAVIORS` is a hardcoded `Record<ParentGroup, ...>` that only covers 10 groups.

When a seller selects "Donation", the code looks up `groupedConfigs['donation']` which is `undefined`, so it falls back to `[]` and shows "No categories available".

## Solution: Make Everything Dynamic

### 1. Make `ParentGroup` a flexible string type (like `ServiceCategory` already is)

In `src/types/categories.ts`:
- Change `ParentGroup` from a hardcoded union to `string` (same approach already used for `ServiceCategory`)
- Change `DEFAULT_GROUP_BEHAVIORS` from `Record<ParentGroup, ...>` to a flexible lookup with a sensible fallback for unknown groups

### 2. Make `groupedConfigs` fully dynamic in `useCategoryBehavior.ts`

Instead of initializing with hardcoded keys:
```text
// BEFORE (broken for new groups):
const grouped: Record<ParentGroup, CategoryConfig[]> = {
  food: [], classes: [], services: [], ...
};

// AFTER (dynamic):
const grouped: Record<string, CategoryConfig[]> = {};
configs.forEach((config) => {
  if (!grouped[config.parentGroup]) {
    grouped[config.parentGroup] = [];
  }
  grouped[config.parentGroup].push(config);
});
```

### 3. Make `useGroupBehavior` fallback gracefully for unknown groups

Instead of requiring a key in `DEFAULT_GROUP_BEHAVIORS`, return a sensible default behavior for any group not in the hardcoded list.

### 4. Update type references across the codebase

Files that cast to `ParentGroup` (like `SellerSettingsPage.tsx`, `BecomeSellerPage.tsx`, `CategoryGroupPage.tsx`) will work automatically once `ParentGroup` becomes `string`, but we need to verify no type errors are introduced.

### Files to modify:
- `src/types/categories.ts` - Make `ParentGroup` dynamic, update `DEFAULT_GROUP_BEHAVIORS` 
- `src/hooks/useCategoryBehavior.ts` - Make `groupedConfigs` build dynamically from data
- No other files need changes since they already use string-compatible patterns

