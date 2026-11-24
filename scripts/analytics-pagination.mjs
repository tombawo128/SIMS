export async function queryAll(path, token, request, pageSize = 1000) {
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new RangeError('pageSize must be a positive integer');
  }
  if (typeof request !== 'function') {
    throw new TypeError('request must be a function');
  }

  const rows = [];
  for (let offset = 0; ; offset += pageSize) {
    const page = await request(path, token, {
      headers: {
        Range: String(offset) + '-' + (offset + pageSize - 1),
        'Range-Unit': 'items',
      },
    });
    if (!Array.isArray(page)) throw new Error('Paginated query did not return an array: ' + path);
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}
