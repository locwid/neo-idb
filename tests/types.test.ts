import { describe, expectTypeOf, it } from 'vitest'

import { neoIDB } from '@/index'
import type { StoreQuery, StoreValue } from '@/index'
import { trackDatabaseName } from './setup'

type TypesSchema = {
  stores: {
    pets: {
      keyPath: 'id'
      value: { id: number; name: string; type: 'cat' | 'dog' }
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

describe('neoIDB type contracts', () => {
  it('enforces strict runtime API and soft migration naming', async () => {
    const db = await neoIDB<TypesSchema>({
      name: createDbName('neo-idb-types'),
      definition: (v) => {
        v(1)
          .addStore('pets', 'id')
          .addIndex('pets', 'byType', 'type')
          .addStore('owners', 'id')
      },
    })

    const pet = await db.get('pets', 1)
    expectTypeOf(pet).toEqualTypeOf<
      StoreValue<TypesSchema, 'pets'> | undefined
    >()

    const petQuery: StoreQuery<TypesSchema, 'pets'> = IDBKeyRange.lowerBound(1)
    expectTypeOf<StoreQuery<TypesSchema, 'pets'>>().toEqualTypeOf<
      number | IDBKeyRange
    >()
    expectTypeOf(petQuery).toMatchTypeOf<number | IDBKeyRange>()

    if (false) {
      // @ts-expect-error unknown store is not allowed in runtime APIs
      await db.get('legacy_pets', 1)
    }

    await db.index('pets', 'byType', async (index) => {
      const byTypePet = await index.get('cat')
      expectTypeOf(byTypePet).toEqualTypeOf<
        StoreValue<TypesSchema, 'pets'> | undefined
      >()

      if (false) {
        // @ts-expect-error index key for byType is cat | dog
        await index.get(1)
      }

      return byTypePet
    })
  })
})
