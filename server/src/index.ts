// Load environment variables FIRST
import './config/dotenv.js'

import express from 'express'
import cors from 'cors'
import { connectDB } from './config/database.js'
import apiRoutes from './routes/api.js'
import { getEnv } from './config/environment.js'

const app = express()
const env = getEnv()
const PORT = env.port

// CORS configuration using environment settings
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = env.allowedOrigins
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

// Routes
app.use('/api', apiRoutes)

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Start server
const startServer = async () => {
  try {
    await connectDB()
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`)
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

startServer()
