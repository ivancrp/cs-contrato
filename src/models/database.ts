import { COLLECTIONS, getAllSkins } from '../data/collections';
import type {
  ContractHistoryEntry,
  DatabaseSchema,
  SimulationRecord,
  TargetSearchParams,
  TradeUpContract,
} from './types';
import type { SimulationResult } from './types';

const STORAGE_KEY = 'cs2-tradeup-db';

/**
 * Camada de persistência local (localStorage).
 * Estrutura preparada para migração a Supabase/PostgreSQL.
 */
export class Database {
  private schema: DatabaseSchema;

  constructor() {
    this.schema = this.load();
  }

  private load(): DatabaseSchema {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as DatabaseSchema;
    } catch {
      // fallback to default
    }
    return {
      collections: COLLECTIONS,
      items: getAllSkins(),
      prices: [],
      contracts: [],
      simulations: [],
    };
  }

  private save(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.schema));
  }

  getSchema(): DatabaseSchema {
    return this.schema;
  }

  /** Salva histórico de contratos gerados */
  saveContractHistory(
    params: TargetSearchParams,
    contracts: TradeUpContract[],
  ): ContractHistoryEntry {
    const entry: ContractHistoryEntry = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      params,
      contracts,
    };
    this.schema.contracts.unshift(entry);
    if (this.schema.contracts.length > 50) {
      this.schema.contracts = this.schema.contracts.slice(0, 50);
    }
    this.save();
    return entry;
  }

  /** Salva resultado de simulação */
  saveSimulation(
    contractId: string,
    result: SimulationResult,
  ): SimulationRecord {
    const record: SimulationRecord = {
      id: crypto.randomUUID(),
      contractId,
      createdAt: new Date().toISOString(),
      result,
    };
    this.schema.simulations.unshift(record);
    if (this.schema.simulations.length > 20) {
      this.schema.simulations = this.schema.simulations.slice(0, 20);
    }
    this.save();
    return record;
  }

  getContractHistory(): ContractHistoryEntry[] {
    return this.schema.contracts;
  }

  getSimulations(): SimulationRecord[] {
    return this.schema.simulations;
  }
}

export const db = new Database();
