type MigrationAction = (ctx: { db: IDBDatabase; tx: IDBTransaction }) => void

export class IDBMigration {
  private version: number
  private actions: Array<MigrationAction> = []
  private stores: Map<string, IDBObjectStore> = new Map()

  constructor(version: number) {
    this.version = version
  }

  getVersion(): number {
    return this.version
  }

  addStore(name: string, keyPath?: string | string[]): IDBMigration {
    this.actions.push(({ db }) => {
      const store = db.createObjectStore(name, { keyPath })
      this.stores.set(name, store)
    })
    return this
  }

  deleteStore(name: string): IDBMigration {
    this.actions.push(({ db }) => {
      db.deleteObjectStore(name)
      this.stores.delete(name)
    })
    return this
  }

  renameStore(oldName: string, newName: string): IDBMigration {
    this.actions.push(({ db, tx }) => {
      const oldStore = tx.objectStore(oldName) || this.stores.get(oldName)
      if (!oldStore) {
        throw new Error(
          `Store ${oldName} does not exist. Cannot rename to ${newName}.`,
        )
      }
      const keyPath = oldStore.keyPath
      const indexes = Array.from(oldStore.indexNames).map((indexName) => {
        const index = oldStore.index(indexName)
        return {
          name: indexName,
          keyPath: index.keyPath,
          unique: index.unique,
        }
      })
      const newStore = db.createObjectStore(newName, { keyPath })
      indexes.forEach(({ name, keyPath, unique }) => {
        newStore.createIndex(name, keyPath, { unique })
      })
      oldStore.openCursor().onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          newStore.add(cursor.value)
          cursor.continue()
        } else {
          db.deleteObjectStore(oldName)
        }
      }

      this.stores.set(newName, newStore)
      this.stores.delete(oldName)
    })
    return this
  }

  addIndex(
    storeName: string,
    indexName: string,
    keyPath: string | string[],
    unique = false,
  ): IDBMigration {
    this.actions.push(({ tx }) => {
      const store = tx.objectStore(storeName) || this.stores.get(storeName)
      if (!store) {
        throw new Error(
          `Store ${storeName} does not exist. Cannot add index ${indexName}.`,
        )
      }
      store.createIndex(indexName, keyPath, { unique })
    })
    return this
  }

  deleteIndex(storeName: string, indexName: string): IDBMigration {
    this.actions.push(({ tx }) => {
      const store = tx.objectStore(storeName) || this.stores.get(storeName)
      if (!store) {
        throw new Error(
          `Store ${storeName} does not exist. Cannot delete index ${indexName}.`,
        )
      }
      store.deleteIndex(indexName)
    })
    return this
  }

  getActions(): Array<MigrationAction> {
    return this.actions
  }
}
