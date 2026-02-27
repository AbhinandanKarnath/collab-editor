import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import './Contacts.css'

function Contacts({ user, onOpenDocument }) {
  const [users, setUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [userDocs, setUserDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [docsLoading, setDocsLoading] = useState(false)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const data = await api.getUsers()
      setUsers((data || []).filter(u => u.name !== user?.name))
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectUser = async (contact) => {
    setSelectedUser(contact)
    setDocsLoading(true)
    try {
      const data = await api.getDocuments(contact.name)
      // Only show public + shared-with-me docs
      const visible = (data || []).filter(doc =>
        doc.visibility === 'public' ||
        (doc.visibility === 'shared' && (doc.shared_with || []).includes(user?.name))
      )
      setUserDocs(visible)
    } catch (error) {
      console.error('Error fetching user docs:', error)
    } finally {
      setDocsLoading(false)
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now - date
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="contacts-page">
      <div className="contacts-inner">
        <div className="contacts-layout">
          {/* Contacts Sidebar */}
          <div className="contacts-sidebar">
            <div className="contacts-sidebar-header">
              <h3>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                Contacts
              </h3>
              <span className="contacts-count">{users.length}</span>
            </div>

            {loading ? (
              <div className="contacts-loading">
                <div className="loading-spinner"></div>
              </div>
            ) : users.length === 0 ? (
              <div className="contacts-empty-sidebar">
                <p>No other users yet</p>
              </div>
            ) : (
              <div className="contacts-list">
                {users.map((contact) => (
                  <button
                    key={contact.name}
                    className={`contact-item ${selectedUser?.name === contact.name ? 'active' : ''}`}
                    onClick={() => handleSelectUser(contact)}
                  >
                    <div className="contact-avatar" style={{ background: contact.color || 'var(--blue-600)' }}>
                      {contact.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="contact-info">
                      <span className="contact-name">{contact.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* User's Documents */}
          <div className="contacts-content">
            {!selectedUser ? (
              <div className="contacts-empty-content">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--gray-300)" strokeWidth="1">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <h3>Select a contact</h3>
                <p>Click on a user to see their shared documents</p>
              </div>
            ) : (
              <>
                <div className="contacts-content-header">
                  <div className="contact-selected-avatar" style={{ background: selectedUser.color || 'var(--blue-600)' }}>
                    {selectedUser.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3>{selectedUser.name}'s Documents</h3>
                    <p>Public and shared documents</p>
                  </div>
                </div>

                {docsLoading ? (
                  <div className="contacts-loading">
                    <div className="loading-spinner"></div>
                  </div>
                ) : userDocs.length === 0 ? (
                  <div className="contacts-no-docs">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--gray-300)" strokeWidth="1.5">
                      <rect x="4" y="2" width="16" height="20" rx="2" />
                      <path d="M8 6h8M8 10h6M8 14h4" strokeLinecap="round" />
                    </svg>
                    <p>No visible documents from {selectedUser.name}</p>
                  </div>
                ) : (
                  <div className="contacts-docs-list">
                    {userDocs.map((doc) => (
                      <div key={doc.id} className="contacts-doc-item" onClick={() => onOpenDocument(doc.id)}>
                        <div className="contacts-doc-icon">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                            <rect x="3" y="3" width="18" height="18" rx="3" fill="var(--blue-600)" />
                            <path d="M8 8h8M8 12h6M8 16h4" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
                          </svg>
                        </div>
                        <div className="contacts-doc-info">
                          <span className="contacts-doc-title">{doc.title}</span>
                          <div className="contacts-doc-meta">
                            <span className={`vis-badge-sm vis-${doc.visibility || 'public'}`}>
                              {doc.visibility || 'public'}
                            </span>
                            <span>· {formatDate(doc.updated_at)}</span>
                          </div>
                        </div>
                        <svg className="contacts-doc-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gray-500)" strokeWidth="2">
                          <polyline points="9,18 15,12 9,6" />
                        </svg>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Contacts
