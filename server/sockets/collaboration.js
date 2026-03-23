import * as Y from 'yjs'
import Document from '../models/Document.js'
import DocumentSnapshot, { digestContent } from '../models/DocumentSnapshot.js'

// ═══════════════════════════════════════════
//  Socket Handler
//  Real-time collaboration via Socket.io + Yjs
// ═══════════════════════════════════════════

// In-memory Yjs document store
const docs = new Map()
const saveTimers = new Map()

/** Last content digest we auto-snapshotted per document (dedupe) */
const lastAutoSnapshotDigest = new Map()

const AUTO_SNAPSHOT_INTERVAL_MS = 10 * 60 * 1000 // 10 minutes

async function loadWhiteboardIntoDoc(documentId, yDoc) {
  try {
    const strokes = await Document.getWhiteboard(documentId)
    if (!strokes?.length) return
    const yArr = yDoc.getArray('strokes')
    strokes.forEach((s) => {
      if (s && typeof s === 'object') yArr.push([s])
    })
  } catch (e) {
    console.error('  ❌ Error loading whiteboard:', e.message)
  }
}

async function maybeAutoSnapshot(documentId, yDoc) {
  const yText = yDoc.getText('content')
  const text = yText.toString()
  const digest = digestContent(text)
  if (lastAutoSnapshotDigest.get(documentId) === digest) return
  lastAutoSnapshotDigest.set(documentId, digest)
  try {
    const state = Y.encodeStateAsUpdate(yDoc)
    await DocumentSnapshot.create({
      documentId,
      state: Buffer.from(state),
      userName: 'system',
      message: 'Auto checkpoint',
    })
    console.log(`  📸 Auto snapshot for document ${documentId}`)
  } catch (error) {
    console.error('  ❌ Auto snapshot failed:', error.message)
  }
}

/** Debounced save — writes content to DB after 2 s of inactivity */
function scheduleSave(documentId, yDoc) {
  if (saveTimers.has(documentId)) clearTimeout(saveTimers.get(documentId))

  const timer = setTimeout(async () => {
    try {
      const yText = yDoc.getText('content')
      const content = yText.toString()
      await Document.updateContent(documentId, content)
      const strokes = yDoc.getArray('strokes').toArray()
      await Document.updateWhiteboard(documentId, strokes)
      console.log(`  💾 Auto-saved document ${documentId}`)
      await maybeAutoSnapshot(documentId, yDoc)
      saveTimers.delete(documentId)
    } catch (error) {
      console.error('  ❌ Error saving document:', error.message)
    }
  }, 2000)

  saveTimers.set(documentId, timer)
}

/**
 * Replace in-memory Y.Doc with decoded snapshot state and notify all clients.
 */
export function replaceYDocFromState(documentId, stateUint8, io) {
  const old = docs.get(documentId)
  if (old) {
    old.destroy()
    docs.delete(documentId)
  }
  const yDoc = new Y.Doc()
  Y.applyUpdate(yDoc, stateUint8)
  docs.set(documentId, yDoc)

  if (io) {
    const update = Array.from(Y.encodeStateAsUpdate(yDoc))
    io.to(`document-${documentId}`).emit('snapshot-restored', { update })
  }
  return yDoc
}

export function getYDoc(documentId) {
  return docs.get(documentId) || null
}

/** Full Yjs state as Uint8Array, or null if doc only on DB */
export function encodeStateForDocument(documentId) {
  const yDoc = docs.get(documentId)
  if (!yDoc) return null
  return Y.encodeStateAsUpdate(yDoc)
}

export function clearLastAutoDigest(documentId) {
  lastAutoSnapshotDigest.delete(documentId)
}

/** Register all Socket.io event handlers on `io` */
export function registerSocketHandlers(io) {
  // Periodic auto snapshots for open collaborative docs
  setInterval(() => {
    for (const [documentId, yDoc] of docs.entries()) {
      maybeAutoSnapshot(documentId, yDoc).catch(() => {})
    }
  }, AUTO_SNAPSHOT_INTERVAL_MS)

  io.on('connection', (socket) => {
    console.log(`  🔌 Client connected: ${socket.id}`)

    // ── Sync step 1: client requests document ──────
    socket.on('sync-step-1', async ({ documentId }) => {
      console.log(`  📄 Sync request for doc ${documentId} from ${socket.id}`)
      socket.join(`document-${documentId}`)

      let yDoc = docs.get(documentId)
      if (!yDoc) {
        yDoc = new Y.Doc()
        docs.set(documentId, yDoc)

        // Load persisted content into Yjs
        try {
          const content = await Document.getContent(documentId)
          if (content) {
            const yText = yDoc.getText('content')
            yText.insert(0, content)
          }
          await loadWhiteboardIntoDoc(documentId, yDoc)
        } catch (error) {
          console.error('  ❌ Error loading document:', error.message)
        }
      }

      // Send full state back to the requesting client
      const state = Y.encodeStateAsUpdate(yDoc)
      socket.emit('sync-step-2', { update: Array.from(state) })
    })

    // ── Incoming update from a client ──────────────
    socket.on('update', ({ documentId, update }) => {
      const yDoc = docs.get(documentId)
      if (!yDoc) return

      try {
        Y.applyUpdate(yDoc, new Uint8Array(update))
        // Broadcast to everyone else in the room
        socket.to(`document-${documentId}`).emit('update', { update })
        scheduleSave(documentId, yDoc)
      } catch (error) {
        console.error('  ❌ Error applying update:', error.message)
      }
    })

    // ── Awareness (cursor, user presence) ──────────
    socket.on('awareness', ({ documentId, update }) => {
      socket.to(`document-${documentId}`).emit('awareness', {
        update,
        clientId: socket.id,
      })
    })

    // ── Disconnect ─────────────────────────────────
    socket.on('disconnect', () => {
      console.log(`  🔌 Client disconnected: ${socket.id}`)
    })
  })
}
