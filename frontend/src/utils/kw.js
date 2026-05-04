import { getISOWeek, getISOWeekYear, startOfISOWeek, addWeeks, format } from 'date-fns'

/**
 * Parse a KW string like "KW23" or "KW23-2024" into { week, year }
 */
function parseKW(kw) {
  if (!kw || typeof kw !== 'string') return null
  const match = kw.match(/^KW(\d{1,2})(?:-(\d{4}))?$/)
  if (!match) return null
  const week = parseInt(match[1], 10)
  const year = match[2] ? parseInt(match[2], 10) : new Date().getFullYear()
  return { week, year }
}

/**
 * Convert a KW string to a numeric sort key.
 * "KW5" → 202305, "KW23-2025" → 202523
 */
export function kwToSortKey(kw) {
  const parsed = parseKW(kw)
  if (!parsed) return 0
  return parsed.year * 100 + parsed.week
}

/**
 * Returns the current KW string, e.g. "KW23"
 */
export function getCurrentKW() {
  const now = new Date()
  const week = getISOWeek(now)
  return `KW${week}`
}

/**
 * Returns the current KW string with year, e.g. "KW23-2025"
 */
export function getCurrentKWWithYear() {
  const now = new Date()
  const week = getISOWeek(now)
  const year = getISOWeekYear(now)
  return `KW${week}-${year}`
}

/**
 * Returns array of KW strings for a given year (ISO weeks that start in that year).
 */
export function getKWRange(year) {
  const result = []
  // ISO week 1 starts on the Monday that includes Jan 4
  let date = startOfISOWeek(new Date(year, 0, 4))
  while (true) {
    const w = getISOWeek(date)
    const y = getISOWeekYear(date)
    if (y > year) break
    result.push(`KW${w}-${y}`)
    date = addWeeks(date, 1)
  }
  return result
}

/**
 * Returns array of KW strings centered on current week, spanning `total` weeks.
 * e.g. getKWWindow(8) → 8 weeks starting 2 before current
 */
export function getKWWindow(total = 8, offsetWeeks = 0) {
  const now = new Date()
  const currentWeekStart = startOfISOWeek(now)
  // Start 2 weeks before current
  const startDate = addWeeks(currentWeekStart, -2 + offsetWeeks)
  return Array.from({ length: total }, (_, i) => {
    const d = addWeeks(startDate, i)
    const w = getISOWeek(d)
    const y = getISOWeekYear(d)
    return `KW${w}-${y}`
  })
}

/**
 * Human-readable display label for a KW string.
 * "KW5" → "KW 05"
 * "KW5-2025" → "KW 05 / 2025"
 */
export function kwToLabel(kw) {
  const parsed = parseKW(kw)
  if (!parsed) return kw || ''
  const weekStr = String(parsed.week).padStart(2, '0')
  // Only show year if it's from the KW string itself (contains dash)
  if (kw.includes('-')) {
    return `KW ${weekStr} / ${parsed.year}`
  }
  return `KW ${weekStr}`
}

/**
 * Returns just the week number part of a KW string (numeric).
 */
export function kwToWeekNumber(kw) {
  const parsed = parseKW(kw)
  return parsed ? parsed.week : null
}

/**
 * Compare two KW strings for sorting.
 */
export function compareKW(a, b) {
  return kwToSortKey(a) - kwToSortKey(b)
}

/**
 * Get date range string for a KW, e.g. "03.03. – 09.03.2025"
 */
export function kwToDateRange(kw) {
  const parsed = parseKW(kw)
  if (!parsed) return ''
  // Find the Monday of ISO week
  const jan4 = new Date(parsed.year, 0, 4)
  const week1Monday = startOfISOWeek(jan4)
  const monday = addWeeks(week1Monday, parsed.week - 1)
  const sunday = addWeeks(monday, 1)
  sunday.setDate(sunday.getDate() - 1)
  return `${format(monday, 'dd.MM.')} – ${format(sunday, 'dd.MM.yyyy')}`
}
