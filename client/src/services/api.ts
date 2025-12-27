/**
 * API Service Layer for Bangalore Survival Assistant
 * 
 * Implements functions for all API endpoints with error handling and loading states.
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 2.5, 3.4, 4.5, 5.5
 */

import type { Persona } from '../App'

// Base API URL - uses relative path for same-origin requests
const API_BASE = '/api'

// Session ID management
let sessionId: string | null = null

export function getSessionId(): string | null {
  return sessionId
}

export function setSessionId(id: string): void {
  sessionId = id
}

// Error codes for specific error handling
export const ErrorCodes = {
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  RATE_LIMITED: 'RATE_LIMITED',
  AI_SERVICE_ERROR: 'AI_SERVICE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  INVALID_REQUEST: 'INVALID_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  NETWORK_ERROR: 'NETWORK_ERROR'
} as const

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes]

// User-friendly error messages for different error types
export const ErrorMessages: Record<ErrorCode, string> = {
  [ErrorCodes.SERVICE_UNAVAILABLE]: 'Service temporarily unavailable. Please try again later.',
  [ErrorCodes.RATE_LIMITED]: 'Too many requests. Please wait a moment.',
  [ErrorCodes.AI_SERVICE_ERROR]: 'AI service temporarily unavailable. Using local knowledge.',
  [ErrorCodes.EXTERNAL_SERVICE_ERROR]: 'External service error. Please try again.',
  [ErrorCodes.INVALID_REQUEST]: 'Invalid request. Please check your input.',
  [ErrorCodes.UNAUTHORIZED]: 'Session expired. Please refresh the page.',
  [ErrorCodes.NETWORK_ERROR]: 'Connection issue. Please check your internet.'
}

// Fallback suggestions for different error types
export const ErrorSuggestions: Record<string, string> = {
  voice: "Couldn't process voice. Please try typing your question.",
  image: "Couldn't read the image. Try describing what you see.",
  location: 'Location service unavailable. Showing general recommendations.',
  ai: 'AI service temporarily unavailable. Using local knowledge.'
}

// Error types for better error handling
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: ErrorCode,
    public suggestion?: string,
    public details?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
  }

  // Helper to get user-friendly message
  getUserMessage(): string {
    if (this.code && ErrorMessages[this.code]) {
      return ErrorMessages[this.code]
    }
    return this.message
  }

  // Check if this is a rate limit error
  isRateLimited(): boolean {
    return this.code === ErrorCodes.RATE_LIMITED || this.status === 429
  }

  // Check if this is a service unavailable error
  isServiceUnavailable(): boolean {
    return this.code === ErrorCodes.SERVICE_UNAVAILABLE || this.status === 503
  }

  // Check if this is an AI service error
  isAIServiceError(): boolean {
    return this.code === ErrorCodes.AI_SERVICE_ERROR || this.status === 502
  }
}

// Place result from Google Maps API
export interface PlaceResult {
  name: string
  address: string
  rating: number
  distance: number
  priceLevel: number
  types: string[]
  placeId: string
}

// Enhanced recommendation with contextual information
export interface EnhancedRecommendation {
  place: PlaceResult
  contextualReasoning: string
  culturalNote?: string
}

// Food recommendation from backend (may or may not have place data)
export interface FoodRecommendation {
  suggestion: string
  reasoning: string
  contextFactors: string[]
  place?: PlaceResult
  culturalNote?: string
  aiPowered?: boolean
}

// Response types
export interface QueryResponse {
  response: string
  contextUsed: string[]
  contextFilesUsed: string[]
  persona: Persona
  bangaloreContextActive: boolean
  aiPowered: boolean
  locationRecommendations?: FoodRecommendation[]
}

export interface ContextFile {
  id: string
  name: string
  domain: string
  isLoaded: boolean
  lastModified?: Date
}

export interface ToggleContextResponse {
  id: string
  isLoaded: boolean
}

export interface PersonaResponse {
  sessionId: string
  persona: Persona
  message: string
}

export interface ImageInterpretation {
  localMeaning: string
  culturalSignificance: string
  practicalImplications: string
}

