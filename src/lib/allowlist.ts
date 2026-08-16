export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function parseAllowedEmailsEnv(
  envValue: string | undefined,
): string[] {
  if (!envValue) return [];
  return envValue
    .split(",")
    .map((part) => normalizeEmail(part))
    .filter(Boolean);
}

export function isEmailAllowed(
  email: string,
  envList: string[],
  tableEmails: string[],
): boolean {
  const needle = normalizeEmail(email);
  const haystack = new Set([
    ...envList.map(normalizeEmail),
    ...tableEmails.map(normalizeEmail),
  ]);
  return haystack.has(needle);
}
