// All API calls go through the Vite proxy (relative paths).
// Vite forwards /api/* → http://localhost:3001/api/*
// This means the frontend works on ANY IP/hostname — no more ERR_CONNECTION_TIMED_OUT.

async function request(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || 'Request failed')
  }
  return res.json()
}

/** Same host as the page, port 3001 — bypasses Vite proxy (avoids ~100kb body truncation on POST). */
function getDirectApiBase() {
  if (typeof window === 'undefined') return ''
  return `http://${window.location.hostname}:3001`
}

export const api = {
  // ── Documents ──────────────────────────────────
  getDocuments(owner) {
    const params = owner ? `?owner=${encodeURIComponent(owner)}` : ''
    return request(`/api/documents${params}`)
  },

  getDocument(id) {
    return request(`/api/documents/${id}`)
  },

  createDocument(title, content, owner) {
    return request('/api/documents', {
      method: 'POST',
      body: JSON.stringify({ title, content, owner, visibility: 'public' }),
    })
  },

  updateDocument(id, updates) {
    return request(`/api/documents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    })
  },

  deleteDocument(id) {
    return request(`/api/documents/${id}`, { method: 'DELETE' })
  },

  updateContent(id, title, content) {
    return request(`/api/documents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title, content }),
    })
  },

  summarize(id) {
    return request(`/api/documents/${id}/summarize`, { method: 'POST' })
  },

  extractKeywords(id) {
    return request(`/api/documents/${id}/keywords`, { method: 'POST' })
  },

  // ── Sharing ────────────────────────────────────
  shareDocument(documentId, sharedWith) {
    return request(`/api/documents/${documentId}/share`, {
      method: 'POST',
      body: JSON.stringify({ shared_with: sharedWith }),
    })
  },

  unshareDocument(documentId, userName) {
    return request(`/api/documents/${documentId}/unshare`, {
      method: 'POST',
      body: JSON.stringify({ user_name: userName }),
    })
  },

  getSharedWithMe(userName) {
    return request(`/api/documents/shared-with/${encodeURIComponent(userName)}`)
  },

  // ── Snapshots & versions ─────────────────────
  listSnapshots(documentId) {
    return request(`/api/documents/${documentId}/snapshots`)
  },

  getSnapshot(documentId, snapshotId) {
    return request(`/api/documents/${documentId}/snapshots/${snapshotId}`)
  },

  getDirectApiBase: getDirectApiBase,

  createSnapshot(documentId, body) {
    const base = getDirectApiBase()
    const url = base
      ? `${base}/api/documents/${documentId}/snapshots`
      : `/api/documents/${documentId}/snapshots`
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(err.error || 'Request failed')
      }
      return res.json()
    })
  },

  diffSnapshots(documentId, fromId, toId) {
    const q = new URLSearchParams({ from: fromId, to: toId })
    return request(`/api/documents/${documentId}/snapshots/diff?${q}`)
  },

  restoreSnapshot(documentId, snapshotId) {
    return request(`/api/documents/${documentId}/snapshots/${snapshotId}/restore`, {
      method: 'POST',
    })
  },

  // ── Branches ─────────────────────────────────
  forkDocument(documentId, body = {}) {
    return request(`/api/documents/${documentId}/fork`, {
      method: 'POST',
      body: JSON.stringify(body),
    })
  },

  listBranches(documentId) {
    return request(`/api/documents/${documentId}/branches`)
  },

  getLineage(documentId) {
    return request(`/api/documents/${documentId}/lineage`)
  },

  exportDocumentBlob(documentId, format) {
    return fetch(`/api/documents/${documentId}/export?format=${encodeURIComponent(format)}`).then(
      async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || res.statusText)
        }
        return res.blob()
      }
    )
  },

  importDocument(documentId, file) {
    const fd = new FormData()
    fd.append('file', file)
    const base = getDirectApiBase()
    const url = base
      ? `${base}/api/documents/${documentId}/import`
      : `/api/documents/${documentId}/import`
    return fetch(url, { method: 'POST', body: fd }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || res.statusText)
      }
      return res.json()
    })
  },

  mergeDocuments(documentId, otherDocumentId, strategy = 'markers') {
    return request(`/api/documents/${documentId}/merge`, {
      method: 'POST',
      body: JSON.stringify({ otherDocumentId, strategy }),
    })
  },

  // ── Users / Contacts ──────────────────────────
  getUsers() {
    return request('/api/users')
  },

  registerUser(name, color) {
    return request('/api/users', {
      method: 'POST',
      body: JSON.stringify({ name, color }),
    })
  },

  // ── Socket helper ─────────────────────────────
  // Socket.io connects directly to backend on port 3001
  // This avoids Vite proxy websocket errors
  getSocketUrl() {
    if (typeof window === 'undefined') return 'http://localhost:3001'
    return `http://${window.location.hostname}:3001`
  },
}
