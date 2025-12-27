# Tech Stack

## Architecture

- Monorepo with npm workspaces (`client/`, `server/`)
- Serverless deployment on Vercel via `api/index.ts` wrapper

## Frontend (client/)

- React 18 + TypeScript
- Vite for bundling
- React Router for navigation
- Custom CSS with glassmorphism styling

## Backend (server/)

- Node.js 18+ with Express
- TypeScript (ES modules with `.js` imports)
- MongoDB via Mongoose

## External Services

| Service | Purpose | Key Variable |
|---------|---------|--------------|
| OpenRouter (GPT-4o-mini) | Chat responses | `OPENROUTER_API_KEY` |
| Google Cloud Speech | Voice transcription | `GOOGLE_CLOUD_API_KEY` |
| Google Cloud Vision | Image text extraction | `GOOGLE_CLOUD_API_KEY` |
| Google Cloud Translate | Text translation | `GOOGLE_CLOUD_API_KEY` |
| Google Maps Places | Location services | `GOOGLE_MAPS_API_KEY` |
| Tesseract.js | Fallback OCR | (bundled) |

## Common Commands

```bash
# Install all dependencies
npm install

# Run both client and server in dev mode
npm run dev

# Run only client (Vite on port 5173)
npm run dev:client

# Run only server (tsx watch on port 5000)
npm run dev:server

# Build for production
npm run build

# Lint TypeScript files
npm run lint

# Run server tests
npm run test --workspace=server
```

## Code Style

- Prettier: no semicolons, single quotes, 2-space tabs, no trailing commas
- ESLint: warn on unused vars, console allowed
- TypeScript: strict mode enabled
