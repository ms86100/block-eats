import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Bell, ShoppingBag, ArrowRight } from 'lucide-react';
import { useCurrency } from '@/hooks/useCurrency';
import { motion, AnimatePresence } from 'framer-motion';

const AUTO_DISMISS_SECONDS = 30;

interface NewOrderAlertOverlayProps {
  order: { id: string; status: string; total_amount: number } | null;
  onDismiss: () => void;
  onSnooze?: () => void;
}

function statusLabel(status: string): string {
  switch (status) {
    case 'enquired': return '📋 New Enquiry';
    case 'placed': return '🛒 New Order';
    case 'quoted': return '💬 Quote Request';
    default: return '🔔 New Order';
  }
}

export function NewOrderAlertOverlay({ order, onDismiss, onSnooze }: NewOrderAlertOverlayProps) {
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const [countdown, setCountdown] = useState(AUTO_DISMISS_SECONDS);

  // Auto-dismiss countdown
  useEffect(() => {
    if (!order) {
      setCountdown(AUTO_DISMISS_SECONDS);
      return;
    }
    setCountdown(AUTO_DISMISS_SECONDS);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onDismiss();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [order, onDismiss]);

  const handleView = () => {
    onDismiss();
    try {
      navigate(`/orders/${order!.id}`);
    } catch (e) {
      console.error('[OrderAlert] Navigation failed, falling back:', e);
      navigate('/orders');
    }
  };

  const handleSnooze = () => {
    if (onSnooze) {
      onSnooze();
    } else {
      onDismiss();
    }
  };

  return (
    <AnimatePresence mode="wait">
      {order && (
        <motion.div
          key="new-order-alert"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-6"
          // No onClick={onDismiss} — backdrop does NOT dismiss
        >
          <motion.div
            initial={{ scale: 0.8, y: 40 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.8, y: 40 }}
            transition={{ type: 'spring', damping: 20 }}
            className="bg-background rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Pulsing bell icon */}
            <div className="flex justify-center">
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 0.8 }}
                className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center"
              >
                <Bell size={32} className="text-accent" />
              </motion.div>
            </div>

            <div className="text-center space-y-1">
              <h2 className="text-xl font-bold text-foreground">{statusLabel(order.status)}</h2>
              {order.total_amount > 0 && (
                <p className="text-2xl font-bold text-accent tabular-nums">{formatPrice(order.total_amount)}</p>
              )}
              <p className="text-sm text-muted-foreground">Tap below to view and respond</p>
            </div>

            {/* Single View Order button */}
            <Button
              className="w-full h-12 text-base bg-accent hover:bg-accent/90 text-accent-foreground gap-2"
              onClick={handleView}
            >
              <ShoppingBag size={18} />
              View Order
              <ArrowRight size={16} />
            </Button>

            {/* Snooze link + countdown */}
            <div className="flex items-center justify-between">
              <button
                onClick={handleSnooze}
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
              >
                Remind me later
              </button>
              <span className="text-xs text-muted-foreground tabular-nums">
                Auto-dismiss in {countdown}s
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
