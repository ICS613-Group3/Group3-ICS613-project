**Group 3 — ICS613**

(Rion Sawabe, Ivan Wu, Nick Fairhart, Yafei Wang, Loreto Coloma)

**Requirements Review Packet**

# User Stories

**Global Authentication Rule:** Unless explicitly stated otherwise, all member actions and API endpoints (except Login, Register, Verify Email, and Forgot Password) require a valid active session. Unauthenticated requests globally return 401 Unauthorized and redirect to the login page.

# **Section 1: Account & Profile**

## **User Story — Admin Invites a New Member (New Added)**

*As an admin, I want to invite a new member by entering their email so that the system generates a unique invite token and emails it to them automatically.*

### **Scenario 1: Admin invites a new member (one-click)**

* Given the logged-in user is an admin.

* When the admin enters the new member's email address and clicks Invite.

* Then a unique invite token is generated and linked to that email.

* And an invite email is automatically sent to that address with the registration link containing the token.

* And the admin sees the invite in the invite list with status "sent".

### **Scenario 2: Admin views all invites and their status**

* Given the logged-in user is an admin.

* When the admin views the invite management page.

* Then the admin sees all invites with status (sent, used, expired, revoked) and the associated member if registered.

### **Scenario 3: Admin revokes an unused invite**

* Given the logged-in user is an admin.

* And an invite is unused and not expired.

* When the admin revokes the invite.

* Then the invite is marked as revoked and the token can no longer be used.

### **Scenario 4: Cannot invite an email that already belongs to a member**

* Given the logged-in user is an admin.

* And an account already exists with the provided email address.

* When the admin attempts to invite that email.

* Then the system rejects the invitation.

* And a message says an account with that email already exists.

## **User Story 1 — Register with Invite Token**

*As a new member, I want to register for an account using an invite token so that I can join the community securely.*

### **Scenario 1: Register with a valid invite token**

* Given an invite token exists and has not been used.

* And the token has not expired.

* When a new user submits a registration with the token, email, password, and display name. (The display name becomes the initial profile display name and can be updated later in profile setup.)

* Then the user account is created with status EMAIL\_PENDING.

* And a verification email is sent to that email address.

* And the invite token is marked as used.

* And the user is shown a message asking them to check their email to verify.

### **Scenario 2: Register with an invalid or already-used invite token**

* Given an invite token is invalid, expired, or already used.

* When a new user attempts to register with the token.

* Then the system rejects the registration.

* And a message says the invite is invalid.

### **Scenario 3: Register with an email that is already in use (invite token not consumed)**

* Given an invite token is valid and unused.

* And an email is already associated with an existing account.

* When a new user attempts to register with the valid invite token and the already-used email.

* Then the system rejects the registration.

* And a message says the email is already in use.

* And the invite token is NOT marked as used (it remains valid for a different email).

## **User Story 2 — Verify Email Address**

*As a new member, I want to verify my email address so that my account becomes active and I can access the community.*

### **Scenario 1: Verify email with valid token**

* Given a user account is in EMAIL\_PENDING status.

* And the user clicks the verification link in the email.

* When the user submits the verification token.

* Then the account status becomes ACTIVE.

* And the user is automatically logged in.

* And the user is redirected to the profile setup page.

### **Scenario 2: Verify email with expired or invalid token**

* Given a user attempts to verify their email.

* When the verification token is invalid or expired.

* Then the system rejects the verification.

* And a message appears with an option to resend the verification email.

## **User Story 3 — Log In Securely**

*As a member, I want to log in and out securely so that my account and personal information are protected.*

### **Scenario 1: Login with valid credentials**

* Given a user account exists with the provided email.

* And the account is in ACTIVE status.

* And the password matches the stored hash.

* When the user submits the login form.

* Then the user is authenticated.

* And a session token is issued.

* And the user is redirected to the member dashboard.

### **Scenario 2: Cannot login until email is verified**

* Given a user account is in EMAIL\_PENDING status.

* When the user attempts to log in.

* Then the system rejects the login.

* And a message says the email must be verified first.

* And a link is provided to resend the verification email.

### **Scenario 3: Login with invalid credentials**

* Given a user attempts to log in.

* When the email does not exist or the password is incorrect.

* Then the system rejects the login.

* And a generic error message appears (do not reveal which field is wrong).


### **Scenario 4: Log out**

* Given the logged-in user has an active session.

* When the user clicks Log Out.

* Then the session token is invalidated.

* And the user is redirected to the login page.

* And protected member pages are no longer accessible without logging in again.


## **User Story 4 — Reset Forgotten Password**

*As a member, I want to reset my password if I forget it so that I can regain access to my account.*

### **Scenario 1: Request password reset**

* Given a user account exists with the provided email.

* When the user submits the forgot-password form with their email.

* Then a password-reset email is sent to the registered email address.

* And a generic success message appears (do not reveal whether the email exists, for security).

### **Scenario 2: Complete password reset with valid token**

* Given a user has requested a password reset.

* And the user clicks the reset link in the email.

* When the user submits a new password.

* Then the password is updated (hashed and stored).

* And all existing session tokens for the user are invalidated.

* And the user is redirected to the login page with a success message.

### **Scenario 3: Password reset with invalid or expired token**

* Given a user attempts to reset their password.

* When the reset token is invalid, expired, or already used.

* Then the system rejects the reset.

* And a message appears with an option to request a new reset email.

## **User Story 5 — Set Up Profile**

*As a new member, I want to set up my profile so that other members know who I am.*

### **Scenario 1: Set up user profile after first login**

* Given a user has just verified their email.

* And the logged-in user is the new member.

* When the user submits their profile information (display name, optional bio, optional profile photo, optional neighborhood/location).

* Then the profile is saved.

* And the user is redirected to the member dashboard.

* And the user's profile is now visible to other members.

### **Scenario 2: Display name is missing or blank**

* Given a user has just verified their email.

* When the user submits the profile setup form without a display name (or with only whitespace).

* Then the system rejects the submission.

* And a validation message says a display name is required.

* And the profile is not saved.

### **Scenario 3: Display name exceeds maximum length**

* Given a user is setting up their profile.

* When the user submits a display name that exceeds the allowed character limit (e.g., more than 50 characters).

* Then the system rejects the submission.

* And a message indicates the maximum character limit.

### **Scenario 4: Profile photo upload fails validation**

* Given a user is setting up their profile.

* When the user uploads a file that is not an image or exceeds the maximum file size.

* Then the system rejects the photo.

* And an error message explains the constraint (accepted formats and size limit).

* And the rest of the profile data is preserved so the user does not lose their input.

### **Scenario 5: Unauthenticated user cannot access profile setup**

* Given a user is not logged in.

* When the user attempts to access the profile setup page directly via URL.

* Then the system returns 401 Unauthorized.

* And the user is redirected to the login page.

### **Scenario 6: Already-completed profile redirects to edit profile**

* Given a user has already completed profile setup.

* When the user attempts to navigate back to the profile setup page.

* Then the system redirects them to the edit profile page instead (User Story 6).

## **User Story 6 — Edit Profile**

*As a member, I want to edit my profile at any time so that I can keep my information current.*

### **Scenario 1: Update profile information**

* Given the logged-in user is a member.

* When the user updates their profile fields (display name, bio, profile photo, location).

* Then the changes are saved.

* And the updated profile is visible to other members.

### **Scenario 2: Display name cannot be cleared or left blank**

* Given the logged-in user is a member on the edit profile page.

* When the user deletes the display name and submits the form.

* Then the system rejects the update.

* And a validation message says the display name is required.

* And the previous display name is preserved.

### **Scenario 3: Display name exceeds maximum length**

* Given the logged-in user is editing their profile.

* When the user submits a display name that exceeds the character limit.

* Then the system rejects the update.

* And a message indicates the maximum character limit.

### **Scenario 4: Profile photo upload fails validation**

* Given the logged-in user attempts to upload a new profile photo.

* When the file is not an image or exceeds the size limit.

* Then the system rejects the photo.

* And an error message explains the constraint.

* And the existing profile photo remains unchanged.

### **Scenario 5: Unauthenticated user cannot edit a profile**

* Given a user is not logged in.

* When the user attempts to access the edit profile page.

* Then the system returns 401 Unauthorized.

* And no changes are saved.

### **Scenario 6: Member cannot edit another member's profile**

* Given the logged-in user is a member.

* When the user attempts to submit an edit for another member's profile (e.g., by manipulating the URL).

* Then the system returns 403 Forbidden.

* And the target member's profile remains unchanged.

### **Scenario 7: No changes submitted results in silent no-op save**

* Given the logged-in user opens the edit profile page.

* When the user submits the form with no changes made.

* Then the system saves silently without error.

* And the profile data remains the same.

## **User Story 7 — Delete Account**

*As a member, I want to delete my account so that I can leave the community and have my personal data removed.*

### **Scenario 1: Member with no active reservations requests account deletion**

