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
  // In production, allow Vercel URLs
  if (process.env.VERCEL_URL) {
    return [`https://${process.env.VERCEL_URL}`, 'https://locallens-bengaluru.vercel.app']
  }
  // Default origins for development
  return ['http://localhost:3000', 'http://localhost:5173']
}

// CORS configuration
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = getAllowedOrigins()
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      callback(null, true)
      return
    }
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      console.log('CORS blocked origin:', origin)
      callback(null, true) // Allow all origins for now to debug
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-session-id']
}

// Middleware
app.use(cors(corsOptions))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Mount routes
app.use('/', apiRoutes)

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: express.NextFunction) => {
  console.error('API Error:', err)
  res.status(500).json({ error: 'Internal server error', message: err.message })
})

// Database connection state
let isConnected = false

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Strip /api prefix from the URL for routing
  if (req.url?.startsWith('/api')) {
    req.url = req.url.replace('/api', '') || '/'
  }
  
  // Connect to database if not connected
  if (!isConnected && process.env.MONGODB_URI) {
    try {
      await connectDB()
      isConnected = true
      console.log('Database connected successfully')
    } catch (error) {
      console.error('Database connection failed:', error)
      return res.status(503).json({ error: 'Database temporarily unavailable' })
    }
  }
  
  // Handle the request with Express
  return app(req as unknown as Request, res as unknown as Response)
}
