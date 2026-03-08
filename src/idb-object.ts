import { NeoIDBIndex } from './idb-index'
import type { NeoIDBQuery } from './idb-query'

export class NeoIDBObject {
  private storeName: string
  private tx: IDBTransaction

  constructor(storeName: string, tx: IDBTransaction) {
    this.storeName = storeName
    this.tx = tx
  }

  add(value: any, key?: IDBValidKey): void {
    const store = this.tx.objectStore(this.storeName)
    store.add(value, key)
  }

  addMany(values: any[]): void {
    const store = this.tx.objectStore(this.storeName)
    for (const value of values) {
      store.add(value)
    }
  }

  count(query?: NeoIDBQuery): Promise<number> {
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

  delete(query: NeoIDBQuery): void {
    const store = this.tx.objectStore(this.storeName)
    store.delete(query)
  }

  deleteMany(queries: NeoIDBQuery[]): void {
    const store = this.tx.objectStore(this.storeName)
    for (const query of queries) {
      store.delete(query)
    }
  }

  get(query: NeoIDBQuery): Promise<any> {
    return new Promise((resolve) => {
      const store = this.tx.objectStore(this.storeName)
      const request = store.get(query)
      request.onsuccess = () => {
        resolve(request.result)
      }
    })
  }

  getAll(query?: NeoIDBQuery | null, count?: number): Promise<any[]> {
    return new Promise((resolve) => {
      const store = this.tx.objectStore(this.storeName)
      const request = store.getAll(query, count)
      request.onsuccess = () => {
        resolve(request.result)
      }
    })
  }

  getAllKeys(
    query?: NeoIDBQuery | null,
    count?: number,
  ): Promise<IDBValidKey[]> {
    return new Promise((resolve) => {
      const store = this.tx.objectStore(this.storeName)
      const request = store.getAllKeys(query, count)
      request.onsuccess = () => {
        resolve(request.result)
      }
    })
  }

  getKey(query: NeoIDBQuery): Promise<IDBValidKey | undefined> {
    return new Promise((resolve) => {
      const store = this.tx.objectStore(this.storeName)
      const request = store.getKey(query)
      request.onsuccess = () => {
        resolve(request.result)
      }
    })
  }

  put(value: any, key?: IDBValidKey): void {
    const store = this.tx.objectStore(this.storeName)
    store.put(value, key)
  }

  index(storeName: string, indexName: string) {
    const store = this.tx.objectStore(storeName)
    const index = store.index(indexName)
    return new NeoIDBIndex(index)
  }
}
