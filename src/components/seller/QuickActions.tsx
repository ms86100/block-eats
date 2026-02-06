import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Settings } from 'lucide-react';

export function QuickActions() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Link to="/seller/products">
        <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Plus className="text-primary" size={20} />
            </div>
            <div>
              <p className="font-medium text-sm">Manage Products</p>
              <p className="text-xs text-muted-foreground">Add or edit items</p>
            </div>
          </CardContent>
        </Card>
      </Link>
      <Link to="/seller/settings">
        <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
              <Settings className="text-secondary-foreground" size={20} />
            </div>
            <div>
              <p className="font-medium text-sm">Store Settings</p>
              <p className="text-xs text-muted-foreground">Payment & hours</p>
            </div>
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}
