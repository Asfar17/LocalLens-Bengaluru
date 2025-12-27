import express from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import fs from 'fs/promises'
import path from 'path'
import OpenAI from 'openai'

const app = express()

// CORS configuration - allow all origins
app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Context files data
const contextFiles = [
  { id: 'city', name: 'city.md', domain: 'city', isLoaded: true },
  { id: 'slang', name: 'slang.md', domain: 'slang', isLoaded: true },
  { id: 'food', name: 'food.md', domain: 'food', isLoaded: true },
  { id: 'traffic', name: 'traffic.md', domain: 'traffic', isLoaded: true },
  { id: 'etiquette', name: 'etiquette.md', domain: 'etiquette', isLoaded: true }
]

// Load context content
async function loadContextContent() {
  const contextDir = path.join(process.cwd(), 'context')
  const contents = {}
  
  for (const file of contextFiles) {
    try {
      const filePath = path.join(contextDir, file.name)
      contents[file.id] = await fs.readFile(filePath, 'utf-8')
    } catch (error) {
      console.error(`Failed to load ${file.name}:`, error.message)
      contents[file.id] = ''
    }
  }
  
  return contents
}

// Initialize OpenAI client for OpenRouter
function getOpenAIClient() {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return null
  
  return new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: apiKey
  })
}

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

// GET /contexts - List available contexts
app.get('/contexts', (req, res) => {
  res.json(contextFiles)
})

// POST /contexts/:id/toggle - Toggle context
app.post('/contexts/:id/toggle', (req, res) => {
  const { id } = req.params
  const context = contextFiles.find(c => c.id === id)
  if (context) {
    context.isLoaded = !context.isLoaded
    res.json({ id, isLoaded: context.isLoaded })
  } else {
    res.status(404).json({ error: 'Context not found' })
  }
})

// GET /session - Get session state
app.get('/session', (req, res) => {
  res.json({
    sessionId: req.headers['x-session-id'] || 'default',
    persona: 'newbie',
    loadedContexts: contextFiles.filter(c => c.isLoaded).map(c => c.id),
    availableContexts: contextFiles,
    bangaloreContextEnabled: true
  })
})

// POST /persona - Set persona
app.post('/persona', (req, res) => {
  const { persona } = req.body
  res.json({ 
    persona: persona || 'newbie',
    message: 'Persona updated successfully'
  })
})

// POST /query - Main chat endpoint
app.post('/query', async (req, res) => {
  try {
    const { query, persona = 'newbie', bangaloreContextEnabled = true, loadedContexts = [] } = req.body
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' })
    }
    
    const client = getOpenAIClient()
    if (!client) {
      return res.status(503).json({ 
        error: 'AI service not configured',
        suggestion: 'Please configure OPENROUTER_API_KEY'
      })
    }
    
    // Load context content
    let contextContent = ''
    if (bangaloreContextEnabled) {
      const contents = await loadContextContent()
      const activeContexts = loadedContexts.length > 0 
        ? loadedContexts 
        : contextFiles.filter(c => c.isLoaded).map(c => c.id)
      
      contextContent = activeContexts
        .map(id => contents[id])
        .filter(Boolean)
        .join('\n\n')
    }
    
    // Build system prompt based on persona
    const personaPrompts = {
      newbie: 'You are a friendly and detailed guide helping newcomers navigate Bangalore. Provide thorough explanations and local customs.',
      student: 'You are a casual and practical guide for students in Bangalore. Focus on budget-friendly options and practical tips.',
      'it-professional': 'You are a concise and efficient guide for IT professionals in Bangalore. Focus on time-saving tips and professional insights.',
      tourist: 'You are a descriptive and cultural guide for tourists visiting Bangalore. Highlight must-see experiences and cultural significance.'
    }
    
    const systemPrompt = `${personaPrompts[persona] || personaPrompts.newbie}

You are the Bangalore Survival Assistant, helping users navigate life in Bangalore, India.

${contextContent ? `Use this local knowledge to inform your responses:\n\n${contextContent}` : ''}

Provide helpful, accurate, and culturally-aware responses about Bangalore.`

    const completion = await client.chat.completions.create({
      model: 'openai/gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query }
      ],
      max_tokens: 1000,
      temperature: 0.7
    })
    
    const response = completion.choices[0]?.message?.content || 'Sorry, I could not generate a response.'
    
    res.json({
      response,
      persona,
      contextUsed: bangaloreContextEnabled
    })
  } catch (error) {
    console.error('Query error:', error)
    res.status(500).json({ 
      error: 'Failed to process query',
      message: error.message,
      suggestion: 'Please try again later.'
    })
  }
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
        console.error('Database connection failed:', error.message)
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
