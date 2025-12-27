# Implementation Plan: Bangalore Survival Assistant

## Overview

This implementation plan builds the context-aware Bangalore Survival Assistant incrementally, starting with core backend infrastructure, then adding context management, response generation, and finally the React frontend. Each task builds on previous work, ensuring no orphaned code.

## Tasks

- [x] 1. Project Setup and Core Infrastructure
  - [x] 1.1 Initialize project structure with Vite + React frontend and Node.js/Express backend
    - Create monorepo structure with `/client` and `/server` directories
    - Set up Vite with React and TypeScript for frontend
    - Set up Express with TypeScript for backend
    - Configure ESLint and Prettier
    - _Requirements: 9.1, 9.2_

  - [x] 1.2 Set up MongoDB connection and base configuration
    - Install mongoose and configure connection
    - Create database connection utility with error handling
    - Set up environment variables for MongoDB URI
    - _Requirements: 11.1, 11.3_

  - [x] 1.3 Create MongoDB schemas and models
    - Create ContextDocument schema for context file metadata
    - Create SessionDocument schema for user session preferences
    - Create QueryLogDocument schema (optional analytics)
    - _Requirements: 11.1, 11.2_

  - [ ]* 1.4 Write unit tests for MongoDB models
    - Test schema validation
    - Test CRUD operations
    - _Requirements: 11.1_

- [x] 2. Context Management System
  - [x] 2.1 Create sample context files in ./context/ directory
    - Create city.md with Bangalore traffic, customs, areas
    - Create slang.md with local phrases, tones, usage
    - Create food.md with food culture and recommendations
    - Create etiquette.md with social do's and don'ts
    - Create traffic.md with commuting guide
    - _Requirements: 2.1, 2.2_

  - [x] 2.2 Implement ContextManager class
    - Implement loadContext() to read and parse markdown files
    - Implement unloadContext() to remove context from memory
    - Implement getLoadedContexts() to return active contexts
    - Implement getContextForDomain() to get specific domain context
    - Parse markdown into searchable sections
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ]* 2.3 Write property test for context content inclusion/exclusion
    - **Property 4: Context Content Inclusion/Exclusion**
    - **Validates: Requirements 2.3, 2.4**

  - [ ]* 2.4 Write property test for missing context fallback
    - **Property 5: Missing Context Fallback**
    - **Validates: Requirements 2.5, 4.5, 5.6, 6.5**

- [x] 3. Checkpoint - Context Management
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Response Generation with Context Switching
  - [x] 4.1 Implement ResponseGenerator class
    - Create generateResponse() method that uses loaded contexts
    - Implement context-aware response logic
    - Return response with metadata (contextsUsed, persona, bangaloreContextActive)
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 4.2 Implement Bangalore context ON/OFF toggle logic
    - When ON: incorporate all loaded context file content
    - When OFF: generate generic, location-agnostic responses
    - Ensure immediate effect on subsequent responses
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ]* 4.3 Write property test for context ON/OFF different responses
    - **Property 1: Context ON/OFF Produces Different Responses**
    - **Validates: Requirements 1.1, 1.2, 1.5**

  - [ ]* 4.4 Write property test for context toggle immediate effect
    - **Property 2: Context Toggle Reflects Immediately**
    - **Validates: Requirements 1.3**

  - [ ]* 4.5 Write property test for no hardcoded Bangalore logic
    - **Property 3: No Hardcoded Bangalore Logic**
    - **Validates: Requirements 1.4**

- [x] 5. Persona System
  - [x] 5.1 Implement persona selection and switching
    - Support four personas: Newbie, Student, IT Professional, Tourist
    - Adapt response tone and depth based on selected persona
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 5.2 Integrate persona into ResponseGenerator
    - Modify generateResponse() to accept persona parameter
    - Apply persona-specific formatting and tone
    - Ensure immediate switch without restart
    - _Requirements: 3.6, 3.7, 3.8_

  - [ ]* 5.3 Write property test for persona switch immediate effect
    - **Property 6: Persona Switch Reflects Immediately**
    - **Validates: Requirements 3.6**

  - [ ]* 5.4 Write property test for different personas different responses
    - **Property 7: Different Personas Produce Different Responses**
    - **Validates: Requirements 3.8**

  - [ ]* 5.5 Write property test for no hardcoded persona behavior
    - **Property 8: No Hardcoded Persona Behavior**
    - **Validates: Requirements 3.7**

- [x] 6. Checkpoint - Core Backend Logic
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Slang Interpreter
  - [x] 7.1 Implement SlangInterpreter class
    - Implement detectSlang() to find slang phrases in text
    - Implement explainSlang() to return meaning, tone, and usage
    - Parse slang.md for phrase definitions
    - _Requirements: 4.2, 4.3, 4.4_

  - [ ]* 7.2 Write property test for slang explanation completeness
    - **Property 9: Slang Explanation Completeness**
    - **Validates: Requirements 4.2, 4.3, 4.4**

