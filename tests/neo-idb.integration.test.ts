import { describe, expect, it, vi } from 'vitest'

import { neoIDB } from '@/index'
import { trackDatabaseName } from './setup'

type TestSchema = {
  stores: {
    pets: {
      keyPath: 'id'
      value: { id: number; name: string; type?: 'cat' | 'dog' }
      indexes: {
        byType: { keyPath: 'type' }
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

describe('neoIDB integration', () => {
  it('supports CRUD operations through the public API', async () => {
    const db = await neoIDB<TestSchema>({
      name: createDbName('neo-idb-crud'),
      definition: (v) => {
        v(1).addStore('pets', 'id').addIndex('pets', 'byType', 'type')
      },
    })

    await db.add('pets', { id: 1, name: 'Milo', type: 'cat' })
    await db.addMany('pets', [
      { id: 2, name: 'Rex', type: 'dog' },
      { id: 3, name: 'Luna', type: 'cat' },
    ])

    expect(await db.count('pets')).toBe(3)
    expect(await db.get('pets', 1)).toEqual({
      id: 1,
      name: 'Milo',
      type: 'cat',
    })
    expect(await db.getAllKeys('pets')).toEqual([1, 2, 3])

    await db.put('pets', { id: 1, name: 'Milo Updated', type: 'cat' })
    expect(await db.get('pets', 1)).toEqual({
      id: 1,
      name: 'Milo Updated',
      type: 'cat',
    })

    await db.delete('pets', 2)
    expect(await db.count('pets')).toBe(2)

    const cats = await db.index('pets', 'byType', async (index) => {
      return index.getAll('cat')
    })

    expect(cats).toHaveLength(2)
  })

  it('supports tx helper for multiple stores', async () => {
    const db = await neoIDB<TestSchema>({
      name: createDbName('neo-idb-tx'),
      definition: (v) => {
        v(1).addStore('pets', 'id').addStore('owners', 'id')
      },
    })

    await db.tx(
      ['pets', 'owners'] as const,
      'readwrite',
      ({ pets, owners }) => {
        pets.add({ id: 1, name: 'Milo' })
        owners.add({ id: 1, name: 'Alex' })
      },
    )

    const [petsCount, ownersCount] = await Promise.all([
      db.count('pets'),
      db.count('owners'),
    ])

    expect(petsCount).toBe(1)
    expect(ownersCount).toBe(1)
  })

  it('covers read APIs with ranges and limits', async () => {
    const db = await neoIDB<TestSchema>({
      name: createDbName('neo-idb-read-apis'),
      definition: (v) => {
        v(1).addStore('pets', 'id').addIndex('pets', 'byType', 'type')
      },
    })

    await db.addMany('pets', [
      { id: 1, name: 'Milo', type: 'cat' },
      { id: 2, name: 'Rex', type: 'dog' },
      { id: 3, name: 'Luna', type: 'cat' },
      { id: 4, name: 'Rocky', type: 'dog' },
    ])

    expect(await db.get('pets', 999)).toBeUndefined()
    expect(await db.getAll('pets', IDBKeyRange.lowerBound(3))).toEqual([
      { id: 3, name: 'Luna', type: 'cat' },
      { id: 4, name: 'Rocky', type: 'dog' },
    ])
    expect(await db.getAll('pets', null, 2)).toEqual([
      { id: 1, name: 'Milo', type: 'cat' },
      { id: 2, name: 'Rex', type: 'dog' },
    ])
    expect(await db.getAllKeys('pets', IDBKeyRange.bound(2, 4))).toEqual([
      2, 3, 4,
    ])
    expect(await db.getAllKeys('pets', null, 1)).toEqual([1])
    expect(await db.getKey('pets', IDBKeyRange.only(2))).toBe(2)
    expect(await db.count('pets', IDBKeyRange.lowerBound(3))).toBe(2)
  })

  it('covers deleteMany and clear behavior', async () => {
    const db = await neoIDB<TestSchema>({
      name: createDbName('neo-idb-delete-clear'),
      definition: (v) => {
        v(1).addStore('pets', 'id')
      },
    })

    await db.addMany('pets', [
      { id: 1, name: 'Milo' },
      { id: 2, name: 'Rex' },
      { id: 3, name: 'Luna' },
    ])

    await db.deleteMany('pets', [1, 3])
    expect(await db.getAllKeys('pets')).toEqual([2])

    await db.clear('pets')
    expect(await db.count('pets')).toBe(0)
    expect(await db.getAll('pets')).toEqual([])
  })

  it('rejects on duplicate key writes and keeps previous records', async () => {
    const db = await neoIDB<TestSchema>({
      name: createDbName('neo-idb-duplicate-key'),
      definition: (v) => {
        v(1).addStore('pets', 'id')
      },
    })

    await db.add('pets', { id: 1, name: 'Milo' })

    await expect(
      db.add('pets', { id: 1, name: 'Milo Duplicate' }),
    ).rejects.toBeInstanceOf(Error)
    expect(await db.count('pets')).toBe(1)
    expect(await db.get('pets', 1)).toEqual({ id: 1, name: 'Milo' })
  })

  it('aborts tx when callback throws and rolls back writes', async () => {
    const db = await neoIDB<TestSchema>({
      name: createDbName('neo-idb-tx-rollback'),
      definition: (v) => {
        v(1).addStore('pets', 'id')
      },
    })

    await expect(
      db.tx('pets', 'readwrite', ({ pets }) => {
        pets.add({ id: 1, name: 'Milo' })
        throw new Error('forced failure')
      }),
    ).rejects.toThrow('forced failure')

    expect(await db.count('pets')).toBe(0)
  })

  it('returns value from index callback', async () => {
    const db = await neoIDB<TestSchema>({
      name: createDbName('neo-idb-index-callback'),
      definition: (v) => {
        v(1).addStore('pets', 'id').addIndex('pets', 'byType', 'type')
      },
    })

    await db.addMany('pets', [
      { id: 1, name: 'Milo', type: 'cat' },
      { id: 2, name: 'Rex', type: 'dog' },
    ])

    const key = await db.index('pets', 'byType', (index) => index.getKey('dog'))
    expect(key).toBe(2)
  })
})

describe('neoIDB lifecycle', () => {
  it('closes database and rejects further operations', async () => {
    const db = await neoIDB<TestSchema>({
      name: createDbName('neo-idb-close'),
      definition: (v) => {
        v(1).addStore('pets', 'id')
      },
    })

    await db.add('pets', { id: 1, name: 'Milo' })
    db.close()

    await expect(db.count('pets')).rejects.toBeInstanceOf(Error)
  })

  it('allows repeated close calls without throwing', async () => {
    const db = await neoIDB<TestSchema>({
      name: createDbName('neo-idb-close-repeat'),
      definition: (v) => {
        v(1).addStore('pets', 'id')
      },
    })

    expect(() => {
      db.close()
      db.close()
    }).not.toThrow()
  })

  it('registers and executes onDestroy on close event', async () => {
    const onDestroy = vi.fn<(event: Event) => void>()
    const addEventListenerSpy = vi.spyOn(
      IDBDatabase.prototype,
      'addEventListener',
    )

    await neoIDB<TestSchema>({
      name: createDbName('neo-idb-on-destroy'),
      definition: (v) => {
        v(1).addStore('pets', 'id')
      },
      onDestroy,
    })

    expect(addEventListenerSpy).toHaveBeenCalledWith('close', onDestroy)

    const closeRegistration = addEventListenerSpy.mock.calls.find(
      ([eventType]) => eventType === 'close',
    )

    expect(closeRegistration).toBeTruthy()

    const listener = closeRegistration?.[1]
    expect(listener).toBeTruthy()

    if (typeof listener === 'function') {
      listener(new Event('close'))
    } else {
      listener?.handleEvent(new Event('close'))
    }
    expect(onDestroy).toHaveBeenCalled()
    expect(onDestroy).toHaveBeenCalledWith(expect.any(Event))

    addEventListenerSpy.mockRestore()
  })

  it('works without onDestroy callback', async () => {
    const db = await neoIDB<TestSchema>({
      name: createDbName('neo-idb-without-on-destroy'),
      definition: (v) => {
        v(1).addStore('pets', 'id')
      },
    })

    await expect(
      db.add('pets', { id: 1, name: 'Milo' }),
    ).resolves.toBeUndefined()
  })
})
