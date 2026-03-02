

## Diagnosis

The article is explicit: **remove `@capacitor/push-notifications` entirely** when using `@capacitor-firebase/messaging`. Our code still imports and uses the legacy plugin for:

1. **Foreground notification listener** (line 427) — `PushNotifications.addListener('pushNotificationReceived', …)`
2. **Action performed listener** (line 476) — `PushNotifications.addListener('pushNotificationActionPerformed', …)`

Both plugins register as APNs delegates via method swizzling on iOS. When both are active, they **conflict** — the legacy plugin intercepts the APNs delegate methods before Firebase can, which means:
- `FirebaseMessaging.requestPermissions()` may resolve without actually triggering the OS prompt (because the legacy plugin already intercepted the delegate)
- Even if a token is generated, Firebase's swizzling never sees it

This is why the button shows "Enabling…" then resets — `requestPermissions()` completes but no popup appears, and the permission stays `prompt`.

## Fix

**Fully remove `@capacitor/push-notifications` usage on iOS.** Use `FirebaseMessaging` for ALL listeners too.

### Changes in `src/hooks/usePushNotifications.ts`

1. **Conditional import**: Only import `PushNotifications` for Android (or remove the top-level import entirely, use dynamic import)
2. **iOS foreground listener**: Replace `PushNotifications.addListener('pushNotificationReceived', …)` with `FirebaseMessaging.addListener('notificationReceived', …)` — the event name differs
3. **iOS action listener**: Replace `PushNotifications.addListener('pushNotificationActionPerformed', …)` with `FirebaseMessaging.addListener('notificationActionPerformed', …)`
4. **Platform guard all remaining `PushNotifications` calls**: Wrap every `PushNotifications.*` call in `if (platform !== 'ios')` checks so the legacy plugin is never invoked on iOS

### Listener event name mapping

| Legacy (`@capacitor/push-notifications`) | Firebase (`@capacitor-firebase/messaging`) |
|---|---|
| `pushNotificationReceived` | `notificationReceived` |
| `pushNotificationActionPerformed` | `notificationActionPerformed` |
| `registration` | `tokenReceived` |

The iOS `tokenReceived` listener (line 361) is already set up correctly. The two remaining legacy listeners (foreground + action) need to switch.

### No other files change
- Database, RLS, edge functions — all correct
- `EnableNotificationsBanner.tsx`, `NotificationsPage.tsx` — unchanged (they call `requestFullPermission` which is already fixed)
- The user should **not** need to uninstall `@capacitor/push-notifications` from npm since Android still uses it. But on iOS, we ensure it's never called.

