import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useNearbySellers(radiusKm: number, enabled: boolean) {
  const { effectiveSocietyId, isApproved } = useAuth();

  return useQuery({
    queryKey: ['sellers', 'nearby-societies', effectiveSocietyId, radiusKm],
    queryFn: async () => {
      if (!effectiveSocietyId) return [];

      const { data, error } = await supabase.rpc('search_nearby_sellers', {
        _buyer_society_id: effectiveSocietyId,
        _radius_km: radiusKm,
      });

      if (error) {
        console.error('Nearby sellers error:', error);
        return [];
      }

      return (data as any[]) || [];
    },
    enabled: !!isApproved && !!effectiveSocietyId && enabled,
    staleTime: 60_000,
  });
}
