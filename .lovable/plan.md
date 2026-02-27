

## Problems Identified and Fixes

### Problem 1: No post-submission confirmation + "Edit" button redirects to home

**Root cause:**
- After `handleSubmit` in `useSellerApplication.ts` (line 269-270), it shows a brief toast and navigates to `/profile`. No dedicated confirmation screen.
- The "Edit Kitchen" button on the "Already Registered" screen (line 111 in `BecomeSellerPage.tsx`) uses `window.location.href = '#/seller/settings'`. This works, but only if the user has the `seller` role. If the seller is still `pending`, `SellerRoute` redirects them to `/` because `isSeller` is false (the role isn't granted until admin approves).

**Fix:**
1. **`useSellerApplication.ts`**: After successful submission, navigate to a new confirmation state instead of `/profile`. Add a `submissionComplete` state flag.
2. **`BecomeSellerPage.tsx`**: Add a Step 7 / success screen that shows: "Your store has been submitted for review. You'll be notified once approved." with a button to go home.
3. **`BecomeSellerPage.tsx` line 111**: For the "Edit" button on "Already Registered", check `verification_status`. If `pending`, show "Your application is under review" instead of an edit button. If `approved`, navigate to `/seller/settings`. If `rejected`, show the resubmit flow (already handled).

### Problem 2: Two separate approval actions in admin (product-level + seller-level)

**Root cause:** The `SellerApplicationReview` component renders:
- Per-product Approve/Reject buttons (lines 234-242) for each product with `approval_status === 'pending'`
- Seller-level Approve/Reject buttons (lines 267-271) for sellers with `verification_status === 'pending'`

This is confusing because approving the seller already cascades to approve all pending products (line 157 in `useSellerApplicationReview.ts`).

**Fix:**
1. Remove individual product approve/reject buttons when the seller itself is still `pending`. Show products as read-only preview in that case.
2. Only show per-product approve/reject when the seller is already `approved` but has new pending products (post-approval product additions).
3. Add a clear label: "Approving the seller will also approve all pending products."

### Problem 3: "Add Product" error after approval notification click

**Root cause:** The congrats banner in `HomePage.tsx` (line 100) links to `/seller/products`. This route is wrapped in `SellerRoute` which checks `isSeller` from `useAuth`. After admin approval:
- The `user_roles` table gets updated server-side
- But the seller's browser session hasn't refreshed its auth context
- `isSeller` is still `false` in the client, so `SellerRoute` redirects to `/`
- The `RouteErrorBoundary` with `sectionName="Products"` catches this as an error

**Fix:**
1. **`HomePage.tsx`**: When the congrats banner's "Add Products" link is clicked, trigger a profile/role refresh before navigating.
2. **`AuthProvider`**: Ensure `refreshProfile()` is called when the seller congrats banner appears, so roles are up-to-date.
3. Alternative simpler fix: In the congrats banner `onClick`, call `refreshProfile()` then navigate programmatically after the refresh completes.

### Problem 4: Products show as "Draft" with Submit button after admin already approved

**Root cause:** There are two code paths creating products:
- **Onboarding** (`handleSubmit` in `useSellerApplication.ts` line 265): transitions products from `draft` to `pending`
- **Post-approval product creation** (`handleSave` in `useSellerProducts.ts` line 182): new products are always created with `approval_status: 'draft'`

When admin approves the seller, the cascade (line 157) updates products `IN ('pending', 'draft')` to `approved`. But if the seller adds products **after** approval, they're created as `draft` -- which is correct behavior for the edit-then-submit workflow. However, the admin filter in `SellerApplicationReview` (line 134) only shows sellers with `pending` products, not `draft` products.

The actual issue: After admin approves seller and products, the seller's `useSellerProducts` hook re-fetches data. But if the seller's client hasn't refreshed, the old product data (pre-approval) might still show `draft` status. Additionally, new products added post-approval are intentionally `draft` until submitted.

**Fix:**
1. For approved sellers, new products should default to `approved` status instead of `draft` (skip the review cycle for already-approved sellers). This matches the memory note about the access lifecycle.
2. Update `useSellerProducts.ts` line 182: if seller's `verification_status === 'approved'`, set `approval_status: 'approved'` instead of `'draft'`.
3. Remove the "Submit for Approval" button and draft banner from `SellerProductsPage.tsx` for approved sellers, since their products go live immediately.

### Files to modify

1. **`src/hooks/useSellerApplication.ts`** -- Add `submissionComplete` state, change post-submit behavior
2. **`src/pages/BecomeSellerPage.tsx`** -- Add submission success screen, fix "Edit" button for pending sellers
3. **`src/components/admin/SellerApplicationReview.tsx`** -- Hide per-product approval when seller is pending, add cascade label
4. **`src/hooks/useSellerProducts.ts`** -- Auto-approve products for approved sellers
5. **`src/pages/SellerProductsPage.tsx`** -- Remove draft submit UI for approved sellers
6. **`src/pages/HomePage.tsx`** -- Refresh auth before navigating to seller products

