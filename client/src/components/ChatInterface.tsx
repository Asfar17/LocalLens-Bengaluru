import { useState, useEffect, useCallback } from 'react'
import type { Persona } from '../App'
import { submitQuery, ApiError, type QueryResponse, type FoodRecommendation } from '../services/api'
import './ChatInterface.css'

/**
 * Parse markdown-style text and return React elements
 * Supports: ### headings, **bold**, *italic*, `code`, ~~strikethrough~~, [links](url), and line breaks
 */
function parseMarkdownText(text: string): React.ReactNode[] {
  const elements: React.ReactNode[] = []
  let key = 0

  // Split by line breaks first to handle paragraphs
  const lines = text.split('\n')
  
  lines.forEach((line, lineIndex) => {
    if (lineIndex > 0) {
      elements.push(<br key={`br-${key++}`} />)
    }
    
    // Check for heading syntax at start of line (###, ##, #)
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/)
    if (headingMatch) {
      const headingText = headingMatch[2]
      elements.push(<strong key={`heading-${key++}`} className="chat-heading">{headingText}</strong>)
      return
    }
    
    // Pattern to match markdown syntax
    // Order matters: check longer patterns first
    const pattern = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)|(\~\~(.+?)\~\~)|(\[(.+?)\]\((.+?)\))/g
    
    let lastIndex = 0
    let match
    
    while ((match = pattern.exec(line)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        elements.push(line.slice(lastIndex, match.index))
      }
      
      if (match[1]) {
        // **bold**
        elements.push(<strong key={`bold-${key++}`}>{match[2]}</strong>)
      } else if (match[3]) {
        // *italic*
        elements.push(<em key={`italic-${key++}`}>{match[4]}</em>)
      } else if (match[5]) {
        // `code`
        elements.push(<code key={`code-${key++}`} className="inline-code">{match[6]}</code>)
      } else if (match[7]) {
        // ~~strikethrough~~
        elements.push(<del key={`del-${key++}`}>{match[8]}</del>)
      } else if (match[9]) {
        // [link](url)
        elements.push(
          <a key={`link-${key++}`} href={match[11]} target="_blank" rel="noopener noreferrer" className="chat-link">
            {match[10]}
          </a>
        )
      }
      
      lastIndex = match.index + match[0].length
    }
    
    // Add remaining text after last match
    if (lastIndex < line.length) {
      elements.push(line.slice(lastIndex))
    }
  })
  
  return elements
}

/**
 * Render formatted text with markdown support
 */
function FormattedText({ text }: { text: string }) {
  return <>{parseMarkdownText(text)}</>
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  aiPowered?: boolean
  contextFilesUsed?: string[]
  bangaloreContextActive?: boolean
  locationRecommendations?: FoodRecommendation[]
}

interface ChatInterfaceProps {
  persona: Persona
  bangaloreContextEnabled: boolean
  loadedContexts: string[]
}

// Component to display a single location recommendation
function LocationRecommendation({ recommendation }: { recommendation: FoodRecommendation }) {
  const { suggestion, reasoning, place, culturalNote } = recommendation
  
  // Render star rating
  const renderStars = (rating: number) => {
    const fullStars = Math.floor(rating)
    const hasHalfStar = rating % 1 >= 0.5
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0)
    
    return (
      <span className="rating-stars">
        {'★'.repeat(fullStars)}
        {hasHalfStar && '½'}
        {'☆'.repeat(emptyStars)}
        <span className="rating-value">({rating.toFixed(1)})</span>
      </span>
    )
  }
  
  // Render price level
  const renderPriceLevel = (level: number) => {
    return <span className="price-level">{'₹'.repeat(level || 1)}</span>
  }
  
  // If we have place data from Google Maps, show rich details
  if (place) {
    return (
      <div className="location-recommendation">
        <div className="recommendation-header">
          <span className="place-name">{place.name}</span>
          {place.rating > 0 && renderStars(place.rating)}
        </div>
        <div className="recommendation-details">
          <span className="place-address">{place.address}</span>
          <div className="place-meta">
            {place.distance > 0 && (
              <span className="place-distance">
                📍 {place.distance < 1000 
                  ? `${Math.round(place.distance)}m` 
                  : `${(place.distance / 1000).toFixed(1)}km`}
              </span>
            )}
            {place.priceLevel > 0 && renderPriceLevel(place.priceLevel)}
          </div>
        </div>
        <div className="recommendation-reasoning"><FormattedText text={reasoning} /></div>
        {culturalNote && (
          <div className="cultural-note">
            <span className="note-icon">💡</span> <FormattedText text={culturalNote} />
          </div>
        )}
      </div>
    )
  }
  
  // Fallback: show simple recommendation without place data
  return (
    <div className="location-recommendation">
      <div className="recommendation-header">
        <span className="place-name">{suggestion}</span>
      </div>
      <div className="recommendation-reasoning"><FormattedText text={reasoning} /></div>
      {culturalNote && (
        <div className="cultural-note">
          <span className="note-icon">💡</span> <FormattedText text={culturalNote} />
        </div>
      )}
    </div>
  )
}

