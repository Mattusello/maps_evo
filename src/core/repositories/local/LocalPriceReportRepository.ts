/**
 * LocalPriceReportRepository — Fase 1/2: prezzi crowdsourced persistiti localmente.
 * Ogni report ha timestamp (createdAt = data del report) e voti; l'outbox prepara il sync.
 */
import { priceReportSchema, type PriceReport } from '../../models';
import { Outbox } from '../../sync/outbox';
import { asyncStorageStore, STORAGE_KEYS, type KeyValueStore } from '../../storage/keyValueStore';
import { newId } from '../../utils/id';
import { nowIso } from '../../utils/time';
import type { CreatePriceReportInput, PriceReportRepository } from '../contracts';

export class LocalPriceReportRepository implements PriceReportRepository {
  constructor(
    private store: KeyValueStore = asyncStorageStore,
    private outbox: Outbox = new Outbox(asyncStorageStore)
  ) {}

  private async loadAll(): Promise<PriceReport[]> {
    const raw = (await this.store.getJSON<unknown[]>(STORAGE_KEYS.priceReports)) ?? [];
    return raw.map((r) => priceReportSchema.parse(r));
  }
  private save(v: PriceReport[]) {
    return this.store.setJSON(STORAGE_KEYS.priceReports, v);
  }

  async list({ stopId, placeId }: { stopId?: string; placeId?: string }): Promise<PriceReport[]> {
    const all = await this.loadAll();
    return all.filter(
      (r) => !r.deletedAt && ((stopId && r.stopId === stopId) || (placeId && r.placeId === placeId))
    );
  }

  async add(input: CreatePriceReportInput): Promise<PriceReport> {
    const now = nowIso();
    const report: PriceReport = priceReportSchema.parse({
      id: newId(),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      syncStatus: 'pending',
      stopId: input.stopId,
      placeId: input.placeId,
      price: input.price,
      label: input.label,
      reportedBy: input.reportedBy,
      upvotes: 0,
      downvotes: 0,
    });
    const all = await this.loadAll();
    all.push(report);
    await this.save(all);
    await this.outbox.enqueue('priceReport', report.id, 'create', report);
    return report;
  }

  async vote(id: string, delta: 1 | -1): Promise<PriceReport> {
    const all = await this.loadAll();
    const idx = all.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error(`Report ${id} non trovato`);
    const r = all[idx];
    all[idx] = {
      ...r,
      upvotes: delta === 1 ? r.upvotes + 1 : r.upvotes,
      downvotes: delta === -1 ? r.downvotes + 1 : r.downvotes,
      updatedAt: nowIso(),
      syncStatus: 'pending',
    };
    await this.save(all);
    await this.outbox.enqueue('priceReport', id, 'update', all[idx]);
    return all[idx];
  }
}
