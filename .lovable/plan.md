
# Production-Ready Platform Upgrade Plan

This plan covers all 7 areas requested: branding/naming, landing page redesign, pricing strategy, multi-platform deployment, coupon engine, strict society isolation, and legal/branding setup.

---

## 1. App Name and Domain

Since domain research requires real-time availability checks, here are strong brandable name candidates for your multi-society community marketplace:

| Name | Rationale |
|---|---|
| **NearNest** | "Near" = hyperlocal, "Nest" = home/community. Short, memorable, scalable |
| **MyGully** | Indian-flavored ("gully" = lane/street), playful, brandable |
| **SocioMart** | "Society + Marketplace", directly communicates the concept |
| **BlockBazaar** | "Block" = residential block, "Bazaar" = marketplace. Catchy alliteration |
| **HiveLocal** | "Hive" = community working together, "Local" = hyperlocal |

**Action items:**
- You will need to check domain availability on Namecheap/GoDaddy for your preferred name
- Once chosen, all references to "BlockEats", "Greenfield Community" will be replaced throughout the codebase (index.html, manifest.json, capacitor configs, Terms, Privacy Policy, landing page, auth page, etc.)
- Update `capacitor.config.ts` appName, `public/manifest.json`, OG meta tags, and all hardcoded strings

---

## 2. Landing Page Redesign (High-Converting Carousel)

Replace the current static landing page with a modern carousel-based design featuring 4-5 slides:

**Slide 1 -- Hero**: "Your Society. Your Marketplace." with a bold CTA (Join Your Community). Full-bleed background image with gradient overlay.

**Slide 2 -- Trust & Safety**: "Only Verified Residents" -- highlights GPS verification, invite codes, admin approval. Shield/lock iconography.

**Slide 3 -- What You Can Do**: Animated category icons (Food, Services, Rentals, Classes, Buy/Sell) with short descriptions. Shows the breadth of the platform.

**Slide 4 -- For Sellers**: "Turn Your Passion Into Income" -- highlights seller benefits (zero listing fee, coupon tools, easy dashboard). Drives seller signups.

**Slide 5 -- Social Proof + CTA**: Testimonial quotes, stats (dynamic from DB: society count, seller count, category count), and final "Get Started" CTA.

**Technical approach:**
- Use `embla-carousel-react` (already installed) for the carousel
- Auto-play with dot indicators and swipe support
- Each slide is a full-viewport-height section
- Mobile-first responsive design

---

## 3. Pricing Strategy

The pricing model will be implemented as a configuration in the admin panel, not hardcoded. The recommended model:

| Tier | Price | Features |
|---|---|---|
| **Free (Buyers)** | Always free | Browse, order, review, chat |
| **Free (Sellers)** | Free to list | Up to 10 products, basic dashboard |
| **Seller Pro** | 199 INR/month | Unlimited products, coupons, promotions, analytics |
| **Society Plan** | 999 INR/month per society | White-label branding, custom rules, priority support |

**Implementation:**
- Create a `/pricing` page with the pricing tiers
- No payment gateway integration now -- just a display page with "Contact Us" for paid tiers
- The admin panel already has settings management; pricing config can be stored there

---

## 4. Multi-Platform Deployment (Capacitor)

Capacitor is already fully configured in the project with:
- `capacitor.config.ts` (development with live reload)
- `capacitor.config.production.ts` (production with bundled assets)
- `codemagic.yaml` (CI/CD for iOS and Android builds)
- Push notifications, haptics, splash screen, status bar plugins

**Remaining work:**
- Update `appName` in both Capacitor configs to the new brand name
- Update `appId` if the brand name changes (requires new Apple/Google registrations)
- Ensure the PWA manifest (`public/manifest.json`) is updated with new name/description
- Update `index.html` meta tags with new branding
- No structural changes needed -- the deployment pipeline is production-ready

---

## 5. Business Promotion and Coupon Engine

This is a new feature requiring database tables and UI.

### Database Schema

**New table: `coupons`**

| Column | Type | Purpose |
|---|---|---|
| id | uuid (PK) | Primary key |
| seller_id | uuid (FK to seller_profiles) | Which seller created it |
| society_id | uuid (FK to societies) | Society scope |
| code | text (unique per society) | e.g. "WELCOME10" |
| discount_type | text | "percentage" or "flat" |
| discount_value | numeric | e.g. 10 (for 10% or 10 INR) |
| min_order_amount | numeric | Minimum order to apply |
| max_discount_amount | numeric | Cap for percentage discounts |
| usage_limit | integer | Total times coupon can be used |
| times_used | integer (default 0) | Current usage count |
| per_user_limit | integer (default 1) | Max uses per user |
| is_active | boolean | Toggle on/off |
| starts_at | timestamptz | Valid from |
| expires_at | timestamptz | Valid until |
| created_at | timestamptz | Creation timestamp |

**New table: `coupon_redemptions`**

| Column | Type | Purpose |
|---|---|---|
| id | uuid (PK) | Primary key |
| coupon_id | uuid (FK to coupons) | Which coupon |
| user_id | uuid | Who redeemed |
| order_id | uuid (FK to orders) | Which order |
| discount_applied | numeric | Actual discount amount |
| created_at | timestamptz | When redeemed |

**RLS policies:**
- Sellers can CRUD their own coupons
- Buyers can read active coupons within their society
- Redemption records scoped to the user

### Seller UI (new section in Seller Dashboard)
- "Promotions" tab showing active/expired coupons
- Create coupon form: code, discount type/value, expiry, usage limit
- Track redemptions per coupon

