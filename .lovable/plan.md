

## Problem

When editing a product, the `handleSave` function sets `approval_status: 'pending'`. This triggers the `check_seller_license()` database trigger, which validates that sellers in license-mandatory groups (like Food/FSSAI) have an approved license before allowing any non-draft product write.

The trigger logic (line from DB function):
```sql
IF NEW.approval_status = 'draft' THEN RETURN NEW; END IF;
-- ... checks for approved license, raises exception if missing
```

So editing a product that was previously `approved` resets it to `pending`, which re-triggers the license gate. If the seller doesn't have an approved FSSAI license in the `seller_licenses` table, the update is blocked.

## Root Cause

In `useSellerProducts.ts` line ~165:
```typescript
...(editingProduct ? { approval_status: 'pending' } : { approval_status: 'draft' }),
```

Every edit forces `approval_status` back to `pending`, which hits the license check. This is by design for re-review, but the license check should not block edits if the seller was already operating (their products were previously approved).

## Fix

**Preserve the existing `approval_status` on edit if the product was already approved**, or keep it as `pending` for re-review but ensure the license check allows transitions from already-approved products.

The cleanest fix is in the **database trigger** `check_seller_license`: allow updates where the product's **current** (OLD) `approval_status` is already `'approved'` — meaning the seller previously passed the license gate. This way:
- New products still require license approval
- Edits to approved products go to `pending` for content re-review but aren't blocked by the license gate

### Database Migration

```sql
-- In check_seller_license(), after the draft check, add:
IF TG_OP = 'UPDATE' AND OLD.approval_status = 'approved' THEN
  RETURN NEW;
END IF;
```

This single change means: if a product was already approved (meaning the license was valid at that time), subsequent edits are allowed through the license gate. The product still gets set to `pending` for admin content re-review, which is correct behavior.

### Files Changed
1. **New migration** — Update `check_seller_license()` function to bypass license check for products that were previously approved (edit scenario)

No frontend changes needed.

