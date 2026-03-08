import 'fake-indexeddb/auto'
import { afterEach } from 'vitest'

const globalWithWindow = globalThis as typeof globalThis & {
  window?: typeof globalThis
}

if (!globalWithWindow.window) {
  globalWithWindow.window = globalThis
}

const trackedDatabaseNames = new Set<string>()

export const trackDatabaseName = (name: string) => {
  trackedDatabaseNames.add(name)
  return name
}

const deleteDatabase = (name: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    request.onblocked = () => resolve()
  })
}

afterEach(async () => {
  const names = Array.from(trackedDatabaseNames)
  trackedDatabaseNames.clear()
  await Promise.all(names.map((name) => deleteDatabase(name)))
})
