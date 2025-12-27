import express, { Request, Response } from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { connectDB } from '../server/src/config/database.js'
import apiRoutes from '../server/src/routes/api.js'

dotenv.config()

const app = express()

// Parse allowed origins from environment variable
function getAllowedOrigins(): string[] {
  const allowedOrigins = process.env.ALLOWED_ORIGINS
  if (allowedOrigins) {
    return allowedOrigins.split(',').map(origin => origin.trim()).filter(Boolean)
  }
  // Default origins for development
  if (process.env.NODE_ENV !== 'production') {
    return ['http://localhost:3000', 'http://localhost:5173']
  }
  // In production, if ALLOWED_ORIGINS is not set, use Vercel URL
  if (process.env.VERCEL_URL) {
    return [`https://${process.env.VERCEL_URL}`]
  }
  return []
}

// CORS configuration for production
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
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}

// Middleware
app.use(cors(corsOptions))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Strip /api prefix since Vercel routes /api/* to this handler
// The routes in api.ts are defined without the /api prefix
app.use('/', apiRoutes)

// Health check at /api/health
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: express.NextFunction) => {
  console.error('API Error:', err)
  res.status(500).json({ error: 'Internal server error', message: err.message })
})

// Connect to database on cold start
let isConnected = false

const handler = async (req: Request, res: Response) => {
  // Strip /api prefix from the URL for routing
  if (req.url.startsWith('/api')) {
    req.url = req.url.replace('/api', '') || '/'
  }
  
  if (!isConnected && process.env.MONGODB_URI) {
    try {
      await connectDB()
      isConnected = true
    } catch (error) {
      console.error('Database connection failed:', error)
      return res.status(503).json({ error: 'Database temporarily unavailable' })
    }
  }
  return app(req, res)
}

export default handler
