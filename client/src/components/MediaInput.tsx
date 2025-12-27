import { useState, useRef, useCallback } from 'react'
import './MediaInput.css'

// Voice transcription result
export interface VoiceResult {
  text: string
  confidence?: number
  language?: string
}

// Image processing result
export interface ImageResult {
  extractedText: string
  translatedText?: string
  detectedLanguage?: string
  interpretation: {
    localMeaning: string
    culturalSignificance: string
    practicalImplications: string
  }
}

// Error result for display
export interface MediaError {
  message: string
  suggestion?: string
}

interface MediaInputProps {
  onVoiceInput: (audioBlob: Blob) => void
  onImageUpload: (file: File) => void
  onSendAsQuery?: (text: string) => void
  isProcessing: boolean
  voiceResult?: VoiceResult | null
  imageResult?: ImageResult | null
  error?: MediaError | null
  onClearResult?: () => void
}

// Component to display voice transcription result
function VoiceResultDisplay({ 
  result, 
  onSendAsQuery, 
  onClear 
}: { 
  result: VoiceResult
  onSendAsQuery?: (text: string) => void
  onClear?: () => void
}) {
  return (
    <div className="media-result voice-result">
      <div className="result-header">
        <span className="result-icon">🎤</span>
        <span className="result-title">Transcription</span>
        {result.language && (
          <span className="result-language">{result.language}</span>
        )}
        {onClear && (
          <button className="result-close" onClick={onClear} aria-label="Close">×</button>
        )}
      </div>
      <div className="result-content">
        <p className="transcribed-text">"{result.text}"</p>
        {result.confidence !== undefined && result.confidence > 0 && (
          <span className="confidence-badge">
            {Math.round(result.confidence * 100)}% confident
          </span>
        )}
      </div>
      {onSendAsQuery && (
        <div className="result-actions">
          <button 
            className="action-btn send-btn"
            onClick={() => onSendAsQuery(result.text)}
          >
            Send as Question
          </button>
        </div>
      )}
    </div>
  )
}

// Component to display image processing result
function ImageResultDisplay({ 
  result, 
  onClear 
}: { 
  result: ImageResult
  onClear?: () => void
}) {
  return (
    <div className="media-result image-result">
      <div className="result-header">
        <span className="result-icon">📷</span>
        <span className="result-title">Image Analysis</span>
        {result.detectedLanguage && (
          <span className="result-language">{result.detectedLanguage}</span>
        )}
        {onClear && (
          <button className="result-close" onClick={onClear} aria-label="Close">×</button>
        )}
      </div>
      <div className="result-content">
        {result.extractedText && (
          <div className="extracted-text-section">
            <span className="section-label">Extracted Text:</span>
            <p className="extracted-text">"{result.extractedText}"</p>
          </div>
        )}
        {result.translatedText && (
          <div className="translated-text-section">
            <span className="section-label">Translation:</span>
            <p className="translated-text">"{result.translatedText}"</p>
          </div>
        )}
        {result.interpretation && (
          <div className="interpretation-section">
            <span className="section-label">Interpretation:</span>
            <div className="interpretation-content">
              {result.interpretation.localMeaning && (
                <p className="interpretation-item">
                  <strong>Local Meaning:</strong> {result.interpretation.localMeaning}
                </p>
              )}
              {result.interpretation.culturalSignificance && (
                <p className="interpretation-item">
                  <strong>Cultural Significance:</strong> {result.interpretation.culturalSignificance}
                </p>
              )}
              {result.interpretation.practicalImplications && (
                <p className="interpretation-item">
                  <strong>Practical Tips:</strong> {result.interpretation.practicalImplications}
                </p>
              )}
            </div>
          </div>
        )}
        {!result.extractedText && (
          <p className="no-text-message">No text could be extracted from the image.</p>
        )}
      </div>
    </div>
  )
}