- [x] 8. Image Processor
  - [x] 8.1 Implement ImageProcessor class
    - Implement extractText() using OCR (Tesseract.js or similar)
    - Implement interpretImage() to provide local meaning with context
    - Return cultural significance, behavior, and practical implications
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ]* 8.2 Write property test for image text extraction
    - **Property 10: Image Text Extraction**
    - **Validates: Requirements 5.1**

  - [ ]* 8.3 Write property test for image interpretation completeness
    - **Property 11: Image Interpretation Completeness**
    - **Validates: Requirements 5.2, 5.3, 5.4, 5.5**

- [x] 9. Location Service
  - [x] 9.1 Implement LocationService class
    - Accept GPS coordinates (lat, lng)
    - Combine location with food.md and city.md context
    - Generate situational recommendations with reasoning
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ]* 9.2 Write property test for location-based recommendations
    - **Property 12: Location-Based Recommendations with Reasoning**
    - **Validates: Requirements 6.1, 6.2, 6.3**

  - [ ]* 9.3 Write property test for no hardcoded restaurant data
    - **Property 13: No Hardcoded Restaurant Data**
    - **Validates: Requirements 6.4**

- [x] 10. Checkpoint - Backend Services
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. API Endpoints
  - [x] 11.1 Implement POST /api/query endpoint
    - Accept query, persona, and optional location
    - Return context-aware response with metadata
    - _Requirements: 10.1_

  - [x] 11.2 Implement GET /api/contexts endpoint
    - Return list of available context files and their loaded status
    - _Requirements: 10.2_

  - [x] 11.3 Implement POST /api/contexts/:id/toggle endpoint
    - Toggle specific context file on/off
    - Return updated context status
    - _Requirements: 10.3_

  - [x] 11.4 Implement POST /api/persona endpoint
    - Set active persona for session
    - Return confirmation
    - _Requirements: 10.4_

  - [x] 11.5 Implement POST /api/image endpoint
    - Accept image upload
    - Return extracted text and interpretation
    - _Requirements: 10.5_

  - [x] 11.6 Implement POST /api/voice endpoint
    - Accept audio input
    - Return transcribed text
    - _Requirements: 4.1_

  - [x] 11.7 Implement GET /api/session endpoint
    - Return current session state (persona, loaded contexts)
    - _Requirements: 7.4, 8.1_

  - [x] 11.8 Implement error handling middleware
    - Return appropriate HTTP status codes
    - Return descriptive error messages
    - _Requirements: 10.6_

  - [ ]* 11.9 Write property test for API error responses
    - **Property 15: API Error Responses**
    - **Validates: Requirements 10.6**

- [-] 12. Session Management
  - [x] 12.1 Implement session persistence
    - Store persona and context settings in MongoDB
    - Retrieve session on subsequent requests
    - _Requirements: 11.2_

  - [ ]* 12.2 Write property test for session preferences persistence
    - **Property 16: Session Preferences Persistence**
    - **Validates: Requirements 11.2**

- [ ] 13. Checkpoint - API Complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. React Frontend - Core Components
  - [x] 14.1 Create ChatInterface component
    - Display message list with user and assistant messages
    - Input field for submitting queries
    - Show loading state during API calls
    - _Requirements: 7.1, 7.2_

  - [x] 14.2 Create ContextControls component
    - Display list of context files with toggle switches
    - Show Bangalore context ON/OFF master toggle
    - Update display immediately on changes
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 14.3 Create PersonaSelector component
    - Dropdown or button group for persona selection
    - Display current persona
    - _Requirements: 3.1_

  - [x] 14.4 Create MediaInput component
    - Voice recording button with visual feedback
    - Image upload with drag-and-drop support
    - Show processing state
    - _Requirements: 4.1, 5.1_

  - [ ]* 14.5 Write property test for chat history maintained
    - **Property 14: Chat History Maintained**
    - **Validates: Requirements 7.3**

- [ ] 15. Frontend Integration
  - [x] 15.1 Create API service layer
    - Implement functions for all API endpoints
    - Handle errors and loading states
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 15.2 Create main App component and wire components together
    - Integrate ChatInterface, ContextControls, PersonaSelector
    - Manage global state for session, contexts, persona
    - _Requirements: 7.1, 7.4, 8.1_

  - [x] 15.3 Implement responsive layout
    - Mobile-first CSS with breakpoints for tablet/desktop
    - Ensure all components render correctly at 320px+
    - _Requirements: 9.1, 9.2, 9.3_

- [ ] 16. Checkpoint - Frontend Complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 17. Final Integration and Deployment Setup
  - [x] 17.1 Configure Vercel deployment
    - Set up vercel.json for monorepo
    - Configure environment variables
    - Set up build commands for frontend and backend
    - _Requirements: All_

  - [x] 17.2 End-to-end integration testing
    - Test full query flow with context switching
    - Test persona switching
    - Test image and voice processing
    - _Requirements: All_

- [ ] 18. Final Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties using fast-check
- Unit tests validate specific examples and edge cases
- Context files in ./context/ are the single source of truth for all local intelligence
