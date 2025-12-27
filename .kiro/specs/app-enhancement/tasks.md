# Implementation Plan: App Enhancement - Glassmorphism UI & API Integrations

## Overview

This implementation plan enhances the Bangalore Survival Assistant with glassmorphism UI, external API integrations (OpenAI, Google Cloud), and secure Vercel deployment. Tasks are ordered to build infrastructure first, then services, then UI, ensuring no orphaned code.

## Tasks

- [x] 1. Environment and Security Setup
  - [x] 1.1 Update environment configuration files
    - Update server/.env.example with all required API keys
    - Update .gitignore to ensure .env files are excluded
    - Create server/src/config/environment.ts for typed env access
    - _Requirements: 6.1, 6.3_

  - [x] 1.2 Implement API Key Manager service
    - Create server/src/services/APIKeyManager.ts
    - Implement key validation on startup
    - Implement feature availability checks
    - Log warnings for missing keys
    - _Requirements: 6.5, 6.6_

  - [ ]* 1.3 Write property test for API key security
    - **Property 2: API Key Security**
    - **Validates: Requirements 2.7, 3.5, 4.6, 5.6, 6.2, 6.4**

- [x] 2. Rate Limiting and Request Validation
  - [x] 2.1 Implement Rate Limiter service
    - Create server/src/services/RateLimiter.ts
    - Implement sliding window rate limiting
    - Configure limits per endpoint
    - _Requirements: 2.6_

  - [x] 2.2 Implement request validation middleware
    - Create server/src/middleware/validation.ts
    - Validate query requests (required fields, types)
    - Validate file uploads (size, type limits)
    - Return descriptive error messages
    - _Requirements: 7.5_

  - [ ]* 2.3 Write property test for rate limiting
    - **Property 5: Rate Limiting Enforcement**
    - **Validates: Requirements 2.6**

  - [ ]* 2.4 Write property test for request validation
    - **Property 6: Request Validation**
    - **Validates: Requirements 7.5**

- [ ] 3. Checkpoint - Security Infrastructure
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. OpenAI Service Integration
  - [x] 4.1 Install OpenAI SDK and dependencies
    - Add openai package to server dependencies
    - Configure TypeScript types
    - _Requirements: 2.4_

  - [x] 4.2 Implement OpenAI Service
    - Create server/src/services/OpenAIService.ts
    - Implement generateResponse() with system prompt construction
    - Implement persona-based prompt customization
    - Implement context-aware prompt building
    - Use GPT-4o-mini model
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 4.3 Implement OpenAI error handling and fallback
    - Handle API errors gracefully
    - Fall back to context-file responses when unavailable
    - _Requirements: 2.5, 8.1_

  - [ ]* 4.4 Write property test for context-aware response generation
    - **Property 3: Context-Aware Response Generation**
    - **Validates: Requirements 2.1, 2.2, 2.3**

- [x] 5. Google Speech Service Integration
  - [x] 5.1 Install Google Cloud Speech SDK
    - Add @google-cloud/speech package
    - Configure authentication
    - _Requirements: 3.1_

  - [x] 5.2 Implement Google Speech Service
    - Create server/src/services/GoogleSpeechService.ts
    - Implement transcribe() method
    - Support English (en-IN) and Kannada (kn-IN)
    - _Requirements: 3.1, 3.2_

  - [x] 5.3 Update VoiceProcessor to use Google Speech
    - Modify server/src/services/VoiceProcessor.ts
    - Integrate GoogleSpeechService
    - Implement error handling and fallback
    - _Requirements: 3.3, 3.4, 8.2_

- [x] 6. Google Vision Service Integration
  - [x] 6.1 Install Google Cloud Vision SDK
    - Add @google-cloud/vision package
    - Add @google-cloud/translate package for translation
    - _Requirements: 4.1_

  - [x] 6.2 Implement Google Vision Service
    - Create server/src/services/GoogleVisionService.ts
    - Implement text extraction (OCR)
    - Implement language detection
    - Implement translation to English for non-English text
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 6.3 Update ImageProcessor to use Google Vision and OpenAI
    - Modify server/src/services/ImageProcessor.ts
    - Use GoogleVisionService for OCR
    - Use OpenAIService for cultural interpretation
    - Implement error handling and fallback
    - _Requirements: 4.4, 4.5, 8.3_

- [ ] 7. Checkpoint - AI Services
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Google Maps Service Integration
  - [x] 8.1 Install Google Maps SDK
    - Add @googlemaps/google-maps-services-js package
    - _Requirements: 5.1_

  - [x] 8.2 Implement Google Maps Service
    - Create server/src/services/GoogleMapsService.ts
    - Implement searchNearbyPlaces() using Places API
    - Implement food type filtering
    - Combine results with food.md context
    - _Requirements: 5.1, 5.2, 5.4_

  - [x] 8.3 Update LocationService to use Google Maps
    - Modify server/src/services/LocationService.ts
    - Integrate GoogleMapsService
    - Enhance recommendations with real place data
    - Implement fallback to context-only recommendations
    - _Requirements: 5.3, 5.5, 8.4_

  - [ ]* 8.4 Write property test for location recommendation completeness
    - **Property 7: Location Recommendation Completeness**
    - **Validates: Requirements 5.2, 5.3**

