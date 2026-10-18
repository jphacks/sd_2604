import test from 'node:test'
import assert from 'node:assert/strict'

import { getDisplayNameWithId } from './memberDisplayUtils.ts'

test('unique names do not show suffix', () => {
  const result = getDisplayNameWithId({ id: 'TW96aW', name: '田中' }, [
    { id: 'A1', name: '田中' },
    { id: 'B2', name: '佐藤' },
  ])

  assert.deepEqual(result, { primary: '田中' })
})

test('duplicate names show a subtle suffix', () => {
  const result = getDisplayNameWithId({ id: 'TW96aW', name: '名無し' }, [
    { id: 'A1', name: '名無し' },
    { id: 'B2', name: '名無し' },
  ])

  assert.deepEqual(result, { primary: '名無し', suffix: '#TW96aW' })
})
