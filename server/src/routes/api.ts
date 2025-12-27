// Ensure environment variables are loaded
import '../config/dotenv.js'

import { Router } from 'express'
import multer from 'multer'
import { ContextManager } from '../services/ContextManager.js'
import { ResponseGenerator } from '../services/ResponseGenerator.js'
import { ImageProcessor, getImageProcessor } from '../services/ImageProcessor.js'
import { VoiceProcessor } from '../services/VoiceProcessor.js'
import { SessionService } from '../services/SessionService.js'
import { getOpenAIService } from '../services/OpenAIService.js'
import { getGoogleVisionService } from '../services/GoogleVisionService.js'
import { 
  validateQueryRequest,
  validatePersonaRequest,
  validateSessionUpdateRequest,
  validateBangaloreContextRequest,
  validateFileUpload,
  requireSessionId,
  rateLimitMiddleware,
  validateRequestBody
} from '../middleware/validation.js'

const router = Router()
const contextManager = new ContextManager()
const responseGenerator = new ResponseGenerator(contextManager)
const imageProcessor = getImageProcessor()
const voiceProcessor = new VoiceProcessor()
const sessionService = new SessionService()

// Configure multer for image uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp']
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, WebP, and BMP images are allowed.'))
    }
  }
})

// Configure multer for audio uploads (memory storage)
const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB limit for audio files
  },
  fileFilter: (req, file, cb) => {
    // Accept audio files
    const allowedMimeTypes = [
      'audio/wav',
      'audio/wave', 
      'audio/x-wav',
      'audio/mp3',
      'audio/mpeg',
      'audio/webm',
      'audio/ogg',
      'audio/flac',
      'audio/m4a',
      'audio/mp4'
    ]
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type. Supported audio formats: WAV, MP3, WebM, OGG, FLAC, M4A.'))
    }
  }
})

// POST /api/query - Submit user query
// Requirements: 2.1, 2.2, 8.1 - OpenAI integration with context and fallback
router.post('/query', rateLimitMiddleware('query'), validateRequestBody, validateQueryRequest, async (req, res) => {
  try {
    const { query, persona, bangaloreContextEnabled, loadedContexts, location } = req.body

    const response = await responseGenerator.generateResponse({
      query,
      persona: persona || 'newbie',
      bangaloreContextEnabled: bangaloreContextEnabled ?? true,
      loadedContexts: loadedContexts || [],
      location
    })

    res.json(response)
  } catch (error) {
    console.error('Query error:', error)
    
    // Return user-friendly error with fallback suggestion
    res.status(500).json({ 
      error: 'Failed to process query',
      code: 'QUERY_FAILED',
      suggestion: 'Please try again. If the problem persists, the AI service may be temporarily unavailable.'
    })
  }
})

// GET /api/contexts - Get available context files
// Requirements: 2.6 - Rate limiting applied
router.get('/contexts', rateLimitMiddleware('contexts'), async (req, res) => {
  try {
    const contexts = await contextManager.getAvailableContexts()
    res.json(contexts)
  } catch (error) {
    console.error('Get contexts error:', error)
    res.status(500).json({ 
      error: 'Failed to get contexts',
      code: 'CONTEXTS_FETCH_FAILED'
    })
  }
})

// POST /api/contexts/:id/toggle - Toggle context file
// Requirements: 11.2 - THE Assistant_App SHALL persist user session preferences (persona, context settings)
// Requirements: 2.6 - Rate limiting applied
router.post('/contexts/:id/toggle', rateLimitMiddleware('contexts'), async (req, res) => {
  try {
    const { id } = req.params
    const sessionId = req.headers['x-session-id'] as string | undefined
    
    // Toggle context in context manager
    const result = await contextManager.toggleContext(id)
    
    // If session ID provided, persist the change
    if (sessionId) {
      await sessionService.toggleContext(sessionId, id)
    }
    
    res.json(result)
  } catch (error) {
    console.error('Toggle context error:', error)
    res.status(500).json({ 
      error: 'Failed to toggle context',
      code: 'CONTEXT_TOGGLE_FAILED'
    })
  }
})

// POST /api/persona - Set active persona
// Requirements: 11.2 - THE Assistant_App SHALL persist user session preferences (persona, context settings)
// Requirements: 2.6 - Rate limiting applied
router.post('/persona', rateLimitMiddleware('session'), validateRequestBody, validatePersonaRequest, requireSessionId, async (req, res) => {
  try {
    const { persona } = req.body
    const sessionId = req.headers['x-session-id'] as string

    // Persist persona to MongoDB
    const session = await sessionService.updatePersona(sessionId, persona)

    res.json({ 
      sessionId: session.sessionId,
      persona: session.persona, 
      message: 'Persona updated successfully' 
    })
  } catch (error) {
    console.error('Set persona error:', error)
    res.status(500).json({ 
      error: 'Failed to set persona',
      code: 'PERSONA_UPDATE_FAILED'
    })
  }
})

