/**
 * Request Validation Middleware
 * Validates incoming requests for required fields, types, and constraints
 * Requirements: 7.5 - THE Assistant_App SHALL implement request validation to prevent abuse
 */

import { Request, Response, NextFunction } from 'express';
import { getRateLimiterManager, RateLimitResult } from '../services/RateLimiter.js';

// Validation error response interface
export interface ValidationError {
  error: string;
  code: string;
  field?: string;
  suggestion?: string;
}

// Valid personas
const VALID_PERSONAS = ['newbie', 'student', 'it-professional', 'tourist'] as const;
type Persona = typeof VALID_PERSONAS[number];

// File size limits
const FILE_SIZE_LIMITS = {
  image: 10 * 1024 * 1024,  // 10MB
  audio: 25 * 1024 * 1024,  // 25MB
};

// Allowed MIME types
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
const ALLOWED_AUDIO_TYPES = [
  'audio/wav', 'audio/wave', 'audio/x-wav',
  'audio/mp3', 'audio/mpeg',
  'audio/webm', 'audio/ogg',
  'audio/flac', 'audio/m4a', 'audio/mp4'
];

/**
 * Create a validation error response
 */
function createValidationError(
  error: string,
  code: string,
  field?: string,
  suggestion?: string
): ValidationError {
  return { error, code, field, suggestion };
}

/**
 * Validate query request body
 */
export function validateQueryRequest(req: Request, res: Response, next: NextFunction): void {
  const { query, persona, bangaloreContextEnabled, loadedContexts, location } = req.body;

  // Query is required and must be a non-empty string
  if (query === undefined || query === null) {
    res.status(400).json(createValidationError(
      'Query is required',
      'MISSING_FIELD',
      'query',
      'Provide a query string in the request body'
    ));
    return;
  }

  if (typeof query !== 'string') {
    res.status(400).json(createValidationError(
      'Query must be a string',
      'INVALID_TYPE',
      'query'
    ));
    return;
  }

  if (query.trim().length === 0) {
    res.status(400).json(createValidationError(
      'Query cannot be empty',
      'EMPTY_FIELD',
      'query',
      'Provide a non-empty query string'
    ));
    return;
  }

  // Query length limit (prevent abuse)
  if (query.length > 5000) {
    res.status(400).json(createValidationError(
      'Query exceeds maximum length of 5000 characters',
      'FIELD_TOO_LONG',
      'query',
      'Shorten your query to under 5000 characters'
    ));
    return;
  }

  // Validate persona if provided
  if (persona !== undefined && !VALID_PERSONAS.includes(persona)) {
    res.status(400).json(createValidationError(
      `Invalid persona. Must be one of: ${VALID_PERSONAS.join(', ')}`,
      'INVALID_VALUE',
      'persona'
    ));
    return;
  }

  // Validate bangaloreContextEnabled if provided
  if (bangaloreContextEnabled !== undefined && typeof bangaloreContextEnabled !== 'boolean') {
    res.status(400).json(createValidationError(
      'bangaloreContextEnabled must be a boolean',
      'INVALID_TYPE',
      'bangaloreContextEnabled'
    ));
    return;
  }

  // Validate loadedContexts if provided
  if (loadedContexts !== undefined) {
    if (!Array.isArray(loadedContexts)) {
      res.status(400).json(createValidationError(
        'loadedContexts must be an array',
        'INVALID_TYPE',
        'loadedContexts'
      ));
      return;
    }
    
    if (!loadedContexts.every(ctx => typeof ctx === 'string')) {
      res.status(400).json(createValidationError(
        'loadedContexts must be an array of strings',
        'INVALID_TYPE',
        'loadedContexts'
      ));
      return;
    }
  }

  // Validate location if provided
  if (location !== undefined) {
    if (typeof location !== 'object' || location === null) {
      res.status(400).json(createValidationError(
        'Location must be an object with lat and lng properties',
        'INVALID_TYPE',
        'location'
      ));
      return;
    }

    if (typeof location.lat !== 'number' || typeof location.lng !== 'number') {
      res.status(400).json(createValidationError(
        'Location must have numeric lat and lng properties',
        'INVALID_TYPE',
        'location',
        'Expected format: { lat: number, lng: number }'
      ));
      return;
    }

    // Validate coordinate ranges
    if (location.lat < -90 || location.lat > 90) {
      res.status(400).json(createValidationError(
        'Latitude must be between -90 and 90',
        'INVALID_VALUE',
        'location.lat'
      ));
      return;
    }

    if (location.lng < -180 || location.lng > 180) {
      res.status(400).json(createValidationError(
        'Longitude must be between -180 and 180',
        'INVALID_VALUE',
        'location.lng'
      ));
      return;
    }
  }

  next();
}


/**
 * Validate persona request body
 */
export function validatePersonaRequest(req: Request, res: Response, next: NextFunction): void {
  const { persona } = req.body;

  if (persona === undefined) {
    res.status(400).json(createValidationError(
      'Persona is required',
      'MISSING_FIELD',
      'persona',
      `Provide one of: ${VALID_PERSONAS.join(', ')}`
    ));
    return;
  }

  if (!VALID_PERSONAS.includes(persona)) {
    res.status(400).json(createValidationError(
      `Invalid persona. Must be one of: ${VALID_PERSONAS.join(', ')}`,
      'INVALID_VALUE',
      'persona'
    ));
    return;
  }

  next();
}

