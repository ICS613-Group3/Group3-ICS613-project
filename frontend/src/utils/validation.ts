/**
 * Shared validation helpers for forms.
 */

// HTML5's ``type="email"`` only checks for an ``@`` separator, so
// addresses like ``rion@e`` would otherwise pass. The backend uses
// Pydantic's ``EmailStr`` which requires ``local@domain.tld``; this
// pattern mirrors that check on the client so the user gets feedback
// before the round-trip.
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Returns true if the email looks like a real address (has a local
 * part, an @, a domain, a dot, and a TLD).
 */
export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim());
}
