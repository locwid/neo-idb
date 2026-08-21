import { NeoIDBError } from './error'
import type {
  LegacyIndexKeyPath,
  LegacyIndexName,
  LegacyStoreKeyPath,
  LegacyStoreName,
  NeoIDBSchema,
} from './idb-types'

type MigrationAction = (ctx: { db: IDBDatabase; tx: IDBTransaction }) => void

export class NeoIDBMigration<S extends NeoIDBSchema = NeoIDBSchema> {
  private version: number
  private actions: Array<MigrationAction> = []
  private stores: Map<string, IDBObjectStore> = new Map()

  constructor(version: number) {
    this.version = version
  }

  getVersion(): number {
    return this.version
  }

  addStore<K extends LegacyStoreName<S>>(
    name: K,
    keyPath?: LegacyStoreKeyPath<S, K>,
  ): NeoIDBMigration<S> {
    this.actions.push(({ db }) => {
      const store = db.createObjectStore(name, {
        keyPath: keyPath as string | string[] | undefined,
      })
      this.stores.set(name, store)
    })
    return this
  }

  deleteStore(name: LegacyStoreName<S>): NeoIDBMigration<S> {
    this.actions.push(({ db }) => {
      db.deleteObjectStore(name)
      this.stores.delete(name)
    })
    return this
  }

  renameStore(
    oldName: LegacyStoreName<S>,
    newName: LegacyStoreName<S>,
  ): NeoIDBMigration<S> {
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

  addIndex<K extends LegacyStoreName<S>, I extends LegacyIndexName<S, K>>(
    storeName: K,
    indexName: I,
    keyPath: LegacyIndexKeyPath<S, K, I>,
    unique = false,
    multiEntry = false,
  ): NeoIDBMigration<S> {
    this.actions.push(({ tx }) => {
      const store = tx.objectStore(storeName) || this.stores.get(storeName)
      if (!store) {
        throw new Error(
          `Store ${storeName} does not exist. Cannot add index ${indexName}.`,
        )
      }
      store.createIndex(indexName, keyPath, { unique, multiEntry })
    })
    return this
  }

  deleteIndex<K extends LegacyStoreName<S>, I extends LegacyIndexName<S, K>>(
    storeName: K,
    indexName: I,
  ): NeoIDBMigration<S> {
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

export class NeoMigrator<S extends NeoIDBSchema> {
  lastVersion = 1
  map = new Map<number, NeoIDBMigration<S>>()

  constructor(
    definition: (v: (version: number) => NeoIDBMigration<S>) => void,
  ) {
    definition((version) => {
      if (this.lastVersion < version) {
        this.lastVersion = version
      }
      const migration = new NeoIDBMigration<S>(version)
      this.map.set(version, migration)
      return migration
    })
  }

  migrate(event: IDBVersionChangeEvent) {
    const db = (event.target as IDBOpenDBRequest).result
    const tx = (event.target as IDBOpenDBRequest).transaction
    if (!tx) {
      return new NeoIDBError('No transaction available during onupgradeneeded')
    }
    const oldVersion = event.oldVersion
    const newVersion = event.newVersion || db.version

    for (let version = oldVersion + 1; version <= newVersion; version++) {
      const migration = this.map.get(version)
      if (migration) {
        migration.getActions().forEach((action) => action({ db, tx }))
      } else {
        console.warn(`No migration defined for version ${version}`)
      }
    }
  }
}
