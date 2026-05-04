/**
 * Deterministic color palette for Auftraege based on ID hash.
 * Returns Tailwind color name string.
 */

const COLOR_PALETTE = [
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'teal',
  'cyan',
  'blue',
  'indigo',
  'violet',
  'pink',
]

function hashString(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit int
  }
  return Math.abs(hash)
}

export function hashColor(id) {
  if (!id) return 'gray'
  const idx = hashString(String(id)) % COLOR_PALETTE.length
  return COLOR_PALETTE[idx]
}

/**
 * Returns Tailwind CSS classes for a border-left colored badge.
 */
export function getAuftragBorderClass(id) {
  const color = hashColor(id)
  const borderMap = {
    red: 'border-l-red-500',
    orange: 'border-l-orange-500',
    amber: 'border-l-amber-500',
    yellow: 'border-l-yellow-500',
    lime: 'border-l-lime-500',
    green: 'border-l-green-500',
    teal: 'border-l-teal-500',
    cyan: 'border-l-cyan-500',
    blue: 'border-l-blue-500',
    indigo: 'border-l-indigo-500',
    violet: 'border-l-violet-500',
    pink: 'border-l-pink-500',
  }
  return borderMap[color] || 'border-l-gray-400'
}

/**
 * Returns Tailwind CSS classes for a colored badge background.
 */
export function getAuftragBadgeClass(id) {
  const color = hashColor(id)
  const badgeMap = {
    red: 'bg-red-100 text-red-800 ring-red-200',
    orange: 'bg-orange-100 text-orange-800 ring-orange-200',
    amber: 'bg-amber-100 text-amber-800 ring-amber-200',
    yellow: 'bg-yellow-100 text-yellow-800 ring-yellow-200',
    lime: 'bg-lime-100 text-lime-800 ring-lime-200',
    green: 'bg-green-100 text-green-800 ring-green-200',
    teal: 'bg-teal-100 text-teal-800 ring-teal-200',
    cyan: 'bg-cyan-100 text-cyan-800 ring-cyan-200',
    blue: 'bg-blue-100 text-blue-800 ring-blue-200',
    indigo: 'bg-indigo-100 text-indigo-800 ring-indigo-200',
    violet: 'bg-violet-100 text-violet-800 ring-violet-200',
    pink: 'bg-pink-100 text-pink-800 ring-pink-200',
  }
  return badgeMap[color] || 'bg-gray-100 text-gray-800 ring-gray-200'
}

/**
 * Returns Tailwind CSS classes for a cell tint (light background).
 */
export function getAuftragCellClass(id) {
  const color = hashColor(id)
  const cellMap = {
    red: 'bg-red-50 border-l-4 border-l-red-400',
    orange: 'bg-orange-50 border-l-4 border-l-orange-400',
    amber: 'bg-amber-50 border-l-4 border-l-amber-400',
    yellow: 'bg-yellow-50 border-l-4 border-l-yellow-400',
    lime: 'bg-lime-50 border-l-4 border-l-lime-400',
    green: 'bg-green-50 border-l-4 border-l-green-400',
    teal: 'bg-teal-50 border-l-4 border-l-teal-400',
    cyan: 'bg-cyan-50 border-l-4 border-l-cyan-400',
    blue: 'bg-blue-50 border-l-4 border-l-blue-400',
    indigo: 'bg-indigo-50 border-l-4 border-l-indigo-400',
    violet: 'bg-violet-50 border-l-4 border-l-violet-400',
    pink: 'bg-pink-50 border-l-4 border-l-pink-400',
  }
  return cellMap[color] || 'bg-gray-50 border-l-4 border-l-gray-400'
}

// Dot color classes for Kanban/capacity
export function getAuftragDotClass(id) {
  const color = hashColor(id)
  const dotMap = {
    red: 'bg-red-400',
    orange: 'bg-orange-400',
    amber: 'bg-amber-400',
    yellow: 'bg-yellow-400',
    lime: 'bg-lime-400',
    green: 'bg-green-400',
    teal: 'bg-teal-400',
    cyan: 'bg-cyan-400',
    blue: 'bg-blue-400',
    indigo: 'bg-indigo-400',
    violet: 'bg-violet-400',
    pink: 'bg-pink-400',
  }
  return dotMap[color] || 'bg-gray-400'
}