- [x] 9. Update API Routes
  - [x] 9.1 Update query endpoint to use OpenAI
    - Modify POST /api/query to use OpenAIService
    - Pass context and persona to AI
    - Handle fallback to context-only responses
    - _Requirements: 2.1, 2.2, 8.1_

  - [x] 9.2 Update voice endpoint
    - Modify POST /api/voice to use GoogleSpeechService
    - Return transcribed text for chat processing
    - _Requirements: 3.3_

  - [x] 9.3 Update image endpoint
    - Modify POST /api/image to use GoogleVisionService and OpenAI
    - Return extracted text, translation, and interpretation
    - _Requirements: 4.4_

  - [x] 9.4 Add rate limiting middleware to routes
    - Apply rate limiter to all API endpoints
    - Configure appropriate limits per endpoint
    - _Requirements: 2.6_

  - [ ]* 9.5 Write property test for error handling
    - **Property 4: External API Error Handling**
    - **Validates: Requirements 2.5, 3.4, 4.5, 5.5, 8.1, 8.2, 8.3, 8.4, 8.5**

- [ ] 10. Checkpoint - Backend Complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Glassmorphism UI - Base Setup
  - [x] 11.1 Add background image asset
    - Save bangalore-map.jpg to client/public/assets/
    - Optimize image for web (compress, appropriate resolution)
    - _Requirements: 1.1_

  - [x] 11.2 Create glassmorphism CSS variables and utilities
    - Create client/src/styles/glassmorphism.css
    - Define CSS variables for glass effects
    - Create utility classes for different glass levels
    - _Requirements: 1.2, 1.5_

  - [x] 11.3 Update App.tsx with background and overlay
    - Add fixed background image layer
    - Add glass overlay for readability
    - Update App.css with new structure
    - _Requirements: 1.1, 1.6_

- [x] 12. Glassmorphism UI - Components
  - [x] 12.1 Update ChatInterface with glassmorphism
    - Apply glass-card styling to chat container
    - Style user messages with accent glass effect
    - Style assistant messages with light glass effect
    - Ensure text contrast and readability
    - _Requirements: 1.3, 1.6_

  - [x] 12.2 Update ContextControls with glassmorphism
    - Apply consistent glass styling
    - Update toggle buttons with glass effect
    - Update context chips styling
    - _Requirements: 1.4_

  - [x] 12.3 Update PersonaSelector with glassmorphism
    - Apply glass-card styling
    - Update persona buttons with glass effect
    - _Requirements: 1.4_

  - [x] 12.4 Update MediaInput with glassmorphism
    - Apply glass styling to container
    - Update voice and image buttons
    - Style drop zone with glass effect
    - _Requirements: 1.4_

  - [x] 12.5 Ensure responsive glassmorphism
    - Test and adjust glass effects at all breakpoints
    - Ensure backdrop-filter works on mobile browsers
    - Add fallbacks for browsers without backdrop-filter support
    - _Requirements: 1.7_

  - [ ]* 12.6 Write property test for glassmorphism consistency
    - **Property 1: Glassmorphism Styling Consistency**
    - **Validates: Requirements 1.2, 1.4, 1.7**

- [x] 13. Frontend Integration Updates
  - [x] 13.1 Update API service layer for new responses
    - Update client/src/services/api.ts
    - Handle new response formats (aiPowered flag, enhanced recommendations)
    - Handle error responses with fallback messages
    - _Requirements: 2.5, 3.4, 4.5, 5.5_

  - [x] 13.2 Update ChatInterface for AI responses
    - Display AI-powered indicator when applicable
    - Show enhanced location recommendations with ratings
    - Handle loading states for AI processing
    - _Requirements: 5.3_

  - [x] 13.3 Update MediaInput for improved feedback
    - Show transcription result before sending as query
    - Display image interpretation with translation
    - Show appropriate error messages for API failures
    - _Requirements: 3.3, 4.4, 8.2, 8.3_

- [ ] 14. Checkpoint - Frontend Complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Vercel Deployment Configuration
  - [x] 15.1 Update vercel.json for API routes
    - Ensure serverless functions are configured correctly
    - Add environment variable references
    - _Requirements: 7.1, 7.2_

  - [x] 15.2 Configure CORS for production
    - Update server CORS configuration
    - Use ALLOWED_ORIGINS environment variable
    - _Requirements: 7.4_

  - [x] 15.3 Create deployment documentation
    - Document required Vercel environment variables
    - Document API key setup process
    - Add deployment checklist to README
    - _Requirements: 7.3_

- [x] 16. Final Integration Testing
  - [x] 16.1 Test full query flow with OpenAI
    - Test context ON/OFF produces different AI responses
    - Test persona affects response tone
    - Test fallback when OpenAI unavailable
    - _Requirements: 2.1, 2.2, 2.3, 8.1_

  - [x] 16.2 Test voice and image flows
    - Test voice transcription with English and Kannada
    - Test image OCR with translation
    - Test fallbacks when services unavailable
    - _Requirements: 3.1, 3.2, 4.1, 4.2, 4.3, 8.2, 8.3_

  - [x] 16.3 Test location-based recommendations
    - Test Places API integration
    - Test enhanced recommendations with context
    - Test fallback to context-only recommendations
    - _Requirements: 5.1, 5.2, 5.3, 8.4_

- [ ] 17. Final Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties using fast-check
- All API keys must be configured in Vercel environment variables before deployment
- The glassmorphism UI requires modern browser support for backdrop-filter

