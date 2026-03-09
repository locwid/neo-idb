export type NeoIDBKeyPath = string | readonly string[]

export interface NeoIDBStoreSchema {
  keyPath: NeoIDBKeyPath
  value: unknown
  indexes?: Record<string, NeoIDBIndexSchema>
}

export interface NeoIDBIndexSchema {
  keyPath: NeoIDBKeyPath
  unique?: boolean
}

export interface NeoIDBSchema {
  stores: Record<string, NeoIDBStoreSchema>
}

export type StoreName<S extends NeoIDBSchema> = keyof S['stores'] & string

export type StoreDef<
  S extends NeoIDBSchema,
  K extends StoreName<S>,
> = S['stores'][K]

export type StoreValue<
  S extends NeoIDBSchema,
  K extends StoreName<S>,
> = StoreDef<S, K>['value']

export type StoreKeyPath<
  S extends NeoIDBSchema,
  K extends StoreName<S>,
> = StoreDef<S, K>['keyPath']

export type IndexDef<
  S extends NeoIDBSchema,
  K extends StoreName<S>,
  I extends IndexName<S, K>,
> = NonNullable<StoreDef<S, K>['indexes']>[I]

export type IndexName<
  S extends NeoIDBSchema,
  K extends StoreName<S>,
> = keyof NonNullable<StoreDef<S, K>['indexes']> & string

type PathValue<T, P extends string> = P extends `${infer Head}.${infer Rest}`
  ? Head extends keyof T
    ? PathValue<T[Head], Rest>
    : never
  : P extends keyof T
    ? T[P]
    : never

type TuplePathValue<T, P extends readonly string[]> = {
  [I in keyof P]: P[I] extends string ? PathValue<T, P[I]> : never
}

export type KeyPathValue<T, KP extends NeoIDBKeyPath> = KP extends string
  ? PathValue<T, KP>
  : KP extends readonly string[]
    ? TuplePathValue<T, KP>
    : never

type FallbackKey<T> = [Extract<T, IDBValidKey>] extends [never]
  ? IDBValidKey
  : Extract<T, IDBValidKey>

export type PrimaryKeyOf<
  S extends NeoIDBSchema,
  K extends StoreName<S>,
> = FallbackKey<KeyPathValue<StoreValue<S, K>, StoreKeyPath<S, K>>>

export type IndexKeyOf<
  S extends NeoIDBSchema,
  K extends StoreName<S>,
  I extends IndexName<S, K>,
> = FallbackKey<KeyPathValue<StoreValue<S, K>, IndexDef<S, K, I>['keyPath']>>

export type StoreQuery<S extends NeoIDBSchema, K extends StoreName<S>> =
  | PrimaryKeyOf<S, K>
  | IDBKeyRange

export type IndexQuery<
  S extends NeoIDBSchema,
  K extends StoreName<S>,
  I extends IndexName<S, K>,
> = IndexKeyOf<S, K, I> | IDBKeyRange

export type LegacyStoreName<S extends NeoIDBSchema> =
  | StoreName<S>
  | (string & {})

export type LegacyIndexName<S extends NeoIDBSchema, K extends StoreName<S>> =
  | IndexName<S, K>
  | (string & {})
