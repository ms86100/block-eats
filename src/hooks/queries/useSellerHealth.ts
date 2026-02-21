import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { jitteredStaleTime } from '@/lib/query-utils';

export interface SellerHealthCheck {
  key: string;
  label: string;
  status: 'pass' | 'warn' | 'fail' | 'info';
  message: string;
  actionLabel?: string;
  actionRoute?: string;
}

export interface SellerHealthData {
  checks: SellerHealthCheck[];
  passCount: number;
  totalChecks: number;
  isFullyVisible: boolean;
}

export function useSellerHealth(sellerId: string | null) {
  return useQuery({
    queryKey: ['seller-health', sellerId],
    queryFn: async (): Promise<SellerHealthData> => {
      if (!sellerId) return { checks: [], passCount: 0, totalChecks: 0, isFullyVisible: false };

      // Run all queries in parallel
      const [profileRes, productCountsRes, licenseRes] = await Promise.all([
        // 1. Seller profile + society coordinates
        supabase
          .from('seller_profiles')
          .select('verification_status, is_available, sell_beyond_community, delivery_radius_km, primary_group, society_id, societies!inner(latitude, longitude)')
          .eq('id', sellerId)
          .single(),

        // 2. Product status counts
        supabase
          .from('products')
          .select('approval_status, is_available')
          .eq('seller_id', sellerId),

        // 3. License status
        supabase
          .from('seller_licenses')
          .select('status, group_id, parent_groups!inner(slug, requires_license)')
          .eq('seller_id', sellerId),
      ]);

      const profile = profileRes.data as any;
      const products = productCountsRes.data || [];
      const licenses = (licenseRes.data || []) as any[];

      if (!profile) return { checks: [], passCount: 0, totalChecks: 0, isFullyVisible: false };

      const checks: SellerHealthCheck[] = [];

      // Check 1: Store verification
      const verStatus = profile.verification_status;
      if (verStatus === 'approved') {
        checks.push({ key: 'store_verified', label: 'Store approved', status: 'pass', message: 'Your store is live and approved.' });
      } else if (verStatus === 'pending') {
        checks.push({ key: 'store_verified', label: 'Store approval pending', status: 'warn', message: 'Your store is under admin review. Buyers cannot see it yet.' });
      } else if (verStatus === 'rejected') {
        checks.push({ key: 'store_verified', label: 'Store rejected', status: 'fail', message: 'Your store was rejected. Edit and resubmit for review.', actionLabel: 'Edit Store', actionRoute: '/seller/settings' });
      } else {
        checks.push({ key: 'store_verified', label: 'Store in draft', status: 'fail', message: 'Your store hasn\'t been submitted yet.', actionLabel: 'Complete Setup', actionRoute: '/become-seller' });
      }

      // Check 2: Store availability
      if (profile.is_available) {
        checks.push({ key: 'store_available', label: 'Store is open', status: 'pass', message: 'Buyers can see your store.' });
      } else {
        checks.push({ key: 'store_available', label: 'Store is closed', status: 'fail', message: 'Your store is marked as closed. Toggle it open to become visible.' });
      }

      // Check 3: Approved products
      const approvedAvailable = products.filter(p => (p as any).approval_status === 'approved' && (p as any).is_available);
      const drafts = products.filter(p => (p as any).approval_status === 'draft');
      const pending = products.filter(p => (p as any).approval_status === 'pending');
      const rejected = products.filter(p => (p as any).approval_status === 'rejected');

      if (approvedAvailable.length > 0) {
        checks.push({ key: 'has_products', label: `${approvedAvailable.length} product(s) live`, status: 'pass', message: `${approvedAvailable.length} approved product(s) visible to buyers.` });
      } else {
        checks.push({ key: 'has_products', label: 'No live products', status: 'fail', message: 'You need at least 1 approved and available product to be visible.', actionLabel: 'Manage Products', actionRoute: '/seller/products' });
      }

      // Check 3b: Draft warning
      if (drafts.length > 0) {
        checks.push({ key: 'draft_products', label: `${drafts.length} draft product(s)`, status: 'warn', message: `${drafts.length} product(s) are in draft. Submit them for admin approval to make them visible.`, actionLabel: 'Submit Products', actionRoute: '/seller/products' });
      }

      // Check 3c: Pending info
      if (pending.length > 0) {
        checks.push({ key: 'pending_products', label: `${pending.length} product(s) under review`, status: 'info', message: `${pending.length} product(s) are awaiting admin approval.` });
      }

      // Check 3d: Rejected
      if (rejected.length > 0) {
        checks.push({ key: 'rejected_products', label: `${rejected.length} product(s) rejected`, status: 'warn', message: `${rejected.length} product(s) were rejected. Edit and resubmit them.`, actionLabel: 'Fix Products', actionRoute: '/seller/products' });
      }

      // Check 4: Society coordinates
      const society = profile.societies;
      if (society?.latitude != null && society?.longitude != null) {
        checks.push({ key: 'society_coords', label: 'Society location set', status: 'pass', message: 'Your society has valid coordinates for distance calculation.' });
      } else {
        checks.push({ key: 'society_coords', label: 'Society location missing', status: 'fail', message: 'Your society has no coordinates. Cross-society buyers cannot find you. Contact your society admin.' });
      }

      // Check 5: Cross-society settings
      if (profile.sell_beyond_community) {
        checks.push({ key: 'cross_society', label: 'Cross-society selling enabled', status: 'pass', message: `Visible to buyers within ${profile.delivery_radius_km} km.` });
      } else {
        checks.push({ key: 'cross_society', label: 'Cross-society selling disabled', status: 'info', message: 'Enable "Sell beyond community" to reach buyers in nearby societies.', actionLabel: 'Update Settings', actionRoute: '/seller/settings' });
      }

      // Check 6: License (only if category requires it)
      const requiresLicense = profile.primary_group != null;
      if (requiresLicense) {
        const relevantLicense = licenses.find((l: any) => l.parent_groups?.slug === profile.primary_group && l.parent_groups?.requires_license);
        if (relevantLicense) {
          if (relevantLicense.status === 'approved') {
            checks.push({ key: 'license', label: 'License approved', status: 'pass', message: 'Your business license is verified.' });
          } else if (relevantLicense.status === 'pending') {
            checks.push({ key: 'license', label: 'License under review', status: 'warn', message: 'Your license is being reviewed. Product submissions may be blocked until approved.' });
          } else {
            checks.push({ key: 'license', label: 'License required', status: 'fail', message: 'Upload your business license to submit products.', actionLabel: 'Upload License', actionRoute: '/become-seller' });
          }
        }
        // If no license record exists but group doesn't require it, skip
      }

      const criticalChecks = checks.filter(c => c.key !== 'cross_society' && c.key !== 'draft_products' && c.key !== 'pending_products' && c.key !== 'rejected_products');
      const passCount = criticalChecks.filter(c => c.status === 'pass').length;
      const isFullyVisible = criticalChecks.every(c => c.status === 'pass' || c.status === 'info');

      return { checks, passCount, totalChecks: criticalChecks.length, isFullyVisible };
    },
    enabled: !!sellerId,
    staleTime: jitteredStaleTime(30_000),
  });
}
