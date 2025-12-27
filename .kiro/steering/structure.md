# Project Structure

```
├── api/                    # Vercel serverless entry point
│   └── index.ts            # Express app wrapper for Vercel
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # React components (ChatInterface, MediaInput, etc.)
│   │   ├── services/       # API client functions
│   │   ├── styles/         # Shared CSS (glassmorphism)
│   │   ├── App.tsx         # Main app component
│   │   └── main.tsx        # Entry point
│   └── public/assets/      # Static assets (SVGs, images)
├── server/                 # Express backend
│   ├── src/
│   │   ├── config/         # Environment, database config
│   │   ├── middleware/     # Express middleware (validation)
│   │   ├── models/         # Mongoose schemas
│   │   ├── routes/         # API route handlers
│   │   ├── services/       # Business logic services
│   │   └── index.ts        # Server entry point
│   └── tests/integration/  # E2E tests
├── context/                # Markdown knowledge files
│   ├── city.md
│   ├── slang.md
│   ├── food.md
│   ├── traffic.md
│   └── etiquette.md
└── vercel.json             # Vercel deployment config
```

## Key Patterns

### Services (server/src/services/)

Services are singleton classes with factory functions:
- `OpenAIService` - Chat completions
- `GoogleSpeechService` - Voice transcription
- `GoogleVisionService` - Image analysis
- `ContextManager` - Loads/manages context files
- `APIKeyManager` - Centralized API key access
- `RateLimiter` - Request throttling

### API Routes

All routes prefixed with `/api`:
- `POST /api/query` - Submit chat query
- `GET /api/contexts` - List context files
- `POST /api/contexts/:id/toggle` - Toggle context
- `POST /api/persona` - Set user persona
- `POST /api/voice` - Process voice input
- `POST /api/image` - Process image upload

### TypeScript Imports

Server uses ES modules - always use `.js` extension in imports:
```typescript
import { getEnv } from './config/environment.js'
```
