import type { NeoIDBQuery } from './idb-query'

export class NeoIDBIndex {
  private index: IDBIndex

  constructor(index: IDBIndex) {
    this.index = index
  }

  count(query?: NeoIDBQuery): Promise<number> {
    return new Promise((resolve) => {
      const request = this.index.count(query)
      request.onsuccess = () => resolve(request.result)
    })
  }

  get(query: NeoIDBQuery) {
    return new Promise((resolve) => {
      const request = this.index.get(query)
      request.onsuccess = () => resolve(request.result)
    })
  }

  getAll(query?: NeoIDBQuery | null, count?: number): Promise<any[]> {
    return new Promise((resolve) => {
      const request = this.index.getAll(query, count)
      request.onsuccess = () => resolve(request.result)
    })
  }

  getAllKeys(query?: NeoIDBQuery | null, count?: number): Promise<any[]> {
    return new Promise((resolve) => {
      const request = this.index.getAllKeys(query, count)
      request.onsuccess = () => resolve(request.result)
    })
  }

  getKey(query: NeoIDBQuery) {
    return new Promise((resolve) => {
      const request = this.index.getKey(query)
      request.onsuccess = () => resolve(request.result)
    })
  }
}
