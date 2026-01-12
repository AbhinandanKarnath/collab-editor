import { useState, useEffect, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import * as Y from 'yjs'
import { io } from 'socket.io-client'
import { supabase } from '../lib/supabase'
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
        await supabase
          .from('documents')
          .update({ 
            content: text, 
            updated_at: new Date().toISOString() 
          })
          .eq('id', documentId)
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

    // Helper functions
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

    // Connect to Socket.io server
    const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'
    const socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      console.log('Connected to server:', socket.id)
      if (mounted) {
        setConnectionStatus('connected')
      }
      
      // Request initial sync
      socket.emit('sync-step-1', { documentId })
      
      // Broadcast user awareness
      broadcastAwareness(socket)
    })

    socket.on('disconnect', () => {
      console.log('Disconnected from server')
      if (mounted) {
        setConnectionStatus('disconnected')
      }
    })

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error)
      console.error('Server URL:', serverUrl)
      console.error('Make sure VITE_SERVER_URL in .env is set to your computer\'s IP, not router IP')
      if (mounted) {
        setConnectionStatus('error')
      }
    })

    // Receive initial document state
    socket.on('sync-step-2', ({ update }) => {
      console.log('Received initial state')
      isLoadingRef.current = true
      try {
        Y.applyUpdate(yDoc, new Uint8Array(update))
        if (mounted) {
          setContent(yText.toString())
        }
      } catch (error) {
        console.error('Error applying initial state:', error)
      } finally {
        setTimeout(() => {
          isLoadingRef.current = false
        }, 100)
      }
    })

    // Receive updates from other clients
    socket.on('update', ({ update }) => {
      console.log('Received update from another client')
      isLoadingRef.current = true
      try {
        Y.applyUpdate(yDoc, new Uint8Array(update))
      } catch (error) {
        console.error('Error applying update:', error)
      } finally {
        setTimeout(() => {
          isLoadingRef.current = false
        }, 50)
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
      if (socket.connected) {
        broadcastAwareness(socket)
      }
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
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .single()

      if (error) throw error
      if (data) {
        setTitle(data.title)
      }
    } catch (error) {
      console.error('Error loading document:', error)
    }
  }

  const handleTitleChange = async (newTitle) => {
    setTitle(newTitle)
    try {
      await supabase
        .from('documents')
        .update({ 
          title: newTitle, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', documentId)
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

  return (
    <div className="editor-container">
      <div className="editor-header">
        <div className="title-section">
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
              className="title-input"
              autoFocus
            />
          ) : (
            <h2 onClick={() => setIsEditingTitle(true)} className="title">
              {title}
            </h2>
          )}
        </div>

        <div className="editor-controls">
          <div className="connection-status">
            <span className={`status-indicator ${connectionStatus}`}>
              {connectionStatus === 'connected' ? '🟢' : connectionStatus === 'connecting' ? '🟡' : '🔴'}
            </span>
          </div>
          
          <div className="active-users">
            {Array.from(activeUsers.values()).map((u, i) => (
              <div
                key={i}
                className="user-avatar small"
                style={{ backgroundColor: u.color }}
                title={u.name}
              >
                {u.name.charAt(0).toUpperCase()}
              </div>
            ))}
          </div>
          
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="preview-toggle"
          >
            {showPreview ? '📝 Edit' : '👁️ Preview'}
          </button>
        </div>
      </div>

      <div className="editor-content">
        {showPreview ? (
          <div className="preview-pane">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content}
            </ReactMarkdown>
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleTextChange}
            className="markdown-editor"
            placeholder="Start typing your markdown here..."
            spellCheck="false"
          />
        )}
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
