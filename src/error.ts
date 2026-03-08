export class NeoIDBError extends Error {
  constructor(arg: string | Event) {
    super(
      typeof arg === 'string'
        ? arg
        : (arg.target as IDBRequest).error?.message ||
            'Unknown IndexedDB error',
    )
  }
}