export interface ImageResponse {
  extractedText: string
  translatedText?: string
  detectedLanguage?: string
  interpretation: ImageInterpretation
}


export interface VoiceResponse {
  text: string
  confidence?: number
  language?: string
}

export interface SessionResponse {
  sessionId: string
  persona: Persona
  loadedContexts: string[]
  availableContexts: ContextFile[]
  bangaloreContextEnabled: boolean
}

export interface BangaloreContextResponse {
  sessionId: string
  bangaloreContextEnabled: boolean
  message: string
}

export interface SessionUpdateResponse {
  sessionId: string
  persona: Persona
  loadedContexts: string[]
  bangaloreContextEnabled: boolean
  message: string
}

// Helper function to build headers with session ID
function getHeaders(contentType?: string): HeadersInit {
  const headers: HeadersInit = {}
  if (contentType) {
    headers['Content-Type'] = contentType
  }
  if (sessionId) {
    headers['x-session-id'] = sessionId
  }
  return headers
}

// Helper function to handle API responses
async function handleResponse<T>(response: Response): Promise<T> {
  // Handle network errors
  if (!response.ok) {
    let data: { error?: string; code?: ErrorCode; suggestion?: string; details?: unknown; reason?: string }
    try {
      data = await response.json()
    } catch {
      // If we can't parse JSON, create a generic error
      throw new ApiError(
        'An unexpected error occurred',
        response.status,
        response.status === 429 ? ErrorCodes.RATE_LIMITED : 
        response.status === 503 ? ErrorCodes.SERVICE_UNAVAILABLE :
        response.status === 502 ? ErrorCodes.EXTERNAL_SERVICE_ERROR :
        undefined
      )
    }
    
    throw new ApiError(
      data.error || 'An error occurred',
      response.status,
      data.code as ErrorCode,
      data.suggestion,
      data.details || data.reason
    )
  }
  
  const data = await response.json()
  return data as T
}

/**
 * POST /api/query - Submit user query and receive context-aware response
 * Requirements: 10.1, 2.5
 * 
 * Handles AI-powered responses with fallback to context-file responses
 * when OpenAI is unavailable.
 */
export async function submitQuery(
  query: string,
  persona: Persona,
  bangaloreContextEnabled: boolean,
  loadedContexts: string[],
  location?: { lat: number; lng: number }
): Promise<QueryResponse> {
  try {
    const response = await fetch(`${API_BASE}/query`, {
      method: 'POST',
      headers: getHeaders('application/json'),
      body: JSON.stringify({
        query,
        persona,
        bangaloreContextEnabled,
        loadedContexts,
        location
      })
    })
    
    return handleResponse<QueryResponse>(response)
  } catch (error) {
    // Re-throw ApiErrors as-is
    if (error instanceof ApiError) {
      throw error
    }
    // Handle network errors
    throw new ApiError(
      ErrorMessages[ErrorCodes.NETWORK_ERROR],
      0,
      ErrorCodes.NETWORK_ERROR
    )
  }
}


/**
 * GET /api/contexts - Retrieve available context files
 * Requirements: 10.2
 */
export async function getContexts(): Promise<ContextFile[]> {
  const response = await fetch(`${API_BASE}/contexts`, {
    method: 'GET',
    headers: getHeaders()
  })
  
  return handleResponse<ContextFile[]>(response)
}

/**
 * POST /api/contexts/:id/toggle - Toggle context file loading
 * Requirements: 10.3
 */
export async function toggleContext(contextId: string): Promise<ToggleContextResponse> {
  const response = await fetch(`${API_BASE}/contexts/${contextId}/toggle`, {
    method: 'POST',
    headers: getHeaders('application/json')
  })
  
  return handleResponse<ToggleContextResponse>(response)
}

/**
 * POST /api/persona - Set the active persona
 * Requirements: 10.4
 */
export async function setPersona(persona: Persona): Promise<PersonaResponse> {
  const response = await fetch(`${API_BASE}/persona`, {
    method: 'POST',
    headers: getHeaders('application/json'),
    body: JSON.stringify({ persona })
  })
  
  return handleResponse<PersonaResponse>(response)
}

