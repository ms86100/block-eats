

## Why Sociva Is Missing Permissions in iOS Settings

### Root Cause

iOS Settings only displays permissions that have been requested through **native iOS APIs**. Sociva currently uses:

- `navigator.geolocation` (web API) for location — invisible to Settings
- `navigator.mediaDevices.getUserMedia()` (web API) for camera — invisible to Settings  
- `<input type="file">` (web API) for photo library — invisible to Settings

Apps like Zomato and mygate use native SDKs, so their permissions appear in Settings and persist across sessions.

### Impact

1. **Location**: Web geolocation prompts every session; user can't pre-authorize in Settings
2. **Camera**: WebView camera access doesn't appear in Settings; harder to troubleshoot
3. **Photos**: File picker works but isn't listed as a permission in Settings

### Fix Plan

**Install native Capacitor plugins and replace web API calls with native equivalents:**

#### Step 1: Install plugins
- `@capacitor/camera` — handles both camera capture and photo library picking
- `@capacitor/geolocation` — native location access

#### Step 2: Replace web API calls with native plugin calls

**File: `src/hooks/useAuthPage.ts`** (location verification)
- Replace `navigator.geolocation.getCurrentPosition()` with `Geolocation.getCurrentPosition()` from `@capacitor/geolocation`
- Wrap in platform check: use native on iOS/Android, keep web fallback for browser

**File: `src/components/workforce/LiveCameraCapture.tsx`** (worker photo capture)
- On native platforms, use `Camera.getPhoto({ source: CameraSource.Camera })` instead of `navigator.mediaDevices.getUserMedia`
- Keep web fallback for browser preview

**File: `src/components/ui/image-upload.tsx`** and `src/components/ui/croppable-image-upload.tsx` (product/profile images)
- On native platforms, use `Camera.getPhoto({ source: CameraSource.Photos })` for gallery or `CameraSource.Prompt` to let user choose
- Keep `<input type="file">` as web fallback

#### Step 3: Update Codemagic CI (`codemagic.yaml`)
- Add `NSPhotoLibraryAddUsageDescription` to Info.plist (required by `@capacitor/camera` for saving)
- The existing `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`, `NSLocationWhenInUseUsageDescription` in `capacitor.config.ts` plistOverrides are already correct

#### Step 4: Create a native utility wrapper
- New file: `src/lib/native-media.ts` — wraps Camera plugin with web fallback
- New file: `src/lib/native-location.ts` — wraps Geolocation plugin with web fallback
- Both auto-detect platform and use native or web accordingly

### What is NOT touched
- Push notification logic (already handled separately)
- Existing UI components layout/styling
- Database schema or RLS policies
- Edge functions

### Result after fix
Sociva's iOS Settings page will show: Location, Camera, Photos, Notifications, Background App Refresh, Mobile Data — matching the experience of Zomato and mygate.

