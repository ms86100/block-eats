

# Root Cause Analysis: Builder Sees All Modules Regardless of Package

## The Problem
Builders currently see and can access ALL modules, regardless of which feature package (Basic/Pro/Enterprise) is assigned to them.

## Root Cause: Broken Database Function

The core feature resolution function `get_effective_society_features()` is **completely broken** due to two column name errors introduced in a recent migration. It fails on every call, which causes the frontend to silently fall back to "enable everything."

### Bug 1: Wrong column name on `feature_package_items`
The function references `fpi.is_enabled` but the actual column is `fpi.enabled`.

### Bug 2: Non-existent column on `platform_features`
The function references `pf.is_enabled_by_default` but this column does not exist in the table.

### How This Causes "All Features Enabled"
1. Frontend calls `get_effective_society_features()` via RPC
2. The function errors out immediately (column not found)
3. The hook receives an empty array and logs the error silently
4. The fallback logic says: "If no features were returned, assume all features are enabled" (backward compatibility for societies without a builder)
5. Result: Every `FeatureGate` check returns `true` -- builder sees everything

## Fix (2 changes)

### 1. Fix the Database Function
A single migration to replace the function with corrected column names:
- `fpi.is_enabled` changed to `fpi.enabled` (3 occurrences)
- `pf.is_enabled_by_default` changed to `false` (features not in a package should be disabled when a builder is assigned)

### 2. Improve Frontend Fallback Logic
Update `useEffectiveFeatures.ts` line 71 to distinguish between "RPC errored" and "no builder assigned":
- If the RPC returned data but a feature is missing from results, it means the feature is not in the package -- disable it
- Only default to "all enabled" when no builder is assigned (i.e., the RPC returns features with `source = 'default'`)
- This prevents silent failures from re-enabling everything

## Technical Details

### Database Migration SQL
```sql
CREATE OR REPLACE FUNCTION public.get_effective_society_features(_society_id UUID)
RETURNS TABLE(...)
-- Fix 1: fpi.is_enabled -> fpi.enabled (3 places)
-- Fix 2: pf.is_enabled_by_default -> false
```

### Frontend Change (useEffectiveFeatures.ts)
```typescript
// Current (broken fallback):
if (!feature) return features.length === 0 ? true : false;

// Fixed (only default-enable when source confirms no builder):
if (!feature) {
  if (features.length === 0) return true; // RPC error or no society
  return false; // Feature not in package = disabled
}
```

## Verification
After the fix, calling the RPC for a society with a builder assigned to the "Basic" package should return only the features included in that package as enabled, and all others as disabled.

