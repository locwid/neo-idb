import { IDB } from './index'

new IDB({
  name: 'test-db',
  definition(v) {
    v(1).addStore('users', 'id')
    v(2).addStore('posts', 'id').addIndex('posts', 'userId', 'userId')
    v(3).deleteIndex('posts', 'userId')
    v(4).deleteStore('users')
  },
})
