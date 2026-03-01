

## Root Cause (My Regression)

In my last edit to `usePushNotifications.ts` lines 506-527, I changed the login effect to:
- First login → set stage to `deferred`, do NOT prompt
- Only prompt if stage is already `full` (which never happens on fresh install)

This broke the auto-prompt that was working before. The fix is straightforward.

## Fix

**`src/hooks/usePushNotifications.ts` lines 511-527** -- Change the login effect to immediately request permission on first login:

- `stage === 'none'` (fresh install): upgrade to `full`, call `attemptRegistration()`
- `stage === 'deferred'`: upgrade to `full`, call `attemptRegistration()`  
- `stage === 'full'`: call `attemptRegistration()` (re-register silently)

This restores the behavior where signing in triggers the iOS permission popup immediately, which:
1. Calls `UNUserNotificationCenter.requestAuthorization()` via the plugin
2. Creates the "Notifications" section in iOS Settings
3. Registers with APNs and obtains FCM token

The NotificationsPage CTA remains as a fallback for users who denied initially.

## What was working before and what I broke

The previous code called `attemptRegistration()` on every login regardless of stage. My "deferred" strategy prevented this on fresh installs, which is exactly why the prompt stopped appearing.

