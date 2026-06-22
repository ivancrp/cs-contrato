'use client';

import type { TradeUpContract, WearTier } from '@ct/types';
import { SkinItemCard, WearFloatBar } from '@/components/SkinItemCard';
import { WEAR_ABBR } from '@/lib/market-links';
import { EditableInputCard } from '@/components/EditableInputCard';
import { ContractActions } from '@/components/ContractActions';
import { useContractEditor } from '@/hooks/useContractEditor';

export interface EnrichedTradeUpContract extends TradeUpContract {
  tier: string;
  tierLabel: string;
  algorithmUsed?: string;
  aiScore?: number;
  inputsVerified?: number;
  inputsLive?: number;
  unverifiedInputNames?: string[];
  priceDeltaFromVerification?: number;
}

export interface TradeUpSearchResult {
  targetSkin: {
    id: string;
    name: string;
    weapon: string;
    imageUrl?: string;
    rarity?: string;
    collectionId?: string;
    minFloat?: number;
    maxFloat?: number;
    stattrak?: boolean;
  };
  wear?: string;
  wearAutoAdjusted?: boolean;
  validWears?: string[];
  contracts: EnrichedTradeUpContract[];
  collectionLabels?: Record<string, string>;
  marketAvailability: {
    listingsFound: number;
    priceSource?: 'live' | 'catalog';
    liveListings?: number;
  };
}

function formatBrl(value: number): string {
  return `R$ ${value.toFixed(2)}`;
}

function wearAbbr(wear: WearTier | string): string {
  return WEAR_ABBR[wear as WearTier] ?? String(wear);
}

function Stars({ score }: { score?: number }) {
  if (!score) return null;
  const filled = Math.min(5, Math.max(1, Math.round(score)));
  return (
    <span className="text-amber-400 text-xs tracking-wider" title={`Score ${filled}/5`}>
      {'★'.repeat(filled)}
      {'☆'.repeat(5 - filled)}
    </span>
  );
}

function getOutputHighlightClass(
  price: number,
  maxPrice: number,
  totalCost: number,
  isTarget?: boolean,
): string {
  const isHighest = maxPrice > 0 && price >= maxPrice;
  const isBelowCost = price < totalCost;

  if (isHighest) {
    return 'ring-2 ring-emerald-500 ring-offset-2 ring-offset-[#0a0e14]';
  }
  if (isBelowCost) {
    return 'ring-2 ring-red-500 ring-offset-2 ring-offset-[#0a0e14]';
  }
  if (isTarget) {
    return 'ring-2 ring-sky-400 ring-offset-2 ring-offset-[#0a0e14]';
  }
  return 'ring-2 ring-sky-500/60 ring-offset-2 ring-offset-[#0a0e14]';
}

const GENERIC_TARGET_PLACEHOLDER = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="180" viewBox="0 0 240 180">
    <rect width="240" height="180" fill="#141b26"/>
    <circle cx="120" cy="78" r="52" fill="none" stroke="#334155" stroke-width="2" stroke-dasharray="8 6"/>
    <path d="M52 118h136l-8-14H60l-8 14z" fill="#475569" opacity="0.35"/>
    <path d="M78 104l44-38 40 38" fill="none" stroke="#64748b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="108" y="88" width="24" height="32" rx="4" fill="#64748b" opacity="0.5"/>
  </svg>`,
)}`;

