import { useState } from 'react'
import './Header.css'

function Header({ user, onSetUser, onBackToList }) {
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
    <header className="header">
      <div className="header-content">
        <div className="header-left">
          {onBackToList && (
            <button onClick={onBackToList} className="back-button">
              ← Back to Documents
            </button>
          )}
          <h1>📝 Collaborative Markdown Editor</h1>
        </div>
        
        <div className="header-right">
          {user && (
            <div className="user-badge" style={{ borderColor: user.color }}>
              <div className="user-avatar" style={{ backgroundColor: user.color }}>
                {user.name.charAt(0).toUpperCase()}
              </div>
              <span>{user.name}</span>
            </div>
          )}
        </div>
      </div>

      {showNamePrompt && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Welcome! 👋</h2>
            <p>Enter your name to start collaborating:</p>
            <form onSubmit={handleSubmitName}>
              <input
                type="text"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                placeholder="Your name"
                autoFocus
                className="name-input"
              />
              <button type="submit" className="submit-button">
                Start Editing
              </button>
            </form>
          </div>
        </div>
      )}
    </header>
  )
}

export default Header
