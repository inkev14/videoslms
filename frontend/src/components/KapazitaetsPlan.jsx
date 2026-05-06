import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { monteureApi, arbeitsschritteApi } from '../api/client.js'
import { getKWWindow, kwToLabel, kwToDateRange } from '../utils/kw.js'
import { getAuftragBadgeClass, getAuftragDotClass } from '../utils/colors.js'

const WEEKS_SHOWN = 8

function SchrittChip({ schritt }) {
  const auftragId = schritt.auftrag_id || schritt.auftrag?.id
  const dotCls = getAuftragDotClass(auftragId)
  return (
    <div className="flex items-center gap-1 text-xs truncate" title={`${auftragId} – ${schritt.typ} – ${schritt.bezeichnung || ''}`}>
      <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${dotCls}`} />
      <span className="truncate font-medium">{auftragId}</span>
      <span className="text-gray-400 truncate hidden lg:inline">{schritt.typ?.slice(0, 4)}</span>
    </div>
  )
}

function CellPopover({ schritte, onClose }) {
  return (
    <div className="absolute z-50 top-full left-0 mt-1 w-72 bg-white border border-gray-200 rounded-xl shadow-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-sm text-gray-800">{schritte.length} Schritt{schritte.length !== 1 ? 'e' : ''}</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-lg leading-none">&times;</button>
      </div>
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {schritte.map(s => (
          <div key={s.id} className="text-xs border-l-2 border-blue-400 pl-2">
            <div className="font-medium text-gray-800">{s.auftrag?.id || s.auftrag_id} – {s.typ}</div>
            <div className="text-gray-500">{s.bezeichnung}</div>
            {s.auftrag?.kunde && <div className="text-gray-400">{s.auftrag.kunde}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

function CapacityCell({ schritte }) {
  const [open, setOpen] = useState(false)
  const count = schritte.length
  const overloaded = count > 3
  const warning = count === 3

  let bgCls = 'bg-gray-50 hover:bg-gray-100'
  if (overloaded) bgCls = 'bg-red-50 hover:bg-red-100 border border-red-200'
  else if (warning) bgCls = 'bg-yellow-50 hover:bg-yellow-100 border border-yellow-200'

  return (
    <td className={`px-2 py-2 align-top min-w-[110px] max-w-[140px] relative ${bgCls} transition-colors`}>
      {count === 0 ? (
        <span className="text-gray-300 text-xs">–</span>
      ) : (
        <button
          className="w-full text-left space-y-0.5"
          onClick={() => setOpen(o => !o)}
        >
          {schritte.slice(0, 3).map(s => (
            <SchrittChip key={s.id} schritt={s} />
          ))}
          {count > 3 && (
            <div className="text-xs text-red-600 font-semibold">+{count - 3} weitere</div>
          )}
        </button>
      )}
      {open && schritte.length > 0 && (
        <CellPopover schritte={schritte} onClose={() => setOpen(false)} />
      )}
    </td>
  )
}

export default function KapazitaetsPlan() {
  const [offset, setOffset] = useState(0)
  const weeks = getKWWindow(WEEKS_SHOWN, offset * WEEKS_SHOWN)

  const { data: monteure = [], isLoading: monteureLoading } = useQuery({
    queryKey: ['monteure'],
    queryFn: monteureApi.getAll,
  })

  const { data: schritte = [], isLoading: schritteLoading } = useQuery({
    queryKey: ['arbeitsschritte', { kw_von: weeks[0], kw_bis: weeks[weeks.length - 1] }],
    queryFn: () => arbeitsschritteApi.getAll({ kw_von: weeks[0], kw_bis: weeks[weeks.length - 1] }),
    enabled: weeks.length > 0,
  })

  // Build lookup: monteur_id -> kw -> schritte[]
  const grid = {}
  const unassigned = {}
  for (const s of schritte) {
    const mid = s.monteur_id || '__unassigned__'
    const kw = s.geplant_kw || '__nokw__'
    if (!grid[mid]) grid[mid] = {}
    if (!grid[mid][kw]) grid[mid][kw] = []
    grid[mid][kw].push(s)
    if (mid === '__unassigned__') {
      if (!unassigned[kw]) unassigned[kw] = []
      unassigned[kw].push(s)
    }
  }

  const loading = monteureLoading || schritteLoading

  return (
    <div className="space-y-4">
      {/* Navigation header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Kapazitätsplan</h2>
          <p className="text-sm text-gray-500">
            {kwToLabel(weeks[0])} – {kwToLabel(weeks[weeks.length - 1])}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setOffset(o => o - 1)}
            className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            ← Zurück
          </button>
          <button
            onClick={() => setOffset(0)}
            className="px-3 py-1.5 rounded-lg border border-blue-300 text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors"
          >
            Heute
          </button>
          <button
            onClick={() => setOffset(o => o + 1)}
            className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Vor →
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-yellow-100 border border-yellow-300" /> 3 Schritte (Warnung)</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-red-100 border border-red-300" /> &gt;3 Schritte (Überlastet)</span>
      </div>

      {/* Grid */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <svg className="animate-spin w-6 h-6 mr-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Lade Kapazitätsplan…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 min-w-[130px] z-10">
                    Monteur
                  </th>
                  {weeks.map(kw => (
                    <th key={kw} className="px-2 py-3 text-center text-xs font-semibold text-gray-500 min-w-[110px]">
                      <div>{kwToLabel(kw)}</div>
                      <div className="text-gray-400 font-normal normal-case tracking-normal mt-0.5 hidden xl:block">
                        {kwToDateRange(kw)}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {monteure.length === 0 ? (
                  <tr>
                    <td colSpan={weeks.length + 1} className="text-center py-12 text-gray-400">
                      Keine Monteure vorhanden. Legen Sie zuerst Monteure an.
                    </td>
                  </tr>
                ) : (
                  monteure.map(monteur => (
                    <tr key={monteur.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-2 sticky left-0 bg-white z-10 border-r border-gray-100">
                        <div className="font-medium text-gray-800 text-sm">{monteur.name}</div>
                        {monteur.kuerzel && (
                          <div className="text-xs text-gray-400">{monteur.kuerzel}</div>
                        )}
                      </td>
                      {weeks.map(kw => {
                        const cellSchritte = grid[monteur.id]?.[kw] || []
                        return <CapacityCell key={kw} schritte={cellSchritte} />
                      })}
                    </tr>
                  ))
                )}
                {/* Unassigned row */}
                {Object.keys(unassigned).length > 0 && (
                  <tr className="bg-gray-50/50">
                    <td className="px-4 py-2 sticky left-0 bg-gray-50 z-10 border-r border-gray-100">
                      <div className="font-medium text-gray-500 text-sm italic">Nicht zugewiesen</div>
                    </td>
                    {weeks.map(kw => {
                      const cellSchritte = unassigned[kw] || []
                      return <CapacityCell key={kw} schritte={cellSchritte} />
                    })}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
