# neo-idb

A small, typed wrapper around IndexedDB with Promise-based API and versioned migrations.

1. [Installation](#install)
2. [Quick Start](#quick-start)
3. [Development](#development)
4. [License](#license)

## Install

```bash
npm install neo-idb
```

## Quick Start

```ts
import { neoIDB } from 'neo-idb'

type AppSchema = {
  stores: {
    pets: {
      keyPath: 'id'
      value: { id: number; name: string; type?: 'cat' | 'dog' }
      indexes: {
        byType: { keyPath: 'type' }
      }
    }
  }
}

const db = await neoIDB<AppSchema>({
  name: 'my-app-db',
  definition: (v) => {
    v(1).addStore('pets', 'id').addIndex('pets', 'byType', 'type')
  },
})

await db.add('pets', { id: 1, name: 'Milo', type: 'cat' })
const pet = await db.get('pets', 1)
const cats = await db.index('pets', 'byType', (index) => index.getAll('cat'))
```

## Development

```bash
bun run test
bun run typecheck
bun run build
```

## License

MIT