* Given the logged-in user is a member.

* And the member has no REQUESTED, APPROVED, or PICKED\_UP reservations as borrower or owner.

* And the member's tool listings have no REQUESTED, APPROVED, or PICKED\_UP reservations on them.

* When the member requests account deletion.

* Then the account is soft-deleted: the status is set to DELETED, and all personally identifiable information EXCEPT the display name is removed or anonymized (including contact information, profile photo, bio, and neighborhood/location). The display name is preserved for the integrity of past reservation history and reviews.

* And all ACTIVE tool listings owned by the member are deactivated.

* And past RETURNED reservation history is preserved.

* And the member is logged out.

* And a confirmation email is sent to the registered email address.

### **Scenario 2: Member with active reservations cannot delete account**

* Given the logged-in user is a member.

* And the member has one or more REQUESTED, APPROVED, or PICKED\_UP reservations as borrower or owner.

* When the member attempts to request account deletion.

* Then the system rejects the request.

* And a message lists the active reservations that must be resolved first.

* And the member is directed to cancel or complete the reservations before trying again.

### **Scenario 3: Account deletion preserves reservation history integrity**

* Given a member with past RETURNED reservations requests account deletion.

* When the account is deleted.

* Then past reservations still show in the other party's history (with the deleted member's name and reviews preserved, but other PII removed — contact information, profile photo, bio, and neighborhood/location).

* And the deleted member's reviews and the ratings they received remain visible to maintain community trust.

### **Scenario 5: Suspended member can still request account deletion**

* Given the logged-in user is a member in SUSPENDED status.

* And the member has no REQUESTED, APPROVED, or PICKED_UP reservations as borrower or owner.

* When the member requests account deletion.

* Then the account is soft-deleted following the same rules as Scenario 1.

### **Scenario 4: Deleted account cannot log in; re-registration requires explicit confirmation**

* Given a user account has been deleted.

* When someone attempts to log in with the deleted account's credentials.

* Then the system rejects the login.

* And a generic error appears (account not found).

* When someone attempts to register a new account with the deleted account's email.

* Then the system requires the user to confirm by acknowledging the previous account is gone.

* And the user must obtain a new invite token from an admin to complete registration.

* And a new account can be created with that email after confirmation.

# **Section 2: Tool Listings**

## **User Story 8 — Create a Tool Listing**

*As a tool owner, I want to create a new tool listing with photos, category, and borrower notes so that borrowers can find and learn about my tool.*

### **Scenario 1: Successfully create a new tool listing**

* Given the logged-in user is a member.

* When the owner submits a new listing with name, description, condition, and category (e.g., "Power Tools", "Garden", "Kitchen", "Ladders", "Other"), uploads 1 to 5 photos (the first becomes the thumbnail), and optionally provides lending rules, notes for borrowers, and a latest\_return\_time (e.g., "21:30", meaning 9:30 PM).

* Then the listing is created with status ACTIVE.

* And the listing appears in member search results filtered by its category.

* And the listing is associated with the owner's account.

* And the photos are stored in order and displayed as a gallery (with the first photo as the thumbnail on browse pages).

* And the latest\_return\_time, notes for borrowers, and lending rules are stored and displayed on the listing details page.

### **Scenario 2: Required fields are missing**

* Given the logged-in user is a member on the create listing form.

* When the owner submits the form without a name, description, condition, or category.

* Then the system rejects the submission.

* And a validation message identifies each missing required field.

* And no listing is created.

### **Scenario 3: Photo upload validation rejects invalid files**

* Given the logged-in user is creating a listing.

* When the user attempts to upload a file that is not an image, a file larger than 5 MB, or more than 5 photos in total.

* Then the system rejects the invalid file or excess upload.

* And an error message is shown explaining the constraint (accepted formats, max size, max count).

* And any valid photos already selected are preserved.

### **Scenario 4: Create listing with zero photos is rejected**

* Given the logged-in user is creating a listing.

* When the owner submits the form without uploading any photos.

* Then the system rejects the submission.

* And a message says at least 1 photo is required.

### **Scenario 5: latest\_return\_time format is validated**

* Given the logged-in user is creating a listing.

* When the owner enters a latest\_return\_time in an invalid format (e.g., "9pm", "21:00", "abc").

* Then the system rejects the submission.

* And a message says the return time must be in HH:MM format (24-hour, HST).

### **Scenario 6: Unauthenticated user cannot create a listing**

* Given a user is not logged in.

* When the user attempts to access the create listing page or submit a listing.

* Then the system returns 401 Unauthorized.

* And no listing is created.

### **Scenario 7: Listing name must be unique per owner**

* Given the logged-in user already owns an ACTIVE listing named "Circular Saw".

* When the owner submits a new listing with the same name "Circular Saw".

* Then the system rejects the submission.

* And a message says the owner already has a listing with that name.

## **User Story — Member Views Their Own Tool Listings (New)**

*As a tool owner, I want to view all of my own tool listings on a management page so that I can see their current status and quickly manage them.*

### **Scenario 1: View all own tool listings**

* Given the logged-in user is a member who owns one or more tool listings.

* When the member opens the "My Tools" page.

* Then all of the member's own listings are displayed (both ACTIVE and DEACTIVATED).

* And each listing shows: thumbnail, name, condition, category, current status (ACTIVE/DEACTIVATED), and count of active reservations.

* And the owner can click any listing to navigate to edit, deactivate, or delete it (User Stories 9 and 10).

### **Scenario 2: Member with no listings sees an empty state**

* Given the logged-in user is a member who owns no tool listings.

* When the member opens the "My Tools" page.

* Then a message is displayed saying the member has not listed any tools yet.

* And a button or link is shown to create a new listing (User Story 8).

### **Scenario 3: Non-owner cannot access another member's tool management page**

* Given a member owns tool listings.

* And the logged-in user is not that member.

* When the user attempts to access the other member's "My Tools" page (e.g., by URL manipulation).

* Then the system returns 403 Forbidden.

### **Scenario 4: Unauthenticated user cannot access the tool management page**

* Given a user is not logged in.

* When the user attempts to access the "My Tools" page.

* Then the system returns 401 Unauthorized.


## **User Story 9 — Edit a Tool Listing and Manage Photos**

*As a tool owner, I want to edit my tool listing and manage its photos so that I can keep the listing information current and accurate.*

### **Scenario 1: Successfully edit a listing with no PICKED\_UP reservation

* Given the logged-in user is the owner of a listing.

* And the listing has no PICKED\_UP reservations (edits are blocked only when the tool is currently out on loan; REQUESTED and APPROVED reservations are allowed since they are not yet binding).

* When the owner updates the listing fields, including adding/removing photos, changing category, lending rules, notes, or latest\_return\_time.

* Then the changes are saved.

* And the photo gallery reflects the new photo order and set.

* And the updated category is reflected in browse and search filters.

* And the updated latest\_return\_time, notes for borrowers, and lending rules are visible on the listing details page.

### **Scenario 2: Cannot edit a listing while tool is PICKED\_UP

* Given the logged-in user is the owner of a listing.

* And the listing has an active PICKED\_UP reservation.

* When the owner attempts to save edits to the listing.

* Then the system rejects the action.

* And a message says the listing cannot be edited while it is out on loan.

* And the listing fields remain unchanged.

### **Scenario 3: Owner can add a photo (up to 5 total)

* Given the logged-in user is the owner of a listing.

* And the listing currently has fewer than 5 photos.

* When the owner uploads a valid image file.

* Then the photo is added to the gallery.

* And the gallery reflects the new photo count and order.

### **Scenario 4: Owner cannot add a photo when 5 already exist

* Given the logged-in user is the owner of a listing.

* And the listing already has exactly 5 photos.

* When the owner attempts to upload an additional photo.

* Then the system rejects the upload.

* And a message says a maximum of 5 photos is allowed.

### **Scenario 5: Owner can remove a photo when 2 or more exist

* Given the logged-in user is the owner of a listing.

* And the listing currently has 2 or more photos.

* When the owner edits the listing and removes a photo (but at least 1 remains).

* Then the removed photo is deleted from storage.

* And the photo gallery is updated.

* And the next photo in the list becomes the new thumbnail (if the first photo was removed).

### **Scenario 6: Owner cannot remove the last remaining photo

* Given the logged-in user is the owner of a listing.

* And the listing currently has exactly 1 photo.

* When the owner attempts to remove the only photo.

* Then the system rejects the action.

* And a message says at least 1 photo is required for the listing.

### **Scenario 7: Photo upload validation rejects invalid files on edit

* Given the logged-in user is editing a listing.

* When the owner attempts to upload a file that is not an image or is larger than 5 MB.

* Then the system rejects the invalid file.

* And an error message explains the constraint.

* And existing valid photos are not affected.

### **Scenario 8: Non-owner cannot edit a listing

* Given a listing exists.

