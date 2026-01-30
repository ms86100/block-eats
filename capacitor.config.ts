import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor Configuration for Greenfield Community App
 * 
 * IMPORTANT: Build Configuration
 * 
 * For DEVELOPMENT (live reload from Lovable):
 * - Keep the `server` block as-is below
 * - This enables hot-reload directly from the sandbox
 * 
 * For PRODUCTION (App Store / Play Store submission):
 * 1. Comment out or remove the entire `server` block
 * 2. Run `npm run build` to generate the dist folder
 * 3. Run `npx cap sync` to copy web assets to native projects
 * 4. Build the native apps in Xcode/Android Studio
 * 
 * The app will use local assets from the `dist` folder when
 * the server block is removed.
 */

const config: CapacitorConfig = {
  appId: 'app.lovable.b3f6efce9b8e4071b39db038b9b1adf4',
  appName: 'Greenfield Community',
  webDir: 'dist',
  
  // DEVELOPMENT: Live reload from Lovable sandbox
  // PRODUCTION: Comment out this entire server block before building for app stores
  server: {
    url: 'https://b3f6efce-9b8e-4071-b39d-b038b9b1adf4.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  
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

export default config;
