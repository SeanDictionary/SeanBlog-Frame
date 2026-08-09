type TaxonomyImportType = 'categories' | 'tags'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function normalizeTaxonomyImportPayload(value: unknown, type: TaxonomyImportType) {
  if (Array.isArray(value)) {
    return { type, items: value }
  }

  if (!isRecord(value)) {
    return value
  }

  if (Array.isArray(value.items)) {
    return value
  }

  if (Array.isArray(value[type])) {
    return { type, items: value[type] }
  }

  if (typeof value.name === 'string') {
    return { type, items: [value] }
  }

  return value
}
