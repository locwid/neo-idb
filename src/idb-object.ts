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

  count(): Promise<number> {
    return new Promise((resolve) => {
      const store = this.tx.objectStore(this.storeName)
      const request = store.count()
      request.onsuccess = () => {
        resolve(request.result)
      }
    })
  }
}
