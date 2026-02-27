

## Problem

The "update your app" banner has `society_id` set to a specific society (Maple Gardens), so users in other societies like `buyer@sgrf.com` (Shriram Greenfield) cannot see it. The RLS policy correctly filters by `society_id IS NULL OR society_id = user's society`.

## Good News

The admin UI **already has** the Global visibility toggle (lines 322-334 of `AdminBannerManager.tsx`), and the save logic already sets `society_id: null` when global is enabled (line 88). No code changes are needed.

## Fix Required

**Database update only** — set the existing banner to global:

```sql
UPDATE featured_items 
SET society_id = NULL 
WHERE id = '15ca2187-b7a0-4f1f-bd9f-1f1905837f13';
```

This single update will make the "update your app" banner visible to all users across all societies immediately.

## How It Works (Already Implemented)

- **Admin creates banner** → Global toggle ON → `society_id` saved as `null`
- **RLS policy** → `society_id IS NULL OR society_id = get_user_society_id(auth.uid())` → global banners pass for everyone
- **Frontend query** → `.or(society_id.eq.${id},society_id.is.null)` → global banners included

No UI or code changes needed. Just the data fix.