// POST /api/session/bangalore-context - Toggle Bangalore context enabled state
// Requirements: 11.2 - THE Assistant_App SHALL persist user session preferences (persona, context settings)
// Requirements: 2.6 - Rate limiting applied
router.post('/session/bangalore-context', rateLimitMiddleware('session'), validateRequestBody, validateBangaloreContextRequest, requireSessionId, async (req, res) => {
  try {
    const { enabled } = req.body
    const sessionId = req.headers['x-session-id'] as string

    // Persist Bangalore context state to MongoDB
    const session = await sessionService.updateBangaloreContextEnabled(sessionId, enabled)

    res.json({
      sessionId: session.sessionId,
      bangaloreContextEnabled: session.bangaloreContextEnabled,
      message: 'Bangalore context state updated successfully'
    })
  } catch (error) {
    console.error('Toggle Bangalore context error:', error)
    res.status(500).json({ 
      error: 'Failed to toggle Bangalore context',
      code: 'CONTEXT_TOGGLE_FAILED'
    })
  }
})

// PUT /api/session - Update session settings
// Requirements: 11.2 - THE Assistant_App SHALL persist user session preferences (persona, context settings)
// Requirements: 2.6 - Rate limiting applied
router.put('/session', rateLimitMiddleware('session'), validateRequestBody, validateSessionUpdateRequest, requireSessionId, async (req, res) => {
  try {
    const { persona, loadedContexts, bangaloreContextEnabled } = req.body
    const sessionId = req.headers['x-session-id'] as string

    // Get or create session first
    let session = await sessionService.getOrCreateSession(sessionId)

    // Update persona if provided
    if (persona !== undefined) {
      session = await sessionService.updatePersona(sessionId, persona)
    }

    // Update loaded contexts if provided
    if (loadedContexts !== undefined) {
      session = await sessionService.updateLoadedContexts(sessionId, loadedContexts)
    }

    // Update Bangalore context enabled if provided
    if (bangaloreContextEnabled !== undefined) {
      session = await sessionService.updateBangaloreContextEnabled(sessionId, bangaloreContextEnabled)
    }

    res.json({
      sessionId: session.sessionId,
      persona: session.persona,
      loadedContexts: session.loadedContexts,
      bangaloreContextEnabled: session.bangaloreContextEnabled,
      message: 'Session updated successfully'
    })
  } catch (error) {
    console.error('Update session error:', error)
    res.status(500).json({ 
      error: 'Failed to update session',
      code: 'SESSION_UPDATE_FAILED'
    })
  }
})

// POST /api/image - Process image upload
// Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 8.3 - Image OCR with Google Vision and OpenAI interpretation
router.post('/image', rateLimitMiddleware('image'), validateFileUpload('image'), upload.single('image'), async (req, res) => {
  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ 
        error: 'No image file provided',
        code: 'MISSING_FILE',
        suggestion: 'Upload an image file with the field name "image"'
      })
    }

    // Get loaded contexts for interpretation
    const loadedContexts = contextManager.getLoadedContexts()

    // Process image using Google Vision for OCR and OpenAI for interpretation
    // This handles: text extraction, language detection, translation, and cultural interpretation
    const interpretation = await imageProcessor.processImage({
      imageBuffer: req.file.buffer,
      contexts: loadedContexts,
      useAI: true
    })

    // If no text was extracted, return appropriate response
    if (!interpretation.extractedText || interpretation.extractedText.trim() === '') {
      return res.json({
        extractedText: '',
        interpretation: {
          localMeaning: 'No text could be extracted from the image.',
          culturalSignificance: 'Unable to provide cultural interpretation without text.',
          associatedBehavior: 'Unable to provide behavior guidance without text.',
          practicalImplications: 'Try uploading a clearer image with visible text.'
        },
        aiPowered: false
      })
    }

    // Return full interpretation with translation if available
    res.json({
      extractedText: interpretation.extractedText,
      translatedText: interpretation.translatedText,
      detectedLanguage: interpretation.detectedLanguage,
      interpretation: {
        localMeaning: interpretation.localMeaning,
        culturalSignificance: interpretation.culturalSignificance,
        associatedBehavior: interpretation.associatedBehavior,
        practicalImplications: interpretation.practicalImplications
      },
      aiPowered: interpretation.aiPowered
    })
  } catch (error) {
    console.error('Image processing error:', error)
    
    // Handle multer errors
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ 
          error: 'File too large. Maximum size is 10MB.',
          code: 'FILE_TOO_LARGE'
        })
      }
      return res.status(400).json({ 
        error: `Upload error: ${error.message}`,
        code: 'UPLOAD_ERROR'
      })
    }
    
    // Handle file type validation errors
    if (error instanceof Error && error.message.includes('Invalid file type')) {
      return res.status(400).json({ 
        error: error.message,
        code: 'INVALID_FILE_TYPE'
      })
    }
    
    // Requirement 4.5, 8.3: Handle Google Vision API errors gracefully
    res.status(422).json({ 
      error: 'Could not process image',
      code: 'IMAGE_PROCESSING_FAILED',
      reason: error instanceof Error ? error.message : 'Unknown error',
      suggestion: 'Try describing the image content instead, or upload a clearer image.'
    })
  }
})

