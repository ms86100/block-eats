
# Phase 4: App Store & Play Store Deployment Readiness
## Complete Implementation Plan for BlockEats v1.4

---

## Executive Summary

This plan addresses all gaps identified in the current implementation to make BlockEats fully compliant and ready for submission to the Google Play Store and Apple App Store.

### Current Status Overview

| Category | Status | Details |
|----------|--------|---------|
| Capacitor Core | ✅ Complete | Installed and configured |
| Privacy Policy | ✅ Complete | Full legal page implemented |
| Terms & Conditions | ✅ Complete | Full legal page implemented |
| Community Notice | ✅ Complete | Auth page shows resident-only message |
| App Icons | ❌ Missing | Referenced but files don't exist |
| Splash Screen | ❌ Missing | Config exists, no runtime integration |
| Push Notifications | ❌ Missing | Not installed or implemented |
| Offline Handling | ❌ Missing | No network error handling |
| Store Metadata | ❌ Missing | No prepared assets or descriptions |

---

## Part 1: Missing App Icons & Assets

### Problem
The `manifest.json` and `index.html` reference icon files that do not exist in the `public/` folder:
- `android-chrome-192x192.png` (missing)
- `android-chrome-512x512.png` (missing)
- `apple-touch-icon.png` (missing)
- `favicon-32x32.png` (missing)
- `favicon-16x16.png` (missing)
- `og-image.png` (missing)

### Solution
Create placeholder icons using a simple SVG-based approach that can be easily replaced with branded assets later.

### Files to Create
```text
public/
├── android-chrome-192x192.png
├── android-chrome-512x512.png
├── apple-touch-icon.png
├── favicon-16x16.png
├── favicon-32x32.png
├── og-image.png (1200x630)
└── splash-screen.png (2732x2732 for iOS)
```