// Component to display error
function ErrorDisplay({ 
  error, 
  onClear 
}: { 
  error: MediaError
  onClear?: () => void
}) {
  return (
    <div className="media-result error-result">
      <div className="result-header">
        <span className="result-icon">⚠️</span>
        <span className="result-title">Error</span>
        {onClear && (
          <button className="result-close" onClick={onClear} aria-label="Close">×</button>
        )}
      </div>
      <div className="result-content">
        <p className="error-message">{error.message}</p>
        {error.suggestion && (
          <p className="error-suggestion">{error.suggestion}</p>
        )}
      </div>
    </div>
  )
}

function MediaInput({ 
  onVoiceInput, 
  onImageUpload, 
  onSendAsQuery,
  isProcessing,
  voiceResult,
  imageResult,
  error,
  onClearResult
}: MediaInputProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      })
      
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { 
          type: mediaRecorder.mimeType 
        })
        onVoiceInput(audioBlob)
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
      setRecordingTime(0)
      
      // Start timer
      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    } catch (error) {
      console.error('Failed to start recording:', error)
      alert('Could not access microphone. Please check permissions.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }

  const handleVoiceClick = () => {
    if (isProcessing) return
    
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }


  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isProcessing) {
      setIsDragging(true)
    }
  }, [isProcessing])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    if (isProcessing) return

    const files = e.dataTransfer.files
    if (files.length > 0) {
      const file = files[0]
      if (file.type.startsWith('image/')) {
        onImageUpload(file)
      } else {
        alert('Please upload an image file (JPEG, PNG, GIF, WebP, or BMP)')
      }
    }
  }, [isProcessing, onImageUpload])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      const file = files[0]
      if (file.type.startsWith('image/')) {
        onImageUpload(file)
      } else {
        alert('Please upload an image file (JPEG, PNG, GIF, WebP, or BMP)')
      }
    }
    // Reset input so same file can be selected again
    e.target.value = ''
  }

  const handleImageClick = () => {
    if (!isProcessing && fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="media-input">
      <div className="media-buttons">
        {/* Voice Recording Button */}
        <button
          className={`media-btn voice-btn ${isRecording ? 'recording' : ''} ${isProcessing ? 'processing' : ''}`}
          onClick={handleVoiceClick}
          disabled={isProcessing}
          title={isRecording ? 'Stop recording' : 'Start voice recording'}
          aria-label={isRecording ? 'Stop recording' : 'Start voice recording'}
        >
          <span className="btn-icon">
            {isRecording ? (
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
              </svg>
            )}
          </span>
          {isRecording && (
            <span className="recording-indicator">
              <span className="pulse"></span>
              <span className="recording-time">{formatTime(recordingTime)}</span>
            </span>
          )}
        </button>

        {/* Image Upload Button */}
        <button
          className={`media-btn image-btn ${isProcessing ? 'processing' : ''}`}
          onClick={handleImageClick}
          disabled={isProcessing || isRecording}
          title="Upload image"
          aria-label="Upload image"
        >
          <span className="btn-icon">
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
              <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
            </svg>
          </span>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp,image/bmp"
          onChange={handleFileSelect}
          className="hidden-input"
          aria-hidden="true"
        />
      </div>

      {/* Drag and Drop Zone */}
      <div
        className={`drop-zone ${isDragging ? 'dragging' : ''} ${isProcessing ? 'processing' : ''}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {isProcessing ? (
          <div className="processing-state">
            <div className="spinner"></div>
            <span>Processing...</span>
          </div>
        ) : isDragging ? (
          <span className="drop-text">Drop image here</span>
        ) : (
          <span className="drop-hint">Drag & drop an image here</span>
        )}
      </div>

      {/* Results Display Area */}
      {error && (
        <ErrorDisplay error={error} onClear={onClearResult} />
      )}
      {voiceResult && !error && (
        <VoiceResultDisplay 
          result={voiceResult} 
          onSendAsQuery={onSendAsQuery}
          onClear={onClearResult} 
        />
      )}
      {imageResult && !error && (
        <ImageResultDisplay result={imageResult} onClear={onClearResult} />
      )}
    </div>
  )
}

export default MediaInput
