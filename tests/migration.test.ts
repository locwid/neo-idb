import { describe, expect, it } from 'vitest'

import { NeoIDBMigration } from '@/idb-migration'
import { trackDatabaseName } from './setup'

type TestSchema = {
  stores: {
    pets: {
      keyPath: 'id'
      value: {
        id: number
        name: string
        type?: 'cat' | 'dog'
        tags?: string[]
      }
      indexes: {
        byType: { keyPath: 'type' }
        byTags: { keyPath: 'tags' }
      }
    }
    owners: {
      keyPath: 'id'
      value: { id: number; name: string }
      indexes: {}
    }
  }
}

const createDbName = (prefix: string) =>
  trackDatabaseName(`${prefix}-${Date.now()}-${Math.random()}`)

const openAndUpgrade = (
  name: string,
  version: number,
  onUpgrade?: (db: IDBDatabase, tx: IDBTransaction) => void,
): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version)

    request.onupgradeneeded = (event) => {
      if (!onUpgrade) {
        return
      }
      const db = (event.target as IDBOpenDBRequest).result
      const tx = (event.target as IDBOpenDBRequest).transaction
      if (!tx) {
        reject(new Error('Missing upgrade transaction'))
        return
      }
      onUpgrade(db, tx)
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

const requestToPromise = <T>(request: IDBRequest<T>): Promise<T> => {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

describe('NeoIDBMigration', () => {
  it('tracks version and exposes queued actions', () => {
    const migration = new NeoIDBMigration<TestSchema>(3)
      .addStore('pets', 'id')
      .addIndex('pets', 'byType', 'type')
      .deleteIndex('pets', 'byType')

    expect(migration.getVersion()).toBe(3)
    expect(migration.getActions()).toHaveLength(3)
  })

  it('applies add/delete store and index actions during upgrade', async () => {
    const name = createDbName('neo-idb-migration-actions')

    const dbV1 = await openAndUpgrade(name, 1, (db) => {
      db.createObjectStore('pets', { keyPath: 'id' })
    })
    dbV1.close()

    const dbV2 = await openAndUpgrade(name, 2, (db, tx) => {
      const migration = new NeoIDBMigration<TestSchema>(2)
        .addIndex('pets', 'byType', 'type')
        .addStore('owners', 'id')
      migration.getActions().forEach((action) => action({ db, tx }))
    })

    expect(Array.from(dbV2.objectStoreNames)).toContain('owners')

    const checkIndexTx = dbV2.transaction('pets', 'readonly')
    const indexNames = Array.from(checkIndexTx.objectStore('pets').indexNames)
    expect(indexNames).toContain('byType')

    dbV2.close()

    const dbV3 = await openAndUpgrade(name, 3, (db, tx) => {
      const migration = new NeoIDBMigration<TestSchema>(3)
        .deleteIndex('pets', 'byType')
        .deleteStore('owners')
      migration.getActions().forEach((action) => action({ db, tx }))
    })

    expect(Array.from(dbV3.objectStoreNames)).not.toContain('owners')
    const tx = dbV3.transaction('pets', 'readonly')
    expect(Array.from(tx.objectStore('pets').indexNames)).not.toContain(
      'byType',
    )
  })

  it('renames store during upgrade', async () => {
    const name = createDbName('neo-idb-migration-rename')

    const dbV1 = await openAndUpgrade(name, 1, (db) => {
      db.createObjectStore('pets', { keyPath: 'id' })
    })
    dbV1.close()

    const dbV2 = await openAndUpgrade(name, 2, (db, tx) => {
      const migration = new NeoIDBMigration<TestSchema>(2).renameStore(
        'pets',
        'animals',
      )
      migration.getActions().forEach((action) => action({ db, tx }))
    })

    const stores = Array.from(dbV2.objectStoreNames)
    expect(stores).toContain('animals')
    expect(stores).not.toContain('pets')
  })

  it('creates multiEntry indexes when requested', async () => {
    const name = createDbName('neo-idb-migration-multi-entry')

    const dbV1 = await openAndUpgrade(name, 1, (db) => {
      db.createObjectStore('pets', { keyPath: 'id' })
    })
    dbV1.close()

    const dbV2 = await openAndUpgrade(name, 2, (db, tx) => {
      const migration = new NeoIDBMigration<TestSchema>(2).addIndex(
        'pets',
        'byTags',
        'tags',
        false,
        true,
      )
      migration.getActions().forEach((action) => action({ db, tx }))
    })

    const tx = dbV2.transaction('pets', 'readonly')
    const index = tx.objectStore('pets').index('byTags')

    expect(index.multiEntry).toBe(true)
  })

  it('indexes array items with multiEntry indexes', async () => {
    const name = createDbName('neo-idb-migration-multi-entry-query')

    const dbV1 = await openAndUpgrade(name, 1, (db) => {
      db.createObjectStore('pets', { keyPath: 'id' })
    })
    dbV1.close()

    const dbV2 = await openAndUpgrade(name, 2, (db, tx) => {
      const migration = new NeoIDBMigration<TestSchema>(2).addIndex(
        'pets',
        'byTags',
        'tags',
        false,
        true,
      )
      migration.getActions().forEach((action) => action({ db, tx }))
    })

    const seedTx = dbV2.transaction('pets', 'readwrite')
    const store = seedTx.objectStore('pets')
    store.add({ id: 1, name: 'Milo', tags: ['indoor', 'playful'] })
    store.add({ id: 2, name: 'Rex', tags: ['active'] })
    store.add({ id: 3, name: 'Luna', tags: ['indoor', 'calm'] })

    await new Promise<void>((resolve, reject) => {
      seedTx.oncomplete = () => resolve()
      seedTx.onerror = () => reject(seedTx.error)
      seedTx.onabort = () => reject(seedTx.error)
    })

    const checkTx = dbV2.transaction('pets', 'readonly')
    const index = checkTx.objectStore('pets').index('byTags')

    expect(await requestToPromise(index.count('indoor'))).toBe(2)
    expect(await requestToPromise(index.getAllKeys('indoor'))).toEqual([1, 3])
    expect(await requestToPromise(index.get('active'))).toEqual({
      id: 2,
      name: 'Rex',
      tags: ['active'],
    })
  })
})
