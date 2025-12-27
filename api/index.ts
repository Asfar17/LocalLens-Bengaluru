// Load environment variables first (for local dev)
import '../server/src/config/dotenv.js'

import type { VercelRequest, VercelResponse } from '@vercel/node'
import express, { Request, Response } from 'express'
import cors from 'cors'
import { connectDB } from '../server/src/config/database.js'
import apiRoutes from '../server/src/routes/api.js'

const app = express()

// Parse allowed origins from environment variable
function getAllowedOrigins(): string[] {
  const allowedOrigins = process.env.ALLOWED_ORIGINS
  if (allowedOrigins) {
    return allowedOrigins.split(',').map(origin => origin.trim()).filter(Boolean)
  }
  if (process.env.VERCEL_URL) {
    return [`https://${process.env.VERCEL_URL}`, 'https://locallens-bengaluru.vercel.app']
  }
  return ['http://localhost:3000', 'http://localhost:5173']
}

// CORS configuration
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = getAllowedOrigins()
    if (!origin) {
      callback(null, true)
      return
    }
    callback(null, true) // Allow all origins for debugging
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-session-id']
}

// Middleware
app.use(cors(corsOptions))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Health check - before routes
app.get('/health', (_req: Request, res: Response) => {
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

// Mount routes
app.use('/', apiRoutes)

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: express.NextFunction) => {
  console.error('API Error:', err)
  res.status(500).json({ error: 'Internal server error', message: err.message })
})

// Database connection state
let isConnected = false

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Strip /api prefix from the URL for routing
    if (req.url?.startsWith('/api')) {
      req.url = req.url.replace('/api', '') || '/'
    }
    
    // Connect to database if not connected
    if (!isConnected && process.env.MONGODB_URI) {
      try {
        await connectDB()
        isConnected = true
      } catch (error) {
        console.error('Database connection failed:', error)
        // Continue without database for health checks
      }
    }
    
    // Handle the request with Express
    return app(req as unknown as Request, res as unknown as Response)
  } catch (error) {
    console.error('Handler error:', error)
    return res.status(500).json({ 
      error: 'Handler failed', 
      message: error instanceof Error ? error.message : String(error)
    })
  }
}
