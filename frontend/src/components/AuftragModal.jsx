import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { auftraegeApi, vorlagenApi } from '../api/client.js'

const AUFTRAG_TYPEN = ['Revision Inhouse', 'Revision Auswärts', 'Neugetriebe']

const TYPE_PREFIX = {
  'Revision Inhouse': 'REV',
  'Revision Auswärts': 'REVA',
  'Neugetriebe': 'NEU',
}

function suggestId(typ, existing) {
  const prefix = TYPE_PREFIX[typ] || 'AUF'
  const nums = existing
    .filter(a => (a.id || '').startsWith(prefix))
    .map(a => {
      const m = (a.id || '').match(/-(\d+)$/)
      return m ? parseInt(m[1], 10) : 0
    })
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1
  return `${prefix}-${String(next).padStart(3, '0')}`
}

export default function AuftragModal({ auftrag, onClose }) {
  const queryClient = useQueryClient()
  const isEdit = !!auftrag

  const { data: vorlagen = [] } = useQuery({
    queryKey: ['vorlagen'],
    queryFn: vorlagenApi.getAll,
  })

  const { data: existingAuftraege = [] } = useQuery({
    queryKey: ['auftraege'],
    queryFn: () => auftraegeApi.getAll(),
  })

  const [form, setForm] = useState({
    id: auftrag?.id || '',
    kunde: auftrag?.kunde || '',
    typ: auftrag?.typ || 'Revision Inhouse',
    getriebe_bezeichnung: auftrag?.getriebe_bezeichnung || '',
    liefertermin: auftrag?.liefertermin || '',
    anlieferung: auftrag?.anlieferung || '',
    bemerkungen: auftrag?.bemerkungen || '',
    vorlage_id: '',
  })

  // Auto-suggest ID when typ changes (only on create)
  useEffect(() => {
    if (!isEdit && existingAuftraege.length >= 0) {
      setForm(f => ({ ...f, id: suggestId(f.typ, existingAuftraege) }))
    }
  }, [form.typ, existingAuftraege.length, isEdit])

  const mutation = useMutation({
    mutationFn: isEdit
      ? (data) => auftraegeApi.update(auftrag.id, data)
      : (data) => auftraegeApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auftraege'] })
      queryClient.invalidateQueries({ queryKey: ['arbeitsschritte'] })
      toast.success(isEdit ? 'Auftrag aktualisiert' : 'Auftrag angelegt')
      onClose()
    },
    onError: (err) => toast.error(err.message),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.id.trim()) return toast.error('Auftrags-Nr ist erforderlich')
    if (!form.kunde.trim()) return toast.error('Kunde ist erforderlich')

    const payload = {
      id: form.id.trim(),
      kunde: form.kunde.trim(),
      typ: form.typ,
      getriebe_bezeichnung: form.getriebe_bezeichnung.trim(),
      liefertermin: form.liefertermin || null,
      anlieferung: form.anlieferung || null,
      bemerkungen: form.bemerkungen.trim(),
    }
    if (!isEdit && form.vorlage_id) {
      payload.vorlage_id = form.vorlage_id
    }
    mutation.mutate(payload)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200 animate-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">
            {isEdit ? `Auftrag bearbeiten – ${auftrag.id}` : 'Neuer Auftrag'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">&times;</button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Typ */}
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Auftragstyp</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.typ}
                onChange={e => setForm(f => ({ ...f, typ: e.target.value }))}
              >
                {AUFTRAG_TYPEN.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {/* ID */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Auftrags-Nr *</label>
              <input
                type="text"
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.id}
                onChange={e => setForm(f => ({ ...f, id: e.target.value }))}
                placeholder="z.B. REV-001"
              />
            </div>

            {/* Kunde */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Kunde *</label>
              <input
                type="text"
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.kunde}
                onChange={e => setForm(f => ({ ...f, kunde: e.target.value }))}
                placeholder="Kundenname"
              />
            </div>

            {/* Getriebe */}
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Getriebe-Bezeichnung</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.getriebe_bezeichnung}
                onChange={e => setForm(f => ({ ...f, getriebe_bezeichnung: e.target.value }))}
                placeholder="z.B. ZF 16S 1820 TD"
              />
            </div>

            {/* Anlieferung */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Anlieferung</label>
              <input
                type="date"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.anlieferung}
                onChange={e => setForm(f => ({ ...f, anlieferung: e.target.value }))}
              />
            </div>

            {/* Liefertermin */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Liefertermin</label>
              <input
                type="date"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.liefertermin}
                onChange={e => setForm(f => ({ ...f, liefertermin: e.target.value }))}
              />
            </div>

            {/* Bemerkungen */}
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Bemerkungen</label>
              <textarea
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                value={form.bemerkungen}
                onChange={e => setForm(f => ({ ...f, bemerkungen: e.target.value }))}
                placeholder="Interne Notizen…"
              />
            </div>

            {/* Vorlage (only for new) */}
            {!isEdit && (
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Vorlage verwenden</label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.vorlage_id}
                  onChange={e => setForm(f => ({ ...f, vorlage_id: e.target.value }))}
                >
                  <option value="">Ohne Vorlage</option>
                  {vorlagen.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.schritte?.length ?? 0} Schritte)
                    </option>
                  ))}
                </select>
                {form.vorlage_id && (
                  <p className="text-xs text-blue-600 mt-1">
                    Schritte werden automatisch aus der Vorlage übernommen.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {mutation.isPending ? 'Speichern…' : isEdit ? 'Speichern' : 'Auftrag anlegen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