* And the logged-in user is not the owner of the listing.

* When the user attempts to submit edits or photo changes to the listing.

* Then the system returns 403 Forbidden.

* And the listing is unchanged.

### **Scenario 9: Unauthenticated user cannot edit a listing

* Given a user is not logged in.

* When the user attempts to access the edit listing page or submit changes.

* Then the system returns 401 Unauthorized.

* And no changes are saved.

### **Scenario 10: Edit with invalid latest\_return\_time is rejected

* Given the logged-in user is the owner of a listing and is editing it.

* When the owner enters a latest\_return\_time in an invalid format (e.g., "9pm", "25:00").

* Then the system rejects the save.

* And a message says the return time must be in HH:MM format (24-hour, HST).

### **Scenario 11: Message threads remain accessible after listing is deactivated

* Given a tool listing has been deactivated.

* And the listing has past reservations with message threads.

* When the borrower, owner, or admin views the message thread of a past reservation.

* Then the thread is still readable.

* And the tool listing details are shown as "deactivated" with the deactivation date.

## **User Story 10 — Delete or Deactivate a Tool Listing**

*As a tool owner, I want to delete or deactivate my listing so that I can remove or hide tools I no longer want to share.*

### **Scenario 1: Delete a listing with no active reservations

* Given the logged-in user is the owner of a listing.

* And the listing has no REQUESTED, APPROVED, or PICKED\_UP reservations.

* When the owner deletes the listing.

* Then the listing is removed from search results.

* And the listing record is marked as deleted (soft delete) for audit purposes.

* And the listing's photos are deleted from storage.

* And past RETURNED reservation history is preserved.

### **Scenario 2: Cannot delete a listing with active reservations

* Given the logged-in user is the owner of a listing.

* And the listing has one or more REQUESTED, APPROVED, or PICKED\_UP reservations.

* When the owner attempts to delete the listing.

* Then the system rejects the action.

* And a message says the listing cannot be deleted while reservations are active.

* And the listing status remains unchanged.

### **Scenario 3: Owner self-deactivates a listing with no PICKED\_UP reservation

* Given an ACTIVE tool listing exists.

* And the logged-in user is the owner of the tool.

* And the tool has no active PICKED\_UP reservation.

* When the owner deactivates their listing with a reason.

* Then the listing is hidden from search results.

* And all REQUESTED and APPROVED reservations for the tool are auto-cancelled.

* And affected borrowers are notified of the auto-cancellation and the reason.

* And a deactivation log entry is created with the owner ID, timestamp, listing ID, and the reason provided.

### **Scenario 4: Owner cannot deactivate a listing while tool is PICKED\_UP

* Given an ACTIVE tool listing exists.

* And the tool has an active PICKED\_UP reservation.

* And the logged-in user is the owner.

* When the owner attempts to deactivate the listing.

* Then the system rejects the action.

* And a message says the listing cannot be deactivated while it is out on loan.

### **Scenario 5: Non-owner cannot delete or deactivate a listing

* Given a listing exists.

* And the logged-in user is not the owner of the listing.

* When the user attempts to delete or deactivate the listing.

* Then the system returns 403 Forbidden.

* And the listing status remains unchanged.

### **Scenario 6: Unauthenticated user cannot delete or deactivate a listing

* Given a user is not logged in.

* When the user attempts to delete or deactivate a listing.

* Then the system returns 401 Unauthorized.

* And the listing status remains unchanged.

### **Scenario 7: Soft-deleted listing cannot be reactivated by owner

* Given a listing has been soft-deleted (status: DELETED).

* And the logged-in user is the owner.

* When the owner attempts to reactivate the deleted listing.

* Then the system rejects the action.

* And a message says deleted listings cannot be reactivated (only deactivated listings can be reactivated by an admin).

## **User Story 11 — Deactivate and Reactivate Listings with Admin Controls**

*As an admin, I want to deactivate and reactivate listings so that problematic listings stay hidden without losing audit history.*

### **Scenario 1: Admin deactivates an active listing with no PICKED\_UP reservation**

* Given an active tool listing exists.

* And the tool has no active PICKED\_UP reservation.

* And the logged-in user is an admin.

* When the admin deactivates the listing (with a reason).

* Then the listing is no longer visible in member search results.

* And the listing retains its past reservation history in the database.

* And the listing is marked as deactivated with the admin's ID and timestamp.

### **Scenario 2: Admin cannot deactivate a tool that is currently PICKED\_UP**

* Given an active tool listing exists.

* And the tool has an active reservation in PICKED\_UP state.

* And the logged-in user is an admin.

* When the admin attempts to deactivate the listing.

* Then the system rejects the action.

* And a message tells them the tool cannot be deactivated while it is out on loan.

### **Scenario 3: Deactivating a tool with pending reservations auto-cancels them**

* Given an active tool listing exists.

* And the tool has one or more reservations in REQUESTED or APPROVED state.

* And the logged-in user is an admin.

* When the admin deactivates the listing.

* Then all REQUESTED and APPROVED reservations for the tool are auto-cancelled.

* And all affected borrowers are notified of the auto-cancellation and the reason.

* And the listing is marked as deactivated.

### **Scenario 4: Admin can reactivate a previously deactivated listing**

* Given a deactivated tool listing exists (temporarily hidden by an admin or owner — does NOT include soft-deleted listings, which cannot be reactivated).

* And the logged-in user is an admin.

* When the admin reactivates the listing.

* Then the listing becomes visible in member search results again.

* And the listing retains all past reservation history.

* And the listing owner receives a notification that the listing has been reactivated.

* And a reactivation record is added to the audit log.

### **Scenario 5: Deactivation is logged with admin ID, timestamp, and reason**

* Given an active tool listing exists.

* And the logged-in user is an admin.

* When the admin deactivates the listing with a reason.

* Then a deactivation log entry is created containing: admin ID, timestamp, listing ID, and the provided reason.

* And the audit log is searchable by admin for compliance reviews (filterable by admin, by date range in HST, and by listing).

# **Section 3: Browse & Search**

## **User Story 12 — Browse and Search for Available Tools**

*As a member, I want to browse and search for available tools by category and view owner profiles, so I can find tools I need and know who I am borrowing from.*

### **Scenario 1: Browse all active tools**

* Given there are multiple ACTIVE tool listings in the system.

* When a member views the browse page.

* Then all ACTIVE listings appear, excluding any listings owned by the current member.

* And each listing shows: thumbnail photo, name, owner name, condition, average rating, availability status, category, and latest\_return\_time (if set by the owner).

### **Scenario 2: Search tools by name or keyword**

* Given there are multiple ACTIVE tool listings.

* When a member enters a search term.

* Then only listings whose name or description contains the search term appear.

* And the results are sorted by relevance.

### **Scenario 3: Filter tools by category**

* Given there are ACTIVE tool listings across multiple categories (e.g., "Power Tools", "Garden", "Kitchen", "Ladders", "Other").

* When a member selects one or more category filters.

* Then only listings matching the selected categories appear.

* And the category filter is shown as an active filter chip on the page.

### **Scenario 4: Filter tools by date range availability**

* Given a member specifies a desired start\_date and end\_date (in HST).

* When the member applies the date range filter.

* Then only listings with no overlapping REQUESTED, APPROVED, or PICKED\_UP reservations for the specified dates appear.

* And listings that are unavailable for the entire date range are excluded.

* And the filter input is interpreted in HST regardless of the user's local timezone.

### **Scenario 5: View detailed information for a specific tool**

* Given an ACTIVE tool listing exists with a latest\_return\_time configured, 1-5 photos, lending rules, and notes for borrowers.

* When a member clicks on a listing.

* Then the listing's full details are displayed, including: photo gallery, name, description, condition, category, lending rules, owner profile link, average rating, upcoming availability calendar, latest\_return\_time, and notes for borrowers.

# **Section 4: Reservations**

## **User Story 13 — Submit a Reservation Request**

*As a borrower, I want to submit a reservation request for a tool so that I can borrow it for a specific date range.*

### **Scenario 1: Borrower submits a valid reservation request

* Given the logged-in user is a member.

* And the tool is ACTIVE with no overlapping REQUESTED, APPROVED, or PICKED\_UP reservations for the requested dates.

* And the borrower is not the owner of the tool.

* And start\_date \>= today and end\_date \>= start\_date.

* When the borrower submits a reservation request with start\_date and end\_date.

* Then the reservation is created with status REQUESTED.

* And the owner receives an in-app notification of the new request.

### **Scenario 2: Owner cannot reserve their own tool

* Given a logged-in user owns an active tool listing.

* When the user attempts to submit a reservation request for that same tool.

* Then the system rejects the submission.

* And a message says owners cannot reserve their own tools.

### **Scenario 3: Reservation request rejected when dates overlap an existing active reservation

* Given a tool has an existing REQUESTED, APPROVED, or PICKED\_UP reservation for a date range.

* When a borrower submits a request with overlapping dates.

