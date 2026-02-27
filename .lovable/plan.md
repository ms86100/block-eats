

## Revised Fulfillment Mode Redesign

**Core principle**: Delivery fee is ALWAYS set by admin (system_settings), never by the seller. This prevents sellers from inflating delivery charges.

### New Fulfillment Modes (5 options for seller)

| Mode value | Seller label | Who delivers | Fee source | Buyer choice? |
|---|---|---|---|---|
| `self_pickup` | Self Pickup Only | N/A | Free | No choice needed |
| `seller_delivery` | I Deliver | Seller | Admin fee | No choice — delivery forced |
| `platform_delivery` | Delivery Partner | Platform rider | Admin fee | No choice — delivery forced |
| `pickup_and_seller_delivery` | Pickup + I Deliver | Seller | Admin fee | Buyer picks: pickup or delivery |
| `pickup_and_platform_delivery` | Pickup + Delivery Partner | Platform rider | Admin fee | Buyer picks: pickup or delivery |

**Key difference from previous plan**: No `seller_delivery_fee` column. ALL delivery fees come from admin `system_settings` (`baseDeliveryFee` / `freeDeliveryThreshold`).

### Database Changes

1. **Add `delivery_handled_by` column** to `seller_profiles` — values: `'seller'` or `'platform'` (nullable, derived from fulfillment_mode for query convenience)
2. **Migrate existing data**: `delivery` → `seller_delivery`, `both` → `pickup_and_seller_delivery` (preserves current sellers' intent)
3. **Add `delivery_handled_by` column** to `orders` table — so the system knows whether to auto-assign a delivery partner for that specific order

### Frontend Changes

**1. Seller Settings (`SellerSettingsPage.tsx`) + Onboarding (`BecomeSellerPage.tsx`)**
- Replace 3 radio options with 5
- When any delivery mode is selected, show info: "Delivery fee is managed by the platform"
- When `platform_delivery` or `pickup_and_platform_delivery` is selected, show note: "A delivery partner will be assigned when order is ready"
- Keep delivery_note input for seller_delivery modes
- Update `FULFILLMENT_OPTIONS` constant and `useSellerSettings.ts` form data

**2. `FulfillmentSelector.tsx` (buyer cart)**
- Only show pickup/delivery choice when mode is `pickup_and_*`
- For `seller_delivery` or `platform_delivery` — force delivery, no choice shown
- For `self_pickup` — force pickup, no choice shown
- Fee always from admin system_settings (already the case — no change needed here)

**3. `useCartPage.ts`**
- Derive `delivery_handled_by` from seller's `fulfillment_mode` and pass it to order creation
- Fee calculation stays the same (admin settings) — no change needed

**4. Order creation RPC / orders table**
- Store `delivery_handled_by` on the order so the delivery assignment trigger knows whether to create a `delivery_assignments` row

**5. Delivery assignment trigger**
- Only auto-create `delivery_assignments` when `delivery_handled_by = 'platform'` and order status = `ready`

**6. Test helpers**
- Update `VALID_FULFILLMENT_MODES` in `business-rules.ts`

### Files to modify

1. **Database migration** — add `delivery_handled_by` to `seller_profiles` and `orders`, migrate existing fulfillment_mode values
2. `src/pages/SellerSettingsPage.tsx` — 5 radio options with contextual info
3. `src/pages/BecomeSellerPage.tsx` — update `FULFILLMENT_OPTIONS` array to 5 options
4. `src/hooks/useSellerSettings.ts` — handle new mode values
5. `src/components/delivery/FulfillmentSelector.tsx` — conditionally show/hide options based on mode
6. `src/hooks/useCartPage.ts` — pass `delivery_handled_by` to order creation
7. `src/test/helpers/business-rules.ts` — update valid modes list

