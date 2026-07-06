# QA Acceptance Testing — Progress Summary

**Owner:** Nick (QA lead) | **Last updated:** 2026-07-05

## What this is

A new automated acceptance-test suite at `backend/src/app/tests/acceptance/`,
mapped 1:1 to the scenarios in *User Stories — Final Draft Version 5*. It's
separate from the backend lead's existing unit/integration suite
(`backend/src/app/tests/*.py`, ~151 tests, all passing) — that suite verifies
"the code does what it's written to do"; this one verifies "the product does
what we promised in the user stories doc."

Each test file corresponds to one user story (`test_us08_create_listing.py`,
etc.), each test class to one Given/When/Then scenario from the doc, named so
a test maps straight back to a scenario number.

Two special markers do double duty as a live gap list:

| Marker | Meaning |
|---|---|
| `@pytest.mark.skip(reason="not implemented: ...")` | The feature described in the scenario doesn't exist in the backend at all yet. |
| `@pytest.mark.xfail(strict=True, reason="known gap: ...")` | The endpoint exists, but its behavior currently contradicts the doc. `strict=True` means if someone fixes it later without removing the marker, the suite fails loudly instead of staying quietly green. |

### Running it

```bash
cd backend && source venv/bin/activate
pytest src/app/tests/acceptance -q      # just acceptance scenarios
pytest -m acceptance -q                  # same, via marker
```

---

## Coverage status

| Section | User Stories | Status |
|---|---|---|
| 1 — Account & Profile | Admin Invite, US1–7 | ✅ Done |
| 2 — Tool Listings | US8–11 | ✅ Done |
| 3 — Browse & Search | US12 | Not started |
| 4 — Reservations | US13–21 | Not started |
| 5 — Messaging | US22 | Not started — **no backend implementation exists yet** |
| 6 — Notifications | US23 | Not started |
| 7 — Reviews & Ratings | US24–25 | Not started |
| 8 — Reporting & Moderation | US26–34 | Not started — most of US26–29 (report a listing, admin review, category management, violation tracking) **have no backend implementation yet** |

CI/CD integration (GitHub Actions) has not been started — this suite currently only runs locally.

---

## Results so far (Sections 1–2)

**55 passed / 11 skipped / 18 xfailed** across 84 scenario-tests. The existing 151-test backend suite is unaffected.

| File | User Story | Passed | Skipped | XFailed |
|---|---|---:|---:|---:|
| `test_us_admin_invite.py` | Admin Invites a New Member | 3 | 1 | 0 |
| `test_us01_register.py` | 1 — Register with Invite Token | 4 | 0 | 0 |
| `test_us02_verify_email.py` | 2 — Verify Email Address | 1 | 0 | 2 |
| `test_us03_login.py` | 3 — Log In Securely | 5 | 0 | 1 |
| `test_us04_reset_password.py` | 4 — Reset Forgotten Password | 4 | 0 | 1 |
| `test_us05_profile_setup.py` | 5 — Set Up Profile | 2 | 2 | 2 |
| `test_us06_edit_profile.py` | 6 — Edit Profile | 4 | 1 | 2 |
| `test_us07_delete_account.py` | 7 — Delete Account | 3 | 1 | 3 |
| `test_us08_create_listing.py` | 8 — Create a Tool Listing | 7 | 2 | 3 |
| `test_us09_edit_listing_photos.py` | 9 — Edit a Tool Listing and Manage Photos | 10 | 3 | 0 |
| `test_us10_delete_deactivate_listing.py` | 10 — Delete or Deactivate a Tool Listing | 8 | 0 | 1 |
| `test_us11_admin_deactivate_reactivate.py` | 11 — Admin Deactivate/Reactivate | 4 | 1 | 3 |

---

## Findings — gaps between the doc and the current backend

Every gap below is a scenario in the doc that the current code does not satisfy. None are guesses — each is backed by a failing (xfail) or impossible-to-write (skip) test, and the more surprising ones were spot-checked against the real running server, not just the test DB.

### Not implemented at all
- No revoke-invite endpoint (Admin Invite, Scenario 3).
- No profile-photo upload endpoint — `photo_url` is a raw string field, no file/image validation (User Stories 5 & 6, photo scenarios).
- No "profile setup" vs "edit profile" distinction — one `PUT /auth/me` handles both, so there's no completed-profile redirect (User Story 5, Scenario 6).
- No explicit "confirm previous account is gone" step on re-registering a deleted account's email (User Story 7, Scenario 4).
- No `latest_return_time`, `lending_rules`, or `notes_for_borrowers` fields anywhere on a tool listing — affects User Stories 8, 9, and (down the line) 12, 19, 20.
- Tool categories are a fixed 5-value enum, not an admin-editable list — User Story 28 (category management) doesn't exist, and the doc's example categories ("Kitchen", "Ladders") aren't in the app.
- Admin audit-log endpoint only filters by action/target type — not by admin, date range, or listing (User Story 11, Scenario 5).

### Implemented, but behavior contradicts the spec
- **Email verification**: an invalid/expired token returns a bare **500 Internal Server Error** instead of a 4xx with a resend option — an exception type isn't wired into the error-mapping table.
- **Password reset**: invalidates access tokens correctly, but **not refresh tokens** — a stale refresh token can still mint a new session after a password change.
- **Logout**: is a documented no-op — an access token stays valid after "logout" until it naturally expires.
- **Profile display name**: no validation at all — blank/whitespace-only and 500+ character names are both accepted (User Stories 5 & 6).
- **Account deletion**: only checks the caller's own reservations as *borrower* — an owner with tools currently out on loan can delete their account and strand borrowers.
- **Account deletion**: overwrites the display name with the literal `"Deleted User"`, even though the spec says display name is the one field that must survive deletion (for review/history integrity).
- **Account deletion**: blocked for suspended members (requires ACTIVE status), contradicting the doc's explicit "suspended members can still delete their account."
- **Tool creation**: succeeds with zero photos and no description, even though both are supposed to be required.
- **Tool creation**: no per-owner duplicate-name check.
- **Deactivating a listing**: doesn't block deactivation while the tool is `PICKED_UP` (out on loan) — true for both owner self-deactivation and admin deactivation.
- **Deactivating/reactivating a listing**: never sends notifications to affected borrowers or the owner.

---

## Next steps

1. Continue building acceptance tests for Sections 3–8 (Reservations, the largest section, is next up by story count).
2. Decide with the team whether the gaps above are pre-demo blockers or tracked as known issues.
3. Wire this suite into GitHub Actions once coverage is further along (no CI/CD pipeline exists yet for this repo).
