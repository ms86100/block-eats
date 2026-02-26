

# Explanation: Notifications, Featured Banners, and Real-Time Updates

---

## 1. Push Notification Flow — End to End

### How it works today

```text
┌─────────────────────────────────────────────────────────┐
│  SETUP (happens once when user installs & opens app)    │
│                                                         │
│  App opens → usePushNotifications hook fires            │
│  → Capacitor PushNotifications.checkPermissions()       │
│  → If 'prompt': PushNotifications.requestPermissions()  │
│  → User taps "Allow" on iOS/Android system dialog       │
│  → PushNotifications.register()                         │
│  → FCM/APNs returns a device token                      │
│  → Token saved to `device_tokens` table in DB           │
│    (user_id, token, platform: 'ios'|'android')          │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  SENDING (when something triggers a notification)       │
│                                                         │
│  1. App code calls sendPushNotification() or            │
│     notifySocietyMembers() or sendOrderStatusNotification│
│  2. These invoke the `send-push-notification` edge fn   │
│  3. Edge function:                                      │
│     a. Reads FIREBASE_SERVICE_ACCOUNT secret            │
│     b. Queries device_tokens for the target user_id     │
│     c. Generates a Google OAuth JWT (RS256)              │
│     d. Calls FCM HTTP v1 API for each device token      │
│     e. Removes invalid/expired tokens automatically     │
│  4. FCM delivers to iOS (APNs) or Android               │
│  5. Additionally writes to `user_notifications` table   │
│     for the in-app notification inbox                   │
└─────────────────────────────────────────────────────────┘
```

### Who can trigger notifications

| Trigger | Who | What happens |
|---------|-----|-------------|
| Order status change | Seller (accept/prepare/ready/deliver) or system (cancel) | `sendOrderStatusNotification()` in `lib/notifications.ts` sends to buyer and/or seller |
| New chat message | Buyer or seller | `sendChatNotification()` sends to the other party |
| Society-wide announcement | Admin or builder | `notifySocietyMembers()` in `lib/society-notifications.ts` sends to all approved members |
| Admin-only alert | System triggers | `notifySocietyAdmins()` sends to users with admin role in that society |
| Help request | Resident | `notify-help-request` edge function |
| Builder announcement | Builder member | Via `builder_announcements` flow |

### Prerequisites for push to work on a real device

1. **Firebase project** must be configured with iOS (APNs key uploaded) and Android
2. **`FIREBASE_SERVICE_ACCOUNT`** secret must be set in backend (the edge function reads it)
3. User must grant notification permission on first launch
4. The `device_tokens` table must have valid entries

### In-app notification inbox

Separately from push, every notification also writes a row to `user_notifications` table. The `NotificationInboxPage` reads from this table. The `useUnreadNotificationCount` hook polls every 30 seconds for the badge count.

---

## 2. Featured Banner — Why It May Not Show on Resident Page

### Current data state

There is exactly 1 banner in the database:
- **Title:** "update your app"
- **society_id:** `c2113076-8479-463b-adce-dbc4d86d86d7`
- **is_active:** true
- **template:** text_overlay

Your resident account (`ms86100@gmail.com`) has **society_id:** `c2113076-8479-463b-adce-dbc4d86d86d7` — same society. So the banner query SHOULD return it.

### Where banners render on the resident home page

```text
HomePage
  └─ MarketplaceSection
       ├─ ParentGroupTabs
       ├─ CategoryImageGrid (for each parent group)
       ├─ FeaturedBanners  ← renders HERE (line 113)
       ├─ DiscoveryRow (popular)
       ├─ DiscoveryRow (new this week)
       └─ ProductListings
```

The `FeaturedBanners` component renders unconditionally inside `MarketplaceSection`. Its query:
```sql
SELECT * FROM featured_items
WHERE is_active = true
AND (society_id = '{effectiveSocietyId}' OR society_id IS NULL)
ORDER BY display_order
```

### Most likely root cause: you tested as admin

When you are logged in as `ms86100@gmail.com` (who has the `admin` role), your `effectiveSocietyId` may be overridden by the SocietySwitcher. If you switched to a different society context while viewing the admin page, and then checked the home page, the `effectiveSocietyId` would not match the banner's `society_id`.

**However**, if you tested with the same society and the banner still didn't show, here is what else could block it:

