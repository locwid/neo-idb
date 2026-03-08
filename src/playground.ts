import { neoIDB } from './index'

const db = await neoIDB({
  name: 'test-db',
  definition(v) {
    v(1)
      .addStore('users', 'id')
      .addStore('posts', 'id')
      .addIndex('posts', 'userId', 'userId')
  },
})

db.tx(['posts', 'users'], 'readwrite', ({ posts, users }) => {
  users.add({ id: 1, name: 'Alice' })
  users.add({ id: 2, name: 'Bob' })
  posts.add({ id: 1, title: 'Hello World', userId: 1 })
})

const userCount = await db.count('users')
console.log('User count:', userCount)

const data = await db.index('posts', 'userId', (index) => index.get(1))
console.log('Posts by user 1:', data)
