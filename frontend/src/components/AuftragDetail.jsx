import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import toast from 'react-hot-toast'
import { auftraegeApi, arbeitsschritteApi, monteureApi } from '../api/client.js'
import { getAuftragBadgeClass } from '../utils/colors.js'
import { kwToLabel, getKWRange } from '../utils/kw.js'

const SCHRITT_TYPEN = [
  'Demontage', 'Reinigen', 'Sandstrahlen', 'Montage Baugruppe',
  'Montage', 'Auswärts', 'Qualitätskontrolle', 'Sonstiges',
]
const TEILE_STATUS_OPTIONS = ['Vorhanden', 'Bestellt', 'Fehlt', 'N/A']
const AUFTRAG_STATUS = ['Eingang', 'In Arbeit', 'Warten Teile', 'Fertig']

function StatusBadge({ status }) {
  const map = {
    'Eingang': 'bg-gray-100 text-gray-700',
    'In Arbeit': 'bg-blue-100 text-blue-800',
    'Warten Teile': 'bg-orange-100 text-orange-800',
    'Fertig': 'bg-green-100 text-green-800',
  }
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${map[status] || 'bg-gray-100 text-gray-600'}`}>
      {status || 'Eingang'}
    </span>
  )
}

function DragHandle({ attributes, listeners }) {
  return (
    <button
      className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 p-1"
      {...attributes}
      {...listeners}
    >
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z"/>
      </svg>
    </button>
  )
}

function SortableSchritt({ schritt, index, monteure, onUpdate, onDelete, kwOptions }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: schritt.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const [local, setLocal] = useState({ ...schritt })
  const [dirty, setDirty] = useState(false)

  const handleChange = (field, value) => {
    setLocal(l => ({ ...l, [field]: value }))
    setDirty(true)
  }

  const handleSave = () => {
    onUpdate(schritt.id, local)
    setDirty(false)
  }

  return (
    <tr ref={setNodeRef} style={style} className={`border-b border-gray-100 ${isDragging ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
      <td className="px-2 py-2">
        <DragHandle attributes={attributes} listeners={listeners} />
      </td>
      <td className="px-2 py-2 text-xs text-gray-400 font-medium w-8">{index + 1}</td>
      <td className="px-2 py-2">
        <select
          className="text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
          value={local.typ || ''}
          onChange={e => handleChange('typ', e.target.value)}
        >
          {SCHRITT_TYPEN.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </td>
      <td className="px-2 py-2">
        <input
          type="text"
          className="text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 w-full min-w-[120px]"
          value={local.bezeichnung || ''}
          onChange={e => handleChange('bezeichnung', e.target.value)}
          placeholder="Bezeichnung"
        />
      </td>
      <td className="px-2 py-2">
        <select
          className="text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
          value={local.monteur_id || ''}
          onChange={e => handleChange('monteur_id', e.target.value || null)}
        >
          <option value="">– kein –</option>
          {monteure.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </td>
      <td className="px-2 py-2">
        <select
          className="text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
          value={local.kw || ''}
          onChange={e => handleChange('kw', e.target.value)}
        >
          <option value="">– KW –</option>
          {kwOptions.map(kw => <option key={kw} value={kw}>{kwToLabel(kw)}</option>)}
        </select>
      </td>
      <td className="px-2 py-2">
        <select
          className="text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
          value={local.teile_status || 'N/A'}
          onChange={e => handleChange('teile_status', e.target.value)}
        >
          {TEILE_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </td>
      <td className="px-2 py-2">
        <input
          type="date"
          className="text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
          value={local.eff_start || ''}
          onChange={e => handleChange('eff_start', e.target.value)}
        />
      </td>
      <td className="px-2 py-2">
        <input
          type="date"
          className="text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
          value={local.eff_ende || ''}
          onChange={e => handleChange('eff_ende', e.target.value)}
        />
      </td>
      <td className="px-2 py-2 text-center">
        <input
          type="checkbox"
          checked={!!local.abgeschlossen}
          onChange={e => handleChange('abgeschlossen', e.target.checked)}
          className="w-4 h-4 rounded border-gray-300 text-blue-600"
        />
      </td>
      <td className="px-2 py-2">
        <div className="flex items-center gap-1">
          {dirty && (
            <button
              onClick={handleSave}
              className="text-xs px-2 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              ✓
            </button>
          )}
          <button
            onClick={() => onDelete(schritt.id)}
            className="text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded hover:bg-red-200"
          >
            ✕
          </button>
        </div>
      </td>
    </tr>
  )
}

function NewSchrittRow({ auftragId, monteure, kwOptions, onSave, onCancel }) {
  const [form, setForm] = useState({
    typ: 'Demontage',
    bezeichnung: '',
    monteur_id: '',
    kw: '',
    teile_status: 'N/A',
  })

  const handleSubmit = () => {
    if (!form.bezeichnung.trim()) return toast.error('Bezeichnung ist erforderlich')
    onSave({ ...form, auftrag_id: auftragId })
  }

  return (
    <tr className="bg-blue-50 border-b border-blue-100">
      <td className="px-2 py-2" />
      <td className="px-2 py-2 text-xs text-gray-400">neu</td>
      <td className="px-2 py-2">
        <select
          className="text-xs border border-blue-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
          value={form.typ}
          onChange={e => setForm(f => ({ ...f, typ: e.target.value }))}
        >
          {SCHRITT_TYPEN.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </td>
      <td className="px-2 py-2">
        <input
          type="text"
          autoFocus
          className="text-xs border border-blue-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 w-full min-w-[120px]"
          value={form.bezeichnung}
          onChange={e => setForm(f => ({ ...f, bezeichnung: e.target.value }))}
          placeholder="Bezeichnung *"
          onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); if (e.key === 'Escape') onCancel() }}
        />
      </td>
      <td className="px-2 py-2">
        <select
          className="text-xs border border-blue-300 rounded px-1.5 py-1 focus:outline-none bg-white"
          value={form.monteur_id}
          onChange={e => setForm(f => ({ ...f, monteur_id: e.target.value }))}
        >
          <option value="">– kein –</option>
          {monteure.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </td>
      <td className="px-2 py-2">
        <select
          className="text-xs border border-blue-300 rounded px-1.5 py-1 focus:outline-none bg-white"
          value={form.kw}
          onChange={e => setForm(f => ({ ...f, kw: e.target.value }))}
        >
          <option value="">– KW –</option>
          {kwOptions.map(kw => <option key={kw} value={kw}>{kwToLabel(kw)}</option>)}
        </select>
      </td>
      <td className="px-2 py-2">
        <select
          className="text-xs border border-blue-300 rounded px-1.5 py-1 focus:outline-none bg-white"
          value={form.teile_status}
          onChange={e => setForm(f => ({ ...f, teile_status: e.target.value }))}
        >
          {TEILE_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </td>
      <td colSpan={3} />
      <td className="px-2 py-2">
        <div className="flex items-center gap-1">
          <button onClick={handleSubmit} className="text-xs px-2 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700">Hinzufügen</button>
          <button onClick={onCancel} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded hover:bg-gray-200">Abbrechen</button>
        </div>
      </td>
    </tr>
  )
}

export default function AuftragDetail({ auftragId, onClose }) {
  const queryClient = useQueryClient()
  const [editHeader, setEditHeader] = useState(false)
  const [addingSchritt, setAddingSchritt] = useState(false)
  const [headerForm, setHeaderForm] = useState(null)
  const [localSchritte, setLocalSchritte] = useState(null)

  const kwOptions = getKWRange(new Date().getFullYear())

  const { data: auftrag, isLoading } = useQuery({
    queryKey: ['auftraege', auftragId],
    queryFn: () => auftraegeApi.getById(auftragId),
  })

  // Sync local schritte from server when auftrag first loads
  useEffect(() => {
    if (auftrag && !localSchritte) {
      setLocalSchritte(auftrag.schritte || [])
    }
  }, [auftrag, localSchritte])

  // Sync local schritte when auftrag loads
  const schritte = localSchritte || auftrag?.schritte || []

  const { data: monteure = [] } = useQuery({
    queryKey: ['monteure'],
    queryFn: monteureApi.getAll,
  })

  const updateAuftragMutation = useMutation({
    mutationFn: (data) => auftraegeApi.update(auftragId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auftraege'] })
      toast.success('Auftrag gespeichert')
      setEditHeader(false)
    },
    onError: (err) => toast.error(err.message),
  })

  const updateSchrittMutation = useMutation({
    mutationFn: ({ id, data }) => arbeitsschritteApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auftraege', auftragId] })
      queryClient.invalidateQueries({ queryKey: ['arbeitsschritte'] })
      toast.success('Schritt gespeichert')
    },
    onError: (err) => toast.error(err.message),
  })

  const deleteSchrittMutation = useMutation({
    mutationFn: (id) => arbeitsschritteApi.delete(id),
    onSuccess: (_, id) => {
      setLocalSchritte(ls => ls.filter(s => s.id !== id))
      queryClient.invalidateQueries({ queryKey: ['auftraege', auftragId] })
      queryClient.invalidateQueries({ queryKey: ['arbeitsschritte'] })
      toast.success('Schritt gelöscht')
    },
    onError: (err) => toast.error(err.message),
  })

  const createSchrittMutation = useMutation({
    mutationFn: (data) => arbeitsschritteApi.create(data),
    onSuccess: (newSchritt) => {
      setLocalSchritte(ls => [...(ls || []), newSchritt])
      queryClient.invalidateQueries({ queryKey: ['auftraege', auftragId] })
      queryClient.invalidateQueries({ queryKey: ['arbeitsschritte'] })
      toast.success('Schritt hinzugefügt')
      setAddingSchritt(false)
    },
    onError: (err) => toast.error(err.message),
  })

  const reorderMutation = useMutation({
    mutationFn: (positions) => auftraegeApi.reorder(auftragId, positions),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auftraege', auftragId] })
    },
    onError: (err) => toast.error(err.message),
  })

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const handleDragEnd = (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = schritte.findIndex(s => s.id === active.id)
    const newIdx = schritte.findIndex(s => s.id === over.id)
    const newOrder = arrayMove(schritte, oldIdx, newIdx)
    setLocalSchritte(newOrder)
    const positions = newOrder.reduce((acc, s, i) => { acc[s.id] = i; return acc }, {})
    reorderMutation.mutate(positions)
  }

  const handleDeleteSchritt = (id) => {
    if (window.confirm('Schritt wirklich löschen?')) {
      deleteSchrittMutation.mutate(id)
    }
  }

  const handleHeaderSave = () => {
    if (headerForm) {
      updateAuftragMutation.mutate(headerForm)
    }
  }

  const badgeCls = getAuftragBadgeClass(auftragId)

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl border border-gray-200 my-4">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`inline-flex items-center px-3 py-1 rounded text-sm font-bold ring-1 ring-inset ${badgeCls}`}>
              {auftragId}
            </span>
            {auftrag && !isLoading && (
              <>
                <span className="font-semibold text-gray-800">{auftrag.kunde}</span>
                <span className="text-gray-400">–</span>
                <span className="text-gray-600">{auftrag.getriebe_bezeichnung}</span>
                <StatusBadge status={auftrag.status} />
                {auftrag.liefertermin && (
                  <span className="text-xs text-gray-500">
                    Liefertermin: {new Date(auftrag.liefertermin).toLocaleDateString('de-DE')}
                  </span>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!editHeader && auftrag && (
              <button
                onClick={() => { setEditHeader(true); setHeaderForm({ ...auftrag }) }}
                className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
              >
                Bearbeiten
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none ml-2">&times;</button>
          </div>
        </div>

        {/* Edit header form */}
        {editHeader && headerForm && (
          <div className="px-6 py-4 bg-blue-50 border-b border-blue-100">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Kunde</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={headerForm.kunde || ''}
                  onChange={e => setHeaderForm(f => ({ ...f, kunde: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Getriebe</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={headerForm.getriebe_bezeichnung || ''}
                  onChange={e => setHeaderForm(f => ({ ...f, getriebe_bezeichnung: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                <select
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={headerForm.status || ''}
                  onChange={e => setHeaderForm(f => ({ ...f, status: e.target.value }))}
                >
                  {AUFTRAG_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Liefertermin</label>
                <input
                  type="date"
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={headerForm.liefertermin || ''}
                  onChange={e => setHeaderForm(f => ({ ...f, liefertermin: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={handleHeaderSave}
                disabled={updateAuftragMutation.isPending}
                className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Speichern
              </button>
              <button
                onClick={() => setEditHeader(false)}
                className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900"
              >
                Abbrechen
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="px-6 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <svg className="animate-spin w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Lade Auftrag…
            </div>
          ) : (
            <>
              {/* Schritte */}
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-700">Arbeitsschritte ({schritte.length})</h3>
                <button
                  onClick={() => setAddingSchritt(true)}
                  className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-1"
                >
                  <span>+</span> Schritt hinzufügen
                </button>
              </div>

              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={schritte.map(s => s.id)} strategy={verticalListSortingStrategy}>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="px-2 py-2 w-8" />
                            <th className="px-2 py-2 text-left text-xs font-semibold text-gray-500 w-8">#</th>
                            <th className="px-2 py-2 text-left text-xs font-semibold text-gray-500">Typ</th>
                            <th className="px-2 py-2 text-left text-xs font-semibold text-gray-500">Bezeichnung</th>
                            <th className="px-2 py-2 text-left text-xs font-semibold text-gray-500">Monteur</th>
                            <th className="px-2 py-2 text-left text-xs font-semibold text-gray-500">KW</th>
                            <th className="px-2 py-2 text-left text-xs font-semibold text-gray-500">Teile</th>
                            <th className="px-2 py-2 text-left text-xs font-semibold text-gray-500">Eff. Start</th>
                            <th className="px-2 py-2 text-left text-xs font-semibold text-gray-500">Eff. Ende</th>
                            <th className="px-2 py-2 text-center text-xs font-semibold text-gray-500">✓</th>
                            <th className="px-2 py-2 text-xs font-semibold text-gray-500">Aktionen</th>
                          </tr>
                        </thead>
                        <tbody>
                          {schritte.length === 0 && !addingSchritt ? (
                            <tr>
                              <td colSpan={11} className="text-center py-8 text-gray-400 text-sm">
                                Noch keine Schritte. Fügen Sie einen Schritt hinzu.
                              </td>
                            </tr>
                          ) : (
                            schritte.map((s, i) => (
                              <SortableSchritt
                                key={s.id}
                                schritt={s}
                                index={i}
                                monteure={monteure}
                                kwOptions={kwOptions}
                                onUpdate={(id, data) => updateSchrittMutation.mutate({ id, data })}
                                onDelete={handleDeleteSchritt}
                              />
                            ))
                          )}
                          {addingSchritt && (
                            <NewSchrittRow
                              auftragId={auftragId}
                              monteure={monteure}
                              kwOptions={kwOptions}
                              onSave={(data) => createSchrittMutation.mutate(data)}
                              onCancel={() => setAddingSchritt(false)}
                            />
                          )}
                        </tbody>
                      </table>
                    </SortableContext>
                  </DndContext>
                </div>
              </div>

              {/* Auftrag Bemerkungen */}
              {auftrag?.bemerkungen && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="text-xs font-medium text-gray-500 mb-1">Bemerkungen</div>
                  <p className="text-sm text-gray-700">{auftrag.bemerkungen}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
