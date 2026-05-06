import { useState } from 'react'
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
import { vorlagenApi } from '../api/client.js'

const SCHRITT_TYPEN = [
  'Demontage', 'Reinigen', 'Sandstrahlen', 'Montage Baugruppe',
  'Montage', 'Auswärts', 'Qualitätskontrolle', 'Sonstiges',
]

function DragHandle({ attributes, listeners }) {
  return (
    <button
      className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 p-1 touch-none"
      {...attributes}
      {...listeners}
    >
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z"/>
      </svg>
    </button>
  )
}

function SortableSchrittRow({ schritt, index, onChange, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: schritt.tempId || schritt.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <tr ref={setNodeRef} style={style} className={`border-b border-gray-100 ${isDragging ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
      <td className="px-2 py-2">
        <DragHandle attributes={attributes} listeners={listeners} />
      </td>
      <td className="px-2 py-2 text-xs text-gray-400 w-6">{index + 1}</td>
      <td className="px-2 py-2">
        <select
          className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
          value={schritt.typ || 'Demontage'}
          onChange={e => onChange(schritt.tempId || schritt.id, 'typ', e.target.value)}
        >
          {SCHRITT_TYPEN.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </td>
      <td className="px-2 py-2">
        <input
          type="text"
          className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
          value={schritt.bezeichnung || ''}
          onChange={e => onChange(schritt.tempId || schritt.id, 'bezeichnung', e.target.value)}
          placeholder="Schrittbezeichnung"
        />
      </td>
      <td className="px-2 py-2">
        <button
          onClick={() => onDelete(schritt.tempId || schritt.id)}
          className="text-xs px-2 py-1 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 hover:text-red-700 transition-colors"
        >
          Entfernen
        </button>
      </td>
    </tr>
  )
}

function VorlageEditor({ vorlage, onClose }) {
  const queryClient = useQueryClient()
  const isNew = !vorlage

  const [name, setName] = useState(vorlage?.name || '')
  const [description, setDescription] = useState(vorlage?.beschreibung || '')
  const [schritte, setSchritte] = useState(() => {
    return (vorlage?.schritte || []).map((s, i) => ({ ...s, tempId: s.id || `new-${i}` }))
  })
  let tempCounter = schritte.length

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      if (isNew) {
        return vorlagenApi.create(payload)
      } else {
        return vorlagenApi.update(vorlage.id, payload)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vorlagen'] })
      toast.success(isNew ? 'Vorlage angelegt' : 'Vorlage gespeichert')
      onClose()
    },
    onError: (err) => toast.error(err.message),
  })

  const handleAddSchritt = () => {
    const tempId = `new-${++tempCounter}`
    setSchritte(s => [...s, { tempId, typ: 'Demontage', bezeichnung: '', position: s.length }])
  }

  const handleChangeSchritt = (tempId, field, value) => {
    setSchritte(s => s.map(sc => (sc.tempId === tempId || sc.id === tempId) ? { ...sc, [field]: value } : sc))
  }

  const handleDeleteSchritt = (tempId) => {
    setSchritte(s => s.filter(sc => sc.tempId !== tempId && sc.id !== tempId))
  }

  const handleDragEnd = (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setSchritte(s => {
      const oldIdx = s.findIndex(sc => (sc.tempId || sc.id) === active.id)
      const newIdx = s.findIndex(sc => (sc.tempId || sc.id) === over.id)
      return arrayMove(s, oldIdx, newIdx)
    })
  }

  const handleSave = () => {
    if (!name.trim()) return toast.error('Name ist erforderlich')
    if (schritte.length === 0) return toast.error('Mindestens ein Schritt erforderlich')
    for (const s of schritte) {
      if (!s.bezeichnung.trim()) return toast.error('Alle Schritte müssen eine Bezeichnung haben')
    }
    const payload = {
      name: name.trim(),
      beschreibung: description.trim(),
      schritte: schritte.map((s, i) => ({
        ...(s.id && !String(s.id).startsWith('new-') ? { id: s.id } : {}),
        typ: s.typ,
        bezeichnung: s.bezeichnung,
        position: i,
      })),
    }
    saveMutation.mutate(payload)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-gray-200 my-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">
            {isNew ? 'Neue Vorlage' : `Vorlage bearbeiten: ${vorlage.name}`}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">&times;</button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Name & Description */}
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Vorlagenname *</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="z.B. Revision Standard"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Beschreibung</label>
              <textarea
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Optionale Beschreibung…"
              />
            </div>
          </div>

          {/* Schritte */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-600">
                Arbeitsschritte ({schritte.length})
              </label>
              <button
                onClick={handleAddSchritt}
                className="text-xs px-3 py-1 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
              >
                + Schritt hinzufügen
              </button>
            </div>

            <div className="border border-gray-200 rounded-xl overflow-hidden">
              {schritte.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  Noch keine Schritte. Fügen Sie mindestens einen Schritt hinzu.
                </div>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext
                    items={schritte.map(s => s.tempId || s.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-2 py-2 w-8" />
                          <th className="px-2 py-2 w-6" />
                          <th className="px-2 py-2 text-left text-xs font-semibold text-gray-500">Typ</th>
                          <th className="px-2 py-2 text-left text-xs font-semibold text-gray-500">Bezeichnung</th>
                          <th className="px-2 py-2 text-xs font-semibold text-gray-500" />
                        </tr>
                      </thead>
                      <tbody>
                        {schritte.map((s, i) => (
                          <SortableSchrittRow
                            key={s.tempId || s.id}
                            schritt={s}
                            index={i}
                            onChange={handleChangeSchritt}
                            onDelete={handleDeleteSchritt}
                          />
                        ))}
                      </tbody>
                    </table>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              Abbrechen
            </button>
            <button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {saveMutation.isPending ? 'Speichern…' : isNew ? 'Vorlage anlegen' : 'Speichern'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function VorlagenVerwaltung() {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(null)  // null = closed, false = new, vorlage = edit
  const [showEditor, setShowEditor] = useState(false)

  const { data: vorlagen = [], isLoading } = useQuery({
    queryKey: ['vorlagen'],
    queryFn: vorlagenApi.getAll,
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => vorlagenApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vorlagen'] })
      toast.success('Vorlage gelöscht')
    },
    onError: (err) => toast.error(err.message),
  })

  const duplizierenMutation = useMutation({
    mutationFn: (id) => vorlagenApi.duplizieren(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vorlagen'] })
      toast.success('Vorlage dupliziert')
    },
    onError: (err) => toast.error(err.message),
  })

  const handleDelete = (v) => {
    if (window.confirm(`Vorlage „${v.name}" wirklich löschen?`)) {
      deleteMutation.mutate(v.id)
    }
  }

  const handleDuplizieren = (v) => {
    duplizierenMutation.mutate(v.id)
  }

  const openNew = () => { setEditing(null); setShowEditor(true) }
  const openEdit = (v) => { setEditing(v); setShowEditor(true) }
  const closeEditor = () => { setShowEditor(false); setEditing(null) }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Vorlagenverwaltung</h2>
          <p className="text-sm text-gray-500">Wiederverwendbare Arbeitsablauf-Vorlagen</p>
        </div>
        <button
          onClick={openNew}
          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
        >
          <span className="text-lg leading-none">+</span> Neue Vorlage
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <svg className="animate-spin w-6 h-6 mr-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          Lade Vorlagen…
        </div>
      ) : vorlagen.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm text-center py-16 text-gray-400">
          <p className="text-lg font-medium">Noch keine Vorlagen</p>
          <p className="text-sm mt-1">Klicken Sie auf „Neue Vorlage" um zu beginnen.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {vorlagen.map(v => (
            <div key={v.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col gap-3">
              {/* Top */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-gray-800">{v.name}</h3>
                  {v.beschreibung && (
                    <p className="text-xs text-gray-500 mt-0.5">{v.beschreibung}</p>
                  )}
                </div>
                <span className="flex-shrink-0 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full">
                  {v.schritte?.length ?? 0} Schritte
                </span>
              </div>

              {/* Schritte preview */}
              {v.schritte && v.schritte.length > 0 && (
                <ol className="space-y-1">
                  {v.schritte.slice(0, 5).map((s, i) => (
                    <li key={s.id || i} className="flex items-center gap-2 text-xs text-gray-600">
                      <span className="w-4 h-4 flex-shrink-0 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center font-medium text-[10px]">
                        {i + 1}
                      </span>
                      <span className="font-medium text-gray-700">{s.typ}</span>
                      <span className="text-gray-400 truncate">{s.bezeichnung}</span>
                    </li>
                  ))}
                  {v.schritte.length > 5 && (
                    <li className="text-xs text-gray-400 pl-6">+{v.schritte.length - 5} weitere…</li>
                  )}
                </ol>
              )}

              {/* Meta */}
              {v.erstellt_am && (
                <div className="text-xs text-gray-400">
                  Erstellt: {new Date(v.erstellt_am).toLocaleDateString('de-DE')}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                <button
                  onClick={() => openEdit(v)}
                  className="flex-1 text-center text-xs py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Bearbeiten
                </button>
                <button
                  onClick={() => handleDuplizieren(v)}
                  disabled={duplizierenMutation.isPending}
                  className="flex-1 text-center text-xs py-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
                >
                  Duplizieren
                </button>
                <button
                  onClick={() => handleDelete(v)}
                  disabled={deleteMutation.isPending}
                  className="flex-1 text-center text-xs py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  Löschen
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor Modal */}
      {showEditor && (
        <VorlageEditor
          vorlage={editing}
          onClose={closeEditor}
        />
      )}
    </div>
  )
}
