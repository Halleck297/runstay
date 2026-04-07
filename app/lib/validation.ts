// Shared validation helpers

/** Matches a practical email: local@domain.tld where TLD is at least 2 chars */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}