export function TargetSkinHero({
  targetSkin,
  empty = false,
  marketAvailability,
  contractCount,
  collectionName,
  targetWear,
  expectedOutputFloat,
}: {
  targetSkin?: TradeUpSearchResult['targetSkin'];
  empty?: boolean;
  marketAvailability?: TradeUpSearchResult['marketAvailability'];
  contractCount?: number;
  collectionName?: string;
  targetWear?: string;
  expectedOutputFloat?: number;
}) {
  if (empty || !targetSkin) {
    return (
      <div className="flex h-full flex-col overflow-hidden rounded-xl border border-surface-border bg-surface-card">
        <div className="relative flex h-[15rem] flex-col overflow-hidden bg-gradient-to-b from-slate-900/90 via-[#121820] to-[#0a0e14]">
          <div className="relative z-10 shrink-0 bg-gradient-to-b from-black/95 via-black/70 to-transparent px-2.5 pb-2 pt-2.5">
            <h3 className="text-[15px] font-bold leading-snug text-slate-400">Skin alvo</h3>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-4">
            <img
              src={GENERIC_TARGET_PLACEHOLDER}
              alt=""
              className="max-h-[70%] max-w-full object-contain opacity-80"
            />
            <span className="absolute right-1.5 top-1 z-20 rounded bg-surface-border/80 px-1.5 py-0.5 text-[10px] font-bold text-slate-400">
              Alvo
            </span>
          </div>
        </div>
        <div className="h-0.5 bg-surface-border opacity-80" />
        <div className="-mt-0 border-t border-surface-border/60 px-4 py-3">
          <p className="text-sm text-slate-500">Nenhuma skin selecionada</p>
          <p className="mt-1 text-xs text-slate-600">Busque ou selecione uma skin no formulário</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden rounded-xl border border-surface-border bg-surface-card">
      <SkinItemCard
        name={targetSkin.name}
        imageUrl={targetSkin.imageUrl}
        rarity={targetSkin.rarity}
        price={0}
        float={expectedOutputFloat ?? 0}
        wear={(targetWear as WearTier) ?? 'Factory New'}
        collectionId={targetSkin.collectionId}
        collectionName={collectionName}
        size="lg"
        badge="Alvo"
        showPrice={false}
        showFloatBar={Boolean(expectedOutputFloat)}
      />
      <div className="-mt-2 border-t border-surface-border/60 px-4 py-3">
        <p className="text-sm text-slate-400">{targetSkin.weapon}</p>
        {marketAvailability && contractCount != null && (
          <p className="mt-1 text-xs text-slate-500">
            {marketAvailability.listingsFound} opções de entrada · {contractCount} contrato
            {contractCount !== 1 ? 's' : ''}
            {marketAvailability.priceSource === 'catalog' && (
              <span> · preços estimados (Steam SCM)</span>
            )}
            {marketAvailability.priceSource === 'live' && marketAvailability.liveListings != null && (
              <span> · {marketAvailability.liveListings} listings live (CSFloat)</span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'amber' | 'emerald' | 'red' | 'sky' | 'slate';
}) {
  const colors = {
    amber: 'text-amber-300',
    emerald: 'text-emerald-300',
    red: 'text-red-300',
    sky: 'text-sky-300',
    slate: 'text-slate-300',
  };

  return (
    <div className="rounded-lg border border-surface-border/50 bg-surface/30 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold tabular-nums ${colors[tone]}`}>{value}</p>
    </div>
  );
}

function ContractCard({
  initialContract,
  result,
}: {
  initialContract: EnrichedTradeUpContract;
  result: TradeUpSearchResult;
}) {
  const targetSkin = {
    id: result.targetSkin.id,
    minFloat: result.targetSkin.minFloat ?? 0,
    maxFloat: result.targetSkin.maxFloat ?? 1,
    stattrak: result.targetSkin.stattrak ?? false,
  };

  const {
    contract,
    editMode,
    setEditMode,
    updateInput,
    recalculating,
    error,
  } = useContractEditor(initialContract, targetSkin);

  const { evMetrics, floatMetrics, inputs, outputs } = contract;
  const targetCollectionIds = new Set(
    outputs.filter((o) => o.isTarget).map((o) => o.item.collectionId),
  );
  const totalCost = evMetrics.totalCost;
  const maxOutputPrice = outputs.reduce((max, o) => Math.max(max, o.price), 0);

  const sortedOutputs = [...outputs].sort((a, b) => {
    if (a.isTarget !== b.isTarget) return a.isTarget ? -1 : 1;
    return b.probability - a.probability;
  });

  return (
    <article className="overflow-hidden rounded-xl border border-surface-border bg-[#0a0e14]">
      <header className="border-b border-surface-border/60 bg-surface/20 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold text-slate-100">{contract.tierLabel}</h3>
                <Stars score={contract.aiScore} />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Saída esperada{' '}
                <span className="font-medium text-slate-300">
                  {wearAbbr(floatMetrics.expectedWear)} · {floatMetrics.expectedOutputFloat.toFixed(4)}
                </span>
                {contract.inputsVerified != null && contract.inputsVerified > 0 && (
                  <span className="ml-2 text-emerald-400">
                    · {contract.inputsVerified}/10 inputs CSFloat verificados
                  </span>
                )}
              </p>
              <div className="mt-3 max-w-md">
                <WearFloatBar float={floatMetrics.expectedOutputFloat} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
              <Metric label="Custo" value={formatBrl(evMetrics.totalCost)} tone="amber" />
              <Metric
                label="Lucro esp."
                value={formatBrl(evMetrics.expectedProfit)}
                tone={evMetrics.expectedProfit >= 0 ? 'emerald' : 'red'}
              />
              <Metric
                label="Chance alvo"
                value={`${(evMetrics.targetChance * 100).toFixed(1)}%`}
                tone="sky"
              />
              <Metric label="ROI" value={`${evMetrics.roi.toFixed(1)}%`} tone="slate" />
            </div>
          </div>

          <ContractActions
            contract={contract}
            targetSkin={result.targetSkin}
            wear={result.wear}
            collectionLabels={result.collectionLabels}
            editMode={editMode}
            onEditModeChange={setEditMode}
            recalculating={recalculating}
          />

          {editMode && (
            <p className="text-xs text-slate-500">
              Ajuste float e preço de cada entrada — as saídas e métricas atualizam automaticamente.
            </p>
          )}
          {error && (
            <p className="text-xs text-amber-400">{error}</p>
          )}
        </div>
      </header>

      <div className="space-y-6 px-4 py-5 sm:px-5">
        <section>
          <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
            Skins de entrada · {inputs.length} itens
          </h4>
          <div className="grid grid-cols-5 gap-2 sm:gap-3">
            {inputs.map((input, idx) => (
              <EditableInputCard
                key={`${input.listing.id}-${idx}`}
                name={input.item.name}
                imageUrl={input.item.imageUrl}
                rarity={input.item.rarity}
                price={input.listing.price}
                float={input.listing.float}
                wear={input.listing.wear}
                minFloat={input.item.minFloat}
                maxFloat={input.item.maxFloat}
                collectionId={input.item.collectionId}
                collectionName={result.collectionLabels?.[input.item.collectionId]}
                isTargetCollection={targetCollectionIds.has(input.item.collectionId)}
                purchaseUrl={editMode ? undefined : input.listing.purchaseUrl}
                badge={
                  input.listing.marketplace === 'csfloat'
                    ? `#${idx + 1} CSF`
                    : `#${idx + 1}`
                }
                editable={editMode}
                onFloatChange={(value) => updateInput(idx, 'float', value)}
                onPriceChange={(value) => updateInput(idx, 'price', value)}
              />
            ))}
          </div>
        </section>

        {outputs.length > 0 && (
          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Possíveis saídas
                {recalculating && (
                  <span className="ml-2 font-normal normal-case text-slate-600">· atualizando preços…</span>
                )}
              </h4>
              <p className="text-[10px] text-slate-600">
                <span className="text-emerald-400">■</span> maior valor ·{' '}
                <span className="text-red-400">■</span> abaixo do custo ·{' '}
                <span className="text-sky-400">■</span> demais saídas ({formatBrl(totalCost)})
              </p>
            </div>
            <div className="grid grid-cols-5 gap-2 sm:gap-3">
              {sortedOutputs.map((output) => (
                <SkinItemCard
                  key={output.item.id}
                  name={output.item.name}
                  imageUrl={output.item.imageUrl}
                  rarity={output.item.rarity}
                  price={output.price}
                  float={output.expectedFloat}
                  wear={output.expectedWear}
                  collectionId={output.item.collectionId}
                  collectionName={result.collectionLabels?.[output.item.collectionId]}
                  badge={
                    output.isTarget
                      ? `${(output.probability * 100).toFixed(1)}% alvo`
                      : `${(output.probability * 100).toFixed(1)}%`
                  }
                  className={getOutputHighlightClass(
                    output.price,
                    maxOutputPrice,
                    totalCost,
                    output.isTarget,
                  )}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </article>
  );
}

export function TradeUpResults({ result }: { result: TradeUpSearchResult }) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-400">
        Análise profunda · {result.contracts.length} estratégia
        {result.contracts.length !== 1 ? 's' : ''}: menor custo, profit, float ideal e verificação CSFloat
      </p>
      {result.contracts.map((contract) => (
        <ContractCard
          key={`${contract.tier}-${contract.id}`}
          initialContract={contract}
          result={result}
        />
      ))}
    </div>
  );
}
