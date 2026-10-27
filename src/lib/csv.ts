/**
 * CSV escaping helpers.
 *
 * Follows OWASP CSV injection guidance: cells whose content begins with
 * =, +, -, @, tab or CR must be neutralized (prefixed with a single quote)
 * so spreadsheet applications do not evaluate them as formulas/DDE.
 * See: https://cheatsheetseries.owasp.org/cheatsheets/CSV_Injection.html
 */
const FORMULA_LEADING_CHARS = ['=', '+', '-', '@', '\t', '\r']
export function neutralizeCsvFormula(value: string): string {
  if (value.length > 0 && FORMULA_LEADING_CHARS.includes(value[0])) return `'${value}`
  return value
}
export function escapeCsvCell(val: unknown): string {
  const str = val == null ? '' : String(val)
  return `"${neutralizeCsvFormula(str).replace(/"/g, '""')}"`
}
