import { useState, useEffect, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import * as Y from 'yjs'
import { io } from 'socket.io-client'
import { api } from '../lib/api'
import './Editor.css'

function Editor({ documentId, user, onUpdateTitle }) {
  const [content, setContent] = useState('')
  const [title, setTitle] = useState('Untitled Document')
  const [showPreview, setShowPreview] = useState(false)
  const [activeUsers, setActiveUsers] = useState(new Map())
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState('connecting')
  
  const yDocRef = useRef(null)
  const socketRef = useRef(null)
  const textareaRef = useRef(null)
  const yTextRef = useRef(null)
  const awarenessRef = useRef(new Map())
  const isLoadingRef = useRef(false)

  // Debounced save function
  const saveDocumentToDb = useCallback(
    debounce(async (text) => {
      try {
        await api.updateDocument(documentId, { content: text })
        console.log('Document saved')
      } catch (error) {
        console.error('Error saving document:', error)
      }
    }, 2000),
    [documentId]
  )

  useEffect(() => {
    if (!documentId || !user) return

    let mounted = true

    const broadcastAwareness = (socket) => {
      socket.emit('awareness', {
        documentId,
        update: {
          user: {
            name: user.name,
            color: user.color,
          }
        }
      })
    }

    const updateActiveUsers = () => {
      if (mounted) {
        setActiveUsers(new Map(awarenessRef.current))
      }
    }

    // Initialize Yjs document
    const yDoc = new Y.Doc()
    yDocRef.current = yDoc
    const yText = yDoc.getText('content')
    yTextRef.current = yText

    // Listen to local Yjs changes
    const observer = (event, transaction) => {
      const text = yText.toString()
      
      if (mounted) {
        setContent(text)
      }
      
      if (transaction.local && !isLoadingRef.current) {
        // This change was made locally, broadcast it
        const update = Y.encodeStateAsUpdate(yDoc)
        if (socketRef.current && socketRef.current.connected) {
          socketRef.current.emit('update', { 
            documentId, 
            update: Array.from(update) 
          })
        }
        
        // Save to database
        saveDocumentToDb(text)
      }
    }
    yText.observe(observer)

    // Connect to Socket.io server using auto-detected URL
    const serverUrl = api.getSocketUrl()
    const socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      console.log('Connected to server:', socket.id)
      if (mounted) setConnectionStatus('connected')
      
      // Request initial sync
      socket.emit('sync-step-1', { documentId })
      
      // Broadcast user awareness
      broadcastAwareness(socket)
    })

    socket.on('disconnect', () => {
      console.log('Disconnected from server')
      if (mounted) setConnectionStatus('disconnected')
    })

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error.message)
      if (mounted) setConnectionStatus('error')
    })

    // Receive initial document state
    socket.on('sync-step-2', ({ update }) => {
      console.log('Received initial state')
      isLoadingRef.current = true
      try {
        Y.applyUpdate(yDoc, new Uint8Array(update))
        if (mounted) setContent(yText.toString())
      } catch (error) {
        console.error('Error applying initial state:', error)
      } finally {
        setTimeout(() => { isLoadingRef.current = false }, 100)
      }
    })

    // Receive updates from other clients
    socket.on('update', ({ update }) => {
      isLoadingRef.current = true
      try {
        Y.applyUpdate(yDoc, new Uint8Array(update))
      } catch (error) {
        console.error('Error applying update:', error)
      } finally {
        setTimeout(() => { isLoadingRef.current = false }, 50)
      }
    })

    // Receive awareness updates (other users)
    socket.on('awareness', ({ update, clientId }) => {
      if (update && update.user) {
        awarenessRef.current.set(clientId, update.user)
        updateActiveUsers()
      }
    })

    // Load document metadata
    loadDocument()

    // Broadcast awareness every 5 seconds
    const awarenessInterval = setInterval(() => {
      if (socket.connected) broadcastAwareness(socket)
    }, 5000)

    return () => {
      mounted = false
      clearInterval(awarenessInterval)
      yText.unobserve(observer)
      socket.disconnect()
      yDoc.destroy()
    }
  }, [documentId, user, saveDocumentToDb])

  const loadDocument = async () => {
    try {
      const data = await api.getDocument(documentId)
      if (data) setTitle(data.title)
    } catch (error) {
      console.error('Error loading document:', error)
    }
  }

  const handleTitleChange = async (newTitle) => {
    setTitle(newTitle)
    try {
      await api.updateDocument(documentId, { title: newTitle })
      onUpdateTitle()
    } catch (error) {
      console.error('Error updating title:', error)
    }
  }

  const handleTextChange = (e) => {
    const newValue = e.target.value
    const yText = yTextRef.current
    
    if (!yText) return
    
    const oldValue = yText.toString()

    if (newValue !== oldValue) {
      // Use transaction for better performance
      yDocRef.current.transact(() => {
        yText.delete(0, oldValue.length)
        yText.insert(0, newValue)
      })
    }
  }

  const statusLabel = connectionStatus === 'connected' 
    ? 'All changes saved' 
    : connectionStatus === 'connecting' 
    ? 'Connecting...' 
    : 'Offline'

  return (
    <div className="editor-page">
      {/* Toolbar */}
      <div className="editor-toolbar">
        <div className="toolbar-left">
          {isEditingTitle ? (
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => {
                setIsEditingTitle(false)
                handleTitleChange(title)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setIsEditingTitle(false)
                  handleTitleChange(title)
                }
              }}
              className="toolbar-title-input"
              autoFocus
            />
          ) : (
            <h1 onClick={() => setIsEditingTitle(true)} className="toolbar-title">
              {title}
            </h1>
          )}
          <span className={`toolbar-status ${connectionStatus}`}>
            <span className="status-dot"></span>
            {statusLabel}
          </span>
        </div>

        <div className="toolbar-right">
          <div className="toolbar-users">
            {Array.from(activeUsers.values()).map((u, i) => (
              <div
                key={i}
                className="toolbar-avatar"
                style={{ '--avatar-color': u.color }}
                title={u.name}
              >
                {u.name.charAt(0).toUpperCase()}
              </div>
            ))}
          </div>
          
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`toolbar-btn ${showPreview ? 'active' : ''}`}
          >
            {showPreview ? (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Edit
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                Preview
              </>
            )}
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="editor-canvas">
        <div className="editor-paper">
          {showPreview ? (
            <div className="preview-content">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
              </ReactMarkdown>
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleTextChange}
              className="editor-textarea"
              placeholder="Start typing..."
              spellCheck="false"
            />
          )}
        </div>
      </div>
    </div>
  )
}

// Debounce utility
function debounce(func, wait) {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

export default Editor
