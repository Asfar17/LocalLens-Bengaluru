import express from 'express'
import cors from 'cors'
import mongoose from 'mongoose'

const app = express()

// CORS configuration - allow all origins for now
app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    env: {
      hasMongoUri: !!process.env.MONGODB_URI,
      hasOpenRouterKey: !!process.env.OPENROUTER_API_KEY,
      hasGoogleKey: !!process.env.GOOGLE_CLOUD_API_KEY
    }
  })
})

// Contexts endpoint - simple version
app.get('/contexts', (req, res) => {
  res.json([
    { id: 'city', name: 'city.md', domain: 'city', isLoaded: true },
    { id: 'slang', name: 'slang.md', domain: 'slang', isLoaded: true },
    { id: 'food', name: 'food.md', domain: 'food', isLoaded: true },
    { id: 'traffic', name: 'traffic.md', domain: 'traffic', isLoaded: true },
    { id: 'etiquette', name: 'etiquette.md', domain: 'etiquette', isLoaded: true }
  ])
})

// Database connection state
let isConnected = false

export default async function handler(req, res) {
  try {
    // Strip /api prefix from the URL for routing
    if (req.url?.startsWith('/api')) {
      req.url = req.url.replace('/api', '') || '/'
    }
    
    // Connect to database if not connected
    if (!isConnected && process.env.MONGODB_URI) {
      try {
        await mongoose.connect(process.env.MONGODB_URI)
        isConnected = true
        console.log('Database connected')
      } catch (error) {
        console.error('Database connection failed:', error)
      }
    }
    
    // Handle the request with Express
    return app(req, res)
  } catch (error) {
    console.error('Handler error:', error)
    return res.status(500).json({ 
      error: 'Handler failed', 
      message: error.message
    })
  }
}
