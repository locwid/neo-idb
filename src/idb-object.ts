import { NeoIDBIndex } from './idb-index'
import type {
  IndexName,
  NeoIDBSchema,
  PrimaryKeyOf,
  StoreName,
  StoreQuery,
  StoreValue,
} from './idb-types'

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

  add(value: StoreValue<S, K>, key?: PrimaryKeyOf<S, K>): void {
    const store = this.tx.objectStore(this.storeName)
    store.add(value, key)
  }

  addMany(values: StoreValue<S, K>[]): void {
    const store = this.tx.objectStore(this.storeName)
    for (const value of values) {
      store.add(value)
    }
  }

  count(query?: StoreQuery<S, K>): Promise<number> {
    return new Promise((resolve) => {
      const store = this.tx.objectStore(this.storeName)
      const request = store.count(query)
      request.onsuccess = () => {
        resolve(request.result)
      }
    })
  }

  clear(): void {
    const store = this.tx.objectStore(this.storeName)
    store.clear()
  }

  delete(query: StoreQuery<S, K>): void {
    const store = this.tx.objectStore(this.storeName)
    store.delete(query)
  }

  deleteMany(queries: StoreQuery<S, K>[]): void {
    const store = this.tx.objectStore(this.storeName)
    for (const query of queries) {
      store.delete(query)
    }
  }

  get(query: StoreQuery<S, K>): Promise<StoreValue<S, K> | undefined> {
    return new Promise((resolve) => {
      const store = this.tx.objectStore(this.storeName)
      const request = store.get(query)
      request.onsuccess = () => {
        resolve(request.result)
      }
    })
  }

  getAll(
    query?: StoreQuery<S, K> | null,
    count?: number,
  ): Promise<StoreValue<S, K>[]> {
    return new Promise((resolve) => {
      const store = this.tx.objectStore(this.storeName)
      const request = store.getAll(query, count)
      request.onsuccess = () => {
        resolve(request.result)
      }
    })
  }

  getAllKeys(
    query?: StoreQuery<S, K> | null,
    count?: number,
  ): Promise<PrimaryKeyOf<S, K>[]> {
    return new Promise((resolve) => {
      const store = this.tx.objectStore(this.storeName)
      const request = store.getAllKeys(query, count)
      request.onsuccess = () => {
        resolve(request.result as PrimaryKeyOf<S, K>[])
      }
    })
  }

  getKey(query: StoreQuery<S, K>): Promise<PrimaryKeyOf<S, K> | undefined> {
    return new Promise((resolve) => {
      const store = this.tx.objectStore(this.storeName)
      const request = store.getKey(query)
      request.onsuccess = () => {
        resolve(request.result as PrimaryKeyOf<S, K> | undefined)
      }
    })
  }

  put(value: StoreValue<S, K>, key?: PrimaryKeyOf<S, K>): void {
    const store = this.tx.objectStore(this.storeName)
    store.put(value, key)
  }

  index<I extends IndexName<S, K>>(indexName: I): NeoIDBIndex<S, K, I> {
    const store = this.tx.objectStore(this.storeName)
    const index = store.index(indexName)
    return new NeoIDBIndex<S, K, I>(index)
  }
}
