import { useEffect, useState } from 'react';
import type { WearTier } from '../models/types';

const STEPS = [
  'Consultando listings no mercado',
  'Verificando floats compatíveis',
  'Montando pool de candidatos',
  'Otimizando contratos',
  'Calculando custos e probabilidades',
] as const;

interface LoadingModalProps {
  open: boolean;
  skinName?: string;
  wear?: WearTier;
}

export function LoadingModal({ open, skinName, wear }: LoadingModalProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!open) {
      setStepIndex(0);
      return undefined;
    }

    setVisible(true);
    document.body.style.overflow = 'hidden';

    const stepTimer = window.setInterval(() => {
      setStepIndex((current) => (current + 1) % STEPS.length);
    }, 2200);

    return () => {
      window.clearInterval(stepTimer);
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    if (open) return undefined;
    const timer = window.setTimeout(() => setVisible(false), 320);
    return () => window.clearTimeout(timer);
  }, [open]);

  if (!open && !visible) return null;

  const progress = ((stepIndex + 1) / STEPS.length) * 100;

  return (
    <div
      className={`loading-modal-overlay${open ? ' is-open' : ' is-closing'}`}
      role="dialog"
      aria-modal="true"
      aria-busy="true"
      aria-label="Calculando contratos"
    >
      <div className="loading-modal-backdrop" />
      <div className="loading-modal-card">
        <div className="loading-modal-glow" aria-hidden />

        <div className="loading-modal-spinner" aria-hidden>
          <span className="loading-ring loading-ring-outer" />
          <span className="loading-ring loading-ring-inner" />
          <span className="loading-core">⚡</span>
        </div>

        <h3 className="loading-modal-title">Calculando contratos</h3>

        {skinName && (
          <p className="loading-modal-skin">
            {skinName}
            {wear && <span className="loading-modal-wear"> · {wear}</span>}
          </p>
        )}

        <div className="loading-modal-progress" aria-hidden>
          <div
            className="loading-modal-progress-bar"
            style={{ width: `${progress}%` }}
          />
        </div>

        <p className="loading-modal-step" key={stepIndex}>
          {STEPS[stepIndex]}
          <span className="loading-dots">
            <span />
            <span />
            <span />
          </span>
        </p>

        <ul className="loading-modal-checklist" aria-hidden>
          {STEPS.map((step, index) => (
            <li
              key={step}
              className={
                index < stepIndex
                  ? 'done'
                  : index === stepIndex
                    ? 'active'
                    : undefined
              }
            >
              <span className="loading-check-icon">
                {index < stepIndex ? '✓' : index === stepIndex ? '◉' : '○'}
              </span>
              {step}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