1. **Stale cache:** The `FeaturedBanners` query has `staleTime: 5 * 60 * 1000` (5 minutes). If the banner was created within the last 5 minutes and the home page was already loaded, the cached (empty) result would be served.

2. **Realtime subscription IS configured:** The code subscribes to `postgres_changes` on `featured_items` and invalidates the query on any change. This should bust the cache. But if the Postgres publication for realtime was added after the subscription was set up, the channel might not receive events until the page is reloaded.

3. **Verified: `featured_items` IS in the `supabase_realtime` publication.** So realtime events should flow. If you created a banner and the home page was already open, the realtime listener should have invalidated the cache and refetched.

### To confirm

I recommend testing this explicitly: navigate away from the home page, then back. This forces a fresh query if the staleTime has elapsed. If the banner appears after navigation, the issue is purely a cache/timing issue.

---

## 3. Real-Time Updates — Current State

### What updates in real time today

The following tables are in the `supabase_realtime` publication and have client-side subscriptions:

| Table | Subscriber Component | What triggers update |
|-------|---------------------|---------------------|
| `featured_items` | `FeaturedBanners.tsx` | Any banner create/update/delete |
| `chat_messages` | `OrderChat.tsx` | New chat message |
| `bulletin_posts` | `BulletinPage` | New community post |
| `bulletin_comments` | Post detail | New comment |
| `gate_entries` | Guard kiosk | Gate entry events |
| `manual_entry_requests` | Security flow | Manual entry approvals |
| `worker_job_requests` | Worker marketplace | Job status changes |
| `delivery_assignments` | Delivery tracking | Delivery status changes |
| `society_activity` | Activity feed | New society activity |

### What does NOT update in real time

| Data | Current behavior | Gap |
|------|-----------------|-----|
| **Products** | 10-minute cache (`staleTime`). No realtime subscription. | New product added by seller won't appear until cache expires or user navigates away and back |
| **Orders** | Fetched on page load. No realtime subscription on `orders` table. | Order status changes require manual refresh or page re-entry |
| **Notification inbox** | 30-second polling for count badge. Full list has `staleTime: 0` but no `refetchInterval`. | New notifications appear in badge within 30s, but inbox page shows stale list until navigated away and back |
| **System settings** | 15-minute cache. No realtime. | Config changes (like marketplace labels) take up to 15 minutes to reflect |
| **Feature flags** | 15-minute cache. No realtime. | Enabling/disabling society features takes up to 15 minutes to reflect for residents |
| **Cart** | 10-minute cache. Invalidated on add/remove. | Cross-device cart sync not real-time |

### Mobile app foreground resume

The `useAppLifecycle` hook listens for `appStateChange` and invalidates these queries when the app returns to foreground:
- `featured-banners`
- `system-settings-raw`, `system-settings-core`
- `cart-count`, `cart-items`
- `unread-notifications`
- `products-by-category`

So if you background the app, a data change happens, and you bring the app back — these queries will refetch. But this is NOT instant real-time; it only triggers on resume.

### What's needed for true real-time everywhere

To make ALL data changes reflect instantly without user action:
1. Add the relevant tables to `supabase_realtime` publication (orders, products, etc.)
2. Add Postgres change listeners in the relevant components (like `FeaturedBanners` already does)
3. On each change event, invalidate the corresponding React Query cache key

This is a significant architectural change and should be done selectively for high-value updates (order status, new products) rather than blanket-enabling it for all tables.

---

## Summary

| Question | Answer |
|----------|--------|
| How do push notifications work? | Capacitor registers device token with FCM/APNs, saved to `device_tokens` table. Edge function `send-push-notification` uses Firebase service account to send via FCM HTTP v1 API. Requires `FIREBASE_SERVICE_ACCOUNT` secret configured. |
| Who can send notifications? | Order status changes (automatic), chat messages (buyer/seller), society announcements (admin/builder), help requests (system). All go through the same edge function. |
| Why doesn't the banner show for residents? | The data and code are correct. Most likely cause is stale cache (5-minute window) or testing while the admin society switcher was set to a different society. The realtime subscription should auto-refresh, but if the page was loaded before the banner was created AND the realtime channel wasn't fully subscribed yet, it would miss the event. |
| Are updates real-time on mobile? | Partially. Banners, chat, and gate entries have realtime subscriptions. Products, orders, notifications, settings, and feature flags rely on cache expiry (10-15 minutes) or foreground resume invalidation. True real-time for all data would require adding more tables to the realtime publication and wiring up client-side listeners. |

