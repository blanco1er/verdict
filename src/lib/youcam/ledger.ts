/**
 * Local unit ledger: reserves units before a paid task starts, confirms them
 * on `success`, refunds them on `error` (the API charges nothing for failed
 * tasks). It protects the 1,000 hackathon units from runaway loops.
 */
export class UnitBudgetExceeded extends Error {
  constructor(
    readonly requested: number,
    readonly remaining: number,
  ) {
    super(`Unit budget exceeded: need ${requested}, ${remaining} left`);
    this.name = "UnitBudgetExceeded";
  }
}

export class UnitLedger {
  private reserved = new Map<string, number>();
  private spentUnits = 0;

  constructor(readonly cap: number) {
    if (!(cap >= 0)) {
      throw new Error("cap must be >= 0");
    }
  }

  get spent(): number {
    return this.spentUnits;
  }

  get pending(): number {
    let total = 0;
    this.reserved.forEach((v) => (total += v));
    return total;
  }

  get remaining(): number {
    return this.cap - this.spentUnits - this.pending;
  }

  reserve(key: string, units: number): void {
    if (units > this.remaining) {
      throw new UnitBudgetExceeded(units, this.remaining);
    }
    this.reserved.set(key, (this.reserved.get(key) ?? 0) + units);
  }

  /** Moves a reservation to a new key (e.g. temp id -> task_id). */
  rekey(from: string, to: string): void {
    const units = this.reserved.get(from);
    if (units == null) return;
    this.reserved.delete(from);
    this.reserved.set(to, units);
  }

  confirm(key: string): void {
    const units = this.reserved.get(key);
    if (units == null) return;
    this.reserved.delete(key);
    this.spentUnits += units;
  }

  refund(key: string): void {
    this.reserved.delete(key);
  }
}
