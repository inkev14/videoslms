import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg = err.response?.data?.detail || err.message || 'Unbekannter Fehler'
    return Promise.reject(new Error(msg))
  }
)

// ─── Aufträge ────────────────────────────────────────────────────────────────
export const auftraegeApi = {
  getAll: (params) => api.get('/auftraege', { params }).then((r) => r.data),
  getById: (id) => api.get(`/auftraege/${id}`).then((r) => r.data),
  create: (data) => api.post('/auftraege', data).then((r) => r.data),
  update: (id, data) => api.put(`/auftraege/${id}`, data).then((r) => r.data),
  delete: (id) => api.delete(`/auftraege/${id}`).then((r) => r.data),
  reorder: (id, items) =>
    api.put(`/auftraege/${id}/reorder`, { items }).then((r) => r.data),
}

// ─── Arbeitsschritte ─────────────────────────────────────────────────────────
export const arbeitsschritteApi = {
  getAll: (filters) =>
    api.get('/arbeitsschritte', { params: filters }).then((r) => r.data),
  create: (data) => api.post('/arbeitsschritte', data).then((r) => r.data),
  update: (id, data) => api.put(`/arbeitsschritte/${id}`, data).then((r) => r.data),
  delete: (id) => api.delete(`/arbeitsschritte/${id}`).then((r) => r.data),
  verschieben: (id, neue_kw) =>
    api.post(`/arbeitsschritte/${id}/verschieben`, { neue_kw }).then((r) => r.data),
}

// ─── Monteure ────────────────────────────────────────────────────────────────
export const monteureApi = {
  getAll: () => api.get('/monteure').then((r) => r.data),
  create: (data) => api.post('/monteure', data).then((r) => r.data),
  update: (id, data) => api.put(`/monteure/${id}`, data).then((r) => r.data),
  getAuslastung: (id) =>
    api.get(`/monteure/${id}/auslastung`).then((r) => r.data),
}

// ─── Vorlagen ────────────────────────────────────────────────────────────────
export const vorlagenApi = {
  getAll: () => api.get('/vorlagen').then((r) => r.data),
  getById: (id) => api.get(`/vorlagen/${id}`).then((r) => r.data),
  create: (data) => api.post('/vorlagen', data).then((r) => r.data),
  update: (id, data) => api.put(`/vorlagen/${id}`, data).then((r) => r.data),
  delete: (id) => api.delete(`/vorlagen/${id}`).then((r) => r.data),
  addSchritt: (id, data) =>
    api.post(`/vorlagen/${id}/schritte`, data).then((r) => r.data),
  updateSchritt: (vorlagenId, schrittId, data) =>
    api
      .put(`/vorlagen/${vorlagenId}/schritte/${schrittId}`, data)
      .then((r) => r.data),
  deleteSchritt: (vorlagenId, schrittId) =>
    api.delete(`/vorlagen/${vorlagenId}/schritte/${schrittId}`).then((r) => r.data),
  reorder: (id, items) =>
    api.put(`/vorlagen/${id}/reorder`, { items }).then((r) => r.data),
  duplizieren: (id) =>
    api.post(`/vorlagen/${id}/duplizieren`).then((r) => r.data),
}

// ─── Auswärts ─────────────────────────────────────────────────────────────────
export const auswärtsApi = {
  getAll: (params) => api.get('/auswarts', { params }).then((r) => r.data),
  create: (data) => api.post('/auswarts', data).then((r) => r.data),
  update: (id, data) => api.put(`/auswarts/${id}`, data).then((r) => r.data),
  delete: (id) => api.delete(`/auswarts/${id}`).then((r) => r.data),
}

export default api
