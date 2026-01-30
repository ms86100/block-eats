
# Production-Ready Mobile App Deployment Plan

## Current State Assessment

Your app already has a strong foundation for mobile deployment:

| Component | Status | Notes |
|-----------|--------|-------|
| Capacitor Core | ✅ Ready | v8.0.2 installed and configured |
| iOS/Android Support | ✅ Ready | Both platforms configured |
| Push Notifications | ✅ Ready | Full implementation with token storage |
| Status Bar | ✅ Ready | Configured with brand colors |
| Splash Screen | ✅ Ready | Plugin configured |
| Safe Area Handling | ✅ Ready | CSS utilities in place |
| Privacy Policy | ✅ Ready | Full legal page at /privacy-policy |
| Terms & Conditions | ✅ Ready | Full legal page at /terms |
| Store Metadata | ✅ Ready | STORE_METADATA.md with full listing details |
| App Icons | ⚠️ Partial | 192x192 and 512x512 exist, need more sizes |

---

## Remaining Implementation Tasks

### Phase 1: App Store Compliance Requirements

#### 1.1 Account Deletion Feature (REQUIRED by Apple & Google)
Both app stores require apps to provide a way for users to delete their account and data.

**Changes needed:**
- Add "Delete Account" button in ProfilePage
- Create confirmation dialog explaining data deletion
- Implement account deletion logic (delete from auth + cascade delete user data)
- Send confirmation email before deletion

#### 1.2 App Tracking Transparency (iOS 14.5+)
If your app uses any analytics or tracking, Apple requires showing a permission prompt.

**Changes needed:**
- Install `@capacitor/app-tracking-transparency` if using analytics
- Show ATT prompt on first launch

#### 1.3 Deep Linking Support
Required for features like password reset emails and push notification routing.

**Changes needed:**
- Configure URL schemes in `capacitor.config.ts`
- Add Associated Domains for iOS (apple-app-site-association file)
- Add Android App Links (assetlinks.json file)

---

### Phase 2: Native Platform Enhancements

#### 2.1 Keyboard Avoidance
Ensure input fields are visible when keyboard appears.

**Changes needed:**
- Install `@capacitor/keyboard`
- Add resize behavior for Android
- Handle scroll-into-view for focused inputs

#### 2.2 Native App Rating Prompt
Encourage users to rate the app after positive experiences.

**Changes needed:**
- Install `capacitor-rate-app` plugin
- Trigger rating prompt after successful order completion

#### 2.3 Enhanced Haptic Feedback
Add tactile feedback for better UX on key actions.

**Changes needed:**
- Install `@capacitor/haptics`
- Add haptic feedback on button taps, order confirmations

#### 2.4 App Updates Handler
Notify users when a new version is available.

**Changes needed:**
- Create version check on app startup
- Show update prompt for mandatory/optional updates

---

### Phase 3: Asset Preparation

#### 3.1 iOS App Icons (Required Sizes)
```text
AppIcon-20@2x.png       (40x40)
AppIcon-20@3x.png       (60x60)
AppIcon-29@2x.png       (58x58)
AppIcon-29@3x.png       (87x87)
AppIcon-40@2x.png       (80x80)
AppIcon-40@3x.png       (120x120)
AppIcon-60@2x.png       (120x120)
AppIcon-60@3x.png       (180x180)
AppIcon-76.png          (76x76)
AppIcon-76@2x.png       (152x152)
AppIcon-83.5@2x.png     (167x167)
AppIcon-1024.png        (1024x1024)
```

#### 3.2 Android Adaptive Icons
```text
mipmap-hdpi/ic_launcher.png       (72x72)
mipmap-mdpi/ic_launcher.png       (48x48)
mipmap-xhdpi/ic_launcher.png      (96x96)
mipmap-xxhdpi/ic_launcher.png     (144x144)
mipmap-xxxhdpi/ic_launcher.png    (192x192)
+ ic_launcher_foreground.xml
+ ic_launcher_background.xml
```

#### 3.3 Splash Screens
- **iOS**: LaunchScreen.storyboard (already configured)
- **Android**: splash.png in multiple densities (ldpi to xxxhdpi)

#### 3.4 Play Store Feature Graphic
- Size: 1024x500px (required for Google Play Store listing)

---

### Phase 4: Production Configuration

