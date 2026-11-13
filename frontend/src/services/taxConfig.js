export const STATUTORY_TAX_RATE_PERCENT = 12.24
export const STATUTORY_TAX_RATE = Number((STATUTORY_TAX_RATE_PERCENT / 100).toFixed(4))
export const STATUTORY_TAX_LABEL = `${STATUTORY_TAX_RATE_PERCENT}%`

/**
 * Computes the fixed 12.24% statutory telecom tax rounded to USD cents.
 */
export function calculateStatutoryTax(taxableAmount = 0) {
  const numericAmount = Number(taxableAmount) || 0
  return Number((numericAmount * STATUTORY_TAX_RATE).toFixed(2))
}

