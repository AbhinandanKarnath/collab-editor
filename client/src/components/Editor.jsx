import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import * as Y from 'yjs'
import { io } from 'socket.io-client'
import {
  History,
  GitBranch,
  GitCompare,
  Camera,
  X,
  Upload,
  Merge,
  WifiOff,
  Pencil,
  FileText,
} from 'lucide-react'
import { api } from '../lib/api'
import WhiteboardPane from './WhiteboardPane'
import './Editor.css'

function Editor({ documentId, user, onUpdateTitle, onNavigateToDocument }) {
  const [content, setContent] = useState('')
  const [title, setTitle] = useState('Untitled Document')
  const [showPreview, setShowPreview] = useState(false)
  const [activeUsers, setActiveUsers] = useState(new Map())
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState('connecting')

  const [historyOpen, setHistoryOpen] = useState(false)
  const [snapshots, setSnapshots] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [lineage, setLineage] = useState([])
  const [branches, setBranches] = useState([])

  const [diffOpen, setDiffOpen] = useState(false)
  const [diffParts, setDiffParts] = useState([])
  const [diffLabel, setDiffLabel] = useState('')

  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewText, setPreviewText] = useState('')
  const [previewTitle, setPreviewTitle] = useState('')

  const [compareFromId, setCompareFromId] = useState('')
  const [compareToId, setCompareToId] = useState('')

  const [editorTab, setEditorTab] = useState('write') // 'write' | 'draw'
  const [mergeOpen, setMergeOpen] = useState(false)
  const [mergeSiblings, setMergeSiblings] = useState([])
  const [mergeOtherId, setMergeOtherId] = useState('')
  const [mergeStrategy, setMergeStrategy] = useState('markers')
  const [timelineIdx, setTimelineIdx] = useState(0)
  const [networkOnline, setNetworkOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )

  const importInputRef = useRef(null)
  const contentRef = useRef('')
  const yDocRef = useRef(null)
  const socketRef = useRef(null)
  const textareaRef = useRef(null)
  const yTextRef = useRef(null)
  const awarenessRef = useRef(new Map())
  const isLoadingRef = useRef(false)

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

  const loadSnapshots = useCallback(async () => {
    if (!documentId) return
    setHistoryLoading(true)
    try {
      const list = await api.listSnapshots(documentId)
      setSnapshots(Array.isArray(list) ? list : [])
    } catch (e) {
      console.error(e)
      setSnapshots([])
    } finally {
      setHistoryLoading(false)
    }
  }, [documentId])

  useEffect(() => {
    if (!historyOpen) return
    loadSnapshots()
  }, [historyOpen, loadSnapshots])

  useEffect(() => {
    if (!documentId) return
    api.getLineage(documentId).then(setLineage).catch(() => setLineage([]))
    api.listBranches(documentId).then(setBranches).catch(() => setBranches([]))
  }, [documentId])

  useEffect(() => {
    contentRef.current = content
  }, [content])

  useEffect(() => {
    const on = () => setNetworkOnline(true)
    const off = () => setNetworkOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  /** Flush latest text to API when browser or socket is back online (offline / reconnect). */
  useEffect(() => {
    if (!documentId) return
    if (!networkOnline || connectionStatus !== 'connected') return
    const text = contentRef.current
    api.updateDocument(documentId, { content: text }).catch(() => {})
  }, [networkOnline, connectionStatus, documentId])

  useEffect(() => {
    if (!mergeOpen || !documentId) return
    const parentId = lineage[1]?.id
    if (!parentId) {
      setMergeSiblings([])
      return
    }
    api
      .listBranches(parentId)
      .then((list) => setMergeSiblings((list || []).filter((d) => d.id !== documentId)))
      .catch(() => setMergeSiblings([]))
  }, [mergeOpen, documentId, lineage])

  const snapshotsChrono = useMemo(() => [...snapshots].reverse(), [snapshots])
  useEffect(() => {
    if (snapshotsChrono.length === 0) setTimelineIdx(0)
    else setTimelineIdx((i) => Math.min(Math.max(0, i), snapshotsChrono.length - 1))
  }, [snapshotsChrono.length])

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
          },
        },
      })
    }

    const updateActiveUsers = () => {
      if (mounted) {
        setActiveUsers(new Map(awarenessRef.current))
      }
    }

    let detachTextObserver = () => {}

    const bindYDoc = (doc) => {
      detachTextObserver()
      yDocRef.current = doc
      const yText = doc.getText('content')
      yTextRef.current = yText

      const observer = (event, transaction) => {
        const yt = yTextRef.current
        if (!yt) return
        const text = yt.toString()

        if (mounted) {
          setContent(text)
        }

        if (transaction.local && !isLoadingRef.current) {
          const d = yDocRef.current
          if (!d) return
          const update = Y.encodeStateAsUpdate(d)
          if (socketRef.current && socketRef.current.connected) {
            socketRef.current.emit('update', {
              documentId,
              update: Array.from(update),
            })
          }

          saveDocumentToDb(text)
        }
      }
      yText.observe(observer)

      const yStrokes = doc.getArray('strokes')
      const strokeObserver = (_event, transaction) => {
        if (!transaction.local || isLoadingRef.current) return
        const d = yDocRef.current
        if (!d || !socketRef.current?.connected) return
        socketRef.current.emit('update', {
          documentId,
          update: Array.from(Y.encodeStateAsUpdate(d)),
        })
        const yt = yTextRef.current
        if (yt) saveDocumentToDb(yt.toString())
      }
      yStrokes.observe(strokeObserver)

      detachTextObserver = () => {
        yText.unobserve(observer)
        yStrokes.unobserve(strokeObserver)
      }
    }

    bindYDoc(new Y.Doc())

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

      socket.emit('sync-step-1', { documentId })

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

    socket.on('sync-step-2', ({ update }) => {
      console.log('Received initial state')
      isLoadingRef.current = true
      try {
        const d = yDocRef.current
        if (d) {
          Y.applyUpdate(d, new Uint8Array(update))
          if (mounted) setContent(yTextRef.current?.toString() || '')
        }
      } catch (error) {
        console.error('Error applying initial state:', error)
      } finally {
        setTimeout(() => {
          isLoadingRef.current = false
        }, 100)
      }
    })

    socket.on('update', ({ update }) => {
      isLoadingRef.current = true
      try {
        const d = yDocRef.current
        if (d) Y.applyUpdate(d, new Uint8Array(update))
      } catch (error) {
        console.error('Error applying update:', error)
      } finally {
        setTimeout(() => {
          isLoadingRef.current = false
        }, 50)
      }
    })

    socket.on('snapshot-restored', ({ update }) => {
      isLoadingRef.current = true
      try {
        const old = yDocRef.current
        if (old) {
          detachTextObserver()
          old.destroy()
        }
        const fresh = new Y.Doc()
        bindYDoc(fresh)
        Y.applyUpdate(yDocRef.current, new Uint8Array(update))
        const text = yTextRef.current?.toString() || ''
        if (mounted) setContent(text)
        saveDocumentToDb(text)
      } catch (error) {
        console.error('Error applying restored snapshot:', error)
      } finally {
        setTimeout(() => {
          isLoadingRef.current = false
        }, 100)
      }
    })

    socket.on('awareness', ({ update, clientId }) => {
      if (update && update.user) {
        awarenessRef.current.set(clientId, update.user)
        updateActiveUsers()
      }
    })

    loadDocument()

    const awarenessInterval = setInterval(() => {
      if (socket.connected) broadcastAwareness(socket)
    }, 5000)

    return () => {
      mounted = false
      clearInterval(awarenessInterval)
      detachTextObserver()
      socket.disconnect()
      yDocRef.current?.destroy()
      yDocRef.current = null
      yTextRef.current = null
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
      yDocRef.current.transact(() => {
        yText.delete(0, oldValue.length)
        yText.insert(0, newValue)
      })
    }
  }

  const handleCheckpoint = async () => {
    const yDoc = yDocRef.current
    if (!yDoc || !user) return
    const msg = window.prompt('Checkpoint message (optional)', '')
    if (msg === null) return
    try {
      // Send text + whiteboard only — avoids huge Yjs CRDT blobs that get truncated by the Vite proxy (~100kb).
      const contentText = yDoc.getText('content').toString()
      const whiteboard = yDoc.getArray('strokes').toArray()
      await api.createSnapshot(documentId, {
        contentText,
        whiteboard,
        message: msg || '',
        userName: user.name,
      })
      await loadSnapshots()
      alert('Checkpoint saved.')
    } catch (e) {
      alert(e.message || 'Failed to save checkpoint')
    }
  }

  const handleRestore = async (snapshotId) => {
    if (
      !window.confirm(
        'Restore this version? This updates the document for everyone connected. Continue?'
      )
    ) {
      return
    }
    try {
      await api.restoreSnapshot(documentId, snapshotId)
      await loadSnapshots()
      setHistoryOpen(false)
    } catch (e) {
      alert(e.message || 'Restore failed')
    }
  }

  const handleDiffVsCurrent = async (snapshotId) => {
    try {
      const { parts } = await api.diffSnapshots(documentId, snapshotId, 'current')
      setDiffParts(parts || [])
      setDiffLabel('Snapshot vs current')
      setDiffOpen(true)
    } catch (e) {
      alert(e.message || 'Diff failed')
    }
  }

  const handleCompareTwo = async () => {
    if (!compareFromId || !compareToId) {
      alert('Select two snapshots.')
      return
    }
    try {
      const { parts } = await api.diffSnapshots(documentId, compareFromId, compareToId)
      setDiffParts(parts || [])
      setDiffLabel('Compare two snapshots')
      setDiffOpen(true)
    } catch (e) {
      alert(e.message || 'Diff failed')
    }
  }

  const handlePreview = async (snap) => {
    try {
      const meta = await api.getSnapshot(documentId, snap.id)
      setPreviewTitle(meta.message || `Snapshot ${new Date(meta.created_at).toLocaleString()}`)
      setPreviewText(meta.preview || '')
      setPreviewOpen(true)
    } catch (e) {
      alert(e.message || 'Preview failed')
    }
  }

  const handleFork = async () => {
    const branchName = window.prompt('New branch name', 'fork')
    if (branchName === null || !String(branchName).trim()) return
    try {
      const data = await api.forkDocument(documentId, {
        branchName: String(branchName).trim(),
        userName: user?.name,
        title: `${title} (${String(branchName).trim()})`,
      })
      if (data?.id && onNavigateToDocument) {
        onNavigateToDocument(data.id)
      }
    } catch (e) {
      alert(e.message || 'Fork failed')
    }
  }

  const downloadBlob = (blob, name) => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = name
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const handleExport = async (format) => {
    try {
      const blob = await api.exportDocumentBlob(documentId, format)
      const ext = format === 'pdf' ? 'pdf' : format === 'docx' ? 'docx' : 'md'
      const safe = (title || 'document').replace(/[^\w\- .]+/g, '').trim().slice(0, 80) || 'document'
      downloadBlob(blob, `${safe}.${ext}`)
    } catch (e) {
      alert(e.message || 'Export failed')
    }
  }

  const handleImportPick = () => importInputRef.current?.click()

  const onImportChange = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      await api.importDocument(documentId, file)
      alert('Imported. Collaborators will see the updated document.')
    } catch (err) {
      alert(err.message || 'Import failed')
    }
  }

  const handleMergeSubmit = async () => {
    if (!mergeOtherId.trim()) {
      alert('Choose a sibling branch or paste another document ID.')
      return
    }
    try {
      await api.mergeDocuments(documentId, mergeOtherId.trim(), mergeStrategy)
      setMergeOpen(false)
      setMergeOtherId('')
      alert('Merge complete. If you used conflict markers, edit the file to resolve them.')
    } catch (e) {
      alert(e.message || 'Merge failed')
    }
  }

  const lineageCrumbs = lineage.length
    ? [...lineage].reverse().map((n) => n.branchName || 'main')
    : []

  const browserOffline = typeof navigator !== 'undefined' && !networkOnline
  const socketOffline = connectionStatus === 'disconnected' || connectionStatus === 'error'
  const statusLabel = browserOffline
    ? 'Offline — edits queue locally'
    : connectionStatus === 'connected'
      ? 'All changes saved'
      : connectionStatus === 'connecting'
        ? 'Connecting...'
        : 'Reconnecting…'

  const selectedTimelineSnap = snapshotsChrono[timelineIdx]

  return (
    <div className="editor-page">
      <input
        ref={importInputRef}
        type="file"
        accept=".md,.docx,.pdf,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="editor-file-input-hidden"
        onChange={onImportChange}
      />
      {(browserOffline || socketOffline) && (
        <div className="editor-offline-banner">
          <WifiOff size={16} />
          {browserOffline
            ? 'No network — keep editing; we will sync when you are back online.'
            : 'Server disconnected — trying to reconnect…'}
        </div>
      )}
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
          {lineageCrumbs.length > 0 && (
            <div className="toolbar-lineage" title="Branch lineage">
              {lineageCrumbs.join(' → ')}
            </div>
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

          {branches.length > 0 && (
            <div className="toolbar-branches-wrap">
              <span className="toolbar-branches-label">Branches</span>
              <select
                className="toolbar-branch-select"
                value=""
                onChange={(e) => {
                  const id = e.target.value
                  if (id && onNavigateToDocument) onNavigateToDocument(id)
                  e.target.value = ''
                }}
              >
                <option value="">Open…</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.branchName} — {b.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="editor-tab-switch">
            <button
              type="button"
              className={`toolbar-btn tab-pill ${editorTab === 'write' ? 'active' : ''}`}
              onClick={() => setEditorTab('write')}
            >
              <FileText size={16} />
              Write
            </button>
            <button
              type="button"
              className={`toolbar-btn tab-pill ${editorTab === 'draw' ? 'active' : ''}`}
              onClick={() => setEditorTab('draw')}
            >
              <Pencil size={16} />
              Whiteboard
            </button>
          </div>

          <select
            className="toolbar-branch-select export-select"
            defaultValue=""
            onChange={(e) => {
              const v = e.target.value
              if (v) handleExport(v)
              e.target.value = ''
            }}
            title="Export"
          >
            <option value="">Export…</option>
            <option value="md">Markdown (.md)</option>
            <option value="docx">Word (.docx)</option>
            <option value="pdf">PDF (.pdf)</option>
          </select>
          <button type="button" className="toolbar-btn" onClick={handleImportPick} title="Import file">
            <Upload size={18} />
            Import
          </button>
          <button type="button" className="toolbar-btn" onClick={() => setMergeOpen(true)} title="Merge branch">
            <Merge size={18} />
            Merge
          </button>

          <button type="button" className="toolbar-btn" onClick={handleCheckpoint} title="Save checkpoint">
            <Camera size={18} />
            Checkpoint
          </button>
          <button
            type="button"
            className="toolbar-btn"
            onClick={() => setHistoryOpen(true)}
            title="Version history"
          >
            <History size={18} />
            History
          </button>
          <button type="button" className="toolbar-btn" onClick={handleFork} title="Fork branch">
            <GitBranch size={18} />
            Fork
          </button>

          <button
            type="button"
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

      <div className={`editor-canvas ${editorTab === 'draw' ? 'show-draw' : ''}`}>
        {editorTab === 'write' && (
          <div className="editor-paper">
            {showPreview ? (
              <div className="preview-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
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
        )}
        <WhiteboardPane yDocRef={yDocRef} active={editorTab === 'draw'} />
      </div>

      {historyOpen && (
        <div className="editor-modal-backdrop" onClick={() => setHistoryOpen(false)}>
          <div className="editor-modal history-modal" onClick={(e) => e.stopPropagation()}>
            <div className="editor-modal-header">
              <h2>
                <History size={20} /> Version history
              </h2>
              <button type="button" className="btn-icon" onClick={() => setHistoryOpen(false)}>
                <X size={20} />
              </button>
            </div>
            {snapshotsChrono.length > 0 && (
              <div className="history-timeline">
                <div className="history-timeline-label">
                  Timeline scrub — {selectedTimelineSnap
                    ? new Date(selectedTimelineSnap.created_at).toLocaleString()
                    : ''}
                </div>
                <input
                  type="range"
                  className="history-timeline-slider"
                  min={0}
                  max={Math.max(0, snapshotsChrono.length - 1)}
                  value={Math.min(timelineIdx, snapshotsChrono.length - 1)}
                  onChange={(e) => setTimelineIdx(Number(e.target.value))}
                />
                {selectedTimelineSnap && (
                  <div className="history-timeline-actions">
                    <button
                      type="button"
                      className="toolbar-btn small"
                      onClick={() => handlePreview(selectedTimelineSnap)}
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      className="toolbar-btn small"
                      onClick={() => handleDiffVsCurrent(selectedTimelineSnap.id)}
                    >
                      Diff vs current
                    </button>
                    <button
                      type="button"
                      className="toolbar-btn small danger-outline"
                      onClick={() => handleRestore(selectedTimelineSnap.id)}
                    >
                      Restore
                    </button>
                  </div>
                )}
              </div>
            )}
            <div className="history-compare-row">
              <GitCompare size={16} />
              <select
                value={compareFromId}
                onChange={(e) => setCompareFromId(e.target.value)}
                className="toolbar-branch-select"
              >
                <option value="">From snapshot…</option>
                {snapshots.map((s) => (
                  <option key={`f-${s.id}`} value={s.id}>
                    {new Date(s.created_at).toLocaleString()} — {s.message || s.userName}
                  </option>
                ))}
              </select>
              <select
                value={compareToId}
                onChange={(e) => setCompareToId(e.target.value)}
                className="toolbar-branch-select"
              >
                <option value="">To snapshot…</option>
                {snapshots.map((s) => (
                  <option key={`t-${s.id}`} value={s.id}>
                    {new Date(s.created_at).toLocaleString()} — {s.message || s.userName}
                  </option>
                ))}
              </select>
              <button type="button" className="toolbar-btn small" onClick={handleCompareTwo}>
                Diff
              </button>
            </div>
            <div className="history-modal-body">
              {historyLoading ? (
                <p className="history-empty">Loading…</p>
              ) : snapshots.length === 0 ? (
                <p className="history-empty">No checkpoints yet. Use Checkpoint to save one.</p>
              ) : (
                <ul className="history-list">
                  {snapshots.map((s) => (
                    <li key={s.id} className="history-item">
                      <div className="history-item-meta">
                        <strong>{s.message || '(no message)'}</strong>
                        <span>
                          {new Date(s.created_at).toLocaleString()} · {s.userName}
                        </span>
                      </div>
                      <div className="history-item-actions">
                        <button type="button" className="linkish" onClick={() => handlePreview(s)}>
                          Preview
                        </button>
                        <button type="button" className="linkish" onClick={() => handleDiffVsCurrent(s.id)}>
                          Diff vs current
                        </button>
                        <button type="button" className="linkish danger" onClick={() => handleRestore(s.id)}>
                          Restore
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {diffOpen && (
        <div className="editor-modal-backdrop" onClick={() => setDiffOpen(false)}>
          <div className="editor-modal diff-modal" onClick={(e) => e.stopPropagation()}>
            <div className="editor-modal-header">
              <h2>
                <GitCompare size={20} /> {diffLabel}
              </h2>
              <button type="button" className="btn-icon" onClick={() => setDiffOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <pre className="diff-pre">
              {diffParts.map((p, i) => (
                <span
                  key={i}
                  className={p.added ? 'diff-add' : p.removed ? 'diff-del' : 'diff-neutral'}
                >
                  {p.value}
                </span>
              ))}
            </pre>
          </div>
        </div>
      )}

      {previewOpen && (
        <div className="editor-modal-backdrop" onClick={() => setPreviewOpen(false)}>
          <div className="editor-modal" onClick={(e) => e.stopPropagation()}>
            <div className="editor-modal-header">
              <h2>{previewTitle}</h2>
              <button type="button" className="btn-icon" onClick={() => setPreviewOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="preview-modal-body">
              <pre className="preview-snippet">{previewText}</pre>
            </div>
          </div>
        </div>
      )}

      {mergeOpen && (
        <div className="editor-modal-backdrop" onClick={() => setMergeOpen(false)}>
          <div className="editor-modal merge-modal" onClick={(e) => e.stopPropagation()}>
            <div className="editor-modal-header">
              <h2>
                <Merge size={20} /> Merge branch
              </h2>
              <button type="button" className="btn-icon" onClick={() => setMergeOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="merge-modal-body">
              <p className="merge-help">
                Merge another document&apos;s content into this one. Use <strong>Conflict markers</strong> to edit
                manually, or take <strong>ours</strong> / <strong>theirs</strong> only.
              </p>
              <label className="merge-field-label">Strategy</label>
              <select
                className="toolbar-branch-select merge-strategy"
                value={mergeStrategy}
                onChange={(e) => setMergeStrategy(e.target.value)}
              >
                <option value="markers">Conflict markers (Git-style)</option>
                <option value="ours">Keep current document only</option>
                <option value="theirs">Replace with other document</option>
              </select>
              {mergeSiblings.length > 0 && (
                <>
                  <label className="merge-field-label">Sibling branch</label>
                  <select
                    className="toolbar-branch-select"
                    value=""
                    onChange={(e) => {
                      if (e.target.value) setMergeOtherId(e.target.value)
                      e.target.value = ''
                    }}
                  >
                    <option value="">Select branch to merge…</option>
                    {mergeSiblings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.branchName} — {b.title}
                      </option>
                    ))}
                  </select>
                </>
              )}
              <label className="merge-field-label">Other document ID</label>
              <input
                className="merge-id-input"
                placeholder="MongoDB ObjectId of document to merge"
                value={mergeOtherId}
                onChange={(e) => setMergeOtherId(e.target.value)}
              />
              <div className="merge-actions">
                <button type="button" className="toolbar-btn" onClick={() => setMergeOpen(false)}>
                  Cancel
                </button>
                <button type="button" className="toolbar-btn primary" onClick={handleMergeSubmit}>
                  Merge
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

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