* Then the system rejects the submission with 409 Conflict.

* And a message says the tool is not available for those dates.

### **Scenario 4: Concurrent overlapping submissions — first commit wins

* Given a tool is available with no active reservations.

* When two borrowers submit overlapping requests at the same time.

* Then the first request to commit succeeds and is saved as REQUESTED.

* And the second request fails with 409 Conflict.

* And the second borrower is shown a message that the tool is no longer available for those dates.

* And the database exclusion constraint enforces this with no application-level locking needed.

### **Scenario 5: 1-day rental (start\_date \= end\_date) is allowed

* Given a borrower submits a request with start\_date \= end\_date \= July 15\.

* When the request is submitted.

* Then the system accepts the request.

* And the reservation covers July 15 only (1-day rental).

## **User Story 14 — Approve or Deny Reservation Requests**

*As an owner, I want to approve or deny incoming reservation requests so that I can control who borrows my tools and when.*

*(Note: This story covers owner actions on REQUESTED reservations. For cancelling already APPROVED reservations, see User Story 16.)*

### **Scenario 1: Owner approves a REQUESTED reservation**

* Given a reservation is in REQUESTED state.

* And the logged-in user is the owner of the tool.

* When the owner approves the request.

* Then the reservation status becomes APPROVED.

* And the borrower receives an in-app notification of the approval.

### **Scenario 2: Owner denies a REQUESTED reservation**

* Given a reservation is in REQUESTED state.

* And the logged-in user is the owner of the tool.

* When the owner denies the request with an optional reason.

* Then the reservation status becomes DENIED.

* And the borrower gets notified with the reason (if any).

### **Scenario 3: Owner cannot approve a REQUESTED reservation that overlaps an existing active reservation**

* Given a tool has an APPROVED or PICKED\_UP reservation for July 1 to July 5\.

* And a REQUESTED reservation exists for July 1 to July 5\.

* When the owner attempts to approve the REQUESTED reservation.

* Then the system rejects the approval.

* And a message says the request conflicts with an existing ACTIVE reservation.

### **Scenario 4: Two non-overlapping REQUESTED reservations can be approved independently**

* Given a tool has two REQUESTED reservations with non-overlapping dates (e.g., July 1–5 and July 10–15).

* When the owner approves the first REQUESTED.

* Then the first becomes APPROVED and the second remains REQUESTED.

* When the owner approves the second REQUESTED.

* Then both APPROVED reservations coexist without conflict.

### **Scenario 5: Denying a REQUESTED reservation frees the date range**

* Given a tool has a REQUESTED reservation for July 1 to July 5.

* When the owner denies the reservation.

* Then the reservation status becomes DENIED.

* And the date range is freed up.

* When a new borrower submits a request for July 1 to July 5.

* Then the new request is accepted and saved as REQUESTED.

## **User Story 15 — Cancel a Reservation as Borrower**

*As a borrower, I want to cancel a reservation before pickup so that I am not committed to a loan I no longer need.*

### **Scenario 1: Borrower cancels REQUESTED reservation**

* Given a reservation is in REQUESTED state.

* And the logged-in user is the borrower.

* When the borrower cancels the reservation.

* Then the reservation status becomes CANCELLED.

* And the owner receives an in-app notification that the reservation was cancelled by the borrower.

### **Scenario 2: Borrower cancels APPROVED reservation**

* Given a reservation is in APPROVED state.

* And the logged-in user is the borrower.

* When the borrower cancels the reservation.

* Then the reservation status becomes CANCELLED.

* And the owner receives an in-app notification that the reservation was cancelled by the borrower.

### **Scenario 3: Cancelling a reservation frees the date range for new requests**

* Given a tool has a REQUESTED reservation for July 1 to July 5\.

* When the borrower cancels the reservation.

* Then the reservation status becomes CANCELLED.

* And the date range is freed up.

* When a new borrower submits a request for July 1 to July 5\.

* Then the new request is accepted and saved as REQUESTED.

### **Scenario 4: Cannot cancel a PICKED\_UP reservation**

* Given a reservation is in PICKED\_UP state.

* And the logged-in user is the borrower.

* When the borrower attempts to cancel the reservation.

* Then the system rejects the action.

* And the reservation status remains PICKED\_UP.

### **Scenario 5: Cannot cancel a DENIED reservation**

* Given a reservation is in DENIED state.

* And the logged-in user is the borrower.

* When the borrower attempts to cancel the reservation.

* Then the system rejects the action.

* And the reservation status remains DENIED.

### **Scenario 6: Cannot cancel a RETURNED reservation**

* Given a reservation is in RETURNED state.

* And the logged-in user is the borrower.

* When the borrower attempts to cancel the reservation.

* Then the system rejects the action.

* And the reservation status remains RETURNED.

### **Scenario 7: Cannot double-cancel an already CANCELLED reservation**

* Given a reservation is in CANCELLED state.

* And the logged-in user is the borrower.

* When the borrower attempts to cancel the reservation again.

* Then the system rejects the action.

* And the reservation status remains CANCELLED.

### **Scenario 8: Non-party cannot cancel someone else's reservation**

* Given a reservation is in REQUESTED or APPROVED state.

* And the logged-in user is not the borrower and not the owner.

* When the user attempts to cancel the reservation.

* Then the system returns 403 Forbidden.

* And the reservation status remains unchanged.

## **User Story 16 — Cancel a Reservation as Owner**

*As an owner, I want to cancel a reservation so that I can manage my tool availability when circumstances change.*

*(Note: This story covers owner cancellation of already APPROVED reservations. For approving or denying REQUESTED reservations, see User Story 14.)*

### **Scenario 1: Owner can cancel an APPROVED reservation when tool becomes unavailable**

* Given a reservation is in APPROVED state.

* And the logged-in user is the owner.

* And the tool has become unavailable (e.g., broken, lost).

* When the owner cancels the reservation.

* Then the reservation status becomes CANCELLED.

* And the borrower gets notified with the reason.

### **Scenario 2: Cannot deny an APPROVED reservation**

* Given a reservation is in APPROVED state.

* And the logged-in user is the owner.

* When the owner attempts to deny the reservation.

* Then the system rejects the action.

* And a message says approved reservations must be cancelled, not denied.

### **Scenario 3: Cannot deny an already DENIED reservation**

* Given a reservation is in DENIED state.

* And the logged-in user is the owner.

* When the owner attempts to deny the reservation again.

* Then the system rejects the action.

* And the reservation status remains DENIED.

### **Scenario 4: Owner cannot cancel a PICKED_UP reservation**

* Given a reservation is in PICKED_UP state.

* And the logged-in user is the owner.

* When the owner attempts to cancel the reservation.

* Then the system rejects the action.

* And a message says PICKED_UP reservations cannot be cancelled.

* And the owner is directed to contact the admin if there is a dispute.

### **Scenario 5: Owner cannot deny a PICKED_UP, RETURNED, or CANCELLED reservation**

* Given a reservation is in PICKED_UP, RETURNED, or CANCELLED state.

* And the logged-in user is the owner.

* When the owner attempts to deny the reservation.

* Then the system rejects the action.

* And the reservation status remains unchanged.

## **User Story 17 — Confirm Tool Pickup**

*As a borrower, I want to confirm I have picked up the tool so that the system knows the loan has started.*

### **Scenario 1: Borrower marks reservation as picked up on or after start\_date**

* Given a reservation is in APPROVED state.

* And today is on or after the start\_date (in HST).

* And the logged-in user is the borrower.

* When the borrower marks the reservation as picked up.

* Then the reservation status becomes PICKED\_UP.

* And a real-time pickup timestamp is recorded in HST.

* And the pickup timestamp is visible on the reservation details page to the borrower, owner, and admin.

* And the borrower confirms pickup unilaterally (owner acknowledgment is not required); the owner receives a notification that pickup was confirmed.

### **Scenario 2: Cannot mark as picked up before start\_date**

* Given a reservation is in APPROVED state.

* And today is before the start\_date (in HST).

* And the logged-in user is the borrower.

* When the borrower attempts to mark the reservation as picked up.

* Then the system rejects the action.

* And a message tells the borrower that pickup is only allowed on or after the start\_date (in HST).

* And the reservation status remains APPROVED.

### **Scenario 3: Mark-as-picked-up UI action is hidden when status is REQUESTED**

* Given a reservation is in REQUESTED state.

* And the logged-in user is the borrower.

* When the borrower views the reservation details page.

* Then the "mark as picked up" control is not displayed.

* And the borrower cannot trigger the pick-up action from the UI.

### **Scenario 4: Backend rejects invalid status transition to PICKED\_UP**

* Given a reservation is in REQUESTED, CANCELLED, DENIED, or RETURNED state.

* And the logged-in user is the borrower.

* When the borrower attempts to mark the reservation as picked up (e.g., via direct API call).

* Then the system rejects the action.

