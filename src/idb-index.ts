import type {
  IndexKeyOf,
  IndexName,
  IndexQuery,
  NeoIDBSchema,
  StoreName,
  StoreValue,
} from './idb-types'

export class NeoIDBIndex<
  S extends NeoIDBSchema = NeoIDBSchema,
  K extends StoreName<S> = StoreName<S>,
  I extends IndexName<S, K> = IndexName<S, K>,
> {
  private index: IDBIndex

  constructor(index: IDBIndex) {
    this.index = index
  }

  count(query?: IndexQuery<S, K, I>): Promise<number> {
    return new Promise((resolve) => {
      const request = this.index.count(query)
      request.onsuccess = () => resolve(request.result)
    })
  }

  get(query: IndexQuery<S, K, I>): Promise<StoreValue<S, K> | undefined> {
    return new Promise((resolve) => {
      const request = this.index.get(query)
      request.onsuccess = () => resolve(request.result)
    })
  }

  getAll(
    query?: IndexQuery<S, K, I> | null,
    count?: number,
  ): Promise<StoreValue<S, K>[]> {
    return new Promise((resolve) => {
      const request = this.index.getAll(query, count)
      request.onsuccess = () => resolve(request.result)
    })
  }

  getAllKeys(
    query?: IndexQuery<S, K, I> | null,
    count?: number,
  ): Promise<IndexKeyOf<S, K, I>[]> {
    return new Promise((resolve) => {
      const request = this.index.getAllKeys(query, count)
      request.onsuccess = () => resolve(request.result as IndexKeyOf<S, K, I>[])
    })
  }

  getKey(query: IndexQuery<S, K, I>): Promise<IndexKeyOf<S, K, I> | undefined> {
    return new Promise((resolve) => {
      const request = this.index.getKey(query)
      request.onsuccess = () =>
        resolve(request.result as IndexKeyOf<S, K, I> | undefined)
    })
  }
}
