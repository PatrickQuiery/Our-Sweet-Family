/** All native SDK work shares one queue so identities cannot cross a purchase. */
export class PurchaseSession<T> {
  private queue: Promise<unknown> = Promise.resolve();
  private generation = 0;
  private acting = false;
  private identified: string | null = null;
  private target: string | null = null;
  info: T | null = null;
  constructor(private sdk: { login: (id: string) => Promise<T>; logout: () => Promise<unknown> }) {}
  ready(id: string | null) { return !!id && this.target === id && this.identified === id; }
  private enqueue<R>(operation: () => Promise<R>): Promise<R> {
    const next = this.queue.then(operation);
    this.queue = next.catch(() => {});
    return next;
  }
  identify(id: string | null) {
    const generation = ++this.generation;
    this.target = id;
    this.info = null;
    this.identified = null;
    return this.enqueue(async () => {
      if (generation !== this.generation) return;
      const info = id ? await this.sdk.login(id) : (await this.sdk.logout(), null);
      if (generation !== this.generation) return;
      this.identified = id;
      this.info = info;
    });
  }
  async action<R>(id: string | null, operation: () => Promise<R>): Promise<R> {
    if (this.acting) throw new Error('A store action is already in progress.');
    this.acting = true;
    try { return await this.run(id, operation); }
    finally { this.acting = false; }
  }
  run<R>(id: string | null, operation: () => Promise<R>): Promise<R> {
    const generation = this.generation;
    if (!this.ready(id)) return Promise.reject(new Error('Purchases are not ready for this account.'));
    return this.enqueue(async () => {
      if (generation !== this.generation || !this.ready(id)) throw new Error('Account changed. Please try again.');
      const result = await operation();
      if (generation !== this.generation) throw new Error('Account changed. Please try again.');
      return result;
    });
  }
}
