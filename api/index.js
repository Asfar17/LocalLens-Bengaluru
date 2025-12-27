import express from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import fs from 'fs/promises'
import path from 'path'
import OpenAI from 'openai'
import multer from 'multer'
import { ImageAnnotatorClient } from '@google-cloud/vision'
import { TranslationServiceClient } from '@google-cloud/translate'
import speech from '@google-cloud/speech'
import { Client as GoogleMapsClient, PlaceType1 } from '@googlemaps/google-maps-services-js'

const app = express()

// CORS configuration
app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Multer configuration for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
})

const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
})

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
  if (Object.keys(contextCache).length > 0) return contextCache
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

// Initialize Google clients
function getGoogleCredentials() {
  const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
  if (credentialsJson) {
    try {
      return JSON.parse(credentialsJson)
    } catch (e) {
      console.error('Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON:', e.message)
    }
  }
  return null
}

let visionClient = null
let translateClient = null
let speechClient = null
let mapsClient = null

function initGoogleClients() {
  const credentials = getGoogleCredentials()
  if (credentials) {
    try {
      visionClient = new ImageAnnotatorClient({ credentials })
      translateClient = new TranslationServiceClient({ credentials })
      speechClient = new speech.SpeechClient({ credentials })
      mapsClient = new GoogleMapsClient({})
      console.log('Google Cloud clients initialized')
    } catch (e) {
      console.error('Failed to initialize Google clients:', e.message)
    }
  }
}

initGoogleClients()


// Detect query type for context file attribution
function detectQueryType(query) {
  const q = query.toLowerCase()
  const types = []
  if (/slang|meaning|what does|kannada|phrase|say|speak|word/.test(q)) types.push('slang')
  if (/food|eat|restaurant|dosa|coffee|hungry|lunch|dinner|breakfast|biryani|thali/.test(q)) types.push('food')
  if (/traffic|commute|metro|bus|auto|uber|ola|travel|route|reach|drive/.test(q)) types.push('traffic')
  if (/etiquette|culture|custom|behave|tip|greeting|temple|office|manner/.test(q)) types.push('etiquette')
  if (/city|bangalore|bengaluru|area|neighborhood|place|location|weather/.test(q)) types.push('city')
  return types.length > 0 ? types : ['city', 'slang', 'food', 'traffic', 'etiquette']
}

// Check if query is food-related
function isFoodQuery(query) {
  return /food|eat|restaurant|dosa|coffee|hungry|lunch|dinner|breakfast|biryani|thali|where.*eat|recommend.*food/.test(query.toLowerCase())
}

// Food type keywords for Google Maps search
const FOOD_TYPE_KEYWORDS = {
  dosa: ['dosa', 'south indian', 'udupi', 'darshini'],
  idli: ['idli', 'south indian', 'udupi'],
  biryani: ['biryani', 'hyderabadi', 'muslim'],
  coffee: ['coffee', 'cafe', 'filter coffee'],
  thali: ['thali', 'meals', 'south indian'],
  pizza: ['pizza', 'italian'],
  burger: ['burger', 'american'],
  chinese: ['chinese', 'indo chinese'],
  vegetarian: ['vegetarian', 'pure veg', 'veg'],
  non_vegetarian: ['non veg', 'military hotel', 'meat']
}

// Extract food type from query
function extractFoodType(query) {
  const q = query.toLowerCase()
  for (const [type, keywords] of Object.entries(FOOD_TYPE_KEYWORDS)) {
    if (keywords.some(kw => q.includes(kw))) return type
  }
  if (q.includes('food') || q.includes('eat') || q.includes('restaurant')) return 'restaurant'
  return null
}

// Calculate distance between coordinates (Haversine formula)
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
}

