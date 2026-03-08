import type { IDBQuery } from './idb-query'

export class IDBObject {
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

  count(query?: IDBQuery): Promise<number> {
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

  delete(query: IDBQuery): void {
    const store = this.tx.objectStore(this.storeName)
    store.delete(query)
  }

  deleteMany(queries: IDBQuery[]): void {
    const store = this.tx.objectStore(this.storeName)
    for (const query of queries) {
      store.delete(query)
    }
  }

  get(query: IDBQuery): Promise<any> {
    return new Promise((resolve) => {
      const store = this.tx.objectStore(this.storeName)
      const request = store.get(query)
      request.onsuccess = () => {
        resolve(request.result)
      }
    })
  }

  getAll(query?: IDBQuery | null, count?: number): Promise<any[]> {
    return new Promise((resolve) => {
      const store = this.tx.objectStore(this.storeName)
      const request = store.getAll(query, count)
      request.onsuccess = () => {
        resolve(request.result)
      }
    })
  }

  getAllKeys(query?: IDBQuery | null, count?: number): Promise<IDBValidKey[]> {
    return new Promise((resolve) => {
      const store = this.tx.objectStore(this.storeName)
      const request = store.getAllKeys(query, count)
      request.onsuccess = () => {
        resolve(request.result)
      }
    })
  }

  getKey(query: IDBQuery): Promise<IDBValidKey | undefined> {
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
}
