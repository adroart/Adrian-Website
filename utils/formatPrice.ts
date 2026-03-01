/**
 * Format a numeric price as a USD string.
 * e.g. 1500 → "$1,500"
 */
export function formatPrice(price: number): string {
    return '$' + price.toLocaleString('en-US');
}
