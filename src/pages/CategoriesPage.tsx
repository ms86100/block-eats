import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useCategoryConfigs } from '@/hooks/useCategoryBehavior';
import { useParentGroups } from '@/hooks/useParentGroups';
import { useProductsByCategory } from '@/hooks/queries/useProductsByCategory';
import { useNearbySocietySellers } from '@/hooks/queries/useStoreDiscovery';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export default function CategoriesPage() {
  const { user } = useAuth();
  const { configs, isLoading: configsLoading } = useCategoryConfigs();
  const { groups, isLoading: groupsLoading } = useParentGroups();
  const { data: productCategories = [], isLoading: productsLoading } = useProductsByCategory();

  // Check if user has browse_beyond enabled
  const { data: prefs } = useQuery({
    queryKey: ['user-browse-prefs', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('browse_beyond_community, search_radius_km')
        .eq('id', user!.id)
        .single();
      return data as any;
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const browseBeyond = prefs?.browse_beyond_community ?? false;
  const { data: nearbyBands = [] } = useNearbySocietySellers();

  // Merge local + nearby categories
  const activeCategorySet = new Set(productCategories.map(c => c.category));

  // Add categories from nearby sellers when browse_beyond is enabled
  if (browseBeyond && nearbyBands.length > 0) {
    for (const band of nearbyBands) {
      for (const society of band.societies) {
        for (const group of Object.keys(society.sellersByGroup)) {
          for (const seller of society.sellersByGroup[group]) {
            if (seller.categories) {
              seller.categories.forEach(cat => activeCategorySet.add(cat));
            }
          }
        }
      }
    }
  }

  const isLoading = configsLoading || groupsLoading || productsLoading;

  // Group categories by parent_group
  const grouped = groups
    .filter(g => g.is_active)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(group => ({
      ...group,
      categories: configs
        .filter(c => c.parentGroup === group.slug && c.isActive && activeCategorySet.has(c.category))
        .sort((a, b) => (a.displayOrder ?? 99) - (b.displayOrder ?? 99)),
    }))
    .filter(g => g.categories.length > 0);

  return (
    <AppLayout showHeader={false}>
      <div className="sticky top-0 z-30 bg-background border-b border-border px-4 py-3 safe-top">
        <h1 className="text-base font-bold text-foreground">Categories</h1>
      </div>

      <div className="px-3 py-3 pb-20">
        {isLoading ? (
          <div className="space-y-6">
            {[1, 2, 3].map(i => (
              <div key={i}>
                <Skeleton className="h-4 w-32 mb-2" />
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map(j => (
                    <Skeleton key={j} className="aspect-square rounded-xl" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-5">
            {grouped.map(group => (
              <div key={group.slug}>
                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                  {group.name}
                </h2>
                <div className="grid grid-cols-4 gap-2">
                  {group.categories.map(cat => (
                    <Link
                      key={cat.category}
                      to={`/category/${cat.parentGroup}?sub=${cat.category}`}
                      className="flex flex-col items-center"
                    >
                      <div className="w-full aspect-square rounded-xl bg-card border border-border flex items-center justify-center mb-1 overflow-hidden">
                        {cat.imageUrl ? (
                          <img src={cat.imageUrl} alt={cat.displayName} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-2xl">{cat.icon}</span>
                        )}
                      </div>
                      <span className="text-[10px] font-medium text-foreground text-center leading-tight line-clamp-2">
                        {cat.displayName}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