// Get location recommendations from Google Maps
async function getLocationRecommendations(location, foodType) {
  if (!mapsClient || !process.env.GOOGLE_MAPS_API_KEY) return []
  try {
    const keyword = foodType ? (FOOD_TYPE_KEYWORDS[foodType]?.[0] || foodType) : 'restaurant'
    const response = await mapsClient.placesNearby({
      params: {
        location: { lat: location.lat, lng: location.lng },
        radius: 1500,
        type: PlaceType1.restaurant,
        keyword,
        key: process.env.GOOGLE_MAPS_API_KEY
      }
    })
    if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') return []
    return (response.data.results || []).slice(0, 5).map(place => ({
      suggestion: place.name,
      reasoning: generatePlaceReasoning(place, location),
      place: {
        name: place.name,
        address: place.vicinity || 'Address not available',
        rating: place.rating || 0,
        distance: calculateDistance(location.lat, location.lng, place.geometry?.location?.lat || 0, place.geometry?.location?.lng || 0),
        priceLevel: place.price_level || 0,
        types: place.types || [],
        placeId: place.place_id || ''
      },
      culturalNote: getCulturalNote(place),
      contextFactors: ['location', 'rating']
    }))
  } catch (e) {
    console.error('Google Maps error:', e.message)
    return []
  }
}

function generatePlaceReasoning(place, location) {
  const parts = []
  const dist = calculateDistance(location.lat, location.lng, place.geometry?.location?.lat || 0, place.geometry?.location?.lng || 0)
  if (dist < 500) parts.push(`Very close (${dist}m)`)
  else if (dist < 1000) parts.push(`Walking distance (${dist}m)`)
  else parts.push(`${(dist / 1000).toFixed(1)}km away`)
  if (place.rating >= 4.5) parts.push('highly rated')
  else if (place.rating >= 4.0) parts.push('well-reviewed')
  else if (place.rating > 0) parts.push(`rated ${place.rating}/5`)
  const priceDesc = ['budget-friendly', 'affordable', 'moderate', 'upscale', 'premium']
  if (place.price_level >= 0 && place.price_level < priceDesc.length) parts.push(priceDesc[place.price_level])
  return parts.join(', ') + '.'
}

function getCulturalNote(place) {
  const name = (place.name || '').toLowerCase()
  const types = (place.types || []).map(t => t.toLowerCase())
  if (name.includes('darshini')) return 'Darshini: Quick service standing-and-eating format. Order at counter, eat quickly.'
  if (name.includes('udupi')) return 'Udupi restaurant: Authentic vegetarian South Indian cuisine. Try the dosas and thalis.'
  if (name.includes('military') || name.includes('nagarjuna')) return 'Military hotel style: Non-vegetarian Karnataka cuisine. Known for mutton and chicken dishes.'
  if (types.includes('cafe') || name.includes('coffee')) return 'Filter coffee is a Bangalore specialty. Best enjoyed before 9 AM for authentic experience.'
  return undefined
}


// Persona prompts
const personaPrompts = {
  newbie: 'You are a friendly and detailed guide helping newcomers navigate Bangalore. Provide thorough explanations and local customs. Start responses with "Welcome to Bangalore! 🌱"',
  student: 'You are a casual and practical guide for students in Bangalore. Focus on budget-friendly options and practical tips. Keep it brief and relatable.',
  'it-professional': 'You are a concise and efficient guide for IT professionals in Bangalore. Focus on time-saving tips and professional insights. Be direct and to the point.',
  tourist: 'You are a descriptive and cultural guide for tourists visiting Bangalore. Highlight must-see experiences and cultural significance. Be enthusiastic and informative.'
}

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: {
      hasMongoUri: !!process.env.MONGODB_URI,
      hasOpenRouterKey: !!process.env.OPENROUTER_API_KEY,
      hasGoogleKey: !!process.env.GOOGLE_CLOUD_API_KEY,
      hasGoogleCredentials: !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON,
      hasMapsKey: !!process.env.GOOGLE_MAPS_API_KEY
    }
  })
})

// GET /contexts
app.get('/contexts', (req, res) => {
  res.json(contextFiles)
})

// POST /contexts/:id/toggle
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

// GET /session
app.get('/session', (req, res) => {
  res.json({
    sessionId: req.headers['x-session-id'] || 'default',
    persona: 'newbie',
    loadedContexts: contextFiles.filter(c => c.isLoaded).map(c => c.id),
    availableContexts: contextFiles,
    bangaloreContextEnabled: true
  })
})

