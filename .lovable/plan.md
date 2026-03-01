

## Root Cause: Multiple Hook Instances Causing iOS Permission Suppression

After thorough audit of every file involved, I found the real issue. It is **not** in your CI pipeline, AppDelegate, entitlements, or Firebase config. Those are all correct.

### The Problem

`usePushNotifications()` is a **full hook with side effects** (listeners, registration logic, permission requests). It is called in **three separate places**, each creating an independent instance:

1. `PushNotificationProvider.tsx` (always mounted, wraps entire app)
2. `NotificationsPage.tsx` (when user visits notifications settings)
3. `useCartPage.ts` (when user opens cart)

Each instance runs its own `useEffect` on login, each calling `attemptRegistration()` independently with a 500ms delay. This means **multiple simultaneous calls** to `PushNotifications.requestPermissions()` hit iOS at the same time.

**iOS behavior**: When `UNUserNotificationCenter.requestAuthorization()` is called multiple times rapidly, iOS silently suppresses the duplicate prompts. The first call may resolve before the UI can show the popup, or the system simply drops it. Since the popup never appears, the user never grants permission, `PushNotifications.register()` (which calls `UIApplication.shared.registerForRemoteNotifications()`) is never reached, and iOS never creates the "Notifications" section in Settings.

This also explains why it "worked before" -- timing changes in the code (like adding/removing the deferred strategy) shifted when these calls fired, sometimes allowing one through and sometimes not.

### Evidence

```text
Instance 1: PushNotificationProvider (App.tsx line 461)
  └─ usePushNotifications() → useEffect fires on user login
     └─ attemptRegistration() at T+500ms

Instance 2: NotificationsPage (line 32)  
  └─ usePushNotifications() → useEffect fires on user login
     └─ attemptRegistration() at T+500ms  (RACE!)

Instance 3: useCartPage (line 18)
  └─ usePushNotifications() → useEffect fires on user login  
     └─ attemptRegistration() at T+500ms  (RACE!)

Each instance has its own registrationStateRef — they cannot coordinate.
iOS sees 2-3 rapid requestAuthorization() calls → suppresses popup.
```

### Fix Plan

**A. Make push registration a singleton** (primary fix)

Convert the hook into a Context + Provider pattern so the registration logic runs exactly once:

1. Create `PushNotificationContext` with the hook's return values
2. Move ALL side effects (listeners, login registration, resume handler) into the existing `PushNotificationProvider` component only
3. Convert `usePushNotifications()` into a context consumer that just reads shared state
4. `NotificationsPage` and `useCartPage` consume via context instead of running their own effects

**B. Module-level guard as safety net**

Add a module-level `let activeInstance = false` flag. The `useEffect` that sets up listeners and triggers registration checks this flag and only proceeds if no other instance is active. This prevents duplicate `requestPermissions()` calls even if the context pattern is bypassed.

**C. No changes needed to:**
- `codemagic.yaml` (AppDelegate, entitlements, background modes all verified correct)
- `capacitor.config.ts` (PushNotifications presentationOptions correct)
- `pushPermissionStage.ts` (stage logic is fine)
- Native plugin code (working correctly when called once)

### Files to Change

| File | Change |
|------|--------|
| `src/hooks/usePushNotifications.ts` | Extract state + effects into a provider-only version; export a lightweight context consumer hook |
| `src/components/notifications/PushNotificationProvider.tsx` | Run the full hook here (single instance); provide values via context |
| `src/pages/NotificationsPage.tsx` | Switch from `usePushNotifications()` to context consumer |
| `src/hooks/useCartPage.ts` | Switch from `usePushNotifications()` to context consumer |

### Why This Will Work

With a single instance, exactly one `requestPermissions()` call reaches iOS on login. The system popup appears, user taps Allow, `registerForRemoteNotifications()` fires, APNs registers the app, and iOS creates the Notifications section in Settings. This matches how MyGate and Zomato work -- they use a singleton notification manager, never multiple competing instances.

