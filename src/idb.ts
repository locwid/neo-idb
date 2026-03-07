import { IDBMigration } from './idb-migration'

interface IDBOptions {
  name: string
  definition: (v: (version: number) => IDBMigration) => void
}

class IDB {
  private _db: IDBDatabase | null = null

  constructor(options: IDBOptions) {
    if (!window.indexedDB) {
      throw new Error(
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
    }

    request.onblocked = (event) => {
      console.warn('IndexedDB open request is blocked:', event)
    }

    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      console.log('IndexedDB opened successfully:', db)
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      const tx = (event.target as IDBOpenDBRequest).transaction
      if (!tx) {
        console.error('No transaction available during onupgradeneeded')
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
  }

  private get db(): IDBDatabase {
    if (!this._db) {
      throw new Error('Database is not initialized yet')
    }
    return this._db
  }

  transaction(
    storeNames: string | string[],
    mode: IDBTransactionMode = 'readonly',
    cb: (tx: IDBTransaction) => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {})
  }

  add(storeName: string, value: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite')
      const store = tx.objectStore(storeName)
      const request = store.add(value)

      request.onsuccess = () => {
        console.log(`Value added to ${storeName} store successfully`)
        resolve()
      }

      request.onerror = (event) => {
        console.error(`Error adding value to ${storeName} store:`, event)
        reject(event)
      }
    })
  }

  addMany(storeName: string, values: any[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite')
      const store = tx.objectStore(storeName)

      let completed = 0
      values.forEach((value) => {
        const request = store.add(value)

        request.onsuccess = () => {
          completed++
          if (completed === values.length) {
            console.log(`All values added to ${storeName} store successfully`)
            resolve()
          }
        }

        request.onerror = (event) => {
          console.error(`Error adding value to ${storeName} store:`, event)
          reject(event)
        }
      })
    })
  }
}

export { IDB }
