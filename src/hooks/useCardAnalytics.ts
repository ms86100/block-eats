import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * DB-backed analytics tracking for ProductListingCard.
 * Writes to marketplace_events table.
 * 
 * OPTIMIZED: Impressions are batched and debounced to avoid
 * dozens of individual DB inserts on page load.
 */

interface CardEvent {
  productId: string;
  category: string;
  price: number;
  sellerId: string;
  layout: string;
}

// ── Batched impression queue ──
let impressionQueue: CardEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let cachedUserId: string | null | undefined = undefined;

async function getUserId(): Promise<string | null> {
  if (cachedUserId !== undefined) return cachedUserId;
  try {
    const { data } = await supabase.auth.getSession();
    cachedUserId = data?.session?.user?.id || null;
    // Reset cache after 5 minutes
    setTimeout(() => { cachedUserId = undefined; }, 5 * 60 * 1000);
  } catch {
    cachedUserId = null;
  }
  return cachedUserId;
}

async function flushImpressions() {
  if (impressionQueue.length === 0) return;
  const batch = impressionQueue.splice(0);
  const userId = await getUserId();

  try {
    await supabase.from('marketplace_events').insert(
      batch.map(data => ({
        product_id: data.productId,
        seller_id: data.sellerId,
        category: data.category,
        layout_type: data.layout,
        event_type: 'impression',
        user_id: userId,
        metadata: { price: data.price },
      }))
    );
  } catch {
    // Silent fail — analytics must never break UI
  }
}

function queueImpression(data: CardEvent) {
  impressionQueue.push(data);
  if (flushTimer) clearTimeout(flushTimer);
  // Flush after 2 seconds of inactivity or when batch hits 20
  if (impressionQueue.length >= 20) {
    flushImpressions();
  } else {
    flushTimer = setTimeout(flushImpressions, 2000);
  }
}

async function emitSingle(eventType: string, data: CardEvent) {
  try {
    const userId = await getUserId();
    await supabase.from('marketplace_events').insert({
      product_id: data.productId,
      seller_id: data.sellerId,
      category: data.category,
      layout_type: data.layout,
      event_type: eventType,
      user_id: userId,
      metadata: { price: data.price },
    });
  } catch {
    // Silent fail
  }
}

export function useCardAnalytics(product: CardEvent) {
  const impressionFired = useRef(false);
  const ref = useRef<HTMLDivElement>(null);

  const payload: CardEvent = {
    productId: product.productId,
    category: product.category,
    price: product.price,
    sellerId: product.sellerId,
    layout: product.layout,
  };

  // Intersection observer for impression tracking
  useEffect(() => {
    if (!ref.current || impressionFired.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !impressionFired.current) {
          impressionFired.current = true;
          queueImpression(payload);
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.productId]);

  const onCardClick = useCallback(() => {
    emitSingle('click', payload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.productId]);

  const onAddClick = useCallback(() => {
    emitSingle('add_to_cart', payload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.productId]);

  const onWishlistClick = useCallback(() => {
    emitSingle('wishlist', payload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.productId]);

  return { ref, onCardClick, onAddClick, onWishlistClick };
}