### Technical Approach
1. Create a React component that generates branded placeholder images
2. Create simple SVG-based icons with the BlockEats branding (orange #F97316 theme)
3. Instructions for replacing with production assets will be provided

---

## Part 2: Native Capacitor Plugin Integration

### Problem
The `capacitor.config.ts` references `SplashScreen` and `StatusBar` plugins, but these are not installed or used in the app code.

### Solution
Install and integrate the required Capacitor plugins.

### Dependencies to Install
```json
{
  "@capacitor/splash-screen": "^8.0.0",
  "@capacitor/status-bar": "^8.0.0"
}
```

### Files to Modify

**src/main.tsx** - Add plugin initialization:
```typescript
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

// Initialize native plugins
if (Capacitor.isNativePlatform()) {
  StatusBar.setStyle({ style: Style.Light });
  StatusBar.setBackgroundColor({ color: '#F97316' });
  SplashScreen.hide();
}
```

---

## Part 3: Push Notifications Infrastructure

### Problem
No push notification capability exists. Buyers and sellers cannot receive real-time order updates.

### Solution
Implement push notifications using Capacitor's push-notifications plugin with backend token storage.

### Dependencies to Install
```json
{
  "@capacitor/push-notifications": "^8.0.0"
}
```

### Database Changes
Create a table to store device push tokens:
```sql
CREATE TABLE device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL, -- 'ios' or 'android'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, token)
);

ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own tokens"
  ON device_tokens FOR ALL
  USING (auth.uid() = user_id);
```

### Files to Create

**src/hooks/usePushNotifications.ts**
```typescript
// Hook to handle push notification registration
// - Request permissions on app load
// - Store device token in database
// - Handle incoming notifications
```

**src/components/notifications/PushNotificationProvider.tsx**
```typescript
// Wrapper component for push notification initialization
// - Register listeners for foreground/background notifications
// - Navigate to relevant screens on notification tap
```

### Integration Points
1. Register token after successful login in `AuthContext`
2. Remove token on logout
3. Send notifications from backend when order status changes

---

## Part 4: Offline & Network Error Handling

### Problem
No handling for network connectivity issues. Users see blank screens or cryptic errors when offline.

### Solution
Implement a network status hook and UI component for graceful offline handling.

### Files to Create

**src/hooks/useNetworkStatus.ts**
```typescript
import { useState, useEffect } from 'react';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline };
}
```

**src/components/network/OfflineBanner.tsx**
```typescript
// Shows a non-intrusive banner when device is offline
// Orange/amber warning style consistent with app theme
```

### Files to Modify

**src/App.tsx**
- Wrap app with network status provider
- Show offline banner when disconnected

---

## Part 5: Store Metadata & Listing Preparation

### App Store Listing Content

**App Name:** BlockEats

**Short Description (80 chars):**
```
Order homemade food from Shriram Greenfield neighbors. Community only.
```

**Full Description (4000 chars):**
```
BlockEats is a private community marketplace exclusively for Shriram Greenfield residents.

🏠 COMMUNITY ONLY
This app is restricted to verified residents of Shriram Greenfield. Each user is verified by community administrators before gaining access.

🍱 ORDER HOMEMADE FOOD
Browse and order homemade meals, snacks, baked goods, and beverages from your neighbors. Support local home chefs in your community.

🛒 KEY FEATURES
• Browse sellers by category (Meals, Snacks, Beverages, etc.)
• View seller ratings and reviews
• Real-time order tracking
• In-app chat with sellers
• UPI and Cash on Delivery payment options
• Favorites and order history

👩‍🍳 BECOME A SELLER
Residents can apply to become sellers and share their homemade creations with the community. All sellers are verified and approved by administrators.

🔒 PRIVACY & SECURITY
Your data stays within the community. We only collect information necessary for order fulfillment and community verification. See our full Privacy Policy in the app.

📱 SUPPORT
Need help? Access the Help & Guide section in your profile for tutorials and FAQs.

---
This app requires community verification. Non-residents will not be able to access the marketplace features.
```

**Keywords:**
```
homemade food, community marketplace, food delivery, home cooking, 
local food, neighborhood, residential, apartment food, home chef
```

**Category:** Food & Drink

**Content Rating:** Everyone / 4+

---

## Part 6: Demo Account for App Store Review

### Problem
Apple requires test credentials to review apps with login requirements.

### Solution
Create a demo account in the database that Apple reviewers can use.

### Implementation
```sql
-- Create demo user for App Store review
-- Credentials: demo@blockeats.app / DemoReview2026!
```

### Demo Account Details (for store submission):
```text
Email: demo@blockeats.app
Password: DemoReview2026!
Notes: This account has buyer access and can view the full marketplace.
```

---

## Part 7: Build Configuration Updates

### Files to Modify

**package.json** - Update version and add build scripts:
```json
{
  "version": "1.4.0",
  "scripts": {
    "build:android": "npm run build && npx cap sync android",
    "build:ios": "npm run build && npx cap sync ios"
  }
}
```

**capacitor.config.ts** - Production configuration:
```typescript
const config: CapacitorConfig = {
  appId: 'app.lovable.b3f6efce9b8e4071b39db038b9b1adf4',
  appName: 'BlockEats',
  webDir: 'dist',
  // Remove server.url for production builds to use local files
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#ffffff',
      androidSplashResourceName: 'splash',
      iosSplashResourceName: 'LaunchScreen',
      showSpinner: false,
    },
    StatusBar: {
      style: 'light',
      backgroundColor: '#F97316',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};
```

---

## Implementation Order

### Step 1: App Icons & Assets (Priority: High)
- Create all missing icon files
- Add splash screen assets
- Create OG image for social sharing

### Step 2: Native Plugins (Priority: High)
- Install @capacitor/splash-screen
- Install @capacitor/status-bar  
- Initialize plugins in main.tsx

### Step 3: Offline Handling (Priority: Medium)
- Create network status hook
- Add offline banner component
- Integrate into App.tsx

### Step 4: Push Notifications (Priority: Medium)
- Install @capacitor/push-notifications
- Create device_tokens table
- Implement notification registration hook
- Add notification provider

### Step 5: Build & Metadata (Priority: High)
- Update package.json version to 1.4.0
- Prepare store listing text
- Create demo account
- Document build process

---

## Post-Implementation: Local Build Steps

After approval, you will need to run these commands locally:

```bash
# 1. Pull the latest code
git pull

# 2. Install dependencies
npm install

# 3. Build the web app
npm run build

# 4. Add native platforms (first time only)
npx cap add android
npx cap add ios

# 5. Sync web assets to native projects
npx cap sync

# 6. Open in native IDE
npx cap open android  # Opens Android Studio
npx cap open ios      # Opens Xcode (Mac only)

# 7. Build release versions from the IDE
```

---

## Files Summary

### New Files to Create
| File | Purpose |
|------|---------|
| `public/android-chrome-192x192.png` | Android app icon |
| `public/android-chrome-512x512.png` | Android app icon (large) |
| `public/apple-touch-icon.png` | iOS home screen icon |
| `public/favicon-16x16.png` | Browser favicon |
| `public/favicon-32x32.png` | Browser favicon |
| `public/og-image.png` | Social media preview |
| `src/hooks/useNetworkStatus.ts` | Network connectivity hook |
| `src/hooks/usePushNotifications.ts` | Push notification handler |
| `src/components/network/OfflineBanner.tsx` | Offline indicator UI |

### Files to Modify
| File | Changes |
|------|---------|
| `package.json` | Add version, new scripts, new dependencies |
| `src/main.tsx` | Initialize Capacitor plugins |
| `src/App.tsx` | Add offline banner integration |
| `capacitor.config.ts` | Add push notification config |

### Database Migration
| Table | Purpose |
|-------|---------|
| `device_tokens` | Store push notification tokens |

---

## Estimated Effort
- **Icons & Assets:** 30 minutes
- **Native Plugins:** 30 minutes
- **Offline Handling:** 30 minutes
- **Push Notifications:** 1 hour
- **Build Config & Metadata:** 30 minutes

**Total: ~3 hours of implementation**
