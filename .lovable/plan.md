

## Analysis: `@capacitor-community/fcm` vs Current Approach

### What the repo reveals

`@capacitor-community/fcm` takes a fundamentally different approach from `@capacitor-firebase/messaging`:

```text
Current approach (@capacitor-firebase/messaging):
  FirebaseMessaging.requestPermissions() → FirebaseMessaging.getToken()
  (Firebase handles EVERYTHING via method swizzling)

@capacitor-community/fcm approach:
  PushNotifications.requestPermissions() → PushNotifications.register() → FCM.getToken()
  (Native APNs registration first, THEN FCM converts the token)
```

The README explicitly states:
> "This plugin is intended to be used **combined** with Capacitor API for Push Notifications. Capacitor only provides APN token whereas this plugin offers the possibility to work with FCM tokens."

### Why this might fix our problem

Our current `@capacitor-firebase/messaging` relies on Firebase's AppDelegate **method swizzling** to intercept the APNs token. If swizzling isn't working (misconfigured `Info.plist`, `FirebaseAppDelegateProxyEnabled` set to `NO`, or AppDelegate not calling `FirebaseApp.configure()` early enough), `FirebaseMessaging.requestPermissions()` resolves without actually triggering the OS prompt.

`@capacitor-community/fcm` bypasses this entirely:
1. `PushNotifications.register()` does native APNs registration directly (no swizzling needed)
2. `FCM.getToken()` then reads the FCM token that Firebase generates from the APNs token

This is more robust because it separates the two concerns: OS permission/APNs registration vs FCM token retrieval.

### Proposed change

**Replace `@capacitor-firebase/messaging` with `@capacitor-community/fcm` for iOS token retrieval only.**

In `src/hooks/usePushNotifications.ts`:

1. **Install**: Add `@capacitor-community/fcm` as a dependency
2. **iOS registration flow becomes**:
   ```
   PushNotifications.requestPermissions()
   PushNotifications.register()
   // Wait for 'registration' event (APNs token)
   FCM.getToken() → FCM token for backend
   ```
3. **Keep `PushNotifications` for both platforms** (no more platform-split logic for permissions)
4. **Remove `@capacitor-firebase/messaging` imports** from the registration flow (keep only if needed for `notificationReceived` listeners, or switch those to `PushNotifications` listeners too)
5. **Simplify**: Both iOS and Android use the same `PushNotifications` flow for permissions + registration; only the token retrieval differs (Android gets FCM token from `registration` event directly, iOS needs `FCM.getToken()`)

### Files changed

- `src/hooks/usePushNotifications.ts` — rewrite registration to use unified `PushNotifications` + `FCM.getToken()` pattern
- `src/pages/NotificationsPage.tsx` — revert permission checks back to `PushNotifications.checkPermissions()` for both platforms (simpler)
- No native file changes needed (the plugin handles it via `npx cap sync`)

### What stays the same

- Database schema, RLS, edge functions — all correct
- `EnableNotificationsBanner.tsx` — unchanged
- `PushNotificationProvider.tsx` — unchanged
- Android flow — largely unchanged (already works)

