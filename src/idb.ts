import { NeoIDBError } from './error'
import type { NeoIDBIndex } from './idb-index'
import { NeoIDBMigration } from './idb-migration'
import { NeoIDBObject } from './idb-object'
import type {
  IndexName,
  NeoIDBSchema,
  PrimaryKeyOf,
  StoreName,
  StoreQuery,
  StoreValue,
} from './idb-types'

interface IDBOptions<S extends NeoIDBSchema> {
  name: string
  definition: (v: (version: number) => NeoIDBMigration<S>) => void
}

type TxStoresArg<S extends NeoIDBSchema> =
  | StoreName<S>
  | readonly StoreName<S>[]

export type TxContext<S extends NeoIDBSchema, TStores extends TxStoresArg<S>> =
  TStores extends StoreName<S>
    ? Record<TStores, NeoIDBObject<S, TStores>>
    : TStores extends readonly StoreName<S>[]
      ? { [K in TStores[number]]: NeoIDBObject<S, K> }
      : never

export const neoIDB = <S extends NeoIDBSchema>(options: IDBOptions<S>) => {
  return new Promise<NeoIDB<S>>((resolve, reject) => {
    if (!window.indexedDB) {
      throw new NeoIDBError(
        "Your browser doesn't support a stable version of IndexedDB. Such and such feature will not be available.",
      )
    }

    let lastVersion = 1
    const migrationsMap = new Map<number, NeoIDBMigration<S>>()
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
      resolve(new NeoIDB<S>(db))
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

export class NeoIDB<S extends NeoIDBSchema> {
  private db: IDBDatabase

  constructor(db: IDBDatabase) {
    this.db = db
  }

  tx<const TStores extends TxStoresArg<S>, TResult>(
    storeNames: TStores,
    mode: IDBTransactionMode,
    callback: (ctx: TxContext<S, TStores>) => TResult | Promise<TResult>,
  ): Promise<TResult> {
    return this.asyncTx(storeNames, mode, (tx) => {
      const names = [storeNames].flat() as StoreName<S>[]
      const ctx: Record<string, NeoIDBObject<S, StoreName<S>>> = {}
      for (const storeName of names) {
        ctx[storeName] = new NeoIDBObject<S, StoreName<S>>(storeName, tx)
      }
      return callback(ctx as TxContext<S, TStores>)
    })
  }

  add<K extends StoreName<S>>(
    storeName: K,
    value: StoreValue<S, K>,
    key?: PrimaryKeyOf<S, K>,
  ): Promise<void> {
    return this.asyncTx(storeName, 'readwrite', (tx) => {
      const obj = new NeoIDBObject<S, K>(storeName, tx)
      obj.add(value, key)
    })
  }

  addMany<K extends StoreName<S>>(
    storeName: K,
    values: StoreValue<S, K>[],
  ): Promise<void> {
    return this.asyncTx(storeName, 'readwrite', (tx) => {
      const obj = new NeoIDBObject<S, K>(storeName, tx)
      obj.addMany(values)
    })
  }

  count<K extends StoreName<S>>(
    storeName: K,
    query?: StoreQuery<S, K>,
  ): Promise<number> {
    return this.asyncTx(storeName, 'readonly', (tx) => {
      const obj = new NeoIDBObject<S, K>(storeName, tx)
      return obj.count(query)
    })
  }

  clear<K extends StoreName<S>>(storeName: K): Promise<void> {
    return this.asyncTx(storeName, 'readwrite', (tx) => {
      const obj = new NeoIDBObject<S, K>(storeName, tx)
      obj.clear()
    })
  }

  delete<K extends StoreName<S>>(
    storeName: K,
    query: StoreQuery<S, K>,
  ): Promise<void> {
    return this.asyncTx(storeName, 'readwrite', (tx) => {
      const obj = new NeoIDBObject<S, K>(storeName, tx)
      obj.delete(query)
    })
  }

  deleteMany<K extends StoreName<S>>(
    storeName: K,
    queries: StoreQuery<S, K>[],
  ): Promise<void> {
    return this.asyncTx(storeName, 'readwrite', (tx) => {
      const obj = new NeoIDBObject<S, K>(storeName, tx)
      obj.deleteMany(queries)
    })
  }

  get<K extends StoreName<S>>(
    storeName: K,
    query: StoreQuery<S, K>,
  ): Promise<StoreValue<S, K> | undefined> {
    return this.asyncTx(storeName, 'readonly', (tx) => {
      const obj = new NeoIDBObject<S, K>(storeName, tx)
      return obj.get(query)
    })
  }

  getAll<K extends StoreName<S>>(
    storeName: K,
    query?: StoreQuery<S, K> | null,
    count?: number,
  ): Promise<StoreValue<S, K>[]> {
    return this.asyncTx(storeName, 'readonly', (tx) => {
      const obj = new NeoIDBObject<S, K>(storeName, tx)
      return obj.getAll(query, count)
    })
  }

  getAllKeys<K extends StoreName<S>>(
    storeName: K,
    query?: StoreQuery<S, K> | null,
    count?: number,
  ): Promise<PrimaryKeyOf<S, K>[]> {
    return this.asyncTx(storeName, 'readonly', (tx) => {
      const obj = new NeoIDBObject<S, K>(storeName, tx)
      return obj.getAllKeys(query, count)
    })
  }

  getKey<K extends StoreName<S>>(
    storeName: K,
    query: StoreQuery<S, K>,
  ): Promise<PrimaryKeyOf<S, K> | undefined> {
    return this.asyncTx(storeName, 'readonly', (tx) => {
      const obj = new NeoIDBObject<S, K>(storeName, tx)
      return obj.getKey(query)
    })
  }

  put<K extends StoreName<S>>(
    storeName: K,
    value: StoreValue<S, K>,
    key?: PrimaryKeyOf<S, K>,
  ): Promise<void> {
    return this.asyncTx(storeName, 'readwrite', (tx) => {
      const obj = new NeoIDBObject<S, K>(storeName, tx)
      obj.put(value, key)
    })
  }

  index<K extends StoreName<S>, I extends IndexName<S, K>, TResult>(
    storeName: K,
    indexName: I,
    callback: (index: NeoIDBIndex<S, K, I>) => TResult | Promise<TResult>,
  ): Promise<TResult> {
    return this.asyncTx<TResult>(storeName, 'readonly', (tx) => {
      const obj = new NeoIDBObject<S, K>(storeName, tx)
      return callback(obj.index(indexName))
    })
  }

  private async asyncTx<TResult>(
    storeNames: TxStoresArg<S>,
    mode: IDBTransactionMode,
    callback: (tx: IDBTransaction) => TResult | Promise<TResult>,
  ): Promise<TResult> {
    const tx = this.db.transaction(storeNames, mode)

    const txCompletion = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => {
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
