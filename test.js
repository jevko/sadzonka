import test from 'node:test'
import { parse, stringify } from './sadzonka.js'
import assert from 'assert/strict'

test('parse', () => {
  assert.deepEqual(parse('abc'), 'abc')
  assert.deepEqual(parse('[abc]'), ['abc'])
  assert.deepEqual(parse('[abc][def]'), ['abc', 'def'])
  assert.deepEqual(parse('k1[abc] k2[def]'), {k1: 'abc', k2: 'def'})
  assert.deepEqual(parse('k1[abc] k2[def] ;k3[xyz]'), {k1: 'abc', k2: 'def'})
  assert.deepEqual(parse('k1[abc] k2[def] \\[\\][xyz]'), {k1: 'abc', k2: 'def', '\\': 'xyz'})
})

test('stringify', () => {
  assert.deepEqual(stringify('abc'), ('abc'))
  assert.deepEqual(stringify(['abc']), ('[abc]'))
  assert.deepEqual(stringify(['abc', 'def']), ('[abc][def]'))
  assert.deepEqual(stringify({k1: 'abc', k2: 'def'}), ('k1[abc]k2[def]'))
  assert.deepEqual(stringify({k1: 'abc', k2: 'def', '\\': 'xyz'}), ('k1[abc]k2[def]\\[\\][xyz]'))
})