import * as Y from 'yjs'
import Document from '../models/Document.js'

// ═══════════════════════════════════════════
//  Socket Handler
//  Real-time collaboration via Socket.io + Yjs
// ═══════════════════════════════════════════

// In-memory Yjs document store
const docs = new Map()
const saveTimers = new Map()

/** Debounced save — writes content to DB after 2 s of inactivity */
function scheduleSave(documentId, content) {
  if (saveTimers.has(documentId)) clearTimeout(saveTimers.get(documentId))

  const timer = setTimeout(async () => {
    try {
      await Document.updateContent(documentId, content)
      console.log(`  💾 Auto-saved document ${documentId}`)
      saveTimers.delete(documentId)
    } catch (error) {
      console.error('  ❌ Error saving document:', error.message)
    }
  }, 2000)

  saveTimers.set(documentId, timer)
}

/** Register all Socket.io event handlers on `io` */
export function registerSocketHandlers(io) {
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
        // Schedule a debounced save
        const yText = yDoc.getText('content')
        scheduleSave(documentId, yText.toString())
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
