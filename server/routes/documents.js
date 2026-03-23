import { Router } from 'express'
import mongoose from 'mongoose'
import multer from 'multer'
import * as Y from 'yjs'
import { diffLines } from 'diff'
import Document from '../models/Document.js'
import DocumentSnapshot, { bufferFromSnapshotBody } from '../models/DocumentSnapshot.js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import {
  buildDocxBuffer,
  buildPdfBuffer,
  getExportFilename,
  parseImportBuffer,
} from '../services/documentExportImport.js'
import {
  replaceYDocFromState,
  getYDoc,
  clearLastAutoDigest,
} from '../sockets/collaboration.js'

function isOid(id) {
  return mongoose.Types.ObjectId.isValid(id)
}

// ═══════════════════════════════════════════
//  Document Routes — factory receives `io` for snapshot restore broadcast
// ═══════════════════════════════════════════

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
})

function replaceDocWithText(documentId, text, ioInstance) {
  const y = new Y.Doc()
  try {
    y.getText('content').insert(0, text)
    y.getArray('strokes')
    replaceYDocFromState(documentId, Y.encodeStateAsUpdate(y), ioInstance)
  } finally {
    y.destroy()
  }
}

export default function createDocumentRoutes(io) {
  const router = Router()
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'dummy_key_if_not_set')

  // GET /api/documents?owner=<name>
  router.get('/', async (req, res) => {
    try {
      const data = await Document.findAll(req.query.owner || null)
      res.json(data)
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })

  // GET /api/documents/shared-with/:userName
  router.get('/shared-with/:userName', async (req, res) => {
    try {
      const data = await Document.findSharedWith(req.params.userName)
      res.json(data)
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })

  // ── Snapshots & branches (must be before GET /:id) ─────────────────

  // GET /api/documents/:id/export?format=md|docx|pdf
  router.get('/:id/export', async (req, res) => {
    try {
      const { id } = req.params
      const format = (req.query.format || 'md').toLowerCase()
      if (!isOid(id)) return res.status(400).json({ error: 'Invalid document id' })
      const doc = await Document.findById(id)
      if (!doc) return res.status(404).json({ error: 'Document not found' })
      let text = doc.content || ''
      const mem = getYDoc(id)
      if (mem) text = mem.getText('content').toString()
      const fname = getExportFilename(doc.title, format)
      if (format === 'md') {
        res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
        res.setHeader('Content-Disposition', `attachment; filename="${fname.replace(/"/g, '')}"`)
        return res.send(text)
      }
      if (format === 'docx') {
        const buf = await buildDocxBuffer(text)
        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        )
        res.setHeader('Content-Disposition', `attachment; filename="${fname.replace(/"/g, '')}"`)
        return res.send(Buffer.from(buf))
      }
      if (format === 'pdf') {
        const buf = await buildPdfBuffer(text)
        res.setHeader('Content-Type', 'application/pdf')
        res.setHeader('Content-Disposition', `attachment; filename="${fname.replace(/"/g, '')}"`)
        return res.send(buf)
      }
      return res.status(400).json({ error: 'format must be md, docx, or pdf' })
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })

  // POST /api/documents/:id/import (multipart field "file")
  router.post('/:id/import', upload.single('file'), async (req, res) => {
    try {
      const { id } = req.params
      if (!isOid(id)) return res.status(400).json({ error: 'Invalid document id' })
      const doc = await Document.findById(id)
      if (!doc) return res.status(404).json({ error: 'Document not found' })
      if (!req.file?.buffer) return res.status(400).json({ error: 'Missing file (use field name "file")' })
      const text = await parseImportBuffer(req.file.buffer, req.file.mimetype, req.file.originalname)
      await Document.updateContent(id, text)
      await Document.updateWhiteboard(id, [])
      clearLastAutoDigest(id)
      replaceDocWithText(id, text, io)
      res.json({ success: true, charCount: text.length })
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  // POST /api/documents/:id/merge — merge other branch content into this document
  router.post('/:id/merge', async (req, res) => {
    try {
      const { id } = req.params
      const { otherDocumentId, strategy = 'markers' } = req.body
      if (!isOid(id) || !isOid(otherDocumentId)) {
        return res.status(400).json({ error: 'Invalid document id' })
      }
      if (id === otherDocumentId) {
        return res.status(400).json({ error: 'Cannot merge document with itself' })
      }
      const base = await Document.findById(id)
      const other = await Document.findById(otherDocumentId)
      if (!base || !other) return res.status(404).json({ error: 'Document not found' })
      let a = base.content || ''
      let b = other.content || ''
      const yA = getYDoc(id)
      const yB = getYDoc(otherDocumentId)
      if (yA) a = yA.getText('content').toString()
      if (yB) b = yB.getText('content').toString()
      let merged
      if (strategy === 'theirs') merged = b
      else if (strategy === 'ours') merged = a
      else {
        merged = `<<<<<<< Current (${base.title || id})\n${a}\n=======\n${b}\n>>>>>>> Other (${other.title || otherDocumentId})\n`
      }
      await Document.updateContent(id, merged)
      await Document.updateWhiteboard(id, [])
      clearLastAutoDigest(id)
      replaceDocWithText(id, merged, io)
      res.json({ success: true, strategy, charCount: merged.length })
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })

  // GET /api/documents/:id/snapshots/diff?from=&to=
  router.get('/:id/snapshots/diff', async (req, res) => {
    try {
      const { id } = req.params
      const { from: fromId, to: toId } = req.query
      if (!isOid(id)) return res.status(400).json({ error: 'Invalid document id' })
      if (!fromId || !toId) {
        return res.status(400).json({ error: 'Query params "from" and "to" are required (to can be "current")' })
      }
      const snapA = await DocumentSnapshot.findById(fromId)
      if (!snapA || snapA.documentId !== id) {
        return res.status(404).json({ error: 'Snapshot "from" not found for this document' })
      }
      const rowA = await DocumentSnapshot.findRawById(fromId)
      const textA = DocumentSnapshot.getTextFromSnapshotRow(rowA)

      let textB
      if (toId === 'current') {
        const yDoc = getYDoc(id)
        textB = yDoc ? yDoc.getText('content').toString() : (await Document.getContent(id)) || ''
      } else {
        const snapB = await DocumentSnapshot.findById(toId)
        if (!snapB || snapB.documentId !== id) {
          return res.status(404).json({ error: 'Snapshot "to" not found for this document' })
        }
        const rowB = await DocumentSnapshot.findRawById(toId)
        textB = DocumentSnapshot.getTextFromSnapshotRow(rowB)
      }
      const changes = diffLines(textA, textB)
      const parts = changes.map((p) => ({
        value: p.value,
        added: !!p.added,
        removed: !!p.removed,
      }))
      res.json({ parts })
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })

  // POST /api/documents/:id/snapshots/:snapshotId/restore
  router.post('/:id/snapshots/:snapshotId/restore', async (req, res) => {
    try {
      const { id, snapshotId } = req.params
      if (!isOid(id) || !isOid(snapshotId)) {
        return res.status(400).json({ error: 'Invalid id' })
      }
      const row = await DocumentSnapshot.findRawById(snapshotId)
      if (!row || row.documentId.toString() !== id) {
        return res.status(404).json({ error: 'Snapshot not found' })
      }
      const text = DocumentSnapshot.getTextFromSnapshotRow(row)
      await Document.updateContent(id, text)
      clearLastAutoDigest(id)
      replaceYDocFromState(id, new Uint8Array(row.state), io)
      res.json({ success: true, message: 'Restored; collaborators received updated state.' })
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })

  // GET /api/documents/:id/snapshots/:snapshotId — metadata + text preview
  router.get('/:id/snapshots/:snapshotId', async (req, res) => {
    try {
      const { id, snapshotId } = req.params
      if (!isOid(id) || !isOid(snapshotId)) {
        return res.status(400).json({ error: 'Invalid id' })
      }
      const meta = await DocumentSnapshot.findById(snapshotId)
      if (!meta || meta.documentId !== id) {
        return res.status(404).json({ error: 'Snapshot not found' })
      }
      const text = await DocumentSnapshot.getPreviewText(snapshotId)
      const preview = text != null && text.length > 800 ? `${text.slice(0, 800)}…` : text || ''
      res.json({
        id: meta.id,
        documentId: meta.documentId,
        userName: meta.userName,
        message: meta.message,
        contentDigest: meta.contentDigest,
        created_at: meta.created_at,
        preview,
        charCount: text?.length ?? 0,
      })
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })

  // GET /api/documents/:id/snapshots
  router.get('/:id/snapshots', async (req, res) => {
    try {
      const { id } = req.params
      if (!isOid(id)) return res.status(400).json({ error: 'Invalid document id' })
      const doc = await Document.findById(id)
      if (!doc) return res.status(404).json({ error: 'Document not found' })
      const list = await DocumentSnapshot.listByDocument(id)
      res.json(list)
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })

  // POST /api/documents/:id/snapshots
  router.post('/:id/snapshots', async (req, res) => {
    try {
      const { id } = req.params
      if (!isOid(id)) return res.status(400).json({ error: 'Invalid document id' })
      const doc = await Document.findById(id)
      if (!doc) return res.status(404).json({ error: 'Document not found' })

      const { message, userName } = req.body
      let stateBuffer
      try {
        stateBuffer = bufferFromSnapshotBody(req.body)
      } catch (e) {
        return res.status(400).json({ error: e.message })
      }
      const created = await DocumentSnapshot.create({
        documentId: id,
        state: stateBuffer,
        userName: userName || 'anonymous',
        message: message || '',
      })
      res.status(201).json(created)
    } catch (error) {
      res.status(400).json({ error: error.message })
    }
  })

  // POST /api/documents/:id/fork
  router.post('/:id/fork', async (req, res) => {
    try {
      const { id } = req.params
      if (!isOid(id)) return res.status(400).json({ error: 'Invalid document id' })
      const source = await Document.findById(id)
      if (!source) return res.status(404).json({ error: 'Document not found' })

      const { title, branchName, userName } = req.body
      let content = source.content || ''
      const yDoc = getYDoc(id)
      if (yDoc) {
        content = yDoc.getText('content').toString()
      }

      const newTitle = title?.trim() || `${source.title || 'Untitled'} (fork)`
      const newBranch = branchName?.trim() || 'fork'
      const owner = userName ?? source.owner

      const created = await Document.create({
        title: newTitle,
        content,
        owner,
        visibility: source.visibility || 'public',
        shared_with: [],
        parentId: id,
        branchName: newBranch,
      })
      res.status(201).json(created)
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })

  // GET /api/documents/:id/branches
  router.get('/:id/branches', async (req, res) => {
    try {
      const { id } = req.params
      if (!isOid(id)) return res.status(400).json({ error: 'Invalid document id' })
      const doc = await Document.findById(id)
      if (!doc) return res.status(404).json({ error: 'Document not found' })
      const branches = await Document.findBranches(id)
      res.json(branches)
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })

  // GET /api/documents/:id/lineage
  router.get('/:id/lineage', async (req, res) => {
    try {
      const { id } = req.params
      if (!isOid(id)) return res.status(400).json({ error: 'Invalid document id' })
      const doc = await Document.findById(id)
      if (!doc) return res.status(404).json({ error: 'Document not found' })
      const chain = await Document.getLineage(id)
      res.json(chain)
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })

  // GET /api/documents/:id
  router.get('/:id', async (req, res) => {
    try {
      const data = await Document.findById(req.params.id)
      res.json(data)
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })

  // POST /api/documents
  router.post('/', async (req, res) => {
    try {
      const { title, content, owner, visibility, parentId, branchName } = req.body
      const data = await Document.create({
        title,
        content,
        owner,
        visibility,
        parentId: parentId && isOid(parentId) ? parentId : undefined,
        branchName,
      })
      res.status(201).json(data)
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })

  // PATCH /api/documents/:id
  router.patch('/:id', async (req, res) => {
    try {
      const data = await Document.update(req.params.id, req.body)
      res.json(data)
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })

  // DELETE /api/documents/:id
  router.delete('/:id', async (req, res) => {
    try {
      const doc = await Document.findById(req.params.id)
      if (!doc) {
        return res.status(404).json({ error: 'Document not found' })
      }
      await DocumentSnapshot.deleteByDocumentId(req.params.id)
      await Document.delete(req.params.id)
      res.json({ success: true })
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })

  // POST /api/documents/:id/share
  router.post('/:id/share', async (req, res) => {
    try {
      const data = await Document.share(req.params.id, req.body.shared_with)
      res.json(data)
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })

  // POST /api/documents/:id/unshare
  router.post('/:id/unshare', async (req, res) => {
    try {
      const data = await Document.unshare(req.params.id, req.body.user_name)
      res.json(data)
    } catch (error) {
      res.status(500).json({ error: error.message })
    }
  })

  // POST /api/documents/:id/summarize
  router.post('/:id/summarize', async (req, res) => {
    try {
      const doc = await Document.findById(req.params.id)
      if (!doc) {
        return res.status(404).json({ error: 'Document not found' })
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: 'GEMINI_API_KEY is not configured in .env' })
      }

      const content = doc.content || ''
      if (content.trim().length === 0) {
        return res.status(400).json({ error: 'Document is empty' })
      }

      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
      const prompt = `Summarize the following document content in 3-5 concise bullet points:\n\n${content}`

      const result = await model.generateContent(prompt)
      const summary = result.response.text()

      res.json({ summary })
    } catch (error) {
      console.error('Summarize error:', error)
      res.status(500).json({ error: error.message })
    }
  })

  // POST /api/documents/:id/keywords
  router.post('/:id/keywords', async (req, res) => {
    try {
      const doc = await Document.findById(req.params.id)
      if (!doc) {
        return res.status(404).json({ error: 'Document not found' })
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: 'GEMINI_API_KEY is not configured in .env' })
      }

      const content = doc.content || ''
      if (content.trim().length === 0) {
        return res.status(400).json({ error: 'Document is empty' })
      }

      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
      const prompt = `Extract 5-10 short, comma-separated keywords or tags from the following document content. 
Return only the comma-separated keywords, with no extra text:\n\n${content}`

      const result = await model.generateContent(prompt)
      const keywords = result.response.text()

      res.json({ keywords })
    } catch (error) {
      console.error('Keywords error:', error)
      res.status(500).json({ error: error.message })
    }
  })

  return router
}