// GET /api/session - Get current session state
// Requirements: 7.4 - THE Assistant_App SHALL display current context status (ON/OFF) and selected persona
// Requirements: 8.1 - THE Assistant_App SHALL display a list of currently loaded context files
// Requirements: 11.2 - THE Assistant_App SHALL persist user session preferences (persona, context settings)
// Requirements: 2.6 - Rate limiting applied
router.get('/session', rateLimitMiddleware('session'), async (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'] as string | undefined
    
    // Get or create session from MongoDB
    const session = await sessionService.getOrCreateSession(sessionId)
    
    // Get available contexts
    const availableContexts = await contextManager.getAvailableContexts()
    
    res.json({
      sessionId: session.sessionId,
      persona: session.persona,
      loadedContexts: session.loadedContexts,
      availableContexts: availableContexts,
      bangaloreContextEnabled: session.bangaloreContextEnabled
    })
  } catch (error) {
    console.error('Get session error:', error)
    res.status(500).json({ 
      error: 'Failed to get session state',
      code: 'SESSION_FETCH_FAILED'
    })
  }
})

// POST /api/voice - Process voice input and return transcribed text
// Requirements: 3.1, 3.2, 3.3, 3.4, 8.2 - Voice transcription with Google Speech
router.post('/voice', rateLimitMiddleware('voice'), validateFileUpload('audio'), audioUpload.single('audio'), async (req, res) => {
  try {
    // Check if audio file was uploaded
    if (!req.file) {
      return res.status(400).json({ 
        error: 'No audio file provided',
        code: 'MISSING_FILE',
        suggestion: 'Upload an audio file with the field name "audio"'
      })
    }

    // Get optional language code from request body or query
    const languageCode = req.body?.languageCode || req.query?.languageCode

    // Transcribe the audio to text using Google Speech Service
    const result = await voiceProcessor.transcribe(
      req.file.buffer, 
      req.file.mimetype,
      languageCode
    )

    // If transcription failed (empty text and not AI powered), suggest typing
    // Requirement 8.2: Fall back to error message when service unavailable
    if (!result.text && !result.aiPowered) {
      return res.json({
        text: '',
        confidence: 0,
        language: result.language,
        aiPowered: false,
        suggestion: 'Voice transcription service is not available. Please type your question instead.'
      })
    }

    res.json({
      text: result.text,
      confidence: result.confidence,
      language: result.language,
      aiPowered: result.aiPowered
    })
  } catch (error) {
    console.error('Voice processing error:', error)
    
    // Handle multer errors
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ 
          error: 'File too large. Maximum size is 25MB.',
          code: 'FILE_TOO_LARGE'
        })
      }
      return res.status(400).json({ 
        error: `Upload error: ${error.message}`,
        code: 'UPLOAD_ERROR'
      })
    }
    
    // Handle file type validation errors
    if (error instanceof Error && error.message.includes('Invalid file type')) {
      return res.status(400).json({ 
        error: error.message,
        code: 'INVALID_FILE_TYPE'
      })
    }

    // Handle unsupported format errors
    if (error instanceof Error && error.message.includes('Unsupported audio format')) {
      return res.status(400).json({ 
        error: error.message,
        code: 'UNSUPPORTED_FORMAT'
      })
    }
    
    // Requirement 3.4: Handle Google Speech API errors gracefully
    res.status(422).json({ 
      error: 'Could not transcribe audio',
      code: 'TRANSCRIPTION_FAILED',
      reason: error instanceof Error ? error.message : 'Unknown error',
      suggestion: 'Please try typing your question instead.'
    })
  }
})

export default router
