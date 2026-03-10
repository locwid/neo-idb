import { NeoIDBIndex } from './idb-index'
import type {
  IndexName,
  NeoIDBSchema,
  PrimaryKeyOf,
  StoreName,
  StoreQuery,
  StoreValue,
} from './idb-types'
import { requestToPromise } from './utils'

export class NeoIDBObject<
  S extends NeoIDBSchema = NeoIDBSchema,
  K extends StoreName<S> = StoreName<S>,
> {
  private storeName: K
  private tx: IDBTransaction

  constructor(storeName: K, tx: IDBTransaction) {
    this.storeName = storeName
    this.tx = tx
  }

  private get store(): IDBObjectStore {
    return this.tx.objectStore(this.storeName)
  }

  add(value: StoreValue<S, K>, key?: PrimaryKeyOf<S, K>): void {
    this.store.add(value, key)
  }

  addMany(values: StoreValue<S, K>[]): void {
    for (const value of values) {
      this.store.add(value)
    }
  }

  count(query?: StoreQuery<S, K>): Promise<number> {
    return requestToPromise<number>(this.store.count(query))
  }

  clear(): void {
    this.store.clear()
  }

  delete(query: StoreQuery<S, K>): void {
    this.store.delete(query)
  }

  deleteMany(queries: StoreQuery<S, K>[]): void {
    for (const query of queries) {
      this.store.delete(query)
    }
  }

  get(query: StoreQuery<S, K>): Promise<StoreValue<S, K> | undefined> {
    return requestToPromise<StoreValue<S, K> | undefined>(this.store.get(query))
  }

  getAll(
    query?: StoreQuery<S, K> | null,
    count?: number,
  ): Promise<StoreValue<S, K>[]> {
    return requestToPromise<StoreValue<S, K>[]>(this.store.getAll(query, count))
  }

  getAllKeys(
    query?: StoreQuery<S, K> | null,
    count?: number,
  ): Promise<PrimaryKeyOf<S, K>[]> {
    return requestToPromise<PrimaryKeyOf<S, K>[]>(
      this.store.getAllKeys(query, count),
    )
  }

  getKey(query: StoreQuery<S, K>): Promise<PrimaryKeyOf<S, K> | undefined> {
    return requestToPromise<PrimaryKeyOf<S, K> | undefined>(
      this.store.getKey(query),
    )
  }

  put(value: StoreValue<S, K>, key?: PrimaryKeyOf<S, K>): void {
    this.store.put(value, key)
  }

  index<I extends IndexName<S, K>>(indexName: I): NeoIDBIndex<S, K, I> {
    const index = this.store.index(indexName)
    return new NeoIDBIndex<S, K, I>(index)
  }
}
