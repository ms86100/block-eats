import { Link } from 'react-router-dom';
import { useSellerHealth, SellerHealthCheck } from '@/hooks/queries/useSellerHealth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, AlertTriangle, XCircle, Info, ShieldCheck, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

const STATUS_CONFIG = {
  pass: { icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10' },
  warn: { icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/10' },
  fail: { icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10' },
  info: { icon: Info, color: 'text-primary', bg: 'bg-primary/10' },
} as const;

function CheckItem({ check }: { check: SellerHealthCheck }) {
  const config = STATUS_CONFIG[check.status];
  const Icon = config.icon;

  return (
    <div className={cn('flex items-start gap-3 p-3 rounded-lg', config.bg)}>
      <Icon size={18} className={cn('shrink-0 mt-0.5', config.color)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{check.label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{check.message}</p>
        {check.actionLabel && check.actionRoute && (
          <Link to={check.actionRoute}>
            <Button variant="link" size="sm" className="h-auto p-0 mt-1 text-xs gap-1">
              {check.actionLabel}
              <ChevronRight size={12} />
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}

export function SellerVisibilityChecklist({ sellerId }: { sellerId: string }) {
  const { data, isLoading } = useSellerHealth(sellerId);
  const [expanded, setExpanded] = useState(true);

  if (isLoading) {
    return <Skeleton className="h-24 w-full rounded-xl" />;
  }

  if (!data || data.checks.length === 0) return null;

  const { checks, passCount, totalChecks, isFullyVisible } = data;
  const issueChecks = checks.filter(c => c.status !== 'pass');
  const passChecks = checks.filter(c => c.status === 'pass');

  return (
    <Card className={cn(
      'overflow-hidden border',
      isFullyVisible ? 'border-success/30' : 'border-warning/30'
    )}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
            isFullyVisible ? 'bg-success/10' : 'bg-warning/10'
          )}>
            <ShieldCheck size={20} className={isFullyVisible ? 'text-success' : 'text-warning'} />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold">
              {isFullyVisible ? 'Store is fully visible' : 'Store visibility issues'}
            </p>
            <p className="text-xs text-muted-foreground">
              {passCount}/{totalChecks} checks passed
            </p>
          </div>
        </div>
        <ChevronRight
          size={16}
          className={cn(
            'text-muted-foreground transition-transform',
            expanded && 'rotate-90'
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CardContent className="pt-0 pb-4 px-4 space-y-2">
              {/* Show issues first */}
              {issueChecks.map(check => (
                <CheckItem key={check.key} check={check} />
              ))}
              {/* Then passes */}
              {passChecks.map(check => (
                <CheckItem key={check.key} check={check} />
              ))}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