/**
 * POST /api/image - Process image upload
 * Requirements: 10.5, 4.5
 * 
 * Handles image OCR with translation and cultural interpretation.
 * Returns extracted text, optional translation, and AI interpretation.
 */
export async function processImage(file: File): Promise<ImageResponse> {
  try {
    const formData = new FormData()
    formData.append('image', file)
    
    const response = await fetch(`${API_BASE}/image`, {
      method: 'POST',
      headers: getHeaders(), // No Content-Type for FormData
      body: formData
    })
    
    return handleResponse<ImageResponse>(response)
  } catch (error) {
    // Re-throw ApiErrors with image-specific suggestion
    if (error instanceof ApiError) {
      if (!error.suggestion) {
        error.suggestion = ErrorSuggestions.image
      }
      throw error
    }
    // Handle network errors
    throw new ApiError(
      ErrorMessages[ErrorCodes.NETWORK_ERROR],
      0,
      ErrorCodes.NETWORK_ERROR,
      ErrorSuggestions.image
    )
  }
}

/**
 * POST /api/voice - Process voice input and return transcribed text
 * Requirements: 4.1, 3.4
 * 
 * Handles voice transcription with support for English and Kannada.
 * Returns transcribed text with confidence and detected language.
 */
export async function processVoice(audioBlob: Blob, filename = 'recording.webm'): Promise<VoiceResponse> {
  try {
    const formData = new FormData()
    formData.append('audio', audioBlob, filename)
    
    const response = await fetch(`${API_BASE}/voice`, {
      method: 'POST',
      headers: getHeaders(), // No Content-Type for FormData
      body: formData
    })
    
    return handleResponse<VoiceResponse>(response)
  } catch (error) {
    // Re-throw ApiErrors with voice-specific suggestion
    if (error instanceof ApiError) {
      if (!error.suggestion) {
        error.suggestion = ErrorSuggestions.voice
      }
      throw error
    }
    // Handle network errors
    throw new ApiError(
      ErrorMessages[ErrorCodes.NETWORK_ERROR],
      0,
      ErrorCodes.NETWORK_ERROR,
      ErrorSuggestions.voice
    )
  }
}


/**
 * GET /api/session - Get current session state
 * Requirements: 7.4, 8.1
 */
export async function getSession(): Promise<SessionResponse> {
  const response = await fetch(`${API_BASE}/session`, {
    method: 'GET',
    headers: getHeaders()
  })
  
  const data = await handleResponse<SessionResponse>(response)
  
  // Store session ID for future requests
  if (data.sessionId) {
    setSessionId(data.sessionId)
  }
  
  return data
}

/**
 * POST /api/session/bangalore-context - Toggle Bangalore context enabled state
 */
export async function setBangaloreContext(enabled: boolean): Promise<BangaloreContextResponse> {
  const response = await fetch(`${API_BASE}/session/bangalore-context`, {
    method: 'POST',
    headers: getHeaders('application/json'),
    body: JSON.stringify({ enabled })
  })
  
  return handleResponse<BangaloreContextResponse>(response)
}

/**
 * PUT /api/session - Update session settings
 */
export async function updateSession(settings: {
  persona?: Persona
  loadedContexts?: string[]
  bangaloreContextEnabled?: boolean
}): Promise<SessionUpdateResponse> {
  const response = await fetch(`${API_BASE}/session`, {
    method: 'PUT',
    headers: getHeaders('application/json'),
    body: JSON.stringify(settings)
  })
  
  return handleResponse<SessionUpdateResponse>(response)
}

// Export all API functions as a namespace for convenience
export const api = {
  submitQuery,
  getContexts,
  toggleContext,
  setPersona,
  processImage,
  processVoice,
  getSession,
  setBangaloreContext,
  updateSession,
  getSessionId,
  setSessionId,
  // Error utilities
  ErrorCodes,
  ErrorMessages,
  ErrorSuggestions
}

export default api
