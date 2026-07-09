const priceFormatter = new Intl.NumberFormat("en-TZ", {
  maximumFractionDigits: 0,
});

export function formatPrice(price: number): string {
  return `TSh ${priceFormatter.format(price)}`;
}
