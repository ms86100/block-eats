import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, ExternalLink } from 'lucide-react';
import { featureShowcaseMap } from '@/lib/feature-showcase-data';
import { useNavigate } from 'react-router-dom';

interface FeatureShowcaseProps {
  featureKey: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FeatureShowcase({ featureKey, open, onOpenChange }: FeatureShowcaseProps) {
  const navigate = useNavigate();
  const data = featureKey ? featureShowcaseMap[featureKey] : null;

  if (!data) return null;

  const Icon = data.icon;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Icon size={22} />
            </div>
            <div>
              <SheetTitle className="text-left">{data.title}</SheetTitle>
              <p className="text-xs text-muted-foreground">{data.tagline}</p>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-5 space-y-5">
          <div>
            <p className="text-sm text-foreground leading-relaxed">{data.description}</p>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">WHO USES THIS</p>
            <div className="flex flex-wrap gap-1.5">
              {data.audience.map(a => (
                <Badge key={a} variant="secondary" className="text-xs">{a}</Badge>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">CAPABILITIES</p>
            <div className="space-y-1.5">
              {data.capabilities.map(c => (
                <div key={c} className="flex items-start gap-2">
                  <Check size={14} className="text-primary mt-0.5 shrink-0" />
                  <span className="text-sm">{c}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Badge variant="outline" className="text-[10px] capitalize">{data.category}</Badge>
          </div>

          <Button
            className="w-full gap-2"
            onClick={() => {
              onOpenChange(false);
              navigate(data.route);
            }}
          >
            <ExternalLink size={14} />
            Try this feature
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
