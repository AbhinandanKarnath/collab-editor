import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import './SharedWithMe.css'

function SharedWithMe({ user, onOpenDocument }) {
  const [sharedDocs, setSharedDocs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user?.name) fetchSharedDocs()
  }, [user])

  const fetchSharedDocs = async () => {
    setLoading(true)
    try {
      const data = await api.getSharedWithMe(user.name)
      setSharedDocs(data || [])
    } catch (error) {
      console.error('Error fetching shared documents:', error)
    } finally {
      setLoading(false)
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
    <div className="shared-page">
      <div className="shared-inner">
        <div className="shared-header">
          <div className="shared-header-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--blue-600)" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
            </svg>
          </div>
          <div>
            <h2>Shared with Me</h2>
            <p>Documents that others have shared with you</p>
          </div>
        </div>

        {loading ? (
          <div className="shared-loading">
            <div className="loading-spinner"></div>
            <p>Loading shared documents...</p>
          </div>
        ) : sharedDocs.length === 0 ? (
          <div className="shared-empty">
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="var(--gray-300)" strokeWidth="1">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
            </svg>
            <h3>No shared documents</h3>
            <p>When someone shares a document with you, it will appear here.</p>
          </div>
        ) : (
          <div className="shared-list">
            {sharedDocs.map((doc) => (
              <div key={doc.id} className="shared-item" onClick={() => onOpenDocument(doc.id)}>
                <div className="shared-item-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="3" width="18" height="18" rx="3" fill="var(--blue-600)" />
                    <path d="M8 8h8M8 12h6M8 16h4" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="shared-item-info">
                  <span className="shared-item-title">{doc.title}</span>
                  <div className="shared-item-meta">
                    <span className="shared-owner">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      {doc.owner || 'Unknown'}
                    </span>
                    <span className="shared-meta-dot">·</span>
                    <span>{formatDate(doc.updated_at)}</span>
                  </div>
                </div>
                <svg className="shared-item-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--gray-500)" strokeWidth="2">
                  <polyline points="9,18 15,12 9,6" />
                </svg>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default SharedWithMe
