const turkishCharacterMap = [
  [/[çÇ]/g, 'c'],
  [/[ğĞ]/g, 'g'],
  [/[ıIİi]/g, 'i'],
  [/[öÖ]/g, 'o'],
  [/[şŞ]/g, 's'],
  [/[üÜ]/g, 'u'],
]

export function normalizeSearch(value) {
  if (typeof value !== 'string') {
    return ''
  }

  return turkishCharacterMap.reduce(
    (normalized, [pattern, replacement]) => normalized.replace(pattern, replacement),
    value.trim().toLocaleLowerCase('tr-TR'),
  )
}

export function matchesSearch(query, value) {
  const normalizedQuery = normalizeSearch(query)

  return !normalizedQuery || normalizeSearch(value).includes(normalizedQuery)
}
