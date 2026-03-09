import { describe, expect, it } from 'vitest'

import { NeoIDBIndex } from '@/idb-index'
import { NeoIDBObject } from '@/idb-object'
import { trackDatabaseName } from './setup'

const createDbName = (prefix: string) =>
  trackDatabaseName(`${prefix}-${Date.now()}-${Math.random()}`)

const openDatabase = (
  name: string,
  version: number,
  onUpgrade: (db: IDBDatabase, tx: IDBTransaction) => void,
): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version)
    request.onupgradeneeded = (event) => {
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

const waitTransaction = (tx: IDBTransaction): Promise<void> => {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

describe('NeoIDBObject and NeoIDBIndex', () => {
  it('reads and writes records via NeoIDBObject', async () => {
    const name = createDbName('neo-idb-object')
    const db = await openDatabase(name, 1, (upgradeDb) => {
      const store = upgradeDb.createObjectStore('pets', { keyPath: 'id' })
      store.createIndex('byType', 'type')
    })

    const writeTx = db.transaction('pets', 'readwrite')
    const writeObj = new NeoIDBObject('pets', writeTx)
    writeObj.add({ id: 1, name: 'Milo', type: 'cat' })
    writeObj.addMany([
      { id: 2, name: 'Rex', type: 'dog' },
      { id: 3, name: 'Luna', type: 'cat' },
    ])
    await waitTransaction(writeTx)

    const readTx = db.transaction('pets', 'readonly')
    const readObj = new NeoIDBObject('pets', readTx)

    expect(await readObj.count()).toBe(3)
    expect(await readObj.get(1)).toEqual({ id: 1, name: 'Milo', type: 'cat' })
    expect(await readObj.getAll()).toHaveLength(3)
    expect(await readObj.getAllKeys()).toEqual([1, 2, 3])
    expect(await readObj.getKey(IDBKeyRange.only(2))).toBe(2)

    const byType = readObj.index('byType')
    expect(await byType.count('cat')).toBe(2)

    await waitTransaction(readTx)

    const updateTx = db.transaction('pets', 'readwrite')
    const updateObj = new NeoIDBObject('pets', updateTx)
    updateObj.put({ id: 1, name: 'Milo Updated', type: 'cat' })
    updateObj.deleteMany([2])
    await waitTransaction(updateTx)

    const finalReadTx = db.transaction('pets', 'readonly')
    const finalObj = new NeoIDBObject('pets', finalReadTx)
    expect(await finalObj.count()).toBe(2)
    expect(await finalObj.get(1)).toEqual({
      id: 1,
      name: 'Milo Updated',
      type: 'cat',
    })
    await waitTransaction(finalReadTx)
  })

  it('queries index records directly via NeoIDBIndex', async () => {
    const name = createDbName('neo-idb-index')
    const db = await openDatabase(name, 1, (upgradeDb) => {
      const store = upgradeDb.createObjectStore('pets', { keyPath: 'id' })
      store.createIndex('byType', 'type')
    })

    const seedTx = db.transaction('pets', 'readwrite')
    const store = seedTx.objectStore('pets')
    store.add({ id: 1, name: 'Milo', type: 'cat' })
    store.add({ id: 2, name: 'Rex', type: 'dog' })
    store.add({ id: 3, name: 'Luna', type: 'cat' })
    await waitTransaction(seedTx)

    const tx = db.transaction('pets', 'readonly')
    const index = new NeoIDBIndex(tx.objectStore('pets').index('byType'))

    expect(await index.get('dog')).toEqual({ id: 2, name: 'Rex', type: 'dog' })
    expect(await index.getAll('cat')).toHaveLength(2)
    expect(await index.getAllKeys('cat')).toEqual([1, 3])
    expect(await index.getKey('dog')).toBe(2)

    await waitTransaction(tx)
  })

  it('handles delete, clear and empty lookups in NeoIDBObject', async () => {
    const name = createDbName('neo-idb-object-edge')
    const db = await openDatabase(name, 1, (upgradeDb) => {
      const store = upgradeDb.createObjectStore('pets', { keyPath: 'id' })
      store.createIndex('byType', 'type')
    })

    const seedTx = db.transaction('pets', 'readwrite')
    const seedObj = new NeoIDBObject('pets', seedTx)
    seedObj.addMany([
      { id: 1, name: 'Milo', type: 'cat' },
      { id: 2, name: 'Rex', type: 'dog' },
      { id: 3, name: 'Luna', type: 'cat' },
    ])
    await waitTransaction(seedTx)

    const deleteTx = db.transaction('pets', 'readwrite')
    const deleteObj = new NeoIDBObject('pets', deleteTx)
    deleteObj.delete(1)
    await waitTransaction(deleteTx)

    const checkTx = db.transaction('pets', 'readonly')
    const checkObj = new NeoIDBObject('pets', checkTx)
    expect(await checkObj.get(1)).toBeUndefined()
    expect(await checkObj.count()).toBe(2)
    await waitTransaction(checkTx)

    const clearTx = db.transaction('pets', 'readwrite')
    const clearObj = new NeoIDBObject('pets', clearTx)
    clearObj.clear()
    await waitTransaction(clearTx)

    const emptyTx = db.transaction('pets', 'readonly')
    const emptyObj = new NeoIDBObject('pets', emptyTx)
    expect(await emptyObj.getAll()).toEqual([])
    expect(await emptyObj.getAllKeys()).toEqual([])
    expect(await emptyObj.get(IDBKeyRange.only(100))).toBeUndefined()
    await waitTransaction(emptyTx)
  })

  it('supports count and list operations with key ranges', async () => {
    const name = createDbName('neo-idb-index-ranges')
    const db = await openDatabase(name, 1, (upgradeDb) => {
      const store = upgradeDb.createObjectStore('pets', { keyPath: 'id' })
      store.createIndex('byType', 'type')
    })

    const seedTx = db.transaction('pets', 'readwrite')
    const store = seedTx.objectStore('pets')
    store.add({ id: 1, name: 'Milo', type: 'cat' })
    store.add({ id: 2, name: 'Rex', type: 'dog' })
    store.add({ id: 3, name: 'Luna', type: 'cat' })
    store.add({ id: 4, name: 'Rocky', type: 'dog' })
    await waitTransaction(seedTx)

    const objTx = db.transaction('pets', 'readonly')
    const obj = new NeoIDBObject('pets', objTx)
    expect(await obj.count(IDBKeyRange.bound(2, 4))).toBe(3)
    expect(await obj.getAll(IDBKeyRange.lowerBound(3))).toEqual([
      { id: 3, name: 'Luna', type: 'cat' },
      { id: 4, name: 'Rocky', type: 'dog' },
    ])
    expect(await obj.getAllKeys(IDBKeyRange.lowerBound(3), 1)).toEqual([3])
    await waitTransaction(objTx)

    const indexTx = db.transaction('pets', 'readonly')
    const index = new NeoIDBIndex(indexTx.objectStore('pets').index('byType'))
    expect(await index.count()).toBe(4)
    expect(await index.count('cat')).toBe(2)
    expect(await index.get('bird')).toBeUndefined()
    expect(await index.getAll('dog', 1)).toEqual([
      { id: 2, name: 'Rex', type: 'dog' },
    ])
    expect(await index.getAllKeys('dog', 1)).toEqual([2])
    expect(await index.getKey('bird')).toBeUndefined()
    await waitTransaction(indexTx)
  })
})
