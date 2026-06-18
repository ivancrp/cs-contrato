/** URL base da API backend (monorepo @ct/api) */
export const API_BASE_URL =
  import.meta.env.VITE_API_URL?.replace(/\/$/, '') || '/api/backend';

/** Health dedicado na Vercel (api/health.ts) — fallback se /api/backend falhar */
export const API_HEALTH_URL =
  import.meta.env.VITE_API_HEALTH_URL?.replace(/\/$/, '') || '/api/health';

export const API_ENABLED = import.meta.env.VITE_API_ENABLED !== 'false';
