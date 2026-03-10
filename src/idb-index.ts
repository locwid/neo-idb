import type {
  IndexKeyOf,
  IndexName,
  IndexQuery,
  NeoIDBSchema,
  StoreName,
  StoreValue,
} from './idb-types'
import { requestToPromise } from './utils'

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
    return requestToPromise<number>(this.index.count(query))
  }

  get(query: IndexQuery<S, K, I>): Promise<StoreValue<S, K> | undefined> {
    return requestToPromise<StoreValue<S, K> | undefined>(this.index.get(query))
  }

  getAll(
    query?: IndexQuery<S, K, I> | null,
    count?: number,
  ): Promise<StoreValue<S, K>[]> {
    return requestToPromise<StoreValue<S, K>[]>(this.index.getAll(query, count))
  }

  getAllKeys(
    query?: IndexQuery<S, K, I> | null,
    count?: number,
  ): Promise<IndexKeyOf<S, K, I>[]> {
    return requestToPromise<IndexKeyOf<S, K, I>[]>(
      this.index.getAllKeys(query, count),
    )
  }

  getKey(query: IndexQuery<S, K, I>): Promise<IndexKeyOf<S, K, I> | undefined> {
    return requestToPromise<IndexKeyOf<S, K, I> | undefined>(
      this.index.getKey(query),
    )
  }
}
