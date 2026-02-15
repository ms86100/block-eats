import { useNavigate } from 'react-router-dom';
import { Plus, Minus, Store } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { VegBadge } from '@/components/ui/veg-badge';
import { useCart } from '@/hooks/useCart';
import { Product } from '@/types/database';
import { cn } from '@/lib/utils';

export interface ProductWithSeller extends Product {
  seller_name?: string;
  seller_rating?: number;
  seller_id: string;
  fulfillment_mode?: string | null;
  delivery_note?: string | null;
}

interface ProductGridCardProps {
  product: ProductWithSeller;
  behavior?: any;
  onTap?: (product: ProductWithSeller) => void;
  className?: string;
  viewOnly?: boolean;
}

export function ProductGridCard({ product, behavior, onTap, className, viewOnly = false }: ProductGridCardProps) {
  const navigate = useNavigate();
  const { items, addItem, updateQuantity } = useCart();
  const cartItem = items.find((item) => item.product_id === product.id);
  const quantity = cartItem?.quantity || 0;

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    addItem(product);
  };

  const handleIncrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    updateQuantity(product.id, quantity + 1);
  };

  const handleDecrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    updateQuantity(product.id, quantity - 1);
  };

  const handleCardClick = () => {
    if (onTap) {
      onTap(product);
    } else {
      // Default: navigate to seller store page (no popup)
      navigate(`/seller/${product.seller_id}`);
    }
  };

  return (
    <div
        onClick={handleCardClick}
        className={cn(
          'bg-card rounded-xl border border-border/60 cursor-pointer transition-shadow hover:shadow-md flex flex-col h-full',
          className
        )}
      >
        {/* Image — Blinkit-style: clean white bg, product centered */}
        <div className="relative p-3 pb-1">
          <div className="relative aspect-square rounded-lg overflow-hidden bg-muted/30">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-full h-full object-contain"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-muted/50">
                <span className="text-3xl">🛍️</span>
              </div>
            )}

            {!product.is_available && (
              <div className="absolute inset-0 bg-background/70 flex items-center justify-center rounded-lg">
                <span className="text-xs font-medium text-muted-foreground">Out of stock</span>
              </div>
            )}

            {/* Discount / Bestseller badge — top-left like Blinkit */}
            {product.is_bestseller && (
              <Badge className="absolute top-1 left-1 bg-accent text-accent-foreground text-[9px] px-1.5 py-0 h-[18px] font-bold shadow-sm rounded-sm">
                Bestseller
              </Badge>
            )}
          </div>

          {/* Veg badge — top-right */}
          <div className="absolute top-4 right-4">
            <VegBadge isVeg={product.is_veg} size="sm" />
          </div>
        </div>

        {/* Content — Blinkit-style: name, description, then price + ADD at bottom */}
        <div className="px-3 pb-3 pt-1 flex flex-col flex-1 gap-0.5">
          {/* Product name — 2-line clamp */}
          <h4 className="font-semibold text-xs leading-tight line-clamp-2 text-foreground min-h-[2rem]">
            {product.name}
          </h4>

          {/* Seller name + fulfillment — key info visible without tapping */}
          {product.seller_name && (
            <div className="flex items-center gap-1 mt-0.5">
              <Store size={9} className="text-muted-foreground shrink-0" />
              <span className="text-[10px] text-muted-foreground truncate">{product.seller_name}</span>
            </div>
          )}

          {/* Fulfillment mode badge */}
          {product.fulfillment_mode && (
            <span className="text-[9px] text-primary/80 font-medium mt-0.5">
              {product.fulfillment_mode === 'delivery' ? '🚚 Delivery' : product.fulfillment_mode === 'pickup' ? '📍 Pickup' : '🚚 Delivery & Pickup'}
            </span>
          )}

          {/* Description / weight line */}
          {product.description && (
            <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
              {product.description}
            </p>
          )}

          <div className="flex-1" />

          {/* Price + Action row */}
          <div className="flex items-end justify-between mt-2 gap-1">
            <div className="flex flex-col">
              <span className="font-bold text-sm text-foreground leading-tight">₹{product.price}</span>
            </div>

            {/* Action area */}
            <div className="shrink-0">
              {!product.is_available ? (
                <span className="text-[10px] font-medium text-muted-foreground">Unavailable</span>
              ) : quantity === 0 ? (
                <button
                  onClick={handleAdd}
                  className="border border-success text-success font-bold text-xs px-3 py-1 rounded-md hover:bg-success hover:text-white transition-colors"
                >
                  ADD
                </button>
              ) : (
                <div className="flex items-center bg-success rounded-md overflow-hidden">
                  <button
                    onClick={handleDecrement}
                    className="px-2 py-1 text-white hover:bg-success/80 transition-colors"
                  >
                    <Minus size={12} />
                  </button>
                  <span className="font-bold text-xs text-white px-1 min-w-[16px] text-center">{quantity}</span>
                  <button
                    onClick={handleIncrement}
                    className="px-2 py-1 text-white hover:bg-success/80 transition-colors"
                  >
                    <Plus size={12} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
  );
}
