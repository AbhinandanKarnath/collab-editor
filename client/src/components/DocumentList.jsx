import { useState } from 'react'
import { api } from '../lib/api'
import './DocumentList.css'

function DocumentList({ documents, user, onCreateDocument, onOpenDocument, onDeleteDocument, onRefresh }) {
  const [menuOpen, setMenuOpen] = useState(null)
  const [shareModal, setShareModal] = useState(null)
  const [allUsers, setAllUsers] = useState([])
  const [searchUser, setSearchUser] = useState('')

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now - date
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    if (diff < 604800000) return date.toLocaleDateString('en-US', { weekday: 'short' })
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const getVisibilityIcon = (visibility) => {
    switch (visibility) {
      case 'private':
        return (
          <span className="vis-badge vis-private" title="Private">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
            Private
          </span>
        )
      case 'shared':
        return (
          <span className="vis-badge vis-shared" title="Shared">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
            </svg>
            Shared
          </span>
        )
      default:
        return (
          <span className="vis-badge vis-public" title="Public">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
            </svg>
            Public
          </span>
        )
    }
  }

  const handleVisibilityChange = async (doc, newVisibility) => {
    try {
      await api.updateDocument(doc.id, { visibility: newVisibility })
      setMenuOpen(null)
      onRefresh()
    } catch (error) {
      console.error('Error updating visibility:', error)
    }
  }

  const openShareModal = async (doc) => {
    setShareModal(doc)
    setMenuOpen(null)
    try {
      const users = await api.getUsers()
      setAllUsers(users.filter(u => u.name !== user?.name))
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  const handleShare = async (userName) => {
    if (!shareModal) return
    try {
      const currentShared = shareModal.shared_with || []
      if (currentShared.includes(userName)) return
      await api.shareDocument(shareModal.id, [...currentShared, userName])
      // Also set visibility to shared
      await api.updateDocument(shareModal.id, { visibility: 'shared' })
      setShareModal({ ...shareModal, shared_with: [...currentShared, userName] })
      onRefresh()
    } catch (error) {
      console.error('Error sharing document:', error)
    }
  }

  const handleUnshare = async (userName) => {
    if (!shareModal) return
    try {
      await api.unshareDocument(shareModal.id, userName)
      const updated = (shareModal.shared_with || []).filter(u => u !== userName)
      setShareModal({ ...shareModal, shared_with: updated })
      if (updated.length === 0) {
        await api.updateDocument(shareModal.id, { visibility: 'public' })
      }
      onRefresh()
    } catch (error) {
      console.error('Error unsharing document:', error)
    }
  }

  const filteredUsers = allUsers.filter(u =>
    u.name.toLowerCase().includes(searchUser.toLowerCase()) &&
    !(shareModal?.shared_with || []).includes(u.name)
  )

  return (
    <div className="doclist-page">
      {/* Hero Section */}
      <div className="doclist-hero">
        <div className="doclist-hero-inner">
          <h2>Start a new document</h2>
          <div className="doclist-templates">
            <button className="template-card" onClick={onCreateDocument}>
              <div className="template-preview">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--blue-600)" strokeWidth="1.5">
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
              </div>
              <span>Blank document</span>
            </button>
          </div>
        </div>
      </div>

      {/* Document List */}
      <div className="doclist-section">
        <div className="doclist-section-inner">
          <div className="doclist-section-header">
            <h3>Recent documents</h3>
            <button className="refresh-btn" onClick={onRefresh} title="Refresh">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23,4 23,10 17,10" />
                <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
              </svg>
            </button>
          </div>

          {documents.length === 0 ? (
            <div className="doclist-empty">
              <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="var(--gray-300)" strokeWidth="1">
                <rect x="4" y="2" width="16" height="20" rx="2" />
                <path d="M8 6h8M8 10h6M8 14h4" strokeLinecap="round" />
              </svg>
              <p>No documents yet. Create one to get started!</p>
            </div>
          ) : (
            <div className="doclist-grid">
              {documents.map((doc) => (
                <div key={doc.id} className="doc-card">
                  <div className="doc-card-preview" onClick={() => onOpenDocument(doc.id)}>
                    <div className="doc-card-preview-lines">
                      <div className="line line-h" style={{ width: '70%' }}></div>
                      <div className="line" style={{ width: '85%' }}></div>
                      <div className="line" style={{ width: '60%' }}></div>
                      <div className="line" style={{ width: '75%' }}></div>
                      <div className="line" style={{ width: '40%' }}></div>
                    </div>
                  </div>
                  <div className="doc-card-info">
                    <div className="doc-card-top">
                      <span className="doc-card-title" onClick={() => onOpenDocument(doc.id)}>
                        {doc.title}
                      </span>
                      <div className="doc-card-actions">
                        <button
                          className="doc-menu-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            setMenuOpen(menuOpen === doc.id ? null : doc.id)
                          }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="5" r="2" />
                            <circle cx="12" cy="12" r="2" />
                            <circle cx="12" cy="19" r="2" />
                          </svg>
                        </button>

                        {menuOpen === doc.id && (
                          <div className="doc-menu">
                            <button onClick={() => { handleVisibilityChange(doc, 'public'); }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                              </svg>
                              Set Public
                            </button>
                            <button onClick={() => { handleVisibilityChange(doc, 'private'); }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="11" width="18" height="11" rx="2" />
                                <path d="M7 11V7a5 5 0 0110 0v4" />
                              </svg>
                              Set Private
                            </button>
                            <button onClick={() => openShareModal(doc)}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="18" cy="5" r="3" />
                                <circle cx="6" cy="12" r="3" />
                                <circle cx="18" cy="19" r="3" />
                                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                              </svg>
                              Share...
                            </button>
                            <div className="menu-divider"></div>
                            <button className="menu-danger" onClick={() => { setMenuOpen(null); onDeleteDocument(doc.id); }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3,6 5,6 21,6" />
                                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                              </svg>
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="doc-card-meta">
                      {getVisibilityIcon(doc.visibility)}
                      <span className="meta-dot">·</span>
                      <span>{formatDate(doc.updated_at)}</span>
                      {doc.owner && <><span className="meta-dot">·</span><span>{doc.owner}</span></>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Share Modal */}
      {shareModal && (
        <div className="modal-overlay" onClick={() => setShareModal(null)}>
          <div className="share-modal" onClick={(e) => e.stopPropagation()}>
            <div className="share-modal-header">
              <h3>Share "{shareModal.title}"</h3>
              <button className="share-close" onClick={() => setShareModal(null)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="share-search">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gray-500)" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search users to share with..."
                value={searchUser}
                onChange={(e) => setSearchUser(e.target.value)}
                autoFocus
              />
            </div>

            {/* Already shared with */}
            {(shareModal.shared_with || []).length > 0 && (
              <div className="share-section">
                <h4>Shared with</h4>
                <div className="share-user-list">
                  {(shareModal.shared_with || []).map(name => (
                    <div key={name} className="share-user-item">
                      <div className="share-user-avatar">{name.charAt(0).toUpperCase()}</div>
                      <span className="share-user-name">{name}</span>
                      <button className="share-remove-btn" onClick={() => handleUnshare(name)}>Remove</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Available users to share */}
            <div className="share-section">
              <h4>Add people</h4>
              <div className="share-user-list">
                {filteredUsers.length === 0 ? (
                  <p className="share-empty">No users found</p>
                ) : (
                  filteredUsers.map(u => (
                    <div key={u.name} className="share-user-item">
                      <div className="share-user-avatar" style={{ background: u.color || 'var(--blue-600)' }}>
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="share-user-name">{u.name}</span>
                      <button className="share-add-btn" onClick={() => handleShare(u.name)}>Share</button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DocumentList
