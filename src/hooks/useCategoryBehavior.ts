import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  ServiceCategory, 
  CategoryBehavior, 
  CategoryConfig, 
  ParentGroup,
  DEFAULT_GROUP_BEHAVIORS,
  getListingType,
  getOrderType,
} from '@/types/categories';

interface CategoryConfigRow {
  id: string;
  category: string;
  display_name: string;
  icon: string;
  color: string;
  parent_group: string;
  is_physical_product: boolean;
  requires_preparation: boolean;
  requires_time_slot: boolean;
  requires_delivery: boolean;
  supports_cart: boolean;
  enquiry_only: boolean;
  has_quantity: boolean;
  has_duration: boolean;
  has_date_range: boolean;
  is_negotiable: boolean;
  display_order: number;
  is_active: boolean;
}

export function useCategoryConfigs() {
  const [configs, setConfigs] = useState<CategoryConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      const { data, error } = await supabase
        .from('category_config')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (error) throw error;

      const mappedConfigs: CategoryConfig[] = (data as CategoryConfigRow[]).map((row) => ({
        id: row.id,
        category: row.category as ServiceCategory,
        displayName: row.display_name,
        icon: row.icon,
        color: row.color,
        parentGroup: row.parent_group as ParentGroup,
        behavior: {
          isPhysicalProduct: row.is_physical_product,
          requiresPreparation: row.requires_preparation,
          requiresTimeSlot: row.requires_time_slot,
          requiresDelivery: row.requires_delivery,
          supportsCart: row.supports_cart,
          enquiryOnly: row.enquiry_only,
          hasQuantity: row.has_quantity,
          hasDuration: row.has_duration,
          hasDateRange: row.has_date_range,
          isNegotiable: row.is_negotiable,
        },
        displayOrder: row.display_order,
        isActive: row.is_active,
      }));

      setConfigs(mappedConfigs);
    } catch (error) {
      console.error('Error fetching category configs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Group configs by parent group
  const groupedConfigs = useMemo(() => {
    const grouped: Record<ParentGroup, CategoryConfig[]> = {
      food: [],
      classes: [],
      services: [],
      personal: [],
      professional: [],
      rentals: [],
      resale: [],
      events: [],
      pets: [],
      property: [],
    };

    configs.forEach((config) => {
      if (grouped[config.parentGroup]) {
        grouped[config.parentGroup].push(config);
      }
    });

    return grouped;
  }, [configs]);

  return { configs, groupedConfigs, isLoading, refresh: fetchConfigs };
}

export function useCategoryBehavior(category: ServiceCategory | null) {
  const { configs } = useCategoryConfigs();

  const config = useMemo(() => {
    if (!category) return null;
    return configs.find((c) => c.category === category) || null;
  }, [configs, category]);

  const behavior = useMemo(() => {
    if (!config) return null;
    return config.behavior;
  }, [config]);

  const listingType = useMemo(() => {
    if (!behavior) return 'product';
    return getListingType(behavior);
  }, [behavior]);

  const orderType = useMemo(() => {
    if (!behavior) return 'purchase';
    return getOrderType(behavior);
  }, [behavior]);

  return {
    config,
    behavior,
    listingType,
    orderType,
    // Convenience accessors
    supportsCart: behavior?.supportsCart ?? true,
    requiresTimeSlot: behavior?.requiresTimeSlot ?? false,
    hasDateRange: behavior?.hasDateRange ?? false,
    enquiryOnly: behavior?.enquiryOnly ?? false,
    isNegotiable: behavior?.isNegotiable ?? false,
    hasDuration: behavior?.hasDuration ?? false,
    requiresPreparation: behavior?.requiresPreparation ?? false,
  };
}

// Hook to get behavior for a parent group
export function useGroupBehavior(parentGroup: ParentGroup | null) {
  return useMemo(() => {
    if (!parentGroup) return DEFAULT_GROUP_BEHAVIORS.food;
    return DEFAULT_GROUP_BEHAVIORS[parentGroup] || DEFAULT_GROUP_BEHAVIORS.food;
  }, [parentGroup]);
}

// Hook to check if a category supports a specific feature
export function useCategoryFeature(category: ServiceCategory | null, feature: keyof CategoryBehavior) {
  const { behavior } = useCategoryBehavior(category);
  return behavior?.[feature] ?? false;
}
