import { useState } from 'react'
import './Header.css'

function Header({ user, onSetUser, onBackToList, activeTab, onTabChange }) {
  const [showNamePrompt, setShowNamePrompt] = useState(!user)
  const [tempName, setTempName] = useState('')

  const handleSubmitName = (e) => {
    e.preventDefault()
    if (tempName.trim()) {
      onSetUser(tempName.trim())
      setShowNamePrompt(false)
    }
  }

  return (
    <>
      <header className="header">
        <div className="header-left">
          {onBackToList && (
            <button onClick={onBackToList} className="header-back-btn" title="Back to documents">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div className="header-logo">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="18" height="18" rx="3" fill="var(--blue-600)" />
              <path d="M8 8h8M8 12h6M8 16h4" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span className="header-title">CollabDocs</span>
          </div>

          {/* Navigation Tabs */}
          {onTabChange && (
            <nav className="header-nav">
              <button
                className={`nav-tab ${activeTab === 'my-docs' ? 'active' : ''}`}
                onClick={() => onTabChange('my-docs')}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14,2 14,8 20,8" />
                </svg>
                My Documents
              </button>
              <button
                className={`nav-tab ${activeTab === 'shared' ? 'active' : ''}`}
                onClick={() => onTabChange('shared')}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
                </svg>
                Shared with Me
              </button>
              <button
                className={`nav-tab ${activeTab === 'contacts' ? 'active' : ''}`}
                onClick={() => onTabChange('contacts')}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                Contacts
              </button>
            </nav>
          )}
        </div>

        <div className="header-right">
          {user && (
            <div className="header-user">
              <div className="header-avatar" style={{ '--user-color': user.color }}>
                {user.name.charAt(0).toUpperCase()}
              </div>
              <span className="header-username">{user.name}</span>
            </div>
          )}
        </div>
      </header>

      {showNamePrompt && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="18" height="18" rx="3" fill="var(--blue-600)" />
                <path d="M8 8h8M8 12h6M8 16h4" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <h2>Welcome to CollabDocs</h2>
            <p>Enter your name to start collaborating in real-time</p>
            <form onSubmit={handleSubmitName}>
              <input
                type="text"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                placeholder="Your name"
                autoFocus
                className="modal-input"
              />
              <button type="submit" className="modal-btn">
                Get Started
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

export default Header
