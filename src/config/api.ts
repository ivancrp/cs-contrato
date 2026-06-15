/** URL base da API backend (monorepo @ct/api) */
export const API_BASE_URL =
  import.meta.env.VITE_API_URL?.replace(/\/$/, '') || '/api/backend';

export const API_ENABLED = import.meta.env.VITE_API_ENABLED !== 'false';
