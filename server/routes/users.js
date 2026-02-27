import { Router } from 'express'
import User from '../models/User.js'

// ═══════════════════════════════════════════
//  User Routes
//  /api/users
// ═══════════════════════════════════════════

const router = Router()

// GET /api/users
router.get('/', async (req, res) => {
  try {
    const data = await User.findAll()
    res.json(data)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// POST /api/users  (register / upsert)
router.post('/', async (req, res) => {
  try {
    const { name, color } = req.body
    if (!name) return res.status(400).json({ error: 'Name is required' })
    const data = await User.upsert({ name, color })
    res.status(201).json(data)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