// POST /persona
app.post('/persona', (req, res) => {
  const { persona } = req.body
  res.json({ persona: persona || 'newbie', message: 'Persona updated successfully' })
})

// POST /session/bangalore-context
app.post('/session/bangalore-context', (req, res) => {
  const { enabled } = req.body
  res.json({
    sessionId: req.headers['x-session-id'] || 'default',
    bangaloreContextEnabled: enabled,
    message: 'Bangalore context state updated'
  })
})

// PUT /session
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
    const { query, persona = 'newbie', bangaloreContextEnabled = true, loadedContexts = [], location } = req.body
    if (!query) return res.status(400).json({ error: 'Query is required' })

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
    const contents = await loadContextContent()
    const activeContexts = loadedContexts.length > 0 ? loadedContexts : contextFiles.filter(c => c.isLoaded).map(c => c.id)

    if (bangaloreContextEnabled) {
      const relevantTypes = detectQueryType(query)
      contextFilesUsed = relevantTypes.filter(type => activeContexts.includes(type)).map(type => `${type}.md`)
      contextContent = activeContexts
        .filter(id => relevantTypes.includes(id))
        .map(id => contents[id])
        .filter(Boolean)
        .join('\n\n---\n\n')
    }

    // Get location recommendations for food queries
    let locationRecommendations = []
    if (location && isFoodQuery(query)) {
      const foodType = extractFoodType(query)
      locationRecommendations = await getLocationRecommendations(location, foodType)
    }

    // Build system prompt
    const systemPrompt = `${personaPrompts[persona] || personaPrompts.newbie}

You are the Bangalore Survival Assistant (LocalLens Bengaluru), helping users navigate life in Bangalore, India.

${bangaloreContextEnabled && contextContent ? `
IMPORTANT: Use the following local knowledge to inform your responses:

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

    res.json({
      response,
      persona,
      contextUsed: bangaloreContextEnabled ? activeContexts : [],
      contextFilesUsed: bangaloreContextEnabled ? contextFilesUsed : [],
      bangaloreContextActive: bangaloreContextEnabled,
      aiPowered: true,
      locationRecommendations: locationRecommendations.length > 0 ? locationRecommendations : undefined
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


// POST /voice - Voice transcription with Google Speech
app.post('/voice', audioUpload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No audio file provided',
        code: 'MISSING_FILE',
        suggestion: 'Upload an audio file with the field name "audio"'
      })
    }

    if (!speechClient) {
      return res.status(503).json({
        error: 'Voice transcription not available',
        code: 'SERVICE_UNAVAILABLE',
        suggestion: 'Please type your question instead.'
      })
    }

    const languageCode = req.body?.languageCode || 'en-IN'
    const audioContent = req.file.buffer.toString('base64')

    // Map MIME type to encoding
    const encodingMap = {
      'audio/wav': 'LINEAR16',
      'audio/wave': 'LINEAR16',
      'audio/mp3': 'MP3',
      'audio/mpeg': 'MP3',
      'audio/webm': 'WEBM_OPUS',
      'audio/ogg': 'OGG_OPUS',
      'audio/flac': 'FLAC'
    }
    const encoding = encodingMap[req.file.mimetype] || 'LINEAR16'

    const [response] = await speechClient.recognize({
      audio: { content: audioContent },
      config: {
        encoding,
        languageCode,
        enableAutomaticPunctuation: true,
        model: 'command_and_search',
        alternativeLanguageCodes: languageCode === 'en-IN' ? ['kn-IN'] : ['en-IN']
      }
    })

    if (!response.results || response.results.length === 0) {
      return res.json({
        text: '',
        confidence: 0,
        language: languageCode,
        aiPowered: true,
        suggestion: 'No speech detected. Please try again or type your question.'
      })
    }

    const transcription = response.results
      .map(result => result.alternatives?.[0]?.transcript || '')
      .join(' ')
      .trim()

    const confidences = response.results
      .map(result => result.alternatives?.[0]?.confidence || 0)
      .filter(c => c > 0)
    const avgConfidence = confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : 0.8

    res.json({
      text: transcription,
      confidence: avgConfidence,
      language: response.results[0]?.languageCode || languageCode,
      aiPowered: true
    })
  } catch (error) {
    console.error('Voice processing error:', error)
    res.status(422).json({
      error: 'Could not transcribe audio',
      code: 'TRANSCRIPTION_FAILED',
      reason: error.message,
      suggestion: 'Please try typing your question instead.'
    })
  }
})


