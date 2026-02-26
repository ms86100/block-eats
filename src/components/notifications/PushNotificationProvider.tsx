import { useEffect, useContext } from 'react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { IdentityContext } from '@/contexts/auth/contexts';

interface PushNotificationProviderProps {
  children: React.ReactNode;
}

export function PushNotificationProvider({ children }: PushNotificationProviderProps) {
  // Use raw context to gracefully handle cases where AuthProvider hasn't mounted yet
  const identity = useContext(IdentityContext);
  const user = identity?.user ?? null;
  const { removeTokenFromDatabase } = usePushNotifications();

  // Clean up tokens on logout
  useEffect(() => {
    if (!user) {
      removeTokenFromDatabase();
    }
  }, [user, removeTokenFromDatabase]);

  return <>{children}</>;
}
