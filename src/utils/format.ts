/**
 * Formata valor monetário em BRL.
 */
export function formatCurrency(value: number, currency = 'BRL'): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

/**
 * Formata percentual.
 */
export function formatPercent(value: number, decimals = 2): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Formata float com precisão.
 */
export function formatFloat(value: number, decimals = 4): string {
  return value.toFixed(decimals);
}

/**
 * Normaliza nome de skin para busca.
 */
export function normalizeSkinName(name: string): string {
  return name
    .toLowerCase()
    .replace(/™/g, '')
    .replace(/stattrak™?\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Gera market hash name padrão Steam.
 */
export function buildMarketHashName(
  name: string,
  stattrak: boolean,
  wear?: string,
): string {
  const prefix = stattrak ? 'StatTrak™ ' : '';
  const suffix = wear ? ` (${wear})` : '';
  return `${prefix}${name}${suffix}`;
}
