import type { VercelRequest, VercelResponse } from '@vercel/node'

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.json({ 
    message: 'Test endpoint working',
    timestamp: new Date().toISOString(),
    url: req.url
  })
}
