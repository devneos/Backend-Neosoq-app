const { buildFilter } = require('../utils/filtering')

describe('utils/filtering', () => {
  test('builds filter with allowed fields', () => {
    const params = { status: 'active', q: 'search', tags: 'a,b,c', empty: '' }
    const allowed = ['status', 'tags']
    const f = buildFilter(params, allowed)
    expect(f).toEqual({ status: 'active', tags: { $in: ['a','b','c'] } })
  })

  test('ignores missing or empty values', () => {
    const params = { status: '', category: undefined }
    const allowed = ['status', 'category']
    const f = buildFilter(params, allowed)
    expect(f).toEqual({})
  })
})
