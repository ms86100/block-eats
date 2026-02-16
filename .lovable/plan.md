

## Fix: License Enforcement in Seller Onboarding

### Root Cause

The admin correctly toggled "Requires License" and "Mandatory" ON for Rentals. The code in Step 4 does check `selectedGroupRow.requires_license` and renders the `LicenseUpload` component. However, the seller never sees it because:

1. **No blocking**: The "Review & Submit" button only checks if products exist -- it does NOT check if a mandatory license was uploaded. The seller can skip it entirely.
2. **Poor visibility**: The license upload card is tucked above the product list in Step 4, easy to scroll past or miss.
3. **Silent failure possible**: If the `license_type_name` is null (as it is for Rentals -- the admin set the toggle but didn't configure a name), the upload prompt says "Upload null", which is confusing but still functional.

### Proposed Fix (3 changes)

---

### Change 1: Move License Upload to Step 3 (Store Details)

Move the `LicenseUpload` component from Step 4 (Products) into Step 3 (Store Details), where it logically belongs -- the seller is setting up their business identity, and the license is part of that.

Place it right after the business detail fields with a clear heading like "Required License" and an explanation.

**File:** `BecomeSellerPage.tsx`
- Remove `LicenseUpload` from the Step 4 block (lines 711-714)
- Add it at the end of the Step 3 block, after the store details form fields
- Keep the Step 5 reminder as-is

---

### Change 2: Block Progression When Mandatory License is Missing

Add license status checking so sellers cannot proceed past Step 3 if:
- The group has `license_mandatory = true`, AND
- No license record exists or the existing one has status `rejected`

This requires:
- Fetching the license status for the current seller + group combo
- Disabling the "Continue" button on Step 3 if the license is mandatory but not uploaded
- Showing a clear message: "You must upload your [license type] before continuing"

**File:** `BecomeSellerPage.tsx`
- Add a state variable to track license upload status
- Query `seller_licenses` table for the current draft seller + group
- Conditionally disable the Step 3 Continue button
- Show inline warning text when blocked

---

### Change 3: Fallback License Type Name

When an admin enables `requires_license` but doesn't set a `license_type_name`, the UI should gracefully default to "Business License" instead of showing "null".

**File:** `LicenseUpload.tsx`
- In `fetchData`, after setting config, default `license_type_name` to `"Business License"` if it's null
- This ensures the upload prompt always shows a readable label

---

### Summary of User Experience After Fix

| Step | What Seller Sees |
|------|-----------------|
| Step 1 | Choose category (Rentals) |
| Step 2 | Pick subcategories (Vehicle, Equipment, etc.) |
| Step 3 | Fill store details + **upload mandatory license** (cannot proceed without it) |
| Step 4 | Add products (license already handled) |
| Step 5 | Review -- sees license status confirmation |

### Technical Details

**Files modified:**
- `src/pages/BecomeSellerPage.tsx` -- move license upload, add blocking logic
- `src/components/seller/LicenseUpload.tsx` -- fallback label for null license type name

**No database changes needed.** The `requires_license` and `license_mandatory` flags are already correctly set for Rentals. The fix is purely in the frontend enforcement and placement.
