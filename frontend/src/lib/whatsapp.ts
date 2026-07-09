// The real business number must be set via VITE_WHATSAPP_NUMBER before going
// live (country code, no leading +, e.g. 255687862261). This placeholder
// only prevents the button from being wired to a wrong/real number by accident.
// SettingsContext overwrites this at app startup with the live, admin-editable
// value from the backend (see setBusinessNumber below) — every call site here
// reads the current module-level value, so no call site needs to change.
let businessNumber: string =
  import.meta.env.VITE_WHATSAPP_NUMBER ?? "255000000000";

/** Overwrites the in-memory business number once site settings load. */
export function setBusinessNumber(number: string): void {
  if (number) businessNumber = number;
}

/** Builds the dynamic wa.me link for a product, per the Kalour contact flow. */
export function buildWhatsAppLink(productName: string): string {
  const message = `Habari! Nimeipenda hii bidhaa ${productName}. Je naweza pata punguzo au naweza ipata je?`;
  return `https://wa.me/${businessNumber}?text=${encodeURIComponent(message)}`;
}

/** Builds a general (non-product) contact link, for the footer and Contact page. */
export function buildGeneralWhatsAppLink(): string {
  const message = "Habari! Nataka kujua zaidi kuhusu bidhaa za Kalour Beauty Empire.";
  return `https://wa.me/${businessNumber}?text=${encodeURIComponent(message)}`;
}

/** Formats the raw business number (e.g. "255687862261") for display as "+255 687 862 261". */
export function formatBusinessNumber(): string {
  const digits = businessNumber;
  if (digits.length < 9) return `+${digits}`;
  const countryCode = digits.slice(0, digits.length - 9);
  const rest = digits.slice(digits.length - 9);
  return `+${countryCode} ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6)}`;
}
