

# Plan: Fix JSON Error in Median.co Simulator

## Problem Analysis

When using Median.co to wrap your web app as a native mobile app, you're encountering a JSON parsing error. Based on my investigation, there are several potential causes:

1. **Hash-based routing compatibility** - Your app now uses `HashRouter` (URLs like `/#/welcome`), which may require specific Median.co configuration
2. **Manifest.json issues** - The PWA manifest may have compatibility issues with Median's webview
3. **API responses or localStorage data** - Malformed JSON in API responses or cached data
4. **Missing Median.co JavaScript bridge handling** - The app doesn't handle Median's native bridge

---

## Root Causes & Fixes

### Issue 1: PWA Manifest Conflict
Median.co uses its own native app configuration. The PWA manifest (`public/manifest.json`) may conflict with Median's expectations or cause parsing errors when the simulator tries to read it.

**Fix:** Conditionally disable PWA manifest loading when running in Median.co webview, OR ensure manifest.json is valid without trailing commas.

### Issue 2: Hash Router + Deep Linking
Median.co expects standard URL paths for navigation but your app uses hash-based routing (`/#/welcome`). This can cause issues with:
- Deep link handling
- Native navigation events
- URL parsing in the simulator

**Fix:** Add Median.co SPA navigation listener to handle routing properly.

### Issue 3: localStorage JSON Parsing
The app has several `JSON.parse()` calls for localStorage data (SearchPage, NotificationsPage, tooltip-guide). If corrupted data exists, it could throw errors.

**Fix:** Add try-catch with fallback values and clear corrupted cache.

### Issue 4: Missing Median JavaScript Bridge
Median.co injects a JavaScript bridge (`median` object) for native functionality. Without proper handling, errors may occur.

**Fix:** Add Median.co NPM package and proper bridge initialization.

---

## Implementation Steps

### Step 1: Install Median.co NPM Package
Add the official Median.co NPM package for proper SPA navigation and bridge handling:
```bash
npm install @nicholasrutherford/median-js-bridge
```

### Step 2: Create Median Bridge Initialization
Create a new file `src/lib/median.ts` to handle Median.co bridge initialization:
- Detect if running in Median.co webview
- Initialize the JavaScript bridge
- Set up SPA navigation listeners for hash routing

### Step 3: Update App.tsx with Median SPA Handler
Add a navigation listener that:
- Listens for Median's `jsNavigation.url` events
- Converts standard URLs to hash-based routes
- Triggers React Router navigation programmatically

### Step 4: Harden JSON.parse Calls
Update all localStorage JSON parsing to:
- Wrap in try-catch blocks
- Return default values on parse failure
- Clear corrupted data automatically

Files to update:
- `src/pages/SearchPage.tsx`
- `src/pages/NotificationsPage.tsx`
- `src/components/ui/tooltip-guide.tsx`

### Step 5: Validate manifest.json
Ensure `public/manifest.json` has no trailing commas or invalid syntax:
- Run JSON through a validator
- Consider removing `categories` field (not required by Median)

### Step 6: Add Median.co Detection Utility
Create a utility to detect Median.co environment:
```typescript
export function isMedianApp(): boolean {
  return typeof window !== 'undefined' && 
         window.navigator.userAgent.includes('gonative');
}
```

---

## Technical Details

### New File: `src/lib/median.ts`
```typescript
// Median.co bridge initialization and SPA navigation handling
// - Detects Median webview environment
// - Sets up jsNavigation listener for hash routing
// - Provides utilities for native features
```

### Modified Files

| File | Changes |
|------|---------|
| `src/App.tsx` | Import Median init, add useEffect for navigation listener |
| `src/pages/SearchPage.tsx` | Harden JSON.parse with try-catch |
| `src/pages/NotificationsPage.tsx` | Harden JSON.parse with try-catch |
| `src/components/ui/tooltip-guide.tsx` | Already has try-catch (verify) |
| `package.json` | Add Median.co NPM package |

### Median SPA Navigation Flow
```text
┌────────────────────────────────────────────────────────────────┐
│                    Median.co Native App                        │
├────────────────────────────────────────────────────────────────┤
│  1. User taps native element (tab, deep link, notification)   │
│                           ↓                                    │
│  2. Median fires jsNavigation event with target URL           │
│                           ↓                                    │
│  3. Our listener catches event in App.tsx                     │
│                           ↓                                    │
│  4. Convert URL to hash route: /welcome → /#/welcome          │
│                           ↓                                    │
│  5. Call React Router navigate() for soft page load           │
│                           ↓                                    │
│  6. Page renders without full reload                          │
└────────────────────────────────────────────────────────────────┘
```

---

## Testing Checklist
After implementation:
1. Test in Median.co simulator - should load without JSON error
2. Verify all routes work (landing, auth, home, search, etc.)
3. Test page refresh on each route
4. Verify localStorage operations don't throw errors
5. Test deep link handling if configured

---

## Alternative Approach
If the above doesn't resolve the issue, we may need to:
1. Switch back to `BrowserRouter` and configure proper server rewrites
2. Create a separate build configuration for Median.co
3. Enable web console logs in Median to capture the exact JSON error

