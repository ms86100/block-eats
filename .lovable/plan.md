

# Root Cause Analysis: Working Main Branch vs Current Broken Build

## Key Differences Found

Comparing the uploaded working files against the current project, here are the exact differences causing the TestFlight white screen:

### Difference 1: `capacitor.config.ts` — Environment Logic is Inverted

| Aspect | Working (main branch) | Current (broken) |
|--------|----------------------|-------------------|
| Variable | `isProduction = process.env.CAPACITOR_ENV === 'production'` | `isDevelopment = process.env.CAPACITOR_ENV === 'development'` |
| Dev server condition | `!isProduction` (default = dev mode) | `isDevelopment` (default = production mode) |
| `launchAutoHide` | `true` | `false` |
| `contentInset` | `'automatic'` | `'never'` |
| Production `allowNavigation` | Has `['rvvctaikytfeyzkwoqxg.supabase.co', 'block-eats.lovable.app']` | Removed entirely |

**The environment logic itself is NOT the white screen cause** — if Codemagic sets `CAPACITOR_ENV=production`, both versions resolve to production mode. The real issue is that the working version has `launchAutoHide: true` and the current has `false`. With `false`, the splash screen stays visible forever unless `SplashScreen.hide()` is called. If `initializeCapacitorPlugins()` hangs before reaching `SplashScreen.hide()`, the user sees a permanent splash/white screen.

### Difference 2: `src/lib/capacitor.ts` — Massive Extra Complexity (ROOT CAUSE)

The working version is **35 lines**. The current version is **65 lines** with three major additions that run BEFORE `SplashScreen.hide()`:

1. **`migrateLocalStorageToPreferences()`** — Iterates all localStorage keys, makes async Preferences calls for each. If `@capacitor/preferences` plugin fails to load or hangs, this blocks forever.

2. **`restoreAppPreferences()`** — Makes 5 sequential async `capacitorStorage.getItem()` calls. Each one dynamically imports `@capacitor/preferences`. If any hangs, the entire init stalls.

3. **`StatusBar.setOverlaysWebView({ overlay: true })`** — Extra StatusBar call not in the working version. Could throw on certain iOS versions.

4. **`preloadHaptics()`** — Dynamically imports `@capacitor/haptics`. Runs even on web (returns immediately on web, but on native it's another async operation).

**The critical path is:** `main.tsx` awaits `initializeCapacitorPlugins()` → which awaits `migrateLocalStorageToPreferences()` → which awaits `restoreAppPreferences()` → then runs native StatusBar/Keyboard/SplashScreen. If ANY of those async steps hang or throw in a way that isn't caught, React never mounts, and with `launchAutoHide: false`, the splash never hides = **permanent white screen**.

### Difference 3: `src/App.tsx` — Extra Wrappers

The current version has `SafeSellerAlert` error boundary and `GlobalSellerAlert` component added. These are fine for web but add code that runs during initial render. The `useNewOrderAlert` hook creates a Realtime subscription immediately. If auth isn't ready, this could throw.

## Fix Plan

### Fix 1: Restore `capacitor.config.ts` to match working version

Revert to the working main branch config exactly:
- Use `isProduction` instead of `isDevelopment`
- Restore `launchAutoHide: true`
- Restore `contentInset: 'automatic'`
- Restore production `allowNavigation`

### Fix 2: Restore `src/lib/capacitor.ts` to match working version + keep safe extras

The working version is simple and reliable. Restore it, but keep the storage migration wrapped in a non-blocking way:
- Remove `migrateLocalStorageToPreferences()` and `restoreAppPreferences()` from the boot-blocking path — fire them in the background instead of awaiting them
- Remove `StatusBar.setOverlaysWebView()` call (not in working version)
- Keep `preloadHaptics()` but ensure it doesn't block (it already doesn't on web)
- Keep the early return for non-native platforms

### Fix 3: Keep `SafeSellerAlert` and `NewOrderAlertOverlay` fixes

These are correct defensive improvements and don't affect the boot path.

## Technical Details

### `capacitor.config.ts` — Restore to working version

Revert to use `isProduction` variable, restore `launchAutoHide: true`, `contentInset: 'automatic'`, and production `allowNavigation`.

### `src/lib/capacitor.ts` — Simplify boot path

```typescript
export async function initializeCapacitorPlugins() {
  // Fire-and-forget haptics preload (no-op on web)
  preloadHaptics();

  if (!Capacitor.isNativePlatform()) {
    return;
  }

  // Non-blocking storage migration — don't await, don't block boot
  migrateLocalStorageToPreferences().catch(e => 
    console.warn('[Capacitor] Storage migration failed:', e)
  );
  restoreAppPreferences().catch(e => 
    console.warn('[Capacitor] Preferences restore failed:', e)
  );

  try {
    await StatusBar.setStyle({ style: Style.Light });
    await StatusBar.setBackgroundColor({ color: '#F97316' });
  } catch (error) {
    console.error('Error configuring status bar:', error);
  }

  try {
    const { Keyboard } = await import('@capacitor/keyboard');
    await Keyboard.setResizeMode({ mode: 'body' as any });
    await Keyboard.setScroll({ isDisabled: false });
  } catch (error) {
    console.error('Error configuring keyboard:', error);
  }

  try {
    await SplashScreen.hide();
  } catch (error) {
    console.error('Error hiding splash screen:', error);
  }
}
```

The key change: `migrateLocalStorageToPreferences()` and `restoreAppPreferences()` are fired but NOT awaited. They run in the background. This matches the working version's simplicity while keeping the storage safety net.

## Summary

The root cause is that `src/lib/capacitor.ts` was expanded with blocking async operations (storage migration, preferences restore) that run before React mounts. If any of those hang on a native device, the app never renders. Combined with `launchAutoHide: false`, the splash screen never hides either. Reverting to the working version's approach (simple, non-blocking init) while keeping the defensive improvements (SafeSellerAlert, AnimatePresence fix) will fix the white screen.