/**
 * Validate session update request body
 */
export function validateSessionUpdateRequest(req: Request, res: Response, next: NextFunction): void {
  const { persona, loadedContexts, bangaloreContextEnabled } = req.body;

  // At least one field should be provided
  if (persona === undefined && loadedContexts === undefined && bangaloreContextEnabled === undefined) {
    res.status(400).json(createValidationError(
      'At least one field (persona, loadedContexts, or bangaloreContextEnabled) is required',
      'MISSING_FIELD',
      undefined,
      'Provide at least one field to update'
    ));
    return;
  }

  // Validate persona if provided
  if (persona !== undefined && !VALID_PERSONAS.includes(persona)) {
    res.status(400).json(createValidationError(
      `Invalid persona. Must be one of: ${VALID_PERSONAS.join(', ')}`,
      'INVALID_VALUE',
      'persona'
    ));
    return;
  }

  // Validate loadedContexts if provided
  if (loadedContexts !== undefined) {
    if (!Array.isArray(loadedContexts)) {
      res.status(400).json(createValidationError(
        'loadedContexts must be an array',
        'INVALID_TYPE',
        'loadedContexts'
      ));
      return;
    }
    
    if (!loadedContexts.every(ctx => typeof ctx === 'string')) {
      res.status(400).json(createValidationError(
        'loadedContexts must be an array of strings',
        'INVALID_TYPE',
        'loadedContexts'
      ));
      return;
    }
  }

  // Validate bangaloreContextEnabled if provided
  if (bangaloreContextEnabled !== undefined && typeof bangaloreContextEnabled !== 'boolean') {
    res.status(400).json(createValidationError(
      'bangaloreContextEnabled must be a boolean',
      'INVALID_TYPE',
      'bangaloreContextEnabled'
    ));
    return;
  }

  next();
}

/**
 * Validate bangalore context toggle request
 */
export function validateBangaloreContextRequest(req: Request, res: Response, next: NextFunction): void {
  const { enabled } = req.body;

  if (enabled === undefined) {
    res.status(400).json(createValidationError(
      'enabled field is required',
      'MISSING_FIELD',
      'enabled',
      'Provide a boolean value for enabled'
    ));
    return;
  }

  if (typeof enabled !== 'boolean') {
    res.status(400).json(createValidationError(
      'enabled must be a boolean',
      'INVALID_TYPE',
      'enabled'
    ));
    return;
  }

  next();
}

/**
 * Validate file upload - checks Content-Length header before upload
 */
export function validateFileUpload(type: 'image' | 'audio') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    const maxSize = FILE_SIZE_LIMITS[type];

    if (contentLength > maxSize) {
      const maxSizeMB = maxSize / (1024 * 1024);
      res.status(400).json(createValidationError(
        `File too large. Maximum size is ${maxSizeMB}MB`,
        'FILE_TOO_LARGE',
        'file',
        `Upload a file smaller than ${maxSizeMB}MB`
      ));
      return;
    }

    next();
  };
}

/**
 * Require session ID header
 */
export function requireSessionId(req: Request, res: Response, next: NextFunction): void {
  const sessionId = req.headers['x-session-id'];

  if (!sessionId || typeof sessionId !== 'string' || sessionId.trim().length === 0) {
    res.status(400).json(createValidationError(
      'Session ID is required',
      'MISSING_HEADER',
      'x-session-id',
      'Include x-session-id header with your request'
    ));
    return;
  }

  next();
}

/**
 * Rate limiting middleware factory
 * Creates middleware that applies rate limiting based on endpoint
 */
export function rateLimitMiddleware(endpoint: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const manager = getRateLimiterManager();
    
    // Use IP address as identifier (or session ID if available)
    const identifier = (req.headers['x-session-id'] as string) || 
                       req.ip || 
                       req.socket.remoteAddress || 
                       'unknown';

    const result: RateLimitResult = manager.checkLimit(endpoint, identifier);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', manager.getRemainingRequests(endpoint, identifier) + (result.allowed ? 1 : 0));
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000));

    if (!result.allowed) {
      res.setHeader('Retry-After', result.retryAfter || 60);
      res.status(429).json(createValidationError(
        'Too many requests. Please wait before trying again.',
        'RATE_LIMITED',
        undefined,
        `Try again in ${result.retryAfter} seconds`
      ));
      return;
    }

    next();
  };
}

/**
 * Generic request body validation - ensures body is valid JSON object
 */
export function validateRequestBody(req: Request, res: Response, next: NextFunction): void {
  // Check if body exists and is an object (not array)
  if (req.body === undefined || req.body === null) {
    res.status(400).json(createValidationError(
      'Request body is required',
      'MISSING_BODY',
      undefined,
      'Send a valid JSON object in the request body'
    ));
    return;
  }

  if (typeof req.body !== 'object' || Array.isArray(req.body)) {
    res.status(400).json(createValidationError(
      'Request body must be a JSON object',
      'INVALID_BODY',
      undefined,
      'Send a valid JSON object in the request body'
    ));
    return;
  }

  next();
}

// Export constants for use in other modules
export { VALID_PERSONAS, FILE_SIZE_LIMITS, ALLOWED_IMAGE_TYPES, ALLOWED_AUDIO_TYPES };