#### 4.1 Update capacitor.config.ts for Production
Remove the development server block before building:

```typescript
const config: CapacitorConfig = {
  appId: 'app.lovable.b3f6efce9b8e4071b39db038b9b1adf4',
  appName: 'Greenfield Community',
  webDir: 'dist',
  // Remove server block for production
  plugins: {
    SplashScreen: {...},
    StatusBar: {...},
    PushNotifications: {...},
  },
};
```

#### 4.2 iOS Code Signing
- Apple Developer Account ($99/year)
- App ID registration
- Provisioning profiles (Development + Distribution)
- Push notification certificates (APNs)

#### 4.3 Android Signing
- Generate upload keystore
- Create signed APK/AAB
- Enable Play App Signing

---

### Phase 5: Testing Checklist

#### 5.1 Functional Testing
| Test | Description |
|------|-------------|
| Authentication | Sign up, login, logout, password reset |
| Profile | View, edit profile, upload avatar |
| Categories | Browse all 12+ categories |
| Seller Flow | Register as seller, add products |
| Ordering | Add to cart, checkout, payment selection |
| Booking | Time slot selection for services |
| Rentals | Date range selection |
| Chat | Buyer-seller messaging |
| Push Notifications | Receive order updates |
| Offline Mode | Banner displays, actions queued |

#### 5.2 Device Testing
- iPhone SE (smallest screen)
- iPhone 15 Pro Max (largest screen, Dynamic Island)
- iPad (tablet layout)
- Android phone (various screen densities)
- Android tablet

#### 5.3 Edge Cases
- Network interruption during checkout
- Low storage space
- Background/foreground transitions
- Push notification with app closed
- Deep link handling

---

### Phase 6: App Store Submission

#### 6.1 Apple App Store (iOS)
1. Create app in App Store Connect
2. Fill in metadata (use STORE_METADATA.md)
3. Upload screenshots (6 device sizes)
4. Upload build from Xcode
5. Submit for review (~24-48 hours)

**Review Notes (include with submission):**
> This app is for verified residents of Shriram Greenfield community only. Demo account provided: demo@greenfield.app / DemoReview2026!

#### 6.2 Google Play Store (Android)
1. Create app in Google Play Console
2. Fill in store listing (use STORE_METADATA.md)
3. Upload screenshots (phone + tablet)
4. Upload feature graphic (1024x500)
5. Upload AAB from Android Studio
6. Submit for review (~2-7 days for new apps)

---

## Implementation Summary

### Code Changes Required

| File | Change |
|------|--------|
| `src/pages/ProfilePage.tsx` | Add account deletion feature |
| `src/components/profile/DeleteAccountDialog.tsx` | New component for deletion flow |
| `capacitor.config.ts` | Add keyboard, haptics, deep linking config |
| `package.json` | Add @capacitor/keyboard, @capacitor/haptics |
| `src/lib/capacitor.ts` | Initialize keyboard and haptics plugins |
| `src/hooks/useAppRating.ts` | New hook for in-app rating prompts |
| `public/.well-known/apple-app-site-association` | iOS deep linking |
| `public/.well-known/assetlinks.json` | Android deep linking |

### Native Project Setup (Local Machine Required)

1. Export project to GitHub
2. Clone repository locally
3. Run `npm install`
4. Run `npm run build`
5. Run `npx cap add ios` and `npx cap add android`
6. Run `npx cap sync`
7. Open in Xcode: `npx cap open ios`
8. Open in Android Studio: `npx cap open android`
9. Configure code signing
10. Build and archive for submission

---

## Timeline Estimate

| Phase | Duration |
|-------|----------|
| Phase 1: Compliance Features | 2-3 hours |
| Phase 2: Native Enhancements | 2-3 hours |
| Phase 3: Asset Preparation | 1-2 hours |
| Phase 4: Production Config | 1 hour |
| Phase 5: Testing | 4-6 hours |
| Phase 6: Store Submission | 2-4 hours |
| App Review (Apple) | 24-48 hours |
| App Review (Google) | 2-7 days |

**Total Development Time:** ~15-20 hours
**Total Time to Store:** ~1-2 weeks (including review)

---

## Documentation Reference

For detailed step-by-step instructions on building and publishing with Capacitor:

https://docs.lovable.dev/tips-tricks/native-mobile-apps
