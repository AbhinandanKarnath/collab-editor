import { Router } from 'express'
import Document from '../models/Document.js'

// ═══════════════════════════════════════════
//  Document Routes
//  /api/documents
// ═══════════════════════════════════════════

const router = Router()

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
// ⚠️ This must be before /:id to avoid conflict
router.get('/shared-with/:userName', async (req, res) => {
  try {
    const data = await Document.findSharedWith(req.params.userName)
    res.json(data)
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
    const { title, content, owner, visibility } = req.body
    const data = await Document.create({ title, content, owner, visibility })
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

export default router
