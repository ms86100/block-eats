

## Root Cause: No Device Tokens = No Push Notifications

The `device_tokens` table is **completely empty**. This means:
- The seller's phone has **never successfully registered** an FCM push token
- The `send-push-notification` function returns "No device tokens found for user" and sends 0 notifications
- Even though the notification_queue processes correctly (logs show "Processing 1 queued notifications"), the push never reaches the phone

The backend pipeline works correctly: order -> DB trigger -> notification_queue -> process-notification-queue -> send-push-notification. But the last step silently fails because there are no tokens.

### Why tokens are not being saved

The `usePushNotifications` hook only runs on native platforms (`Capacitor.isNativePlatform()`). Since you are running in **dev mode** with the Capacitor WebView pointing to the Lovable sandbox URL, the WebView likely loads the app as a web context where `Capacitor.isNativePlatform()` may return false, OR the FCM registration succeeds but the token save fails silently due to the RLS policy requiring the user to be authenticated at the exact moment the token is saved.

Additionally, the `pushNotificationReceived` listener (foreground notifications) does **nothing** -- it just logs. No toast, no sound, no UI update. So even if push worked, the user would not see anything while the app is open.

### Why the in-app popup is not appearing

The `GlobalSellerAlert` component uses `useNewOrderAlert` which relies on Supabase Realtime. The Capacitor app in dev mode connects to the sandbox URL. If the WebSocket connection drops (which happens frequently on mobile networks), realtime events are missed. The polling fallback should catch it, but it initializes `lastSeenAtRef` to `new Date().toISOString()` -- so if the app was closed and reopened, it only checks for orders newer than the reopen time, potentially missing the order that was placed while the app was closed.

### Plan (3 fixes)

**1. Fix in-app foreground notification handling** (`src/hooks/usePushNotifications.ts`)
- In the `pushNotificationReceived` listener, show a toast with sound/haptic and navigate to order
- This ensures sellers see notifications even when the app is in the foreground

**2. Fix the in-app popup when reopening the app** (`src/hooks/useNewOrderAlert.ts`)
- Change `lastSeenAtRef` initialization to look back 5 minutes instead of "right now"
- This ensures orders placed while the app was backgrounded/closed are detected on reopen
- Add an immediate poll on mount (delay 0) instead of waiting MIN_POLL_MS

**3. Debug token registration** (`src/hooks/usePushNotifications.ts`)
- Add more detailed logging for the registration flow
- Log whether `isNativePlatform()` returns true
- Log the token save result
- Handle the case where user auth may not be ready when registration fires

**4. Capacitor rebuild requirement**
- After these changes you MUST rebuild: `git pull` -> `npm install` -> `npm run build` -> `npx cap sync` -> `npx cap run ios`
- The current build has the old code where foreground push does nothing

### Files to modify

1. `src/hooks/usePushNotifications.ts` -- Handle foreground push notifications with toast/sound/haptic; add debug logging for token registration
2. `src/hooks/useNewOrderAlert.ts` -- Initialize lastSeenAtRef to 5 minutes ago; trigger immediate poll on mount
3. `src/components/notifications/PushNotificationProvider.tsx` -- No changes needed

