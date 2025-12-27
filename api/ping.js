export default function handler(req, res) {
  res.json({ 
    message: 'Ping successful',
    timestamp: new Date().toISOString()
  })
}