* And a message says the reservation must be in APPROVED state to be marked as picked up.

* And the reservation status remains unchanged.

### **Scenario 5: Non-borrower cannot mark a reservation as picked up**

* Given a reservation is in APPROVED state.

* And the logged-in user is the owner (not the borrower).

* When the owner attempts to mark the reservation as picked up.

* Then the system returns 403 Forbidden.

* And the reservation status remains APPROVED.

### **Scenario 6: Unauthenticated user cannot mark a reservation as picked up**

* Given a reservation is in APPROVED state.

* And the user is not logged in.

* When the user attempts to mark the reservation as picked up.

* Then the system returns 401 Unauthorized.

* And the reservation status remains APPROVED.

### **Scenario 7: Cannot double-confirm pickup on an already PICKED\_UP reservation**

* Given a reservation is already in PICKED\_UP state.

* And the logged-in user is the borrower.

* When the borrower attempts to mark the reservation as picked up again.

* Then the system rejects the action.

* And the reservation status remains PICKED\_UP.

* And the original pickup timestamp is preserved.

## **User Story 18 — Auto-Cancel Overdue Pickup**

*As the system, I want to automatically cancel reservations that are never picked up after a grace period, so that tool availability is not indefinitely blocked.*

### **Scenario 1: Reservation is auto-cancelled after 3-day grace period with no pickup**

* Given a reservation is in APPROVED state.

* And the start\_date has passed by more than 3 calendar days (in HST) without being marked PICKED\_UP.

* When the system grace period timer expires (HST midnight on the 4th day after start\_date).

* Then the reservation status becomes CANCELLED.

* And both the borrower and owner receive an in-app notification of the auto-cancellation.

* And the date range is freed up for new reservation requests.

### **Scenario 2: Reservation is NOT auto-cancelled within the 3-day grace period**

* Given a reservation is in APPROVED state.

* And the start\_date has passed but fewer than 4 days have elapsed (in HST).

* When the system timer runs.

* Then the reservation is not auto-cancelled.

* And the reservation status remains APPROVED.

### **Scenario 3: Pickup within the grace period prevents auto-cancellation**

* Given a reservation is in APPROVED state.

* And the start\_date has passed but the grace period has not yet expired.

* When the borrower marks the reservation as picked up before the grace period ends.

* Then the reservation status becomes PICKED\_UP.

* And the auto-cancel timer is deactivated for this reservation.

### **Scenario 4: Auto-cancelled reservation frees the date range**

* Given a reservation has been auto-cancelled after the grace period expired.

* When a new borrower submits a reservation request for the same tool and date range.

* Then the system accepts the new request.

* And the new reservation is saved as REQUESTED.

### **Scenario 5: Grace period timer is evaluated in HST**

* Given a reservation's start\_date is July 1\.

* And the logged-in borrower is in a non-HST timezone.

* When the system evaluates whether the grace period has expired.

* Then all date comparisons are performed in HST (UTC-10), regardless of the borrower's local timezone.

* And the auto-cancel fires at HST midnight on July 5 (the 4th day after July 1\) if no pickup has occurred.

## **User Story 19 — Timezone and Date Normalization for Reservations**

*As the system, I want all reservation dates and times stored in UTC and displayed in Hawaii Standard Time (HST, UTC-10) so that all members see consistent reservation windows.*

The application converts user-entered dates/times from HST to UTC for storage, and converts UTC back to HST for display. No per-user timezone detection is required.

### **Scenario 1: All submitted dates are normalized to HST on the server**

* Given a borrower submits a reservation request with date values.

* When the server processes the request.

* Then all dates are converted from HST to UTC for storage.

* And all dates are converted back from UTC to HST for display.

* And no false conflicts or gaps appear due to timezone differences.

### **Scenario 2: Reservation window spans the full day in HST**

* Given a reservation has start\_date = July 15 and end\_date = July 17.

* When the system processes the reservation.

* Then the reservation window is interpreted as July 15 00:00:00 HST through July 17 23:59:59 HST (stored as UTC).

* And pickup can be confirmed at any time on or after July 15 00:00 HST.

* And the actual pickup timestamp is recorded separately as a real-time event in HST.

### **Scenario 3: Overlap detection uses day-granular HST boundaries**

* Given an existing reservation covers July 10 to July 14 (HST).

* When a new request is submitted for July 14 to July 16.

* Then the system detects an overlap on July 14.

* And the new request is rejected with 409 Conflict.

### **Scenario 4: Non-overlapping date ranges on the same tool are accepted**

* Given an existing reservation covers July 1 to July 5 (HST).

* When a new request is submitted for July 6 to July 10.

* Then the system detects no overlap.

* And the new reservation is accepted and saved as REQUESTED.

### **Scenario 5: 1-day rental (start\_date equals end\_date) is handled correctly**

* Given a borrower submits a request with start\_date = end\_date = July 15.

* When the server processes the request.

* Then the window is interpreted as July 15 00:00:00 HST through July 15 23:59:59 HST.

* And the reservation covers exactly 1 day.

* And the system accepts the request if no overlapping reservation exists for July 15.

### **Scenario 6: Date input from the UI is assumed to be HST regardless of browser locale**

* Given a member's browser is set to a non-HST locale (e.g., EST or UTC).

* When the member enters a date range in the reservation form.

* Then the server treats the submitted dates as HST calendar dates.

* And no timezone conversion is applied to the date portion of the input.

* And the UI displays a note that all dates are in Hawaii Standard Time (HST).


## **User Story 20 — Confirm Tool Return**

*As a borrower, I want to confirm I have returned the tool so that the system knows the loan has ended and both parties can leave reviews.*

### **Scenario 1: Borrower marks reservation as returned on time**

* Given a reservation is in PICKED\_UP state.

* And the logged-in user is the borrower.

* And the current time is at or before the latest\_return\_time on the end\_date (in HST).

* When the borrower marks the reservation as returned.

* Then the reservation status becomes RETURNED.

* And the return is recorded as on-time.

* And a real-time return timestamp is recorded in HST.

* And both borrower and owner are prompted to leave a review.

### **Scenario 2: Borrower marks reservation as returned after the latest\_return\_time**

* Given a reservation is in PICKED\_UP state.

* And the current time is after the latest\_return\_time on the end\_date (in HST).

* When the borrower attempts to mark the reservation as returned.

* Then the system asks the borrower to confirm.

* And a warning appears: "You are returning the tool after the owner's latest return time. The owner will be notified."

* When the borrower confirms the late return.

* Then the reservation status becomes RETURNED.

* And the reservation record is flagged as a late return.

* And the owner gets notified of the late return.

### **Scenario 3: Borrower marks reservation as returned after the end\_date**

* Given a reservation is in PICKED\_UP state.

* And today is after the end\_date (in HST).

* And the logged-in user is the borrower.

* When the borrower marks the reservation as returned.

* Then the reservation status becomes RETURNED.

* And the reservation record is flagged as a late return.

* And the owner gets notified of the late return.

### **Scenario 4: Non-borrower cannot mark as returned**

* Given a reservation is in PICKED\_UP state.

* And the logged-in user is the owner (not the borrower).

* When the owner attempts to mark the reservation as returned.

* Then the system rejects the action.

* And the reservation status remains PICKED\_UP.

### **Scenario 5: Cannot mark as returned unless reservation is in PICKED\_UP state**

* Given a reservation is in REQUESTED, APPROVED, CANCELLED, DENIED, or RETURNED state.

* And the logged-in user is the borrower.

* When the borrower attempts to mark the reservation as returned.

* Then the system rejects the action.

* And a message says only PICKED\_UP reservations can be marked as returned.

### **Scenario 6: Owner files damage report after tool returned damaged**

* Given a reservation has been marked RETURNED.

* And the owner has inspected the tool and found it damaged.

* And the owner files the damage report within 7 calendar days of the RETURNED status (in HST).

* When the owner files a damage report associated with the reservation.

* Then a damage report is saved and associated with the reservation.

* And the tool listing is automatically deactivated, and any remaining REQUESTED or APPROVED reservations for the tool are auto-cancelled with affected borrowers notified.

* And the damage report is recorded as a 1-star equivalent trust signal that reduces the borrower's average rating.

* And the borrower's account is flagged for admin review.

* And the owner's average rating is unaffected.

* And both parties get notified of the damage report.

### **Scenario 7: Tool never returned — escalation to admin after 7 days**

* Given a reservation is in PICKED\_UP state.

* And the end\_date has passed by more than 7 calendar days (in HST).

* And the reservation has not been marked as RETURNED.

* When the escalation timer expires.

* Then the admin gets notified.

* And a flag is set on the borrower's profile (admin-visible; borrower is NOT automatically blocked but admin may manually block).

* And the reservation status remains PICKED\_UP until resolved.

### **Scenario 8: Admin can force-mark RETURNED in dispute**

* Given a reservation is in PICKED\_UP state.

