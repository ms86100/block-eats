
# Full Product Audit: Builder & Resident Experience Gaps

## Executive Summary

After a thorough code audit of every feature page, the builder dashboard, society dashboard, feature gating system, and data flow, here is an honest assessment. The platform has strong foundational modules but suffers from **disconnected workflows**, **missing cross-feature integrations**, and **several features that are "demo-ready" but not "production-ready."** A builder evaluating this today would see promising building blocks but would hesitate to pay because the tool doesn't yet feel like a **complete operating system** for their societies.

---

## Part 1: Critical Gaps (Would Stop a Builder from Buying)

### Gap 1: No Announcement / Communication System for Builders
**Problem:** A builder managing 5 societies has no way to send announcements or updates to residents. The `EmergencyBroadcastSheet` exists but is admin-only (Platform Admin page), not builder-accessible. There is no "Builder sends update to all residents of Society X" flow.

**Why it matters:** Communication is the #1 thing builders do with residents during construction. Without this, the tool is a dashboard they look at, not one they work with.

**Fix:** Add a "Send Update" action per society on the Builder Dashboard. Allow builders to post construction updates, delay notifications, and possession-related announcements directly.

### Gap 2: No Notifications Pipeline Connected to Features
**Problem:** When a visitor is added, parcel logged, dispute raised, snag reported, or milestone posted -- there are no push notifications or in-app notifications sent to relevant parties. The notification tables exist (`notification_queue`, `push_notification` edge function) but nothing in the feature pages actually calls them.

**Why it matters:** A parcel arrives, gets logged -- but the resident never knows. A dispute is raised -- the committee never gets alerted. The tool becomes a passive record-keeper instead of an active communication platform.

**Fix:** Wire up notification triggers for: visitor check-in, parcel received, dispute status change, snag acknowledged/fixed, milestone posted, maintenance due generated.

### Gap 3: Builder Cannot Respond to Snags or Disputes
**Problem:** The `SnagDetailSheet` and `DisputeDetailSheet` allow status updates, but there is no builder-specific workflow. When a builder views snags across their societies, they can see counts but cannot acknowledge, assign, or respond to individual snags/disputes from the builder dashboard.

**Why it matters:** A builder buys this tool to manage defect complaints during construction. If they can only see aggregate numbers but must navigate into each society, switch context, and then act -- the workflow is too painful for real use.

**Fix:** Add a "Builder Action Center" -- a consolidated view of all open snags and disputes across societies, with ability to acknowledge, assign to contractor, and respond directly.

### Gap 4: Society Dashboard Shows Empty States for Most Features
**Problem:** When a builder sets up a new society with their plan features, most pages show "No data yet" empty states. There is no onboarding, seed data, or guided setup for any module. Parking has no slots, maintenance has no dues, construction has no towers, inspection has no checklists.

**Why it matters:** First impression is everything. A builder logs in, sees "No parking slots configured," "No payment milestones," "No milestone updates" across every feature. The tool looks empty and abandoned.

**Fix:** Add a "Setup Wizard" for builders that walks through initial configuration for each enabled feature: add towers, set up parking slots, create payment milestones, etc.

---

## Part 2: Integration Gaps (Features That Exist but Don't Talk to Each Other)

### Gap 5: Visitor Management is Isolated from Guard Kiosk
**Problem:** Residents create visitor entries with OTPs on `/visitors`. Guards verify OTPs on `/guard-kiosk`. But the guard kiosk only does OTP lookup -- it has no list of expected visitors for the day, no dashboard of checked-in visitors, no count of how many visitors are currently inside.

**Fix:** Add a "Today's Expected" list to the Guard Kiosk tab and a "Currently Inside" counter.

### Gap 6: Construction Progress Doesn't Link to Payment Milestones
**Problem:** Construction milestones (`construction_milestones`) and payment milestones (`payment_milestones`) are completely separate features. A builder updates construction to "Slab Complete" but the payment milestone for "Slab Casting" doesn't auto-update or even cross-reference.

**Fix:** Link payment milestones to construction stages. When a construction milestone reaches a stage, auto-flag the corresponding payment milestone as "due."

### Gap 7: Inspection Checklist Doesn't Feed Into Snag Reports
**Problem:** When a resident marks items as "fail" in the pre-handover inspection, those items stay in the checklist. They don't automatically become snag tickets. The resident would have to re-enter everything manually in the Snag Reports section.

**Fix:** Add a "Convert Failed Items to Snags" button on the inspection checklist. Auto-create `snag_tickets` from failed inspection items with the category, notes, and photos.

### Gap 8: Maintenance Dues Has No Payment Integration
**Problem:** Maintenance dues can be generated and marked as "paid" manually by admin. But there's no online payment option for residents (no Razorpay integration for maintenance), no receipt generation, and no auto-reminder for overdue dues.

**Fix:** Connect Razorpay checkout to maintenance dues. Allow residents to pay online and auto-mark as paid.

### Gap 9: Domestic Help Has No Gate Integration
**Problem:** Domestic help entries are tracked for attendance but are completely separate from the gate management system. A maid checks in via the Domestic Help page, but the guard kiosk doesn't know about it. There is no OTP or QR for domestic help entry.

