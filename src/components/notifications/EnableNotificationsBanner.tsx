import { useState } from 'react';
import { Bell, X } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { usePushNotifications } from '@/contexts/PushNotificationContext';
import { Button } from '@/components/ui/button';

const DISMISSED_KEY = 'notif_banner_dismissed';

export function EnableNotificationsBanner() {
  const { permissionStatus, requestFullPermission } = usePushNotifications();
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem(DISMISSED_KEY) === '1'
  );
  const [loading, setLoading] = useState(false);

  if (!Capacitor.isNativePlatform()) return null;
  if (permissionStatus !== 'prompt') return null;
  if (dismissed) return null;

  const handleTurnOn = async () => {
    setLoading(true);
    try {
      await requestFullPermission();
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISSED_KEY, '1');
    setDismissed(true);
  };

  return (
    <div className="mx-4 mt-4 rounded-2xl border bg-card p-4 shadow-sm relative">
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3 pr-4">
        <div className="rounded-full bg-primary/10 p-2.5 shrink-0">
          <Bell className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 space-y-1">
          <h3 className="text-sm font-semibold text-foreground">Turn On Notifications</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Stay updated on your orders and community activity.
          </p>
        </div>
      </div>

      <Button
        onClick={handleTurnOn}
        disabled={loading}
        size="sm"
        className="w-full mt-3"
      >
        {loading ? 'Enabling…' : 'Turn On'}
      </Button>
    </div>
  );
}
