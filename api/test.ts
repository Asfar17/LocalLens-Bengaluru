export default function handler(req, res) {
  res.json({ 
    message: 'Test endpoint working',
    timestamp: new Date().toISOString(),
    url: req.url
  })
}