// POST /image - Image processing with Google Vision OCR and translation
app.post('/image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No image file provided',
        code: 'MISSING_FILE',
        suggestion: 'Upload an image file with the field name "image"'
      })
    }

    if (!visionClient || !translateClient) {
      return res.status(503).json({
        error: 'Image processing not available',
        code: 'SERVICE_UNAVAILABLE',
        suggestion: 'Please describe what you see in the image.'
      })
    }

    const credentials = getGoogleCredentials()
    const projectId = credentials?.project_id || 'bangalore-assistant'

    // Step 1: Extract text using OCR
    const [visionResult] = await visionClient.textDetection({
      image: { content: req.file.buffer.toString('base64') }
    })

    const detections = visionResult.textAnnotations
    if (!detections || detections.length === 0) {
      return res.json({
        extractedText: '',
        interpretation: {
          localMeaning: 'No text could be extracted from the image.',
          culturalSignificance: 'Unable to provide cultural interpretation without text.',
          practicalImplications: 'Try uploading a clearer image with visible text.'
        },
        aiPowered: false
      })
    }

    const extractedText = (detections[0].description || '').trim()

    // Step 2: Detect language
    let detectedLanguage = 'en'
    try {
      const [langResponse] = await translateClient.detectLanguage({
        parent: `projects/${projectId}/locations/global`,
        content: extractedText
      })
      detectedLanguage = langResponse.languages?.[0]?.languageCode || 'en'
    } catch (e) {
      console.error('Language detection error:', e.message)
    }

    // Step 3: Translate if non-English
    let translatedText
    if (detectedLanguage !== 'en') {
      try {
        const [translateResponse] = await translateClient.translateText({
          parent: `projects/${projectId}/locations/global`,
          contents: [extractedText],
          sourceLanguageCode: detectedLanguage,
          targetLanguageCode: 'en'
        })
        translatedText = translateResponse.translations?.[0]?.translatedText
      } catch (e) {
        console.error('Translation error:', e.message)
      }
    }

    // Step 4: Generate AI interpretation
    let interpretation = {
      localMeaning: `Text found: "${extractedText}"`,
      culturalSignificance: 'This appears to be local signage or text.',
      practicalImplications: 'Consider the context where you found this text.'
    }

    const client = getOpenAIClient()
    if (client) {
      try {
        const contents = await loadContextContent()
        const contextContent = Object.values(contents).filter(Boolean).join('\n\n')

        const completion = await client.chat.completions.create({
          model: 'openai/gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are a Bangalore local expert. Interpret text found in images (signs, menus, notices) for someone new to Bangalore.

Use this local knowledge:
${contextContent}

Provide interpretation in JSON format:
{
  "localMeaning": "What this text means in local context",
  "culturalSignificance": "Cultural background or significance",
  "practicalImplications": "What the user should do or know"
}`
            },
            {
              role: 'user',
              content: `Interpret this text found in Bangalore: "${translatedText || extractedText}"${detectedLanguage !== 'en' ? ` (Original language: ${detectedLanguage}, Original text: "${extractedText}")` : ''}`
            }
          ],
          max_tokens: 500,
          temperature: 0.7
        })

        const aiResponse = completion.choices[0]?.message?.content || ''
        try {
          const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            interpretation = JSON.parse(jsonMatch[0])
          }
        } catch (e) {
          interpretation.localMeaning = aiResponse
        }
      } catch (e) {
        console.error('AI interpretation error:', e.message)
      }
    }

    res.json({
      extractedText,
      translatedText,
      detectedLanguage,
      interpretation,
      aiPowered: !!client
    })
  } catch (error) {
    console.error('Image processing error:', error)
    res.status(422).json({
      error: 'Could not process image',
      code: 'IMAGE_PROCESSING_FAILED',
      reason: error.message,
      suggestion: 'Try describing the image content instead, or upload a clearer image.'
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
