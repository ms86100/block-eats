

## Problem

The chat overlay (`OrderChat`) opens full-screen with `fixed inset-0 z-50`, but the bottom navigation bar from `AppLayout` renders on top of the chat's input area, hiding the message input field and send button. The user sees messages but cannot type or send follow-up messages.

Confirmed via browser testing: the chat shows the message thread correctly but the input field at the bottom is covered by the `BottomNav` component.

## Root Cause

In `OrderDetailPage.tsx`, the `AppLayout` wraps everything including the chat overlay. The `showNav` prop controls whether the bottom nav renders. When the chat is open, the bottom nav still renders at the same or higher z-index, covering the chat input.

The `BottomNav` component likely uses `z-50` (same as the chat), and since it renders later in the DOM, it paints on top.

## Fix

**File: `src/pages/OrderDetailPage.tsx`**

Update the `showNav` prop on `AppLayout` to also hide the nav when the chat is open:

```
Current:  showNav={!o.isSellerView || order.status === 'completed' || order.status === 'cancelled'}
Fixed:    showNav={(!o.isSellerView || order.status === 'completed' || order.status === 'cancelled') && !o.isChatOpen}
```

This ensures when the full-screen chat overlay is active, the bottom nav hides and does not cover the chat input.

**Alternative/additional safety**: Bump the `OrderChat` container z-index from `z-50` to `z-[60]` in `src/components/chat/OrderChat.tsx` to guarantee it renders above all other fixed elements.

## Changes Summary

| File | Change |
|------|--------|
| `src/pages/OrderDetailPage.tsx` | Add `&& !o.isChatOpen` to `showNav` condition |
| `src/components/chat/OrderChat.tsx` | Change `z-50` to `z-[60]` for safety |

