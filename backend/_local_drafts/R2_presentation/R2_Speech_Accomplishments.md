# R2 Backend — 45-Second Major Accomplishments Speech

## Slide: R2 BACKEND — MAJOR ACCOMPLISHMENTS

---

**Speaker:** Ivan Wu, BE Lead

---

### Speech Text (45 seconds)

"Since R1, the backend achieved four major milestones.

First, the full reservation lifecycle. We have 14 endpoints covering Request, Approve, Pickup, and Return. The key here is the GiST EXCLUDE constraint at the database level. It prevents two reservations from overlapping on the same tool, with no race conditions in the application layer.

Second, the moderation system. Six user stories — tracking violations, suspending and reactivating members, the full audit log, and moderation reports with CSV export. Admins can see everything.

Third, dynamic categories and the reporting system. We moved from a hardcoded enum to an admin-managed category model. Members can now flag listings, and admins can review and auto-deactivate them when reported.

Finally, quality. 337 acceptance tests pass with zero failures, covering all 34 user stories. We also cleaned up five stale xfails where bugs were already fixed. The frontend TypeScript compiles clean."