* And there is a confirmed dispute and the admin has reviewed evidence from both parties.

* And the logged-in user is an admin.

* When the admin force-marks the reservation as RETURNED.

* Then the reservation status becomes RETURNED.

* And a force-resolution note is recorded with the admin's ID, timestamp, and reason.

* And if the force-mark occurs after the latest\_return\_time or after the end\_date, the reservation is flagged as a late return.

* And both parties are notified of the admin decision.


### **Scenario 9: Duplicate report on same reservation is rejected**

* Given the logged-in user has already submitted an unresolved report for a specific reservation.

* When the user attempts to submit another report for the same reservation.

* Then the system rejects the submission.

* And a message says a report has already been filed for this reservation.

## **User Story 21 — View Reservation History**

*As a member, I want to view my reservation history so that I can track my past and current loans as both a borrower and an owner.*

### **Scenario 1: Member views their reservations as borrower**

* Given the logged-in user is a member.

* When the member opens their reservations page.

* Then all reservations where they are the borrower are displayed.

* And each reservation shows: tool name, owner name, dates, and current status.

### **Scenario 2: Member views their reservations as owner**

* Given the logged-in user is a member who owns tool listings.

* When the member opens their tool management page.

* Then all reservations on their listings are displayed.

* And each reservation shows: borrower name, dates, and current status.

### **Scenario 3: Past RETURNED reservations remain visible after completion**

* Given a reservation has reached RETURNED status.

* When either the borrower or owner views their reservation history.

* Then the past reservation is visible with its final status and timestamps.

# **Section 5: Messaging**

## **User Story 22 — Send and Receive Messages in a Reservation Thread**

*As a borrower or owner, I want to send and receive messages in a private thread tied to a specific reservation, so we can coordinate pickup, return, and work out any issues.*

### **Scenario 1: Send a message in an active reservation thread**

* Given a reservation is in REQUESTED, APPROVED, or PICKED\_UP state.

* And the logged-in user is the borrower or owner for the reservation.

* When the user submits a message in the thread.

* Then the message is saved and displayed in the thread.

* And the other party is notified of the new message.

### **Scenario 2: Cannot send messages in a closed reservation thread**

* Given a reservation is in RETURNED or CANCELLED state. (DENIED reservations never open a thread.)

* And the logged-in user is the borrower or owner.

* When the user attempts to send a message.

* Then the system rejects the action.

* And a message says the thread is read-only.

### **Scenario 3: Both parties can view the full message history**

* Given a reservation has an existing message thread.

* When either the borrower or owner views the thread.

* Then all messages are displayed in chronological order.

* And each message shows the sender, timestamp, and content.

### **Scenario 4: Non-party cannot send a message in someone else's reservation thread**

* Given a reservation has an existing message thread.

* And the logged-in user is a third-party member.

* When the user attempts to send a message.

* Then the system returns 403 Forbidden.

* And the message is not saved.

# **Section 6: Notifications**

## **User Story 23 — Receive Notifications About Reservations**

*As a member, I want to receive notifications about my reservations, so I do not miss important updates.*

### **Scenario 1: Owner receives notification of new reservation request**

* Given a borrower submits a new reservation request.

* When the request is created.

* Then the owner of the tool receives an in-app notification including the borrower's name, the tool name, and the requested date range.

### **Scenario 2: Borrower receives notification of approval or denial**

* Given the owner approves or denies a reservation request.

* When the status changes.

* Then the borrower receives an in-app notification including the tool name, the new status, and the owner's name.

### **Scenario 3: Both parties receive notification of pickup and return status changes**

* Given a reservation status changes to PICKED\_UP or RETURNED.

* When the status change occurs.

* Then both the borrower and owner receive in-app notifications including the tool name, the new status, and the date of the change.

### **Scenario 4: Unread notifications are displayed in the user's notification center**

* Given a user has unread in-app notifications.

* When the user views their dashboard.

* Then a notification badge shows the count of unread notifications.

* And clicking the badge opens the full notification list.

# **Section 7: Reviews & Ratings**

## **User Story 24 — Leave a Rating and Review After a Tool is Returned**

*As a user (borrower or owner), I want to leave a rating and review after a tool is returned, so the community can build trust from past lending history.*

### **Scenario 1: Submit a valid review**

* Given a reservation is in RETURNED state.

* And the logged-in user was either the borrower or owner for this reservation.

* When the user submits a 1–5 star rating and optional text review.

* Then the review is saved and associated with the other party's profile.

* And the other party's profile shows the review with the rating, comment, and reviewer's display name.

### **Scenario 2: Cannot review a non-completed reservation**

* Given a reservation is in REQUESTED, APPROVED, PICKED\_UP, CANCELLED, or DENIED state.

* When the user attempts to submit a review.

* Then the system rejects the action.

### **Scenario 3: Each user can only submit one review per reservation**

* Given a reservation is in RETURNED state.

* And the logged-in user has already submitted a review.

* When the user attempts to submit another review.

* Then the system rejects the action and the existing review is preserved.

### **Scenario 4: Review must be submitted within 30 days of RETURNED status**

* Given a reservation is in RETURNED state.

* And more than 30 days have passed since the RETURNED status (in HST).

* When the user attempts to submit a review.

* Then the system rejects the action.

* And a message says the review window has closed.

### **Scenario 5: User cannot review themselves**

* Given a reservation is in RETURNED state.

* And the borrower and owner are the same user.

* When the user attempts to submit a review.

* Then the system rejects the action and a message says self-reviews are not allowed.

### **Scenario 6: Rating must be an integer between 1 and 5**

* Given a reservation is in RETURNED state.

* When the user submits a rating of 0, 6, or a non-integer value.

* Then the system rejects the action and a validation error appears.

### **Scenario 7: Comment is optional but rating is required**

* Given a reservation is in RETURNED state.

* When the user submits a rating without a comment.

* Then the review is saved successfully with the rating only.

### **Scenario 8: User can edit or delete their review within 24 hours**

* Given a reservation is in RETURNED state.

* And the user submitted a review less than 24 hours ago (in HST).

* When the user edits the rating or comment.

* Then the review is updated and an edit timestamp (in HST) is recorded.

* When the user deletes the review.

* Then the review is permanently removed and no longer shows on the other party's profile.

### **Scenario 9: Review window reminder sent 3 days after RETURNED status**

* Given a reservation has reached RETURNED status.

* And neither the borrower nor the owner has submitted a review.

* When 3 days have passed since the RETURNED status (in HST).

* Then both the borrower and owner receive an in-app reminder to leave a review.

* And the reminder includes a link to the review form for that reservation.

## **User Story 25 — View a Member's Review History**

*As a member, I want to view another member's review history so that I can assess their trustworthiness before lending or borrowing.*

### **Scenario 1: View another member's public profile

* Given a member is logged in.

* When the member clicks on an owner's name or profile link.

* Then the owner's public profile page appears showing: display name, optional profile photo, optional bio, optional neighborhood/location, member-since date, average rating, total completed loans as owner, and a list of the owner's ACTIVE tool listings.

* And the profile does not show private information (email, password, etc.).


### **Scenario 2: View all reviews on another member's public profile

* Given the logged-in user is a member.

* When the member views another member's public profile.

* Then all reviews written about that member are displayed.

* And each review shows: star rating, optional comment, reviewer's display name, and reservation date.

* And the member's average rating is prominently displayed.

### **Scenario 3: Damage reports appear on borrower's profile as trust signals

* Given a borrower has had a damage report filed against them.

* When a member views that borrower's public profile.

* Then the damage report is visible as a trust signal.

* And the damage report is treated as a 1-star equivalent in the borrower's average rating calculation.

* And the borrower cannot dispute the rating impact.

### **Scenario 4: Deleted member's reviews are preserved for community trust

* Given a member's account has been deleted.

* When another member views a past reservation involving the deleted member.

* Then reviews written by and about the deleted member remain visible.

* And the deleted member's display name is preserved but all other PII is removed.

# **Section 8: Reporting & Moderation**

## **User Story 26 — Member Reports an Inappropriate Tool Listing**

*As a member, I want to report a tool listing that seems inappropriate, unsafe, or against community rules, so that admins can review the listing and keep the tool-sharing community safe.*

### **Scenario 1: Member submits a report for a listing**

* Given a logged-in member is viewing an active tool listing.

* When the member clicks "Report Listing," selects a report reason, optionally enters a comment, and submits the report.

* Then the system saves the report linked to the listing, reporting member, and listing owner.

* And the report status is set to PENDING\_REVIEW.

* And an admin receives a notification that a new report needs review.

### **Scenario 2: Member cannot report the same listing multiple times while a report is pending**

* Given a member has already submitted a pending report for the same listing.

* When the member attempts to report the same listing again.

* Then the system blocks the duplicate report.

* And a message tells the member that the listing has already been reported and is waiting for an admin review.

### **Scenario 3: Unauthenticated user cannot report a listing**

