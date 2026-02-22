/**
 * Format a price with the configured currency symbol.
 * Usage: formatPrice(199, '₹') → '₹199'
 */
export function formatPrice(amount: number | string, currencySymbol: string = '₹'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return `${currencySymbol}0`;
  return `${currencySymbol}${num.toLocaleString('en-IN')}`;
}
