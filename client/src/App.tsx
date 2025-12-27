import { useState, useRef } from 'react'
import ChatInterface from './components/ChatInterface'
import ContextControls from './components/ContextControls'
import PersonaSelector from './components/PersonaSelector'
import MediaInput, { type VoiceResult, type ImageResult, type MediaError } from './components/MediaInput'
import { processVoice, processImage, ApiError, ErrorSuggestions } from './services/api'
import './App.css'
import './styles/glassmorphism.css'

export type Persona = 'newbie' | 'student' | 'it-professional' | 'tourist'

export interface ContextFile {
  id: string
  name: string
  domain: string
  isLoaded: boolean
}

function App() {
  const [persona, setPersona] = useState<Persona>('newbie')
  const [bangaloreContextEnabled, setBangaloreContextEnabled] = useState(true)
  const [isMediaProcessing, setIsMediaProcessing] = useState(false)
  const [voiceResult, setVoiceResult] = useState<VoiceResult | null>(null)
  const [imageResult, setImageResult] = useState<ImageResult | null>(null)
  const [mediaError, setMediaError] = useState<MediaError | null>(null)
  const chatInputRef = useRef<HTMLInputElement>(null)
  const [contextFiles, setContextFiles] = useState<ContextFile[]>([
    { id: 'city', name: 'city.md', domain: 'city', isLoaded: true },
    { id: 'slang', name: 'slang.md', domain: 'slang', isLoaded: true },
    { id: 'food', name: 'food.md', domain: 'food', isLoaded: true },
    { id: 'traffic', name: 'traffic.md', domain: 'traffic', isLoaded: true },
    { id: 'etiquette', name: 'etiquette.md', domain: 'etiquette', isLoaded: true },
  ])

  const handleToggleContext = (fileId: string) => {
    setContextFiles(prev =>
      prev.map(f => (f.id === fileId ? { ...f, isLoaded: !f.isLoaded } : f))
    )
  }

  // Clear any previous results/errors
  const clearMediaResults = () => {
    setVoiceResult(null)
    setImageResult(null)
    setMediaError(null)
  }

  const handleVoiceInput = async (audioBlob: Blob) => {
    clearMediaResults()
    setIsMediaProcessing(true)
    
    try {
      const data = await processVoice(audioBlob)
      
      if (data.text) {
        setVoiceResult({
          text: data.text,
          confidence: data.confidence,
          language: data.language
        })
      } else {
        setMediaError({
          message: 'Could not transcribe audio',
          suggestion: ErrorSuggestions.voice
        })
      }
    } catch (error) {
      console.error('Voice processing error:', error)
      
      if (error instanceof ApiError) {
        setMediaError({
          message: error.getUserMessage(),
          suggestion: error.suggestion || ErrorSuggestions.voice
        })
      } else {
        setMediaError({
          message: 'Failed to process voice input',
          suggestion: ErrorSuggestions.voice
        })
      }
    } finally {
      setIsMediaProcessing(false)
    }
  }

  const handleImageUpload = async (file: File) => {
    clearMediaResults()
    setIsMediaProcessing(true)
    
    try {
      const data = await processImage(file)
      
      setImageResult({
        extractedText: data.extractedText,
        translatedText: data.translatedText,
        detectedLanguage: data.detectedLanguage,
        interpretation: data.interpretation
      })
    } catch (error) {
      console.error('Image processing error:', error)
      
      if (error instanceof ApiError) {
        setMediaError({
          message: error.getUserMessage(),
          suggestion: error.suggestion || ErrorSuggestions.image
        })
      } else {
        setMediaError({
          message: 'Failed to process image',
          suggestion: ErrorSuggestions.image
        })
      }
    } finally {
      setIsMediaProcessing(false)
    }
  }

  // Handle sending transcribed text as a query
  const handleSendAsQuery = (text: string) => {
    // Clear the voice result
    clearMediaResults()
    
    // Focus the chat input and set the text
    // This will be handled by the ChatInterface component
    // For now, we'll use a custom event or ref
    if (chatInputRef.current) {
      // Dispatch a custom event that ChatInterface can listen to
      const event = new CustomEvent('sendQuery', { detail: { text } })
      window.dispatchEvent(event)
    }
  }

  return (
    <div className="app-container">
      {/* Fixed background image layer */}
      <div 
        className="app-background"
        aria-hidden="true"
      />
      
      {/* Glass overlay for readability */}
      <div 
        className="app-overlay"
        aria-hidden="true"
      />
      
      {/* App content */}
      <div className="app">
        <header className="app-header glass-card">
          <h1>🏙️ LocalLens Bengaluru</h1>
          <p>Your context-aware guide to life in Bangalore</p>
        </header>
        
        <div className="app-controls">
          <PersonaSelector 
            currentPersona={persona} 
            onSelectPersona={setPersona} 
          />
          <ContextControls
            contextFiles={contextFiles}
            bangaloreContextEnabled={bangaloreContextEnabled}
            onToggleContext={handleToggleContext}
            onToggleBangaloreContext={setBangaloreContextEnabled}
          />
          <MediaInput
            onVoiceInput={handleVoiceInput}
            onImageUpload={handleImageUpload}
            onSendAsQuery={handleSendAsQuery}
            isProcessing={isMediaProcessing}
            voiceResult={voiceResult}
            imageResult={imageResult}
            error={mediaError}
            onClearResult={clearMediaResults}
          />
        </div>

        <main className="app-main">
          <ChatInterface 
            persona={persona}
            bangaloreContextEnabled={bangaloreContextEnabled}
            loadedContexts={contextFiles.filter(f => f.isLoaded).map(f => f.id)}
          />
        </main>
      </div>
    </div>
  )
}

export default App
