const { paginateArray } = require('../utils/pagination')

describe('utils/pagination', () => {
  test('paginates an array correctly', () => {
    const items = Array.from({ length: 45 }, (_, i) => i + 1)
    const res = paginateArray(items, 2, 10)

    expect(res.total).toBe(45)
    expect(res.page).toBe(2)
    expect(res.limit).toBe(10)
    expect(res.pages).toBe(Math.ceil(45 / 10))
    expect(res.docs).toEqual([11,12,13,14,15,16,17,18,19,20])
  })

  test('handles page/limit edge cases', () => {
    const items = [1,2,3]
    const r1 = paginateArray(items, -1, 0)
    expect(r1.page).toBe(1)
    expect(r1.limit).toBe(1)
    expect(r1.docs).toEqual([1])
  })
})
