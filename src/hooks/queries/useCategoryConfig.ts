import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { jitteredStaleTime } from '@/lib/query-utils';

export function useCategoryConfig() {
  return useQuery({
    queryKey: ['category-configs'], // Shared cache key with useCategoryConfigs
    queryFn: async () => {
      const { data } = await supabase
        .from('category_config')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      return data || [];
    },
    staleTime: jitteredStaleTime(10 * 60 * 1000), // 10 min + jitter to prevent stampede
  });
}
