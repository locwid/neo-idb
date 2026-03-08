import { describe, expect, it } from 'vitest'

import { NeoIDBError } from '@/error'
import { neoIDB } from '@/idb'
import { trackDatabaseName } from './setup'

const createDbName = (prefix: string) =>
  trackDatabaseName(`${prefix}-${Date.now()}-${Math.random()}`)

describe('error handling', () => {
  it('creates NeoIDBError from string message', () => {
    const error = new NeoIDBError('custom message')
    expect(error.message).toBe('custom message')
  })

  it('creates NeoIDBError from event error message', () => {
    const event = {
      target: {
        error: { message: 'indexeddb failed' },
      },
    } as unknown as Event

    const error = new NeoIDBError(event)
    expect(error.message).toBe('indexeddb failed')
  })

  it('uses fallback message when event has no error payload', () => {
    const event = {
      target: {},
    } as unknown as Event

    const error = new NeoIDBError(event)
    expect(error.message).toBe('Unknown IndexedDB error')
  })

  it('rejects when indexedDB is not available on window', async () => {
    const currentIndexedDB = window.indexedDB
    try {
      Object.defineProperty(window, 'indexedDB', {
        configurable: true,
        value: undefined,
      })

      await expect(
        neoIDB({
          name: createDbName('neo-idb-no-indexeddb'),
          definition: (v) => {
            v(1).addStore('pets', 'id')
          },
        }),
      ).rejects.toBeInstanceOf(NeoIDBError)
    } finally {
      Object.defineProperty(window, 'indexedDB', {
        configurable: true,
        value: currentIndexedDB,
      })
    }
  })

  it('rejects tx for unknown object store', async () => {
    const db = await neoIDB({
      name: createDbName('neo-idb-tx-error'),
      definition: (v) => {
        v(1).addStore('pets', 'id')
      },
    })

    await expect(db.count('missing-store')).rejects.toBeInstanceOf(Error)
  })
})
