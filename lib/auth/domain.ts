export function isAllowedEmail(email: string | null | undefined, domain: string): boolean {
  if (!email) return false;
  return email.toLowerCase().endsWith(`@${domain.toLowerCase()}`);
}
