

# Why Sociva Shows Fewer Settings Than Canva in iOS Settings

## What You Are Seeing

The iOS Settings page for Sociva only shows "Apple Intelligence & Siri", "Search", and "Mobile Data". Compare this to Canva which shows Photos, Notifications, Background App Refresh, and more.

This is **not a code bug** -- it is a native iOS behavior. iOS only shows permission rows in Settings after the app has **actually requested** that permission at runtime, or when the corresponding **native capability** is properly declared in the Xcode project.

## Why Each Item Is Missing

### 1. Notifications -- Missing
Even though the Capacitor config includes `PushNotifications` and the code calls `PushNotifications.requestPermissions()`, the **Push Notifications capability** must be explicitly enabled in the Xcode project's "Signing & Capabilities" tab. Without this:
- The permission prompt never appears
- iOS Settings never shows the Notifications row
- The app silently fails to register for push

**Fix (Xcode-side, cannot be done from Lovable):**
In Xcode, open the project target > Signing & Capabilities > click "+ Capability" > add "Push Notifications". Also add "Background Modes" and check "Remote notifications".

### 2. Photos -- Missing
The `NSPhotoLibraryUsageDescription` is declared in `capacitor.config.ts` plistOverrides (line 82), which is correct. However, iOS only shows the Photos row **after the app has actually triggered a photo picker or requested photo library access at runtime**. If the user has never used a feature that opens the photo library, the row will not appear in Settings.

**This is normal iOS behavior.** The row will appear once the user triggers a photo-related feature (e.g., uploading a profile picture or product image).

### 3. Camera -- Missing (same reason as Photos)
`NSCameraUsageDescription` is declared (line 81). The row appears only after the app first requests camera access.

### 4. Background App Refresh -- Missing
This requires the **Background Modes** capability in Xcode and the `UIBackgroundModes` key in Info.plist. The app currently does not declare any background modes.

**Fix (Xcode-side):**
In Xcode, add "Background Modes" capability and enable "Background fetch" and/or "Remote notifications" as needed.

### 5. Location -- Missing
`NSLocationWhenInUseUsageDescription` is declared (line 80), but the row only appears after the app actually requests location permission at runtime.

## What Needs to Happen (All Xcode-Side Steps)

These changes must be made in Xcode on the native project. They cannot be done from Lovable's web editor:

1. **Open Xcode project** (`ios/App/App.xcworkspace`)
2. **Select the App target** > Signing & Capabilities
3. **Add "Push Notifications" capability** -- this is the critical missing one
4. **Add "Background Modes" capability** and check:
   - "Remote notifications" (for silent push delivery)
   - "Background fetch" (for Background App Refresh toggle to appear)
5. **Run `npx cap sync ios`** after any Capacitor config changes
6. **Rebuild and re-deploy to TestFlight**

After these changes and the first successful push notification permission request, the Notifications row will appear. After the user uses camera/photos features, those rows will appear too.

## Summary

| Setting | Why Missing | Fix |
|---------|------------|-----|
| Notifications | Push Notifications capability not added in Xcode | Add capability in Xcode |
| Photos | Not yet requested at runtime | Will appear after first use |
| Camera | Not yet requested at runtime | Will appear after first use |
| Background App Refresh | Background Modes capability not added | Add capability in Xcode |
| Location | Not yet requested at runtime | Will appear after first use |

No code changes are needed from Lovable. All fixes are Xcode project configuration steps performed locally on your Mac.

