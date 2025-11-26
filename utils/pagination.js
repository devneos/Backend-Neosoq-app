function paginateArray(items = [], page = 1, limit = 20) {
  page = Number(page)
  if (!Number.isFinite(page) || page < 1) page = 1

  limit = Number(limit)
  if (!Number.isFinite(limit)) limit = 20
  if (limit < 1) limit = 1

  const total = Array.isArray(items) ? items.length : 0
  const pages = Math.max(1, Math.ceil(total / limit))
  const start = (page - 1) * limit
  const docs = Array.isArray(items) ? items.slice(start, start + limit) : []

  return {
    docs,
    total,
    page,
    pages,
    limit,
  }
}

function parsePagination(query = {}) {
  let page = Number(query.page || query.p || 1)
  if (!Number.isFinite(page) || page < 1) page = 1

  let limit = Number(query.limit || query.perPage || 20)
  if (!Number.isFinite(limit) || limit < 1) limit = 20

  const skip = (page - 1) * limit
  return { page, limit, skip }
}

module.exports = { paginateArray, parsePagination }
