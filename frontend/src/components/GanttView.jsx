import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { auftraegeApi, arbeitsschritteApi, planningApi } from '../api/client.js'
import { getAuftragBadgeClass, getAuftragBorderClass } from '../utils/colors.js'

const DAY_WIDTH = 36 // pixels per day
const ROW_HEIGHT = 56 // pixels per row
const SIDEBAR_WIDTH = 230 // px

// ─── Date helpers ─────────────────────────────────────────────────────────────

function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function formatDate(date) {
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
}

function dateToKW(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const week1 = new Date(d.getFullYear(), 0, 4)
  const weekNum =
    1 +
    Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7
    )
  const year = d.getFullYear()
  return `KW${String(weekNum).padStart(2, '0')}-${year}`
}

const DAY_ABBR = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

function isWeekend(date) {
  const d = date.getDay()
  return d === 0 || d === 6
}

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

// Group consecutive days into ISO weeks for the header
function groupDaysIntoWeeks(days) {
  const weeks = []
  let current = null
  days.forEach((day, i) => {
    // ISO week number
    const d = new Date(day)
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
    const week1 = new Date(d.getFullYear(), 0, 4)
    const weekNum =
      1 +
      Math.round(
        ((d.getTime() - week1.getTime()) / 86400000 -
          3 +
          ((week1.getDay() + 6) % 7)) /
          7
      )
    const key = `${d.getFullYear()}-${weekNum}`

    if (!current || current.key !== key) {
      current = { key, weekNum, year: d.getFullYear(), days: [], startIndex: i }
      weeks.push(current)
    }
    current.days.push(day)
  })
  return weeks
}

// ─── Ampel color map ──────────────────────────────────────────────────────────

const AMPEL_COLORS = {
  Erledigt: { bar: 'bg-green-400', border: 'border-green-500', text: 'text-white' },
  Läuft: { bar: 'bg-blue-400', border: 'border-blue-500', text: 'text-white' },
  Blockiert: { bar: 'bg-red-400', border: 'border-red-500', text: 'text-white' },
  Geplant: { bar: 'bg-yellow-300', border: 'border-yellow-400', text: 'text-yellow-900' },
  Offen: { bar: 'bg-gray-300', border: 'border-gray-400', text: 'text-gray-700' },
}

// ─── GanttBar ─────────────────────────────────────────────────────────────────

