import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import dotenv from 'dotenv'
import * as Y from 'yjs'
import { createClient } from '@supabase/supabase-js'
import os from 'os'

dotenv.config()

// Get local IP address
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

const app = express()
const httpServer = createServer(app)

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

app.use(cors())
app.use(express.json())

// Socket.io server
const io = new Server(httpServer, {
  cors: {
    origin: '*', // Allow all origins for LAN access (or specify your LAN IPs)
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})

// Store Yjs documents in memory
const docs = new Map()
const saveTimers = new Map()

// Debounced save function
const scheduleSave = (documentId, content) => {
  if (saveTimers.has(documentId)) {
    clearTimeout(saveTimers.get(documentId))
  }
  
  const timer = setTimeout(async () => {
    try {
      await supabase
        .from('documents')
        .update({ 
          content,
          updated_at: new Date().toISOString()
        })
        .eq('id', documentId)
      console.log(`Saved document ${documentId}`)
      saveTimers.delete(documentId)
    } catch (error) {
      console.error('Error saving to database:', error)
    }
  }, 2000)
  
  saveTimers.set(documentId, timer)
}

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id)

  // Handle document synchronization
  socket.on('sync-step-1', async ({ documentId }) => {
    console.log(`Client ${socket.id} requesting sync for document: ${documentId}`)
    socket.join(`document-${documentId}`)

    // Get or create Yjs document
    let yDoc = docs.get(documentId)
    if (!yDoc) {
      yDoc = new Y.Doc()
      docs.set(documentId, yDoc)

      // Load initial content from database
      try {
        const { data, error } = await supabase
          .from('documents')
          .select('content')
          .eq('id', documentId)
          .single()

        if (data && data.content) {
          const yText = yDoc.getText('content')
          yText.insert(0, data.content)
        }
      } catch (error) {
        console.error('Error loading document:', error)
      }
    }

    // Send full state to the new client
    const state = Y.encodeStateAsUpdate(yDoc)
    socket.emit('sync-step-2', { update: Array.from(state) })
  })

  // Handle incoming updates from clients
  socket.on('update', ({ documentId, update }) => {
    console.log(`Update received from ${socket.id} for document: ${documentId}`)
    
    // Get Yjs document
    const yDoc = docs.get(documentId)
    if (!yDoc) {
      console.error(`Document ${documentId} not found`)
      return
    }

    // Apply update to server's document
    try {
      Y.applyUpdate(yDoc, new Uint8Array(update))

      // Broadcast to all other clients in the room
      socket.to(`document-${documentId}`).emit('update', { update })

      // Schedule save to database
      const yText = yDoc.getText('content')
      const content = yText.toString()
      scheduleSave(documentId, content)
    } catch (error) {
      console.error('Error applying update:', error)
    }
  })

  // Handle awareness (cursor positions, user info)
  socket.on('awareness', ({ documentId, update }) => {
    socket.to(`document-${documentId}`).emit('awareness', { 
      update,
      clientId: socket.id 
    })
  })

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id)
  })
})

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API endpoint to create document
app.post('/api/documents', async (req, res) => {
  try {
    const { title, content } = req.body
    const { data, error } = await supabase
      .from('documents')
      .insert([{ title, content }])
      .select()

    if (error) throw error
    res.json(data[0])
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// API endpoint to get documents
app.get('/api/documents', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .order('updated_at', { ascending: false })

    if (error) throw error
    res.json(data)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

const PORT = process.env.PORT || 3001
const localIP = getLocalIPAddress()

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log('\n' + '='.repeat(70))
  console.log('🚀 SERVER STARTED SUCCESSFULLY')
  console.log('='.repeat(70))
  console.log('\n📍 Local Access:')
  console.log(`   http://localhost:${PORT}`)
  console.log('\n🌐 Network Access (LAN):')
  console.log(`   http://${localIP}:${PORT}`)
  console.log('\n📋 SETUP INSTRUCTIONS FOR OTHER COMPUTERS:\n')
  console.log('1. Create/Update client/.env file with:')
  console.log(`   VITE_SERVER_URL=http://${localIP}:${PORT}`)
  console.log('\n2. Access from other computers on the same network:')
  console.log(`   Frontend: http://${localIP}:3000`)
  console.log(`   Backend:  http://${localIP}:${PORT}`)
  console.log('\n3. Ensure Windows Firewall allows ports 3000 & ${PORT}')
  console.log('   Run PowerShell as Admin:')
  console.log('   New-NetFirewallRule -DisplayName "React Dev" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow')
  console.log(`   New-NetFirewallRule -DisplayName "Node Server" -Direction Inbound -LocalPort ${PORT} -Protocol TCP -Action Allow`)
  console.log('\n' + '='.repeat(70) + '\n')
})
