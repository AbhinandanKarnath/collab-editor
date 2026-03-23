import { useState, useEffect } from 'react';
import { 
  Plus, 
  MoreVertical, 
  Search, 
  Globe, 
  Lock, 
  Users, 
  Trash2, 
  Share2, 
  Clock,
  Wand2,
  X,
  GitBranch,
} from 'lucide-react';
import './DocumentList.css';
import {api} from '../lib/api';

export default function DocumentList({ user, documents, onOpenDocument, onCreateDocument, onDeleteDocument, onRefresh }) {
  const [menuOpen, setMenuOpen] = useState(null)
  
  const [allUsers, setAllUsers] = useState([])
  const [searchUser, setSearchUser] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [activeDoc, setActiveDoc] = useState(null);
  const [shareWithUser, setShareWithUser] = useState('');
  const [shareError, setShareError] = useState('');
  
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [summaryDoc, setSummaryDoc] = useState(null);
  const [summaryText, setSummaryText] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState('');

  const [keywordsModalOpen, setKeywordsModalOpen] = useState(false);
  const [keywordsDoc, setKeywordsDoc] = useState(null);
  const [keywordsText, setKeywordsText] = useState('');
  const [isExtractingKeywords, setIsExtractingKeywords] = useState(false);
  const [keywordsError, setKeywordsError] = useState('');

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.doc-menu') && !e.target.closest('.doc-card')) {
        setMenuOpen(null)
      }
      if (!e.target.closest('.share-modal') && !e.target.closest('.doc-card')) {
        setShareModalOpen(false)
        setActiveDoc(null)
        setShareWithUser('')
        setShareError('')
      }
      if (!e.target.closest('.modal-content')) {
        setSummaryModalOpen(false)
        setSummaryDoc(null)
        setSummaryText('')
        setIsSummarizing(false)
        setSummaryError('')

        setKeywordsModalOpen(false)
        setKeywordsDoc(null)
        setKeywordsText('')
        setIsExtractingKeywords(false)
        setKeywordsError('')
      }
    }

    document.addEventListener('click', handleClickOutside)
    return () => {
      document.removeEventListener('click', handleClickOutside)
    }
  }, [])

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
            <Lock size={14} />
            Private
          </span>
        )
      case 'shared':
        return (
          <span className="vis-badge vis-shared" title="Shared">
            <Users size={14} />
            Shared
          </span>
        )
      default:
        return (
          <span className="vis-badge vis-public" title="Public">
            <Globe size={14} />
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

  const openShareModal = (doc) => {
    setActiveDoc(doc);
    setShareModalOpen(true);
    setMenuOpen(null);
  }

  const handleSummarize = async (doc) => {
    setSummaryDoc(doc);
    setSummaryModalOpen(true);
    setIsSummarizing(true);
    setSummaryError('');
    setSummaryText('');
    setMenuOpen(null);

    try {
      const response = await api.summarize(doc.id);
      setSummaryText(response.summary);
    } catch (error) {
      console.error('Summarize error:', error);
      setSummaryError(error.message || 'Failed to generate summary. Is GEMINI_API_KEY set?');
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleFork = async (doc) => {
    const branch = window.prompt('Branch name (e.g. feature-notes)', 'fork')
    if (branch === null || !String(branch).trim()) return
    setMenuOpen(null)
    try {
      const data = await api.forkDocument(doc.id, {
        branchName: String(branch).trim(),
        userName: user?.name,
        title: `${doc.title || 'Untitled'} (${String(branch).trim()})`,
      })
      onRefresh?.()
      if (data?.id) onOpenDocument(data.id)
    } catch (error) {
      console.error('Fork error:', error)
      alert(error.message || 'Fork failed')
    }
  }

  const handleExtractKeywords = async (doc) => {
    setKeywordsDoc(doc);
    setKeywordsModalOpen(true);
    setIsExtractingKeywords(true);
    setKeywordsError('');
    setKeywordsText('');
    setMenuOpen(null);

    try {
      const response = await api.extractKeywords(doc.id);
      setKeywordsText(response.keywords);
    } catch (error) {
      console.error('Extract keywords error:', error);
      setKeywordsError(error.message || 'Failed to extract keywords. Is GEMINI_API_KEY set?');
    } finally {
      setIsExtractingKeywords(false);
    }
  };

  const closeShareModal = () => {
    setShareModalOpen(false);
    setActiveDoc(null);
    setShareWithUser('');
    setShareError('');
  }

  const handleShare = async (userName) => {
    if (!activeDoc) return
    try {
      const currentShared = activeDoc.shared_with || []
      if (currentShared.includes(userName)) return
      await api.shareDocument(activeDoc.id, [...currentShared, userName])
      // Also set visibility to shared
      await api.updateDocument(activeDoc.id, { visibility: 'shared' })
      setActiveDoc({ ...activeDoc, shared_with: [...currentShared, userName] })
      onRefresh()
    } catch (error) {
      console.error('Error sharing document:', error)
    }
  }

  const handleUnshare = async (userName) => {
    if (!activeDoc) return
    try {
      await api.unshareDocument(activeDoc.id, userName)
      const updated = (activeDoc.shared_with || []).filter(u => u !== userName)
      setActiveDoc({ ...activeDoc, shared_with: updated })
      if (updated.length === 0) {
        await api.updateDocument(activeDoc.id, { visibility: 'public' })
      }
      onRefresh()
    } catch (error) {
      console.error('Error unsharing document:', error)
    }
  }

  const filteredUsers = allUsers.filter(u =>
    u.name.toLowerCase().includes(searchUser.toLowerCase()) &&
    !(activeDoc?.shared_with || []).includes(u.name)
  )

  const filteredDocs = documents.filter(doc => 
    doc.title?.toLowerCase().includes(searchTerm.toLowerCase())
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
      <div className="doclist-content">
        <div className="doclist-header">
          <h1>Documents</h1>
          <div className="doc-controls">
            <div className="search-box">
              <Search className="search-icon" size={16} />
              <input 
                type="text" 
                placeholder="Search documents..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button className="btn-primary" onClick={onCreateDocument}>
              <Plus size={16} />
              <span>New Document</span>
            </button>
          </div>
        </div>

        {filteredDocs.length === 0 ? (
          <div className="doclist-empty">
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="var(--gray-300)" strokeWidth="1">
              <rect x="4" y="2" width="16" height="20" rx="2" />
              <path d="M8 6h8M8 10h6M8 14h4" strokeLinecap="round" />
            </svg>
            <p>No documents yet. Create one to get started!</p>
          </div>
        ) : (
          <div className="doclist-grid">
            {filteredDocs.map((doc) => (
              <div key={doc.id} className="doc-card">
                <div className="doc-card-preview" onClick={() => onOpenDocument(doc.id)}>
                  <div className="doc-card-preview-lines">
                    <div className="line line-h"></div>
                    <div className="line"></div>
                    <div className="line"></div>
                    <div className="line" style={{ width: '75%' }}></div>
                  </div>
                </div>
                
                <div className="doc-card-info">
                  <div className="doc-card-top">
                    <div className="doc-card-title" onClick={() => onOpenDocument(doc.id)}>
                      {doc.title || 'Untitled Document'}
                      {(doc.parentId || (doc.branchName && doc.branchName !== 'main')) && (
                        <span className="doc-branch-badge" title="Branch">
                          <GitBranch size={12} />
                          {doc.branchName || 'branch'}
                        </span>
                      )}
                    </div>
                    
                    <div className="doc-card-actions">
                      <button 
                        className="doc-menu-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          setMenuOpen(menuOpen === doc.id ? null : doc.id)
                        }}
                      >
                        <MoreVertical size={16} />
                      </button>
                      
                      {menuOpen === doc.id && (
                        <div className="doc-menu">
                          <button onClick={(e) => { e.stopPropagation(); handleVisibilityChange(doc, 'public'); }}>
                            <Globe size={14} /> Set Public
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleVisibilityChange(doc, 'private'); }}>
                            <Lock size={14} /> Set Private
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); openShareModal(doc); }}>
                            <Share2 size={14} /> Share...
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleFork(doc); }}>
                            <GitBranch size={14} /> Fork branch...
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleExtractKeywords(doc); }}>
                            <Wand2 size={14} /> Extract keywords (AI)
                          </button>
                          <div className="menu-divider"></div>
                          <button className="menu-danger" onClick={(e) => { e.stopPropagation(); onDeleteDocument(doc.id); }}>
                            <Trash2 size={14} /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="doc-card-ai-row">
                    <button
                      className="doc-ai-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSummarize(doc);
                      }}
                    >
                      <Wand2 size={14} />
                      <span>Summarize (AI)</span>
                    </button>
                  </div>
                  
                  <div className="doc-card-meta">
                    <span className="doc-date">
                      <Clock size={12} className="meta-icon" />
                      {new Date(doc.updated_at).toLocaleDateString()}
                    </span>
                    
                    <span className={`visibility-badge ${doc.visibility}`}>
                      {doc.visibility === 'public' && <Globe size={10} />}
                      {doc.visibility === 'private' && <Lock size={10} />}
                      {doc.visibility === 'shared' && <Users size={10} />}
                      {doc.visibility.charAt(0).toUpperCase() + doc.visibility.slice(1)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Share Modal */}
      {shareModalOpen && (
        <div className="modal-overlay" onClick={() => setShareModalOpen(false)}>
          <div className="share-modal" onClick={(e) => e.stopPropagation()}>
            <div className="share-modal-header">
              <h3>Share "{activeDoc.title}"</h3>
              <button className="share-close" onClick={() => setShareModalOpen(false)}>
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
            {(activeDoc.shared_with || []).length > 0 && (
              <div className="share-section">
                <h4>Shared with</h4>
                <div className="share-user-list">
                  {(activeDoc.shared_with || []).map(name => (
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

      {/* Summary Modal */}
      {summaryModalOpen && (
        <div className="modal-backdrop" onClick={() => setSummaryModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2><Wand2 size={20} style={{ marginRight: '8px' }}/> AI Summary: {summaryDoc?.title || 'Untitled'}</h2>
              <button className="btn-icon" onClick={() => setSummaryModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="modal-body">
              {isSummarizing ? (
                <div style={{ padding: '40px', textAlign: 'center' }}>
                  <Wand2 size={40} className="spinning-icon" />
                  <p style={{ marginTop: '16px', color: 'var(--gray-600)' }}>Reading and summarizing your document...</p>
                </div>
              ) : summaryError ? (
                <div style={{ color: 'var(--red-600)', padding: '16px', background: 'var(--red-50)', borderRadius: 'var(--radius)' }}>
                  {summaryError}
                </div>
              ) : (
                <div className="summary-result" style={{ 
                  padding: '20px', 
                  background: 'var(--gray-50)', 
                  borderRadius: 'var(--radius)', 
                  lineHeight: '1.6',
                  whiteSpace: 'pre-line' 
                }}>
                  {summaryText}
                </div>
              )}
            </div>
            
            <div className="modal-actions" style={{ justifyContent: 'flex-end', marginTop: '20px' }}>
              <button className="btn" onClick={() => setSummaryModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Keywords Modal */}
      {keywordsModalOpen && (
        <div className="modal-backdrop" onClick={() => setKeywordsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2><Wand2 size={20} style={{ marginRight: '8px' }}/> AI Keywords: {keywordsDoc?.title || 'Untitled'}</h2>
              <button className="btn-icon" onClick={() => setKeywordsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="modal-body">
              {isExtractingKeywords ? (
                <div style={{ padding: '40px', textAlign: 'center' }}>
                  <Wand2 size={40} className="spinning-icon" />
                  <p style={{ marginTop: '16px', color: 'var(--gray-600)' }}>Analyzing your document and extracting keywords...</p>
                </div>
              ) : keywordsError ? (
                <div style={{ color: 'var(--red-600)', padding: '16px', background: 'var(--red-50)', borderRadius: 'var(--radius)' }}>
                  {keywordsError}
                </div>
              ) : (
                <div className="summary-result" style={{ 
                  padding: '20px', 
                  background: 'var(--gray-50)', 
                  borderRadius: 'var(--radius)', 
                  lineHeight: '1.6',
                  whiteSpace: 'pre-line' 
                }}>
                  {keywordsText}
                </div>
              )}
            </div>
            
            <div className="modal-actions" style={{ justifyContent: 'flex-end', marginTop: '20px' }}>
              <button className="btn" onClick={() => setKeywordsModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