* Given a user is not logged in.

* When the user attempts to report a listing.

* Then the system returns 401 Unauthorized and the report is not saved.

### **Scenario 4: Report reason is required**

* Given a logged-in member opens the report form.

* When the member submits the form without selecting a reason.

* Then the system rejects the submission and a validation message says a report reason is required.


### **Scenario 5: Report on non-existent or deactivated listing is rejected**

* Given the logged-in user is a member.

* When the user attempts to report a listing that does not exist, is already DEACTIVATED, or belongs to a deleted account.

* Then the system rejects the report.

* And a message says the listing is not available for reporting.

## **User Story 27 — Admin Reviews Reported Listings**

*As an admin, I want to review reported tool listings, so that I can decide whether the listing should remain active, be hidden, or be marked as inappropriate.*

### **Scenario 1: Admin views pending reported listings**

* Given the logged-in user is an admin.

* When the admin opens the reported listings page.

* Then the system displays all reports with PENDING\_REVIEW status.

* And each report shows the listing title, owner name, report reason, reporter name, report date, and optional comment.

### **Scenario 2: Admin marks a report as valid and hides the listing**

* Given a listing report is in PENDING\_REVIEW status and the logged-in user is an admin.

* When the admin marks the report as valid.

* Then the listing is hidden from member search results.

* And the listing status becomes DEACTIVATED.

* And all REQUESTED and APPROVED reservations for the listing are auto-cancelled, and affected borrowers are notified of the auto-cancellation and the reason.

* And the report status becomes RESOLVED\_VALID.

* And the listing owner receives a notification explaining the action.

### **Scenario 3: Admin marks a report as invalid and keeps the listing active**

* Given a listing report is in PENDING\_REVIEW status and the logged-in user is an admin.

* When the admin marks the report as invalid.

* Then the listing remains active.

* And the report status becomes RESOLVED\_INVALID.

* And the report decision is saved for audit history.

### **Scenario 4: Non-admin cannot access reported listing review page**

* Given the logged-in user is not an admin.

* When the user attempts to access the reported listings page.

* Then the system returns 403 Forbidden and no report details are shown.

## **User Story 28 — Admin Manages Tool Categories**

*As an admin, I want to manage the list of allowed tool categories so that members can only list approved types of tools.*

The system maintains a single list of allowed categories (e.g., "Power Tools", "Garden", "Kitchen", "Ladders", "Other"). When creating a listing, the member selects from this dropdown. If a category is not in the list, it cannot be added — implicitly denying unlisted tool types. Admins can add or remove categories from this list.

### **Scenario 1: Admin adds a new category**

* Given the logged-in user is an admin.

* When the admin opens the category management page and enters a new category name.

* Then the category is added to the allowed categories list.

* And the new category appears in the listing creation dropdown for all members.

* And the system records the admin ID and timestamp.

### **Scenario 2: Admin removes an existing category**

* Given the logged-in user is an admin.

* And a category exists in the allowed categories list.

* And no ACTIVE tool listings currently use that category.

* When the admin removes the category.

* Then the category is removed from the allowed categories list.

* And the category no longer appears in the listing creation dropdown.

* And existing deactivated listings that used the category retain it for history.

### **Scenario 3: Admin cannot remove a category in use by active listings**

* Given the logged-in user is an admin.

* And a category exists with one or more ACTIVE tool listings.

* When the admin attempts to remove the category.

* Then the system rejects the action.

* And a message lists the ACTIVE listings using that category.

### **Scenario 4: Non-admin cannot manage categories**

* Given the logged-in user is not an admin.

* When the user attempts to access the category management page.

* Then the system returns 403 Forbidden and no changes are saved.


## **User Story 29 — Admin Tracks Member Listing Violations**

*As an admin, I want to track how many confirmed inappropriate listings each member has created, so that I can identify repeated violations and take appropriate moderation action.*

### **Scenario 1: Admin views a member's violation count**

* Given the logged-in user is an admin.

* When the admin opens a member's moderation profile.

* Then the system displays the member's confirmed inappropriate listing count and the dates, listing titles, and admin decisions for each violation.

### **Scenario 2: Violation count increases after admin confirms a listing violation**

* Given a reported listing is reviewed by an admin.

* When the admin marks the report as valid.

* Then the listing owner's violation count increases by one and the violation record is saved under that member's moderation history.

### **Scenario 3: Invalid report does not increase violation count**

* Given a reported listing is reviewed by an admin.

* When the admin marks the report as invalid.

* Then the listing owner's violation count does not change.

* And the invalid report decision is still saved in the report history.

### **Scenario 4: Member with no violations shows zero**

* Given a member has no confirmed inappropriate listings.

* When the admin views the member's moderation profile.

* Then the system displays a violation count of zero and indicates that no confirmed violations are recorded.

## **User Story 30 — Admin Suspends a Member Account**

*As an admin, I want to suspend a member who repeatedly violates community rules, so that unsafe or inappropriate behavior can be limited.*

### **Scenario 1: Admin suspends a member**

* Given the logged-in user is an admin and a member has repeated confirmed violations or serious misconduct.

* When the admin opens the member's moderation profile, clicks Suspend, enters a reason, and confirms.

* Then the member account status changes to SUSPENDED.

* And the suspension reason, admin ID, and timestamp are saved.

* And the suspended member receives a notification.

### **Scenario 2: Suspended member cannot use restricted features**

* Given a member account status is SUSPENDED.

* When the suspended member attempts to create a listing, request a tool, approve or deny a reservation, confirm pickup or return, send a message, or edit their profile.

* Then the system blocks the action and a message explains that the account is suspended.

* And the suspended member can still log in, view the suspension notice, browse listings (read-only), and view their own reservation history.

### **Scenario 3: Suspended member can still log in and view suspension notice**

* Given a member account status is SUSPENDED.

* When the member logs in.

* Then the system allows login only to show the suspension notice, account status, and any allowed appeal/contact information.

* And restricted community actions remain disabled.

### **Scenario 4: Non-admin cannot suspend a member**

* Given the logged-in user is not an admin.

* When the user attempts to suspend another member.

* Then the system returns 403 Forbidden and the target member's account status remains unchanged.


### **Scenario 5: Cannot suspend an already-suspended member**

* Given the logged-in user is an admin.

* And a member account is already in SUSPENDED status.

* When the admin attempts to suspend the member again.

* Then the system rejects the action.

* And a message says the member is already suspended.

## **User Story 31 — Admin Reactivates a Suspended Member Account**

*As an admin, I want to reactivate a suspended member account after review, so that members can regain access when the issue has been resolved.*

### **Scenario 1: Admin reactivates a suspended member**

* Given the logged-in user is an admin and a member account is in SUSPENDED status.

* When the admin clicks Reactivate, enters a reactivation reason, and confirms.

* Then the member account status changes to ACTIVE.

* And the reactivation reason, admin ID, and timestamp are saved.

* And the member receives a notification that the account has been reactivated.

### **Scenario 2: Admin cannot reactivate an account that is not suspended**

* Given a member account is already ACTIVE or DELETED.

* When the admin attempts to reactivate the account.

* Then the system rejects the action and a message explains that only suspended accounts can be reactivated.

### **Scenario 3: Reactivated member regains normal access**

* Given a suspended member account has been reactivated.

* When the member logs in.

* Then the member can create listings, request tools, send messages, and use normal member features again.

### **Scenario 4: Non-admin cannot reactivate a member**

* Given the logged-in user is not an admin.

* When the user attempts to reactivate a suspended member account.

* Then the system returns 403 Forbidden and the suspended account status remains unchanged.

## **User Story 32 — Admin Views Moderation History**

*As an admin, I want to view a moderation history log, so that I can track reports, listing removals, suspensions, and reactivations for accountability.*

### **Scenario 1: Admin views moderation history**

* Given the logged-in user is an admin.

* When the admin opens the moderation history page.

* Then the system displays moderation actions including reported listings, confirmed violations, hidden listings, suspensions, and reactivations.

* And each record includes the action type, affected member or listing, admin ID, timestamp, and reason.

### **Scenario 2: Admin filters moderation history**

* Given moderation history records exist.

* When the admin filters by member, listing, action type, or date range.

* Then the system displays only matching moderation records.

### **Scenario 3: No records match the filter**

* Given the admin applies a filter.

* When no moderation records match the selected criteria.

* Then the system displays a message saying no matching records were found.

### **Scenario 4: Non-admin cannot view moderation history**

* Given the logged-in user is not an admin.

* When the user attempts to access the moderation history page.

* Then the system returns 403 Forbidden and no moderation records are displayed.

## **User Story 33 — Admin Generates Community Moderation Reports**

*As an admin, I want to generate community moderation reports, so that I can review trends in reported listings, violations, suspensions, and borrowing activity.*

### **Scenario 1: Admin generates a moderation report**

* Given the logged-in user is an admin.

