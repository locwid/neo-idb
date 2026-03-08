import { NeoIDBError } from './error'
import { IDBMigration } from './idb-migration'
import { IDBObject } from './idb-object'

interface IDBOptions {
  name: string
  definition: (v: (version: number) => IDBMigration) => void
}

type TxContext<TStores extends string | readonly string[]> =
  TStores extends string
    ? Record<TStores, IDBObject>
    : Record<TStores[number], IDBObject>

export const neoIDB = (options: IDBOptions) => {
  return new Promise<IDB>((resolve, reject) => {
    if (!window.indexedDB) {
      throw new NeoIDBError(
        "Your browser doesn't support a stable version of IndexedDB. Such and such feature will not be available.",
      )
    }

    let lastVersion = 1
    const migrationsMap = new Map<number, IDBMigration>()
    const handleDefinition = (version: number) => {
      if (lastVersion < version) {
        lastVersion = version
      }
      const migration = new IDBMigration(version)
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
      resolve(new IDB(db))
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

class IDB {
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
          acc[storeName] = new IDBObject(storeName, tx)
          return acc
        },
        {} as Record<string, IDBObject>,
      ) as TxContext<TStores>
      return callback(ctx)
    })
  }

  add(storeName: string, value: any, key?: IDBValidKey): Promise<void> {
    return this.asyncTx(storeName, 'readwrite', (tx) => {
      const obj = new IDBObject(storeName, tx)
      obj.add(value, key)
    })
  }

  addMany(storeName: string, values: any[]): Promise<void> {
    return this.asyncTx(storeName, 'readwrite', (tx) => {
      const obj = new IDBObject(storeName, tx)
      obj.addMany(values)
    })
  }

  count(storeName: string): Promise<number> {
    return this.asyncTx(storeName, 'readonly', (tx) => {
      const obj = new IDBObject(storeName, tx)
      return obj.count()
    })
  }

  private asyncTx<TResult>(
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

    return Promise.resolve(callback(tx))
      .then(async (result) => {
        await txCompletion
        return result
      })
      .catch(async (error) => {
        try {
          tx.abort()
        } catch {}
        await txCompletion.catch(() => undefined)
        throw error
      })
  }
}
