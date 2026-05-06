import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { auftraegeApi } from '../api/client.js'
import { getAuftragBadgeClass, getAuftragBorderClass } from '../utils/colors.js'
import AuftragModal from './AuftragModal.jsx'
import AuftragDetail from './AuftragDetail.jsx'

function StatusBadge({ status }) {
  const map = {
    'Eingang': 'bg-gray-100 text-gray-700',
    'In Arbeit': 'bg-blue-100 text-blue-800',
    'Warten Teile': 'bg-orange-100 text-orange-800',
    'Fertig': 'bg-green-100 text-green-800',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-600'}`}>
      {status || 'Eingang'}
    </span>
  )
}

function AmpelDot({ auftrag }) {
  const today = new Date()
  const liefertermin = auftrag.liefertermin ? new Date(auftrag.liefertermin) : null
  const teileFehlend = auftrag.schritte?.some(s => s.teile_status === 'Fehlt')
  const teilebestellt = auftrag.schritte?.some(s => s.teile_status === 'Bestellt')
  const gefaehrdet = liefertermin && (today > liefertermin) && auftrag.status !== 'Fertig'

  if (gefaehrdet || teileFehlend) {
    return <span className="inline-block w-3 h-3 rounded-full bg-red-500" title="Gefährdet / Teile fehlen" />
  }
  if (teilebestellt) {
    return <span className="inline-block w-3 h-3 rounded-full bg-yellow-400" title="Teile bestellt" />
  }
  return <span className="inline-block w-3 h-3 rounded-full bg-green-500" title="OK" />
}

export default function AuftraegeView() {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editAuftrag, setEditAuftrag] = useState(null)
  const [detailAuftrag, setDetailAuftrag] = useState(null)
  const [search, setSearch] = useState('')

  const { data: auftraege = [], isLoading } = useQuery({
    queryKey: ['auftraege'],
    queryFn: () => auftraegeApi.getAll(),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => auftraegeApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auftraege'] })
      toast.success('Auftrag gelöscht')
    },
    onError: (err) => toast.error(err.message),
  })

  const handleDelete = (auftrag) => {
    if (window.confirm(`Auftrag "${auftrag.id}" wirklich löschen? Alle zugehörigen Schritte werden ebenfalls gelöscht.`)) {
      deleteMutation.mutate(auftrag.id)
    }
  }

  const filtered = auftraege.filter(a => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      (a.id || '').toLowerCase().includes(q) ||
      (a.kunde || '').toLowerCase().includes(q) ||
      (a.getriebe_bezeichnung || '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-800">Aufträge</h2>
          <span className="text-sm text-gray-400">({auftraege.length})</span>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Suchen nach Nr, Kunde, Getriebe…"
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button
            onClick={() => { setEditAuftrag(null); setShowModal(true) }}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
          >
            <span className="text-lg leading-none">+</span> Neuer Auftrag
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <svg className="animate-spin w-6 h-6 mr-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Lade Aufträge…
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-lg font-medium">{search ? 'Keine Aufträge gefunden' : 'Noch keine Aufträge'}</p>
              <p className="text-sm mt-1">{search ? 'Passen Sie die Suche an.' : 'Klicken Sie auf „Neuer Auftrag" um zu beginnen.'}</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Nr.</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Kunde</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Getriebe</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Typ</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Liefertermin</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Anlieferung</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Ampel</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Schritte</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((auftrag) => {
                  const borderCls = getAuftragBorderClass(auftrag.id)
                  const badgeCls = getAuftragBadgeClass(auftrag.id)
                  return (
                    <tr
                      key={auftrag.id}
                      className={`hover:bg-gray-50 border-l-4 ${borderCls} cursor-pointer`}
                      onClick={() => setDetailAuftrag(auftrag)}
                    >
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold ring-1 ring-inset ${badgeCls}`}>
                          {auftrag.id}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-800">{auftrag.kunde || '–'}</td>
                      <td className="px-4 py-3 text-gray-600">{auftrag.getriebe_bezeichnung || '–'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{auftrag.typ || '–'}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                        {auftrag.liefertermin ? new Date(auftrag.liefertermin).toLocaleDateString('de-DE') : '–'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                        {auftrag.anlieferung ? new Date(auftrag.anlieferung).toLocaleDateString('de-DE') : '–'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={auftrag.status} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <AmpelDot auftrag={auftrag} />
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {auftrag.schritte?.length ?? 0} Schritt{(auftrag.schritte?.length ?? 0) !== 1 ? 'e' : ''}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => { setEditAuftrag(auftrag); setShowModal(true) }}
                            className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                          >
                            Bearbeiten
                          </button>
                          <button
                            onClick={() => handleDelete(auftrag)}
                            className="text-xs px-2.5 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                          >
                            Löschen
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modals */}
      {showModal && (
        <AuftragModal
          auftrag={editAuftrag}
          onClose={() => { setShowModal(false); setEditAuftrag(null) }}
        />
      )}
      {detailAuftrag && (
        <AuftragDetail
          auftragId={detailAuftrag.id}
          onClose={() => setDetailAuftrag(null)}
        />
      )}
    </div>
  )
}