function ChatInterface({ persona, bangaloreContextEnabled, loadedContexts }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationStatus, setLocationStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle')

  // Request user location on mount
  useEffect(() => {
    if ('geolocation' in navigator) {
      setLocationStatus('requesting')
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          })
          setLocationStatus('granted')
        },
        (error) => {
          console.warn('Geolocation error:', error.message)
          setLocationStatus('denied')
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
      )
    }
  }, [])

  // Handle submitting a query (extracted for reuse)
  const submitUserQuery = useCallback(async (queryText: string) => {
    if (!queryText.trim() || isLoading) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: queryText.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const data: QueryResponse = await submitQuery(
        userMessage.content,
        persona,
        bangaloreContextEnabled,
        loadedContexts,
        userLocation || undefined
      )
      
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || 'Sorry, I could not process your request.',
        timestamp: new Date(),
        aiPowered: data.aiPowered,
        contextFilesUsed: data.contextFilesUsed,
        bangaloreContextActive: data.bangaloreContextActive,
        locationRecommendations: data.locationRecommendations
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      let errorContent = 'Connection error. Please try again.'
      
      if (error instanceof ApiError) {
        errorContent = error.getUserMessage()
        if (error.suggestion) {
          errorContent += ` ${error.suggestion}`
        }
      }
      
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errorContent,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }, [isLoading, persona, bangaloreContextEnabled, loadedContexts, userLocation])

  // Listen for sendQuery events from MediaInput
  useEffect(() => {
    const handleSendQuery = (event: CustomEvent<{ text: string }>) => {
      submitUserQuery(event.detail.text)
    }

    window.addEventListener('sendQuery', handleSendQuery as EventListener)
    return () => {
      window.removeEventListener('sendQuery', handleSendQuery as EventListener)
    }
  }, [submitUserQuery])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    submitUserQuery(input)
  }

  // Render message content with optional AI indicator, context info, and recommendations
  const renderMessageContent = (msg: ChatMessage) => {
    return (
      <>
        <div className="message-content">
          <FormattedText text={msg.content} />
          {msg.aiPowered && (
            <span className="ai-indicator" title="AI-powered response">
              ✨ AI
            </span>
          )}
        </div>
        {msg.role === 'assistant' && msg.bangaloreContextActive && msg.contextFilesUsed && msg.contextFilesUsed.length > 0 && (
          <div className="context-transparency">
            <span className="context-icon">📚</span>
            <span className="context-label">Sources:</span>
            <span className="context-files">{msg.contextFilesUsed.join(', ')}</span>
          </div>
        )}
        {msg.role === 'assistant' && msg.bangaloreContextActive === false && (
          <div className="context-transparency general-mode">
            <span className="context-icon">🌐</span>
            <span className="context-label">General AI response (Bangalore context disabled)</span>
          </div>
        )}
        {msg.locationRecommendations && msg.locationRecommendations.length > 0 && (
          <div className="location-recommendations">
            <div className="recommendations-header">📍 Nearby Recommendations</div>
            {msg.locationRecommendations.map((rec, index) => (
              <LocationRecommendation key={rec.place?.placeId || rec.suggestion || index} recommendation={rec} />
            ))}
          </div>
        )}
      </>
    )
  }

  return (
    <div className="chat-interface">
      <div className="chat-status">
        <span className={`status-indicator ${bangaloreContextEnabled ? 'on' : 'off'}`}>
          Context: {bangaloreContextEnabled ? 'ON' : 'OFF'}
        </span>
        <span className="persona-indicator">Persona: {persona}</span>
        <span className={`location-indicator ${locationStatus}`}>
          {locationStatus === 'granted' ? '📍 Location on' : 
           locationStatus === 'requesting' ? '📍 Getting location...' :
           locationStatus === 'denied' ? '📍 Location off' : '📍'}
        </span>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-welcome">
            <p>👋 Namaskara! I'm your LocalLens Bengaluru Ai Powered Assistant.</p>
            <p>Ask me about local slang, food, traffic, etiquette, or anything about life in Bangalore!</p>
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`chat-message ${msg.role}`}>
            {renderMessageContent(msg)}
            <div className="message-time">
              {msg.timestamp.toLocaleTimeString()}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="chat-message assistant loading">
            <div className="typing-indicator">
              <span></span><span></span><span></span>
            </div>
          </div>
        )}
      </div>

      <form className="chat-input-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask about Bangalore..."
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  )
}

export default ChatInterface
