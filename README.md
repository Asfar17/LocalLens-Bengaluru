# Bangalore Survival Assistant

A context-aware AI assistant to help people navigate life in Bangalore.

## Features

- 🏙️ Context-aware responses based on local knowledge
- 👤 Persona-based adaptation (Newbie, Student, IT Pro, Tourist)
- 🗣️ Local slang interpretation
- 🍛 Food recommendations
- 🚗 Traffic and commute guidance
- 🙏 Cultural etiquette tips

## Tech Stack

- **Frontend**: React + Vite + TypeScript
- **Backend**: Node.js + Express + TypeScript
- **Database**: MongoDB
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)

### Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp server/.env.example server/.env

# Start development servers
npm run dev
```

### Environment Variables

Create `server/.env`:

```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/bangalore-assistant
```

## Vercel Deployment

### Quick Deploy

1. Push your code to GitHub
2. Import the repository in [Vercel](https://vercel.com/new)
3. Configure environment variables in Vercel project settings (see below)
4. Deploy!

### Environment Variables

Configure these in your Vercel project settings (Settings > Environment Variables):

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | ✅ Yes | MongoDB Atlas connection string |
| `OPENAI_API_KEY` | ⚠️ Optional | OpenAI API key for AI-powered responses |
| `GOOGLE_CLOUD_API_KEY` | ⚠️ Optional | Google Cloud API key (Speech-to-Text, Vision, Translate) |
| `GOOGLE_MAPS_API_KEY` | ⚠️ Optional | Google Maps API key (Places API) |
| `ALLOWED_ORIGINS` | ⚠️ Optional | Comma-separated list of allowed CORS origins |
| `NODE_ENV` | Auto | Set automatically by Vercel to `production` |

> **Note**: Optional API keys enable enhanced features. The app works without them using context-file-based responses.

### API Key Setup

#### MongoDB Atlas (Required)
1. Create a free cluster at [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create a database user with read/write access
3. Add `0.0.0.0/0` to the IP Access List (or Vercel's IPs)
4. Get your connection string from Database > Connect > Drivers
5. Format: `mongodb+srv://username:password@cluster.mongodb.net/bangalore-assistant`

#### OpenAI (Optional - AI Responses)
1. Create an account at [OpenAI Platform](https://platform.openai.com)
2. Generate an API key from API Keys section
3. Add billing information for API usage
4. Format: `sk-...`

#### Google Cloud (Optional - Voice & Image)
1. Create a project in [Google Cloud Console](https://console.cloud.google.com)
2. Enable these APIs:
   - Cloud Speech-to-Text API
   - Cloud Vision API
   - Cloud Translation API
3. Create an API key from Credentials section
4. Restrict the key to only the enabled APIs

#### Google Maps (Optional - Location)
1. In the same Google Cloud project, enable:
   - Places API
   - Geocoding API
2. Create a separate API key for Maps
3. Restrict the key to Maps APIs only

### Deployment Checklist

- [ ] MongoDB Atlas cluster created and configured
- [ ] Database user created with read/write permissions
- [ ] IP Access List configured (0.0.0.0/0 for Vercel)
- [ ] `MONGODB_URI` added to Vercel environment variables
- [ ] (Optional) OpenAI API key added as `OPENAI_API_KEY`
- [ ] (Optional) Google Cloud API key added as `GOOGLE_CLOUD_API_KEY`
- [ ] (Optional) Google Maps API key added as `GOOGLE_MAPS_API_KEY`
- [ ] (Optional) `ALLOWED_ORIGINS` configured with your domain(s)
- [ ] Deployment triggered and successful
- [ ] Health check endpoint verified: `https://your-app.vercel.app/api/health`

### Manual CLI Deployment

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Login to Vercel:
   ```bash
   vercel login
   ```

3. Deploy:
   ```bash
   vercel
   ```

4. Set environment variables:
   ```bash
   vercel env add MONGODB_URI
   vercel env add OPENAI_API_KEY
   vercel env add GOOGLE_CLOUD_API_KEY
   vercel env add GOOGLE_MAPS_API_KEY
   vercel env add ALLOWED_ORIGINS
   ```

5. Redeploy to apply environment variables:
   ```bash
   vercel --prod
   ```

### CORS Configuration

By default, the API allows requests from:
- `http://localhost:3000` (development)
- `http://localhost:5173` (Vite dev server)
- Your Vercel deployment URL

To restrict origins in production, set `ALLOWED_ORIGINS`:
```
ALLOWED_ORIGINS=https://your-app.vercel.app,https://your-custom-domain.com
```

### Troubleshooting

| Issue | Solution |
|-------|----------|
| Database connection fails | Check MongoDB Atlas IP whitelist includes 0.0.0.0/0 |
| CORS errors | Verify `ALLOWED_ORIGINS` includes your frontend domain |
| AI features not working | Check API keys are correctly set in Vercel |
| 503 Service Unavailable | Check Vercel function logs for errors |

### Deployment Configuration

The project includes:
- `vercel.json` - Vercel build, routing, and function configuration
- `api/index.ts` - Serverless function entry point for the backend
- `.vercelignore` - Files excluded from deployment

## Project Structure

```
├── api/             # Vercel serverless functions
│   └── index.ts     # Express app wrapper
├── client/          # React frontend
│   ├── src/
│   │   ├── components/
│   │   └── App.tsx
│   └── package.json
├── server/          # Express backend
│   ├── src/
│   │   ├── routes/
│   │   ├── services/
│   │   └── index.ts
│   └── package.json
├── context/         # Markdown context files
│   ├── city.md
│   ├── slang.md
│   ├── food.md
│   ├── traffic.md
│   └── etiquette.md
├── vercel.json      # Vercel configuration
└── package.json     # Root workspace config
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/query | Submit query, get response |
| GET | /api/contexts | List context files |
| POST | /api/contexts/:id/toggle | Toggle context |
| POST | /api/persona | Set persona |

## License

MIT
