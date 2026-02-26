/**
 * Persistent Storage Adapter for Supabase Auth on Capacitor (iOS/Android)
 *
 * On native platforms, WKWebView's localStorage is non-persistent — Apple can
 * purge it when the app is backgrounded or when the device is low on storage.
 * This adapter uses @capacitor/preferences (UserDefaults on iOS,
 * SharedPreferences on Android) which are fully persistent across app restarts.
 *
 * On web, it falls back to localStorage (standard behavior).
 *
 * Implements the Supabase `SupportedStorage` interface:
 *   getItem(key): Promise<string | null>
 *   setItem(key, value): Promise<void>
 *   removeItem(key): Promise<void>
 */
import { Capacitor } from '@capacitor/core';

interface SupportedStorage {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

let _preferences: typeof import('@capacitor/preferences').Preferences | null = null;
let _loaded = false;

async function ensurePreferences() {
  if (_loaded) return _preferences;
  try {
    const mod = await import('@capacitor/preferences');
    _preferences = mod.Preferences;
  } catch (e) {
    console.warn('[CapacitorStorage] Failed to load Preferences plugin:', e);
    _preferences = null;
  }
  _loaded = true;
  return _preferences;
}

/**
 * A SupportedStorage adapter backed by @capacitor/preferences on native
 * and localStorage on web.
 */
class CapacitorStorage implements SupportedStorage {
  private withTimeout<T>(promise: Promise<T>, ms = 5000, fallback: T): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((resolve) => setTimeout(() => {
        console.warn('[CapacitorStorage] Native bridge call timed out after', ms, 'ms — using fallback');
        resolve(fallback);
      }, ms)),
    ]);
  }

  async getItem(key: string): Promise<string | null> {
    const t = Date.now();
    const shortKey = key.substring(0, 30);

    try {
      const localValue = localStorage.getItem(key);
      if (!Capacitor.isNativePlatform()) return localValue;

      // Fast path: if local copy exists, return immediately to avoid blocking auth flows.
      if (localValue !== null) {
        console.log('[CapacitorStorage] getItem fast-path(localStorage)', shortKey, Date.now() - t, 'ms');
        return localValue;
      }
    } catch {
      // Ignore localStorage read errors and continue to native read fallback
    }

    console.log('[CapacitorStorage] getItem native-read start', shortKey, t);
    const prefs = await ensurePreferences();
    if (!prefs) {
      console.log('[CapacitorStorage] getItem fallback (no prefs)', shortKey, Date.now() - t, 'ms');
      return null;
    }

    try {
      const { value } = await this.withTimeout(prefs.get({ key }), 1200, { value: null });
      if (value !== null) {
        try { localStorage.setItem(key, value); } catch { /* ignore */ }
      }
      console.log('[CapacitorStorage] getItem native-read done', shortKey, Date.now() - t, 'ms');
      return value;
    } catch (e) {
      console.warn('[CapacitorStorage] getItem native-read failed', shortKey, Date.now() - t, 'ms', e);
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    const t = Date.now();
    const shortKey = key.substring(0, 30);

    // Primary write path for auth runtime (must be immediate/non-blocking).
    try { localStorage.setItem(key, value); } catch (_) { /* quota exceeded, ignore */ }

    if (!Capacitor.isNativePlatform()) return;

    console.log('[CapacitorStorage] setItem queued(native-mirror)', shortKey, t);
    void (async () => {
      const prefs = await ensurePreferences();
      if (!prefs) {
        console.log('[CapacitorStorage] setItem mirror skipped (no prefs)', shortKey, Date.now() - t, 'ms');
        return;
      }
      try {
        await this.withTimeout(prefs.set({ key, value }), 1500, undefined);
        console.log('[CapacitorStorage] setItem mirror done', shortKey, Date.now() - t, 'ms');
      } catch (e) {
        console.warn('[CapacitorStorage] setItem mirror failed', shortKey, Date.now() - t, 'ms', e);
      }
    })();
  }

  async removeItem(key: string): Promise<void> {
    const t = Date.now();
    const shortKey = key.substring(0, 30);

    try { localStorage.removeItem(key); } catch (_) { /* ignore */ }

    if (!Capacitor.isNativePlatform()) return;

    console.log('[CapacitorStorage] removeItem queued(native-mirror)', shortKey, t);
    void (async () => {
      const prefs = await ensurePreferences();
      if (!prefs) {
        console.log('[CapacitorStorage] removeItem mirror skipped (no prefs)', shortKey, Date.now() - t, 'ms');
        return;
      }
      try {
        await this.withTimeout(prefs.remove({ key }), 1500, undefined);
        console.log('[CapacitorStorage] removeItem mirror done', shortKey, Date.now() - t, 'ms');
      } catch (e) {
        console.warn('[CapacitorStorage] removeItem mirror failed', shortKey, Date.now() - t, 'ms', e);
      }
    })();
  }
}

/** Singleton instance — reused across the app */
export const capacitorStorage = new CapacitorStorage();

/**
 * Migrate any existing auth tokens from localStorage to Preferences.
 * This ensures users who already have a session in localStorage don't
 * get logged out after the storage swap.
 */
export async function migrateLocalStorageToPreferences(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  const prefs = await ensurePreferences();
  if (!prefs) return;

  // Supabase stores session under keys starting with 'sb-'
  const keysToMigrate: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('sb-')) {
      keysToMigrate.push(key);
    }
  }

  for (const key of keysToMigrate) {
    const value = localStorage.getItem(key);
    if (value) {
      // Only migrate if not already present in Preferences
      const { value: existing } = await prefs.get({ key });
      if (!existing) {
        await prefs.set({ key, value });
      }
    }
  }
}
