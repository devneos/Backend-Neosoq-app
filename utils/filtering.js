function buildFilter(params = {}, allowedFields = []) {
  const filter = {}
  for (const key of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(params, key)) {
      const val = params[key]
      if (val === undefined || val === null || String(val).trim() === '') continue
      // If comma-separated values provided, treat as $in
      if (typeof val === 'string' && val.includes(',')) {
        filter[key] = { $in: val.split(',').map(v => v.trim()).filter(Boolean) }
      } else {
        filter[key] = val
      }
    }
  }
  return filter
}

module.exports = { buildFilter }