### Buyer UI (Cart Page integration)
- "Apply Coupon" input field on CartPage
- Validate coupon: check society match, expiry, usage limits, min order
- Show discount breakdown in bill details
- Add `coupon_id` and `discount_amount` columns to `orders` table

---

## 6. Strict Society-Level Isolation

### Current gaps found in the codebase:

| Page/Query | Society Scoped? | Fix Needed |
|---|---|---|
| `HomePage.tsx` seller queries | Yes (has society_id filter) | OK |
| `SearchPage.tsx` | Yes (passes user_society_id to RPC) | OK |
| `CategoryGroupPage.tsx` | **NO** -- queries all approved sellers | Add society_id filter |
| `FavoritesPage.tsx` | **NO** -- shows favorites from any society | Add society_id filter on seller join |
| `CartPage.tsx` delivery address | Hardcoded "Shriram Greenfield" | Use society name from context |
| `SellerDetailPage.tsx` | No filter needed (direct ID lookup) | OK (RLS handles it) |

### Fixes required:

1. **CategoryGroupPage.tsx**: Add `.eq('society_id', profile.society_id)` to the seller query
2. **FavoritesPage.tsx**: Filter favorites to only show sellers from user's society
3. **CartPage.tsx line 377**: Replace hardcoded "Shriram Greenfield" with `society?.name`
4. **Coupon system**: All coupon queries will include `society_id` filter
5. **RLS-level enforcement**: Add a database function `get_user_society_id(user_id)` and use it in RLS policies on `seller_profiles` and `products` tables so that even if client-side filters are bypassed, the database enforces society isolation

### Database-level enforcement (new RLS approach):
```text
-- Security definer function
create function get_user_society_id(_user_id uuid) returns uuid
  -- Returns the society_id for a given user

-- Update seller_profiles SELECT policy to include:
  OR (society_id = get_user_society_id(auth.uid()))
-- This ensures users can only see sellers from their own society
```

---

## 7. Complete Branding and Legal Setup

### Logo
- A logo cannot be generated by code -- you will need to use a design tool (Canva, Figma) or hire a designer
- The codebase supports `society.logo_url` for per-society branding; the platform logo should be added as a static asset

### Terms and Conditions Rewrite
Update `TermsPage.tsx` to:
- Replace all "BlockEats" references with the new platform name
- Replace all "Shriram Greenfield" with generic "your registered society"
- Add Grievance Officer section (required by Consumer Protection Rules 2020)
- Add FSSAI compliance clause for food sellers
- Add TCS/GST disclaimer
- Add marketplace intermediary disclaimer (IT Act Section 79)
- Add DPDPA (Digital Personal Data Protection Act) compliance section

### Privacy Policy Rewrite
Update `PrivacyPolicyPage.tsx` to:
- Replace hardcoded society references with generic language
- Add GPS/location data collection disclosure
- Add push notification data handling
- Add DPDPA compliance: data principal rights, consent mechanism, data retention policy
- Add Data Protection Officer contact placeholder

### Pricing Page
- Create new `/pricing` route and `PricingPage.tsx`
- Display the tiered pricing model (Free Buyer, Free Seller, Seller Pro, Society Plan)
- Add to footer navigation on landing page

---

## Technical Implementation Sequence

### Phase 1: Society Isolation Fixes (Critical)
- Fix CategoryGroupPage.tsx missing society filter
- Fix FavoritesPage.tsx missing society filter
- Fix CartPage.tsx hardcoded society name
- Add `get_user_society_id` database function for RLS enforcement

### Phase 2: Branding Update
- Choose final name (user decision)
- Update all hardcoded references across ~10 files
- Update Capacitor configs, manifest.json, index.html meta tags

### Phase 3: Landing Page Carousel
- Rebuild LandingPage.tsx with embla-carousel
- 5 slides with auto-play, dot indicators, swipe
- Dynamic stats from database

### Phase 4: Coupon Engine
- Create `coupons` and `coupon_redemptions` tables with RLS
- Add `coupon_id` and `discount_amount` to `orders` table
- Seller coupon management UI
- Buyer coupon application on CartPage

### Phase 5: Legal and Pricing Pages
- Rewrite Terms and Privacy Policy with generic, multi-society language
- Create PricingPage.tsx
- Add Grievance Officer section

### Phase 6: Final Polish
- Capacitor config updates for new brand
- PWA manifest updates
- OG image and social meta updates

---

## Files to be Created or Modified

| File | Action |
|---|---|
| `src/pages/LandingPage.tsx` | Rewrite with carousel |
| `src/pages/PricingPage.tsx` | **New** |
| `src/pages/TermsPage.tsx` | Rewrite for multi-society + compliance |
| `src/pages/PrivacyPolicyPage.tsx` | Rewrite for DPDPA compliance |
| `src/pages/CategoryGroupPage.tsx` | Add society_id filter |
| `src/pages/FavoritesPage.tsx` | Add society_id filter |
| `src/pages/CartPage.tsx` | Dynamic society name |
| `src/App.tsx` | Add /pricing route |
| `index.html` | Update meta tags |
| `public/manifest.json` | Update name/description |
| `capacitor.config.ts` | Update appName |
| `capacitor.config.production.ts` | Update appName |
| Database migration | `coupons`, `coupon_redemptions` tables, `orders` columns, RLS function |
| `src/components/seller/CouponManager.tsx` | **New** -- seller coupon CRUD |
| `src/components/cart/CouponInput.tsx` | **New** -- buyer coupon application |
