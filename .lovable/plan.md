

## Implementation Plan — 4 Fixes

### Fix 1: Apple Info.plist Missing Privacy Strings (ITMS-90683)

**Root cause**: `capacitor.config.ts` has `plistOverrides` for `NSPhotoLibraryUsageDescription`, `NSLocationWhenInUseUsageDescription`, and `NSCameraUsageDescription`, but the CI pipeline strips and rebuilds the Xcode project. Capacitor's `npx cap sync` may inject these, but the pipeline does not guarantee they survive. Apple also requires `NSLocationAlwaysAndWhenInUseUsageDescription` which is completely missing.

**Changes**:
- **`capacitor.config.ts`**: Add `NSLocationAlwaysAndWhenInUseUsageDescription` to `plistOverrides`.
- **`codemagic.yaml`**: Add a new build step (in both `ios-release` and `release-all` workflows) after "Enable Push Notification & Background Modes" that explicitly injects all 4 privacy strings via `/usr/libexec/PlistBuddy` into `ios/App/App/Info.plist`. This guarantees the keys exist regardless of what Capacitor sync does.

The 4 keys to inject:
- `NSPhotoLibraryUsageDescription`
- `NSCameraUsageDescription`
- `NSLocationWhenInUseUsageDescription`
- `NSLocationAlwaysAndWhenInUseUsageDescription`

### Fix 2: `verifyOTP` Timing Attack (P0-3 leftover)

**File**: `supabase/functions/manage-delivery/index.ts` lines 32-35

**Change**: Replace `computed === hash` with byte-level XOR comparison identical to the `verifyHMAC` function 4 lines below it. Decode both base64 strings to `Uint8Array`, compare lengths, XOR all bytes.

### Fix 3: Multi-Order Navigation Bug

**File**: `src/hooks/useCartPage.ts` line 265

**Change**: `navigate(pendingOrderIds.length === 1 ? `/orders/${pendingOrderIds[0]}` : `/orders`)` — when multiple orders exist, go to the orders list page instead of the first order.

### Fix 4: Cart `addItem` Count Rollback

**File**: `src/hooks/useCart.tsx` lines 141-147

**Change**: Capture the previous `cart-count` value before the optimistic update. In the catch block, restore it explicitly (matching the pattern used by `clearCart` and `removeItem`).

```text
Before:
  queryClient.setQueryData(['cart-count', user?.id], (old) => (old || 0) + quantity);
  invalidate();
} catch (error) {
  invalidate();

After:
  const prevCount = queryClient.getQueryData(['cart-count', user?.id]);
  queryClient.setQueryData(['cart-count', user?.id], (old) => (old || 0) + quantity);
  invalidate();
} catch (error) {
  queryClient.setQueryData(['cart-count', user?.id], prevCount);
  invalidate();
```

### Execution Order
All 4 fixes are independent and will be implemented in parallel.

