

## What the Article Reveals

The article's approach is simple — use `FirebaseMessaging` from `@capacitor-firebase/messaging` for **everything**: permissions, token retrieval, and listeners. Our code **mixes two plugins**, which is the root cause of the silent failure.

### Current Code (Broken)
Our `requestFullPermission` and `attemptIosRegistration` use:
1. `PushNotifications.checkPermissions()` — from `@capacitor/push-notifications` (legacy)
2. `PushNotifications.requestPermissions()` — legacy plugin
3. `PushNotifications.register()` — legacy APNs registration
4. `FirebaseMessaging.getToken()` — community plugin

The legacy `PushNotifications.register()` registers with APNs but doesn't integrate with Firebase's swizzling. So when `FirebaseMessaging.getToken()` is called next, Firebase may not have received the APNs token yet, causing a silent failure or timeout.

### Article's Approach (Correct)
```typescript
const { receive } = await FirebaseMessaging.requestPermissions();
if (receive === 'granted') {
  const { token } = await FirebaseMessaging.getToken();
  // Done — unified FCM token
}
```

No `PushNotifications` at all. `FirebaseMessaging.requestPermissions()` handles the OS prompt AND sets up the Firebase swizzling pipeline. Then `getToken()` returns a proper FCM token.

### What Also Matters
- The 10s timeout is too aggressive for first-launch token fetch — increase to 20s
- Double permission request (once in `requestFullPermission`, again in `attemptIosRegistration`) can confuse iOS

## Fix Plan

### Single change: `src/hooks/usePushNotifications.ts`

**Replace all `PushNotifications.*` calls on iOS with `FirebaseMessaging.*` equivalents:**

1. **`requestFullPermission`**: Replace `PushNotifications.checkPermissions()` / `requestPermissions()` with `FirebaseMessaging.checkPermissions()` / `requestPermissions()` on iOS
2. **`attemptIosRegistration`**: Remove `PushNotifications.checkPermissions()`, `requestPermissions()`, and `register()`. Use only `FirebaseMessaging.requestPermissions()` + `FirebaseMessaging.getToken()`
3. **Increase timeout** from 10s to 20s
4. **Keep `PushNotifications` for Android** (it works fine there per the article) and for **listeners** (foreground notifications, action performed) which are platform-agnostic

No other files need to change — the database, RLS, and edge functions are all correct. The problem is purely that the iOS token never reaches `saveTokenToDatabase` because of the mixed-plugin registration flow.