* When the admin opens the reports page, selects a report type, selects a date range, and clicks Generate Report.

* Then the system displays a report with totals and relevant records for the selected criteria.

### **Scenario 2: Admin exports a report as CSV**

* Given a report has been generated.

* When the admin clicks Export.

* Then the data is downloaded as a .csv file whose contents match the on-screen data.

* And the CSV includes column headers matching the report columns.

### **Scenario 3: Report has no matching data**

* Given the admin selects a report type and date range where no matching records exist.

* When the report is generated.

* Then the system displays a message saying no matching records were found and does not generate an empty or misleading report.

### **Scenario 4: Non-admin cannot access reports**

* Given the logged-in user is not an admin.

* When the user attempts to access the reports page.

* Then the system returns 403 Forbidden and no report data is shown.

## **User Story 34 — Admin Views All Active Reservations**

*As an admin, I want to view all active reservations across the platform so that I can monitor borrowing activity and intervene when needed.*

### **Scenario 1: Admin views all REQUESTED, APPROVED, and PICKED\_UP reservations**

* Given the logged-in user is an admin.

* When the admin opens the reservations overview page.

* Then the system displays all reservations with REQUESTED, APPROVED, or PICKED\_UP status.

* And each reservation shows: tool name, borrower name, owner name, dates, and current status.

### **Scenario 2: Admin filters reservations by status, member, or date**

* Given the admin is viewing the reservations overview page.

* When the admin filters by status, borrower, owner, or date range.

* Then only matching reservations are displayed.

### **Scenario 3: Non-admin cannot access the reservations overview page**

* Given the logged-in user is not an admin.

* When the user attempts to access the reservations overview page.

* Then the system returns 403 Forbidden and no reservation data is shown.

*Total user stories: 36  |  Sections: 8  |  Scenarios restart at 1 per user story*

# 

# User Roles / Personas

## 1\. Platform Member

A Platform Member is a registered neighborhood user who has access to the tool-sharing system. This user may act as either a borrower, a tool owner, or both depending on their needs. Platform Members can manage their profile, browse tool listings, view tool details, submit requests, list their own tools, track reservation status, and leave ratings or feedback after a completed borrowing experience.

**Primary goals:**

* Create and maintain a user profile.  
* Browse available neighborhood tools.  
* Participate in borrowing and lending activities.  
* Track current and past tool-sharing activity.  
* Communicate with other members through reservation threads when needed (see messaging constraint below).

**Messaging constraint:** Member-to-member messaging is available ONLY within the context of an active reservation thread (REQUESTED, APPROVED, or PICKED_UP). There is no general-purpose direct messaging feature.

**Example user story connection:**  
As a Platform Member, I want to manage my profile information so that other neighborhood members can identify and contact me appropriately during tool-sharing activities.

---

## 2\. Borrower / Tool Requester

A Borrower, also called a Tool Requester, is a registered neighborhood member who needs to borrow a tool for temporary use. This user searches for tools, filters or browses available listings, views tool details, submits a reservation or borrow request, and tracks whether the request is pending, approved, denied, active, or completed. The Borrower is responsible for returning the tool on time and in acceptable condition.

**Primary goals:**

* Search or browse for tools needed for a specific task.  
* View tool details, availability, pickup instructions, and owner information.  
* Submit a borrow or reservation request.  
* Track request status and return deadlines.  
* Complete the borrowing process and provide feedback.

**Example user story connection:**  
As a Borrower, I want to request an available tool so that I can borrow it from a neighbor instead of buying one.

---

## 3\. Tool Owner / Lender

A Tool Owner, also called a Lender, is a registered neighborhood member who owns tools and is willing to share them with other trusted members. This user creates and manages tool listings, provides tool descriptions, sets availability, reviews incoming borrow requests, approves or denies requests, and confirms when a borrowed tool has been returned.

**Primary goals:**

* Create tool listings with useful details such as name, category, condition, and availability.  
* Update or remove tool listings when needed.  
* Review borrow requests from other members.  
* Approve or deny requests based on availability and preference.  
* Confirm pickup, return, and tool condition.

**Example user story connection:**  
As a Tool Owner, I want to approve or deny borrow requests so that I can control when and to whom my tools are lent.

---

## 4\. Admin / Moderator

An Admin or Moderator is a system-level user responsible for maintaining safety, quality, and proper use of the platform. This user may review reports, manage inappropriate listings, resolve disputes, monitor user activity, and take action when platform rules are violated. The Admin does not participate in normal borrowing and lending as their main role; instead, they help keep the system trustworthy and organized.

**Primary goals:**

* Review reported users, listings, or tool-sharing issues.  
* Remove inappropriate, duplicate, or unsafe tool listings.  
* Help resolve disputes between borrowers and lenders.  
* Manage user access when necessary.  
* Support platform safety and reliability.

**Example user story connection:**  
As an Admin, I want to review reported listings so that I can remove unsafe or inappropriate content from the platform.

---

## 5\. Guest / Unregistered Visitor

Guest/Unregistered Visitors see only a public landing page stating the platform is private and invite-only. They may register if they possess a valid invite token, or log in if they already have an account. No tool listings, member profiles, reservation data, or any other application content is visible without authentication.

**Primary goals:**

* Understand the platform is private and invite-only.  
* Register using a valid invite token if they have one.  
* Log in if they already have an account.

# 

# Open Questions and Assumptions

## Assumptions

* The application will serve one private neighborhood community only.  
* Users will have devices, browsers, and internet access capable of running the website.  
* The app will remain small-scale and will not need architecture for medium- or large-scale growth in this course project.  
* The primary user base will be willing to participate in tool sharing and follow community rules around borrowing and returns.  
* The system will be invite-only, and membership will be limited to approved users.  
* The first release will focus on core borrowing and listing workflows rather than production-grade operational depth.  
* Detailed historical analytics and long-term reporting are out of scope, except for the reservation and review history needed for normal app behavior.  
* Basic accessibility and responsiveness will be supported, but advanced accessibility certification and extensive assistive-technology testing are not in scope unless required later.  
* The system design will prioritize modularity so new features can be added later without major rewrites.  
* Admin and moderation features will be limited to the roles and actions defined in the requirements, not full enterprise-style administration.


## Open Questions

* Which additional features are in scope for version 1 beyond the base tool-sharing workflow?  
* Should notifications be in-app only, email only, or both?  
* Do we want automated reminder notifications for upcoming pickup or return deadlines?  
* How should we handle overdue returns, late fees, or disputes if they arise?  
* What level of search and filtering is required for tool browsing?  
* Should tool listings support categories only, or also tags, condition levels, and location-based filters?  
* What is the minimum viable accessibility standard the team wants to commit to for this project?  
* How should we support future feature growth in the architecture without over-engineering the first release?  
* What admin reporting is actually needed: user activity, tool usage, reservation counts, or something else?  
* Should deleted or deactivated content remain visible in any audit or history views?  
* Do we need moderation controls for reviews and ratings?  
* What are the browser and device support targets for the first release?

# Known risks

​

## 1\. Task misunderstanding

**Description:** Task misunderstanding is the situation in which members may not fully understand what they should do or may understand their tasks in unintended ways. Task misunderstanding can occur when communication is insufficient or when the task details are not provided.

**Impact:** Task misunderstanding may also lead to negative consequences. For example, the team wastes time because we have to redo the task we were supposed to do after we realize we misunderstood what to do. In addition, this may lower the team’s motivation.

**Mitigation:** The project manager must understand the instructions well and then assign detailed tasks to team members. Members should ask if the task is not clear. Therefore, communication is crucial to minimizing this risk.

​

## 2\. Getting stuck in the same error for too long

**Description:** This risk could arise from the coding process. We may get stuck in the same error because the functionality we try to develop may be too complicated, we are new to a certain programming language, or we lack the ability to pay attention to the case.

**Impact:** This may also lead to delays in progress or fatigue.

**Mitigation:** We ask team members on Discord for help or advice.

​

## 3\. Poor task assignment

**Description**: For example, poor task assignment may result in each member being assigned too many tasks in a single sprint. We anticipate that poor task assignment may occur when communication between the project manager and team members is insufficient, or when the project manager does not understand the team's workload capacity.

**Impacts:** This may result in a loss of credibility between the project manager and the team member and may affect the entire team.

**Mitigation:** We have to prevent this by ensuring capacity and communication. Also, team members should agree on the task assignment for each sprint before their tasks are assigned.

​

## 4\. Tech stack incompatibility

**Description**: We develop the full-stack web application by incorporating several programming languages, libraries, and a database. Tech stack incompatibility means that this combination does not work well.

**Impacts:** If a tech stack incompatibility occurs, developers must rewrite code, which negatively affects their mental health and wastes time. 

**Mitigation:** Before deciding, we should check the version of each technical stack and compatibility. In addition, before starting, developers should communicate with each other, for example, between the frontend and backend. Integrating testing is crucial as well.