function GanttBar({ schritt, viewStart, daysShown, onDragEnd }) {
  const [dragOffset, setDragOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const startXRef = useRef(0)

  const handleMouseDown = (e) => {
    e.preventDefault()
    setDragging(true)
    startXRef.current = e.clientX

    const handleMouseMove = (ev) => {
      setDragOffset(ev.clientX - startXRef.current)
    }

    const handleMouseUp = (ev) => {
      const dx = ev.clientX - startXRef.current
      const daysDelta = Math.round(dx / DAY_WIDTH)
      if (daysDelta !== 0 && schritt.geplant_start) {
        const newStart = addDays(new Date(schritt.geplant_start), daysDelta)
        const newKW = dateToKW(newStart)
        onDragEnd(schritt.id, newKW, newStart)
      }
      setDragging(false)
      setDragOffset(0)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  if (!schritt.geplant_start) return null

  const start = new Date(schritt.geplant_start)
  const daysFromViewStart = Math.floor((start - viewStart) / 86400000)

  // Skip bars that are completely outside the visible range
  const barDays = schritt.dauer_tage || 1
  if (daysFromViewStart + barDays < 0 || daysFromViewStart > daysShown) return null

  const left = daysFromViewStart * DAY_WIDTH + dragOffset
  const width = Math.max(barDays * DAY_WIDTH - 3, 10)

  const colors = AMPEL_COLORS[schritt.ampel] || AMPEL_COLORS.Offen

  return (
    <div
      className={`absolute top-2 h-9 rounded border flex items-center px-1.5 cursor-grab active:cursor-grabbing select-none ${colors.bar} ${colors.border} ${colors.text} ${
        dragging ? 'opacity-80 shadow-xl z-20 scale-y-105' : 'hover:brightness-95 hover:shadow-md z-10'
      }`}
      style={{
        left: `${left}px`,
        width: `${width}px`,
        transition: dragging ? 'none' : 'box-shadow 0.15s',
      }}
      onMouseDown={handleMouseDown}
      title={`${schritt.typ}: ${schritt.bezeichnung || ''}\nDauer: ${barDays}d\nAmpel: ${schritt.ampel || 'Offen'}\nStart: ${start.toLocaleDateString('de-DE')}`}
    >
      <span className="text-xs font-semibold truncate drop-shadow-sm leading-none">
        {schritt.typ?.slice(0, 3)}
      </span>
    </div>
  )
}

// ─── GanttView ────────────────────────────────────────────────────────────────

export default function GanttView() {
  const queryClient = useQueryClient()

  const [viewStart, setViewStart] = useState(() => {
    const d = new Date()
    // Start of current ISO week (Monday)
    const day = d.getDay()
    const diff = day === 0 ? -6 : 1 - day
    d.setDate(d.getDate() + diff)
    d.setHours(0, 0, 0, 0)
    return d
  })

  const DAYS_SHOWN = 42 // 6 weeks

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Generate array of dates for columns
  const days = Array.from({ length: DAYS_SHOWN }, (_, i) => addDays(viewStart, i))

  // Group days by ISO week for header
  const weeks = groupDaysIntoWeeks(days)

  const { data: auftraege = [], isLoading } = useQuery({
    queryKey: ['auftraege'],
    queryFn: auftraegeApi.getAll,
  })

  const activeAuftraege = auftraege.filter((a) => a.status !== 'Fertig')

  const verschiebenMutation = useMutation({
    mutationFn: ({ id, neue_kw }) => arbeitsschritteApi.verschieben(id, neue_kw),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auftraege'] })
      queryClient.invalidateQueries({ queryKey: ['arbeitsschritte'] })
      toast.success('Schritt verschoben')
    },
    onError: (err) => toast.error(err.message),
  })

  const scheduleAllMutation = useMutation({
    mutationFn: planningApi.scheduleAll,
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['auftraege'] })
      queryClient.invalidateQueries({ queryKey: ['arbeitsschritte'] })
      const warned = Array.isArray(results)
        ? results.filter((r) => r.liefertermin_gefaehrdet).length
        : 0
      if (warned > 0) toast.error(`${warned} Aufträge gefährden den Liefertermin`)
      else toast.success('Alle Aufträge geplant')
    },
    onError: (err) => toast.error(err.message),
  })

  const goToToday = () => {
    const d = new Date()
    const day = d.getDay()
    const diff = day === 0 ? -6 : 1 - day
    d.setDate(d.getDate() + diff)
    d.setHours(0, 0, 0, 0)
    setViewStart(d)
  }

  const totalGridWidth = DAYS_SHOWN * DAY_WIDTH

  // Today's offset
  const todayOffset = Math.floor((today - viewStart) / 86400000)
  const todayInView = todayOffset >= 0 && todayOffset < DAYS_SHOWN

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Gantt-Planung</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Aufträge visuell planen — Balken ziehen zum Verschieben
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewStart((d) => addDays(d, -7))}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-1"
          >
            <span>&#8592;</span> Zurück
          </button>
          <button
            onClick={goToToday}
            className="px-3 py-1.5 text-sm rounded-lg border border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
          >
            Heute
          </button>
          <button
            onClick={() => setViewStart((d) => addDays(d, 7))}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-1"
          >
            Vor <span>&#8594;</span>
          </button>
          <div className="w-px h-6 bg-gray-300 mx-1" />
          <button
            onClick={() => scheduleAllMutation.mutate()}
            disabled={scheduleAllMutation.isPending}
            className="px-3 py-1.5 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
          >
            {scheduleAllMutation.isPending ? (
              <>
                <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Plane...
              </>
            ) : (
              '⚡ Alle planen'
            )}
          </button>
        </div>
      </div>

      {/* Main grid card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <svg className="animate-spin w-6 h-6 mr-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Lade Aufträge…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div style={{ minWidth: `${totalGridWidth + SIDEBAR_WIDTH}px` }}>

              {/* ── Week header row ───────────────────────────────────────── */}
              <div className="flex border-b border-gray-200 bg-gray-50 sticky top-0 z-30">
                {/* Sidebar header */}
                <div
                  className="flex-shrink-0 bg-gray-50 border-r border-gray-200 flex items-center px-3 sticky left-0 z-40"
                  style={{ width: `${SIDEBAR_WIDTH}px`, height: '34px' }}
                >
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Auftrag
                  </span>
                </div>
                {/* Week labels */}
                <div className="relative flex" style={{ width: `${totalGridWidth}px` }}>
                  {weeks.map((week) => (
                    <div
                      key={week.key}
                      className="border-r border-gray-300 flex items-center justify-center overflow-hidden"
                      style={{ width: `${week.days.length * DAY_WIDTH}px`, height: '34px' }}
                    >
                      <span className="text-xs font-bold text-gray-600 truncate px-1">
                        KW{String(week.weekNum).padStart(2, '0')}
                        <span className="font-normal text-gray-400 ml-1">
                          {formatDate(week.days[0])}–{formatDate(week.days[week.days.length - 1])}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Day abbreviation header row ───────────────────────────── */}
              <div className="flex border-b border-gray-200 bg-gray-50 sticky top-[34px] z-30">
                {/* Sidebar spacer */}
                <div
                  className="flex-shrink-0 bg-gray-50 border-r border-gray-200 sticky left-0 z-40"
                  style={{ width: `${SIDEBAR_WIDTH}px`, height: '26px' }}
                />
                {/* Day labels */}
                <div className="flex" style={{ width: `${totalGridWidth}px` }}>
                  {days.map((day, i) => {
                    const isToday = isSameDay(day, today)
                    const weekend = isWeekend(day)
                    return (
                      <div
                        key={i}
                        className={`flex-shrink-0 flex items-center justify-center border-r text-xs font-medium ${
                          isToday
                            ? 'bg-blue-500 text-white border-blue-600'
                            : weekend
                            ? 'bg-gray-100 text-gray-400 border-gray-200'
                            : 'text-gray-500 border-gray-200'
                        }`}
                        style={{ width: `${DAY_WIDTH}px`, height: '26px' }}
                      >
                        {DAY_ABBR[day.getDay()]}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* ── Auftrag rows ──────────────────────────────────────────── */}
              {activeAuftraege.length === 0 ? (
                <div className="flex items-center justify-center py-16 text-gray-400">
                  <div className="text-center">
                    <div className="text-4xl mb-2">📋</div>
                    <p className="font-medium">Keine offenen Aufträge</p>
                    <p className="text-sm mt-1">Alle Aufträge sind abgeschlossen oder es gibt noch keine.</p>
                  </div>
                </div>
              ) : (
                activeAuftraege.map((auftrag, rowIdx) => {
                  const badgeCls = getAuftragBadgeClass(auftrag.id)
                  const borderCls = getAuftragBorderClass(auftrag.id)

                  // Liefertermin offset
                  let lieferOffset = null
                  if (auftrag.liefertermin) {
                    const lt = new Date(auftrag.liefertermin)
                    lt.setHours(0, 0, 0, 0)
                    const off = Math.floor((lt - viewStart) / 86400000)
                    if (off >= 0 && off <= DAYS_SHOWN) lieferOffset = off
                  }

                  return (
                    <div
                      key={auftrag.id}
                      className={`flex border-b border-gray-100 hover:bg-gray-50/40 transition-colors border-l-4 ${borderCls}`}
                      style={{ height: `${ROW_HEIGHT}px` }}
                    >
                      {/* Sidebar */}
                      <div
                        className="flex-shrink-0 px-3 flex flex-col justify-center border-r border-gray-100 bg-white sticky left-0 z-10"
                        style={{ width: `${SIDEBAR_WIDTH}px` }}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold ring-1 ring-inset flex-shrink-0 ${badgeCls}`}
                          >
                            {auftrag.id}
                          </span>
                          <span className="text-xs text-gray-700 font-medium truncate">
                            {auftrag.kunde}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400 truncate mt-0.5 pl-0.5">
                          {auftrag.getriebe_bezeichnung || '–'}
                        </div>
                        {auftrag.liefertermin && (
                          <div className="text-xs text-red-600 font-medium mt-0.5 pl-0.5">
                            ⚑{' '}
                            {new Date(auftrag.liefertermin).toLocaleDateString('de-DE', {
                              day: '2-digit',
                              month: '2-digit',
                              year: '2-digit',
                            })}
                          </div>
                        )}
                      </div>

                      {/* Gantt area */}
                      <div
                        className="relative flex-shrink-0"
                        style={{ width: `${totalGridWidth}px` }}
                      >
                        {/* Day background columns */}
                        {days.map((day, i) => {
                          const isToday = isSameDay(day, today)
                          const weekend = isWeekend(day)
                          return (
                            <div
                              key={i}
                              className={`absolute top-0 bottom-0 border-r ${
                                isToday
                                  ? 'bg-blue-50 border-blue-200'
                                  : weekend
                                  ? 'bg-gray-50 border-gray-200'
                                  : 'border-gray-100'
                              }`}
                              style={{
                                left: `${i * DAY_WIDTH}px`,
                                width: `${DAY_WIDTH}px`,
                              }}
                            />
                          )
                        })}

                        {/* Today vertical line */}
                        {todayInView && (
                          <div
                            className="absolute top-0 bottom-0 w-0.5 bg-blue-400 z-20 pointer-events-none"
                            style={{ left: `${todayOffset * DAY_WIDTH}px` }}
                            title="Heute"
                          />
                        )}

                        {/* Liefertermin vertical line */}
                        {lieferOffset !== null && (
                          <div
                            className="absolute top-0 bottom-0 z-20 pointer-events-none"
                            style={{ left: `${lieferOffset * DAY_WIDTH}px` }}
                            title={`Liefertermin: ${new Date(auftrag.liefertermin).toLocaleDateString('de-DE')}`}
                          >
                            <div className="w-0.5 h-full bg-red-400 opacity-80" style={{ borderStyle: 'dashed', borderWidth: '0 0 0 2px', borderColor: '#f87171' }} />
                            <div className="absolute -top-0 left-0.5 text-red-400 text-xs leading-none select-none">⚑</div>
                          </div>
                        )}

                        {/* Schritt bars */}
                        {(auftrag.schritte || []).map((schritt) => (
                          <GanttBar
                            key={schritt.id}
                            schritt={schritt}
                            viewStart={viewStart}
                            daysShown={DAYS_SHOWN}
                            onDragEnd={(id, neue_kw) =>
                              verschiebenMutation.mutate({ id, neue_kw })
                            }
                          />
                        ))}

                        {/* Unplanned indicators (schritte without geplant_start) */}
                        {(() => {
                          const unplanned = (auftrag.schritte || []).filter(
                            (s) => !s.geplant_start
                          )
                          if (unplanned.length === 0) return null
                          return (
                            <div
                              className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-60"
                              title={`${unplanned.length} ungeplante Schritte`}
                            >
                              <span className="text-xs text-gray-400 font-medium">
                                {unplanned.length}✕
                              </span>
                              <span className="w-3 h-3 rounded bg-gray-300 inline-block" />
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-500 px-1">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-green-400 inline-block ring-1 ring-green-500" />
          Erledigt
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-blue-400 inline-block ring-1 ring-blue-500" />
          Läuft
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-yellow-300 inline-block ring-1 ring-yellow-400" />
          Geplant
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-red-400 inline-block ring-1 ring-red-500" />
          Blockiert
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-gray-300 inline-block ring-1 ring-gray-400" />
          Offen
        </span>
        <span className="flex items-center gap-1.5 ml-2 border-l border-gray-200 pl-4">
          <span className="w-0.5 h-4 bg-blue-400 inline-block" />
          Heute
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-0.5 h-4 bg-red-400 inline-block opacity-80" style={{ borderLeft: '2px dashed #f87171' }} />
          Liefertermin
        </span>
        <span className="flex items-center gap-1.5 text-gray-400 italic">
          Balken ziehen zum Verschieben
        </span>
      </div>
    </div>
  )
}
