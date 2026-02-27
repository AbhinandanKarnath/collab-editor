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
    // In development, always use localhost:3001 for websockets
    // API calls still go through Vite proxy (relative /api paths)
    return 'http://localhost:3001'
  },
}
