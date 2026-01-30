import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Loader2, Grid3X3, GripVertical } from 'lucide-react';
import { PARENT_GROUPS, ParentGroup } from '@/types/categories';
import { cn } from '@/lib/utils';

interface CategoryConfigRow {
  id: string;
  category: string;
  display_name: string;
  icon: string;
  color: string;
  parent_group: string;
  display_order: number;
  is_active: boolean;
}

export function CategoryManager() {
  const [categories, setCategories] = useState<CategoryConfigRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<ParentGroup | null>(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('category_config')
        .select('*')
        .order('display_order');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
      toast.error('Failed to load categories');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleCategory = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('category_config')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;

      setCategories(
        categories.map((c) => (c.id === id ? { ...c, is_active: isActive } : c))
      );
      toast.success(isActive ? 'Category enabled' : 'Category disabled');
    } catch (error) {
      console.error('Error updating category:', error);
      toast.error('Failed to update category');
    }
  };

  const groupedCategories = categories.reduce((acc, cat) => {
    if (!acc[cat.parent_group]) {
      acc[cat.parent_group] = [];
    }
    acc[cat.parent_group].push(cat);
    return acc;
  }, {} as Record<string, CategoryConfigRow[]>);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="animate-spin" size={24} />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Grid3X3 size={20} />
          Category Management
        </CardTitle>
        <CardDescription>
          Enable or disable categories available in the marketplace
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Group filters */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
          <Button
            variant={selectedGroup === null ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedGroup(null)}
          >
            All
          </Button>
          {PARENT_GROUPS.map((group) => (
            <Button
              key={group.value}
              variant={selectedGroup === group.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedGroup(group.value)}
            >
              <span className="mr-1">{group.icon}</span>
              {group.label.split(' ')[0]}
            </Button>
          ))}
        </div>

        <ScrollArea className="h-[400px]">
          <div className="space-y-6 pr-4">
            {PARENT_GROUPS.filter(
              (g) => !selectedGroup || g.value === selectedGroup
            ).map((group) => {
              const groupCats = groupedCategories[group.value] || [];
              if (groupCats.length === 0) return null;

              const activeCount = groupCats.filter((c) => c.is_active).length;

              return (
                <div key={group.value} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium flex items-center gap-2">
                      <span>{group.icon}</span>
                      {group.label}
                    </h4>
                    <span className="text-xs text-muted-foreground">
                      {activeCount}/{groupCats.length} active
                    </span>
                  </div>

                  <div className="space-y-1">
                    {groupCats.map((cat) => (
                      <div
                        key={cat.id}
                        className={cn(
                          'flex items-center justify-between p-2 rounded-lg transition-colors',
                          cat.is_active ? 'bg-muted' : 'bg-muted/30'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <GripVertical size={14} className="text-muted-foreground cursor-move" />
                          <span>{cat.icon}</span>
                          <span className={cn('text-sm', !cat.is_active && 'text-muted-foreground')}>
                            {cat.display_name}
                          </span>
                        </div>
                        <Switch
                          checked={cat.is_active}
                          onCheckedChange={(checked) => toggleCategory(cat.id, checked)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            💡 Disabled categories won't be visible to users but existing sellers can still operate.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
