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

// Cache for loaded context content
let contextCache = {}

// Load context content
async function loadContextContent() {
  if (Object.keys(contextCache).length > 0) {
    return contextCache
  }
  
  const contextDir = path.join(process.cwd(), 'context')
  
  for (const file of contextFiles) {
    try {
      const filePath = path.join(contextDir, file.name)
      contextCache[file.id] = await fs.readFile(filePath, 'utf-8')
      console.log(`Loaded context: ${file.name}`)
    } catch (error) {
      console.error(`Failed to load ${file.name}:`, error.message)
      contextCache[file.id] = ''
    }
  }
  
  return contextCache
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

// Detect query type for context file attribution
function detectQueryType(query) {
  const q = query.toLowerCase()
  const types = []
  
  if (/slang|meaning|what does|kannada|phrase|say|speak|word/.test(q)) types.push('slang')
  if (/food|eat|restaurant|dosa|coffee|hungry|lunch|dinner|breakfast|biryani/.test(q)) types.push('food')
  if (/traffic|commute|metro|bus|auto|uber|ola|travel|route|reach|drive/.test(q)) types.push('traffic')
  if (/etiquette|culture|custom|behave|tip|greeting|temple|office|manner/.test(q)) types.push('etiquette')
  if (/city|bangalore|bengaluru|area|neighborhood|place|location|weather/.test(q)) types.push('city')
  
  return types.length > 0 ? types : ['city', 'slang', 'food', 'traffic', 'etiquette']
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

// POST /session/bangalore-context - Toggle Bangalore context
app.post('/session/bangalore-context', (req, res) => {
  const { enabled } = req.body
  res.json({
    sessionId: req.headers['x-session-id'] || 'default',
    bangaloreContextEnabled: enabled,
    message: 'Bangalore context state updated'
  })
})

// PUT /session - Update session
app.put('/session', (req, res) => {
  const { persona, loadedContexts, bangaloreContextEnabled } = req.body
  res.json({
    sessionId: req.headers['x-session-id'] || 'default',
    persona: persona || 'newbie',
    loadedContexts: loadedContexts || contextFiles.filter(c => c.isLoaded).map(c => c.id),
    bangaloreContextEnabled: bangaloreContextEnabled !== false,
    message: 'Session updated'
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
    let contextFilesUsed = []
    
    if (bangaloreContextEnabled) {
      const contents = await loadContextContent()
      const activeContexts = loadedContexts.length > 0 
        ? loadedContexts 
        : contextFiles.filter(c => c.isLoaded).map(c => c.id)
      
      // Detect which contexts are relevant to the query
      const relevantTypes = detectQueryType(query)
      contextFilesUsed = relevantTypes
        .filter(type => activeContexts.includes(type))
        .map(type => `${type}.md`)
      
      // Build context content from relevant files
      contextContent = activeContexts
        .filter(id => relevantTypes.includes(id))
        .map(id => contents[id])
        .filter(Boolean)
        .join('\n\n---\n\n')
    }
    
    // Build system prompt based on persona
    const personaPrompts = {
      newbie: 'You are a friendly and detailed guide helping newcomers navigate Bangalore. Provide thorough explanations and local customs. Start responses with "Welcome to Bangalore! 🌱"',
      student: 'You are a casual and practical guide for students in Bangalore. Focus on budget-friendly options and practical tips. Keep it brief and relatable.',
      'it-professional': 'You are a concise and efficient guide for IT professionals in Bangalore. Focus on time-saving tips and professional insights. Be direct and to the point.',
      tourist: 'You are a descriptive and cultural guide for tourists visiting Bangalore. Highlight must-see experiences and cultural significance. Be enthusiastic and informative.'
    }
    
    const systemPrompt = `${personaPrompts[persona] || personaPrompts.newbie}

You are the Bangalore Survival Assistant (LocalLens Bengaluru), helping users navigate life in Bangalore, India.

${bangaloreContextEnabled && contextContent ? `
IMPORTANT: Use the following local knowledge to inform your responses. This is verified local information:

${contextContent}

When you use information from these context files, naturally incorporate it into your response.
` : 'Note: Bangalore-specific context is currently disabled. Provide general responses.'}

Guidelines:
- Be helpful, accurate, and culturally-aware
- Use local terms when appropriate (with explanations for newbies/tourists)
- For food queries, mention specific dishes and places
- For traffic queries, give practical timing and route advice
- For slang queries, explain meanings and usage context
- Keep responses conversational and engaging`

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
    
    // Return response with context transparency info
    res.json({
      response,
      persona,
      contextUsed: bangaloreContextEnabled ? loadedContexts : [],
      contextFilesUsed: bangaloreContextEnabled ? contextFilesUsed : [],
      bangaloreContextActive: bangaloreContextEnabled,
      aiPowered: true
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

// POST /voice - Voice transcription placeholder
app.post('/voice', (req, res) => {
  res.status(503).json({
    error: 'Voice transcription not available in serverless mode',
    suggestion: 'Please type your question instead.'
  })
})

// POST /image - Image processing placeholder
app.post('/image', (req, res) => {
  res.status(503).json({
    error: 'Image processing not available in serverless mode',
    suggestion: 'Please describe what you see in the image.'
  })
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
