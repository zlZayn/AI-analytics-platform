export interface ClosablePool {
  end(): Promise<void>
}

interface PoolEntry<TPool> {
  pool: TPool
  touchedAt: number
}

export interface PoolRegistryOptions {
  maxEntries: number
  idleMs: number
  now?: () => number
}

export class PoolRegistry<TPool extends ClosablePool> {
  readonly #entries = new Map<string, PoolEntry<TPool>>()
  readonly #pending = new Map<string, Promise<TPool>>()
  readonly #maxEntries: number
  readonly #idleMs: number
  readonly #now: () => number

  constructor({ maxEntries, idleMs, now = Date.now }: PoolRegistryOptions) {
    if (!Number.isInteger(maxEntries) || maxEntries < 1) throw new Error("maxEntries must be a positive integer")
    if (!Number.isFinite(idleMs) || idleMs < 0) throw new Error("idleMs must be non-negative")
    this.#maxEntries = maxEntries
    this.#idleMs = idleMs
    this.#now = now
  }

  get size(): number {
    return this.#entries.size
  }

  keys(): string[] {
    return [...this.#entries.keys()]
  }

  async getOrCreate(key: string, factory: () => Promise<TPool>): Promise<TPool> {
    await this.pruneIdle()
    const current = this.#entries.get(key)
    if (current) {
      current.touchedAt = this.#now()
      return current.pool
    }

    const pending = this.#pending.get(key)
    if (pending) return pending

    const creation = (async () => {
      const pool = await factory()
      await this.#makeRoom()
      this.#entries.set(key, { pool, touchedAt: this.#now() })
      return pool
    })()
    this.#pending.set(key, creation)
    try {
      return await creation
    } finally {
      this.#pending.delete(key)
    }
  }

  async invalidate(key: string): Promise<void> {
    const entry = this.#entries.get(key)
    if (!entry) return
    this.#entries.delete(key)
    await entry.pool.end()
  }

  async pruneIdle(): Promise<void> {
    const cutoff = this.#now() - this.#idleMs
    const idle = [...this.#entries.entries()]
      .filter(([, entry]) => entry.touchedAt <= cutoff)
      .map(([key]) => key)
    await Promise.all(idle.map((key) => this.invalidate(key)))
  }

  async closeAll(): Promise<void> {
    await Promise.all(this.keys().map((key) => this.invalidate(key)))
  }

  async #makeRoom(): Promise<void> {
    while (this.#entries.size >= this.#maxEntries) {
      const oldest = [...this.#entries.entries()].reduce((candidate, entry) =>
        entry[1].touchedAt < candidate[1].touchedAt ? entry : candidate
      )
      await this.invalidate(oldest[0])
    }
  }
}
