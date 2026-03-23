import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import dotenv from 'dotenv'
import os from 'os'

// Config & Models
import { testConnection } from './config/db.js'

// Routes
import createDocumentRoutes from './routes/documents.js'
import userRoutes from './routes/users.js'

// Socket handlers
import { registerSocketHandlers } from './sockets/collaboration.js'

dotenv.config()

// ═══════════════════════════════════════════
//  Express App Setup
// ═══════════════════════════════════════════
const app = express()
const httpServer = createServer(app)

// Socket.io (needed by document routes for snapshot restore broadcast)
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
})

registerSocketHandlers(io)

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))
app.use(express.json({ limit: '32mb' }))

// ═══════════════════════════════════════════
//  Routes
// ═══════════════════════════════════════════
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api/documents', createDocumentRoutes(io))
app.use('/api/users', userRoutes)

// ═══════════════════════════════════════════
//  Start Server
// ═══════════════════════════════════════════
function getLocalIPAddress() {
  const interfaces = os.networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address
      }
    }
  }
  return 'localhost'
}

const PORT = process.env.PORT || 3001
const localIP = getLocalIPAddress()

httpServer.listen(PORT, '0.0.0.0', async () => {
  console.log('\n' + '═'.repeat(60))
  console.log('  🚀 COLLAB-DOCS SERVER')
  console.log('═'.repeat(60))

  // Test database connection
  await testConnection()

  console.log(`\n  📍 Local:   http://localhost:${PORT}`)
  console.log(`  🌐 Network: http://${localIP}:${PORT}`)
  console.log(`\n  Frontend:   http://${localIP}:3000`)
  console.log('\n' + '═'.repeat(60) + '\n')
})
