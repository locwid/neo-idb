import { NeoIDBError } from './error'
import type { NeoIDBIndex } from './idb-index'
import { NeoIDBMigration } from './idb-migration'
import { NeoIDBObject } from './idb-object'
import type { NeoIDBQuery } from './idb-query'

interface IDBOptions {
  name: string
  definition: (v: (version: number) => NeoIDBMigration) => void
}

type TxContext<TStores extends string | readonly string[]> =
  TStores extends string
    ? Record<TStores, NeoIDBObject>
    : Record<TStores[number], NeoIDBObject>

export const neoIDB = (options: IDBOptions) => {
  return new Promise<NeoIDB>((resolve, reject) => {
    if (!window.indexedDB) {
      throw new NeoIDBError(
        "Your browser doesn't support a stable version of IndexedDB. Such and such feature will not be available.",
      )
    }

    let lastVersion = 1
    const migrationsMap = new Map<number, NeoIDBMigration>()
    const handleDefinition = (version: number) => {
      if (lastVersion < version) {
        lastVersion = version
      }
      const migration = new NeoIDBMigration(version)
      migrationsMap.set(version, migration)
      return migration
    }
    options.definition(handleDefinition)

    const request = window.indexedDB.open(options.name, lastVersion)

    request.onerror = (event) => {
      console.error('Error opening IndexedDB:', event)
      reject(new NeoIDBError(event))
    }

    request.onblocked = (event) => {
      console.warn('IndexedDB open request is blocked:', event)
      reject(new NeoIDBError(event))
    }

    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      console.log('IndexedDB opened successfully:', db)
      resolve(new NeoIDB(db))
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      const tx = (event.target as IDBOpenDBRequest).transaction
      if (!tx) {
        reject(
          new NeoIDBError('No transaction available during onupgradeneeded'),
        )
        return
      }
      const oldVersion = event.oldVersion
      const newVersion = event.newVersion || db.version

      console.log(
        `Upgrading database from version ${oldVersion} to ${newVersion}`,
      )

      for (let version = oldVersion + 1; version <= newVersion; version++) {
        const migration = migrationsMap.get(version)
        if (migration) {
          console.log(`Applying migration for version ${version}`)
          // Here you would apply the migration actions to the database
          migration.getActions().forEach((action) => action({ db, tx }))
        } else {
          console.warn(`No migration defined for version ${version}`)
        }
      }
    }
  })
}

class NeoIDB {
  private db: IDBDatabase

  constructor(db: IDBDatabase) {
    this.db = db
  }

  tx<const TStores extends string | readonly string[], TResult>(
    storeNames: TStores,
    mode: IDBTransactionMode,
    callback: (ctx: TxContext<TStores>) => TResult | Promise<TResult>,
  ): Promise<TResult> {
    return this.asyncTx(storeNames, mode, (tx) => {
      const ctx = [storeNames].flat().reduce(
        (acc, storeName) => {
          acc[storeName] = new NeoIDBObject(storeName, tx)
          return acc
        },
        {} as Record<string, NeoIDBObject>,
      ) as TxContext<TStores>
      return callback(ctx)
    })
  }

  add(storeName: string, value: any, key?: IDBValidKey): Promise<void> {
    return this.asyncTx(storeName, 'readwrite', (tx) => {
      const obj = new NeoIDBObject(storeName, tx)
      obj.add(value, key)
    })
  }

  addMany(storeName: string, values: any[]): Promise<void> {
    return this.asyncTx(storeName, 'readwrite', (tx) => {
      const obj = new NeoIDBObject(storeName, tx)
      obj.addMany(values)
    })
  }

  count(storeName: string, query?: NeoIDBQuery): Promise<number> {
    return this.asyncTx(storeName, 'readonly', (tx) => {
      const obj = new NeoIDBObject(storeName, tx)
      return obj.count(query)
    })
  }

  clear(storeName: string): Promise<void> {
    return this.asyncTx(storeName, 'readwrite', (tx) => {
      const obj = new NeoIDBObject(storeName, tx)
      obj.clear()
    })
  }

  delete(storeName: string, query: NeoIDBQuery): Promise<void> {
    return this.asyncTx(storeName, 'readwrite', (tx) => {
      const obj = new NeoIDBObject(storeName, tx)
      obj.delete(query)
    })
  }

  deleteMany(storeName: string, queries: NeoIDBQuery[]): Promise<void> {
    return this.asyncTx(storeName, 'readwrite', (tx) => {
      const obj = new NeoIDBObject(storeName, tx)
      obj.deleteMany(queries)
    })
  }

  get(storeName: string, query: NeoIDBQuery): Promise<any> {
    return this.asyncTx(storeName, 'readonly', (tx) => {
      const obj = new NeoIDBObject(storeName, tx)
      return obj.get(query)
    })
  }

  getAll(
    storeName: string,
    query?: NeoIDBQuery | null,
    count?: number,
  ): Promise<any[]> {
    return this.asyncTx(storeName, 'readonly', (tx) => {
      const obj = new NeoIDBObject(storeName, tx)
      return obj.getAll(query, count)
    })
  }

  getAllKeys(
    storeName: string,
    query?: NeoIDBQuery | null,
    count?: number,
  ): Promise<IDBValidKey[]> {
    return this.asyncTx(storeName, 'readonly', (tx) => {
      const obj = new NeoIDBObject(storeName, tx)
      return obj.getAllKeys(query, count)
    })
  }

  getKey(
    storeName: string,
    query: NeoIDBQuery,
  ): Promise<IDBValidKey | undefined> {
    return this.asyncTx(storeName, 'readonly', (tx) => {
      const obj = new NeoIDBObject(storeName, tx)
      return obj.getKey(query)
    })
  }

  put(storeName: string, value: any, key?: IDBValidKey): Promise<void> {
    return this.asyncTx(storeName, 'readwrite', (tx) => {
      const obj = new NeoIDBObject(storeName, tx)
      obj.put(value, key)
    })
  }

  index<TResult>(
    storeName: string,
    indexName: string,
    callback: (index: NeoIDBIndex) => TResult | Promise<TResult>,
  ) {
    return this.asyncTx<TResult>(storeName, 'readonly', (tx) => {
      const obj = new NeoIDBObject(storeName, tx)
      return callback(obj.index(storeName, indexName))
    })
  }

  private async asyncTx<TResult>(
    storeNames: readonly string[] | string,
    mode: IDBTransactionMode,
    callback: (tx: IDBTransaction) => TResult | Promise<TResult>,
  ): Promise<TResult> {
    const tx = this.db.transaction(storeNames, mode)

    const txCompletion = new Promise<void>((resolve, reject) => {
      tx.oncomplete = (event) => {
        console.log('Transaction completed successfully', event)
        resolve()
      }
      tx.onerror = (event) => {
        reject(new NeoIDBError(event))
      }
      tx.onabort = (event) => {
        reject(new NeoIDBError(event))
      }
    })

    try {
      const result = await Promise.resolve(callback(tx))
      await txCompletion
      return result
    } catch (error) {
      try {
        tx.abort()
      } catch {}
      await txCompletion.catch(() => undefined)
      throw error
    }
  }
}
