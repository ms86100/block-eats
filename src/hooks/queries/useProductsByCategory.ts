import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ProductWithSeller } from '@/components/product/ProductListingCard';
import { jitteredStaleTime } from '@/lib/query-utils';
import { useNearbyProducts, mergeProducts } from './useNearbyProducts';

interface CategoryGroup {
  category: string;
  parentGroup: string;
  displayName: string;
  icon: string;
  products: ProductWithSeller[];
}

export function useProductsByCategory(limit = 50) {
  const { effectiveSocietyId } = useAuth();
  const queryClient = useQueryClient();
  const { data: nearbyProducts } = useNearbyProducts();

  const localQuery = useQuery({
    queryKey: ['products-by-category', effectiveSocietyId, limit],
    queryFn: async (): Promise<CategoryGroup[]> => {
      let configs: any[] | undefined = queryClient.getQueryData(['category-configs']);

      const configPromise = configs
        ? Promise.resolve(configs)
        : supabase
            .from('category_config')
            .select('category, display_name, icon, supports_cart, parent_group')
            .eq('is_active', true)
            .order('display_order')
            .then(({ data }) => data || []);

      let query = supabase
        .from('products')
        .select(`
          *,
          seller:seller_profiles!products_seller_id_fkey(
            id, business_name, rating, society_id, verification_status, fulfillment_mode, delivery_note
          )
        `)
        .eq('is_available', true)
        .eq('approval_status', 'approved')
        .order('is_bestseller', { ascending: false })
        .order('updated_at', { ascending: false })
        .limit(limit);

      if (effectiveSocietyId) {
        query = query.eq('seller.society_id', effectiveSocietyId);
      }

      const [resolvedConfigs, { data: products, error }] = await Promise.all([
        configPromise,
        query,
      ]);

      if (error) throw error;

      const approved = (products || [])
        .filter((p: any) => p.seller?.verification_status === 'approved')
        .map((p: any) => ({
          ...p,
          seller_name: p.seller?.business_name || 'Seller',
          seller_rating: p.seller?.rating || 0,
          seller_id: p.seller_id,
          fulfillment_mode: p.seller?.fulfillment_mode || null,
          delivery_note: p.seller?.delivery_note || null,
        }));

      // Build config map for grouping
      const configMap = new Map(
        (resolvedConfigs || []).map((c: any) => [
          c.category,
          { parent_group: c.parent_group || c.parentGroup, display_name: c.display_name || c.displayName, icon: c.icon },
        ])
      );

      return { approved, configMap } as any;
    },
    enabled: !!effectiveSocietyId,
    staleTime: jitteredStaleTime(5 * 60 * 1000),
  });

  // Post-process: merge nearby products and group by category
  const rawData = localQuery.data as any;
  let result: CategoryGroup[] = [];

  if (rawData?.approved) {
    const allProducts = mergeProducts(rawData.approved, nearbyProducts);
    const configMap: Map<string, any> = rawData.configMap;

    const grouped: Record<string, ProductWithSeller[]> = {};
    for (const product of allProducts) {
      const cat = product.category;
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(product);
    }

    for (const [category, items] of Object.entries(grouped)) {
      const cfg = configMap.get(category);
      result.push({
        category,
        parentGroup: cfg?.parent_group || category,
        displayName: cfg?.display_name || category,
        icon: cfg?.icon || '📦',
        products: items,
      });
    }
  }

  return {
    ...localQuery,
    data: result,
  };
}