**Fix:** Auto-create a recurring visitor entry or gate pass for active domestic help. Show domestic help expected arrivals in the Guard Kiosk.

---

## Part 3: Missing Features (What a Builder Would Ask For)

### Gap 10: No Society-Level Dashboard for Committee Members
**Problem:** Society admins manage their society from `/society/admin` which is a member/seller approval page. There is no "committee dashboard" showing: unresolved disputes, maintenance collection rate, pending visitor approvals, upcoming construction deadlines.

**Fix:** Enhance the Society Admin page with a dashboard tab showing key operational metrics.

### Gap 11: No Bulk Communication to Residents
**Problem:** There's no way for society admin or builder to send a notice, circular, or announcement to all residents. The bulletin board exists but is a social feed, not an official communication channel.

**Fix:** Add a "Notices" section with official announcements from committee/builder, distinct from the community bulletin.

### Gap 12: No Report/Export for Any Module
**Problem:** The "Monthly Report Card" link exists in the Society Dashboard but there is no actual export or PDF generation for any data: finances, maintenance collection, snag resolution rates, visitor logs.

**Fix:** Add export-to-PDF and CSV download capabilities for finances, visitor logs, and maintenance reports.

### Gap 13: Worker Marketplace / Workforce Not in Society Dashboard
**Problem:** `worker_marketplace` and `workforce_management` are defined as features but are not present in the Society Dashboard card grid. They exist only at the route level.

**Fix:** Add these two features to the Society Dashboard grid with appropriate `featureKey` mapping.

---

## Part 4: UX/Polish Issues

### Gap 14: No Loading States on Data Mutations
**Problem:** Most forms (Add Visitor, Log Parcel, Add Helper) have submit buttons but no optimistic updates or loading spinners on individual card actions (Check In, Check Out, Collect, Resolve).

### Gap 15: No Confirmation Before Destructive Actions
**Problem:** "Check Out" visitor, "Deny" entry at guard kiosk, and "Cancel" visitor entry happen with a single tap and no confirmation dialog.

### Gap 16: Role-Based Feature Visibility Inconsistencies
**Problem:** Maintenance page shows "Generate Monthly Dues" only to `isAdmin` (platform admin), not to society admins. This means the actual society committee can't generate dues. Same issue in several other places where `isAdmin` is checked instead of `isSocietyAdmin`.

---

## Recommended Implementation Priority

| Priority | Gap | Impact | Effort |
|----------|-----|--------|--------|
| P0 | #2 - Notifications pipeline | Critical - Without notifications, nothing feels alive | Medium |
| P0 | #3 - Builder snag/dispute response | Critical - Builder's primary daily workflow | Medium |
| P0 | #16 - Role-based visibility fixes | Critical - Committee members can't use key features | Low |
| P1 | #1 - Builder communication system | High - Builders need to communicate with residents | Medium |
| P1 | #4 - Setup wizard / guided onboarding | High - Empty states kill first impressions | High |
| P1 | #7 - Inspection to snag conversion | High - Natural workflow continuation | Low |
| P1 | #9 - Domestic help gate integration | High - Security gap | Medium |
| P2 | #5 - Guard kiosk expected visitors | Medium - Better guard experience | Low |
| P2 | #6 - Construction-payment linking | Medium - Reduces manual work | Medium |
| P2 | #8 - Online maintenance payment | Medium - Revenue opportunity | Medium |
| P2 | #10 - Committee dashboard | Medium - Better governance visibility | Medium |
| P2 | #11 - Official notices system | Medium - Distinct from social bulletin | Medium |
| P2 | #13 - Missing features in dashboard grid | Low - Quick fix | Low |
| P3 | #12 - Reports and exports | Medium - Compliance and transparency | High |
| P3 | #14-15 - UX polish | Low - Quality of life | Low |

---

## Technical Details

### Files That Need Changes (by priority)

**P0 - Notifications:**
- Create database triggers on `visitor_entries`, `parcel_entries`, `dispute_tickets`, `snag_tickets`, `construction_milestones`, `maintenance_dues` that insert into `notification_queue`
- Wire `process-notification-queue` edge function to actually send push notifications

**P0 - Builder Action Center:**
- New component `src/components/builder/BuilderActionCenter.tsx`
- New page or section on `BuilderDashboardPage.tsx` showing consolidated open items
- Update RLS policies to allow builder SELECT across managed societies for snags/disputes

**P0 - Role Fixes:**
- `MaintenancePage.tsx` line 54, 137, 220: Change `isAdmin` to `isAdmin || isSocietyAdmin`
- Audit all pages for similar `isAdmin`-only checks that should include `isSocietyAdmin`

**P1 - Builder Announcements:**
- New table `builder_announcements` or extend `bulletin_posts` with `is_official` flag
- New component for builder to post per-society
- Show in society bulletin with distinct styling

**P1 - Inspection to Snag:**
- Add button in `InspectionChecklistPage.tsx` after submit
- Create `snag_tickets` from failed `inspection_items` programmatically

**P1 - Domestic Help Gate Pass:**
- On domestic help creation, auto-create recurring `visitor_entries` with type `domestic_help`
- Show in Guard Kiosk expected list

This plan gives you a clear roadmap to transform the tool from a collection of isolated modules into a connected operating system that a builder would pay for.
