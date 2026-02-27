import mongoose from 'mongoose'
import dotenv from 'dotenv'

dotenv.config()

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/collab-docs'

// Test & establish the connection on startup
export async function testConnection() {
  try {
    await mongoose.connect(MONGODB_URI)
    console.log('  ✅ Database connected (MongoDB local)')
    return true
  } catch (error) {
    console.error('  ❌ MongoDB connection failed:', error.message)
    console.error('  ⚠️  Make sure MongoDB is running locally!')
    console.error('     Start it with: mongod  (or via MongoDB Compass / Windows service)')
    return false
  }
}

export default mongoose
