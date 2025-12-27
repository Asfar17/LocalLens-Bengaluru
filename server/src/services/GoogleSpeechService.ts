/**
 * Google Speech Service
 * Handles voice transcription using Google Cloud Speech-to-Text API
 * 
 * Requirements: 3.1, 3.2 - Voice transcription with English and Kannada support
 */

import speech from '@google-cloud/speech';
import { getAPIKeyManager } from './APIKeyManager';

export interface TranscriptionRequest {
  audioBuffer: Buffer;
  mimeType: string;
  languageCode?: string; // 'en-IN' or 'kn-IN' for Kannada
}

export interface TranscriptionResponse {
  text: string;
  confidence: number;
  detectedLanguage: string;
}

// Supported languages for the Bangalore Survival Assistant
export const SUPPORTED_LANGUAGES = {
  ENGLISH_INDIA: 'en-IN',
  KANNADA: 'kn-IN',
} as const;

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[keyof typeof SUPPORTED_LANGUAGES];

export class GoogleSpeechService {
  private client: speech.SpeechClient | null = null;
  private isEnabled: boolean = false;

  constructor() {
    this.initializeClient();
  }

  /**
   * Initialize the Google Speech client
   * Supports both JSON credentials (for Vercel) and file path (for local dev)
   */
  private initializeClient(): void {
    const apiKeyManager = getAPIKeyManager();
    
    if (!apiKeyManager.isFeatureEnabled('speech')) {
      console.warn('⚠️  Google Speech Service disabled - API key not configured');
      this.isEnabled = false;
      return;
    }

    try {
      // Check for JSON credentials first (Vercel deployment)
      const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
      
      if (credentialsJson) {
        // Parse JSON credentials for serverless deployment
        const credentials = JSON.parse(credentialsJson);
        this.client = new speech.SpeechClient({ credentials });
      } else {
        // Fall back to file path for local development
        this.client = new speech.SpeechClient({
          keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS || 'gcp-key.json',
        });
      }
      
      this.isEnabled = true;
      console.log('✅ Google Speech Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Google Speech Service:', error);
      this.isEnabled = false;
    }
  }


  /**
   * Check if the service is enabled and ready to use
   */
  isServiceEnabled(): boolean {
    return this.isEnabled && this.client !== null;
  }

  /**
   * Get list of supported languages
   */
  getSupportedLanguages(): string[] {
    return Object.values(SUPPORTED_LANGUAGES);
  }

  /**
   * Map MIME type to Google Speech encoding
   */
  private getEncoding(mimeType: string): string {
    const encodingMap: Record<string, string> = {
      'audio/wav': 'LINEAR16',
      'audio/wave': 'LINEAR16',
      'audio/x-wav': 'LINEAR16',
      'audio/mp3': 'MP3',
      'audio/mpeg': 'MP3',
      'audio/webm': 'WEBM_OPUS',
      'audio/ogg': 'OGG_OPUS',
      'audio/flac': 'FLAC',
      'audio/m4a': 'MP3', // Approximate
      'audio/mp4': 'MP3', // Approximate
    };
    return encodingMap[mimeType.toLowerCase()] || 'LINEAR16';
  }

  /**
   * Transcribe audio to text using Google Cloud Speech-to-Text
   * @param request - The transcription request containing audio buffer and options
   * @returns TranscriptionResponse with transcribed text and metadata
   */
  async transcribe(request: TranscriptionRequest): Promise<TranscriptionResponse> {
    if (!this.isServiceEnabled()) {
      throw new Error('Google Speech Service is not enabled. Please configure GOOGLE_CLOUD_API_KEY.');
    }

    if (!request.audioBuffer || request.audioBuffer.length === 0) {
      throw new Error('Empty audio buffer provided');
    }

    // Default to English (India) if no language specified
    const languageCode = request.languageCode || SUPPORTED_LANGUAGES.ENGLISH_INDIA;

    // Validate language code
    if (!this.getSupportedLanguages().includes(languageCode)) {
      throw new Error(`Unsupported language: ${languageCode}. Supported: ${this.getSupportedLanguages().join(', ')}`);
    }

    try {
      const audioContent = request.audioBuffer.toString('base64');
      const encoding = this.getEncoding(request.mimeType);

      const speechRequest: speech.protos.google.cloud.speech.v1.IRecognizeRequest = {
        audio: {
          content: audioContent,
        },
        config: {
          encoding: encoding as any,
          sampleRateHertz: 16000, // Default sample rate
          languageCode: languageCode,
          // Enable automatic punctuation for better readability
          enableAutomaticPunctuation: true,
          // Enable word-level confidence for better accuracy metrics
          enableWordConfidence: true,
          // Model optimized for short queries
          model: 'command_and_search',
          // Alternative languages for better detection
          alternativeLanguageCodes: languageCode === SUPPORTED_LANGUAGES.ENGLISH_INDIA 
            ? [SUPPORTED_LANGUAGES.KANNADA]
            : [SUPPORTED_LANGUAGES.ENGLISH_INDIA],
        },
      };

      const [response] = await this.client!.recognize(speechRequest);
      
      if (!response.results || response.results.length === 0) {
        return {
          text: '',
          confidence: 0,
          detectedLanguage: languageCode,
        };
      }

      // Combine all transcription results
      const transcription = response.results
        .map(result => result.alternatives?.[0]?.transcript || '')
        .join(' ')
        .trim();

      // Calculate average confidence
      const confidences = response.results
        .map(result => result.alternatives?.[0]?.confidence || 0)
        .filter(c => c > 0);
      
      const avgConfidence = confidences.length > 0
        ? confidences.reduce((a, b) => a + b, 0) / confidences.length
        : 0;

      // Detect language from response if available
      const detectedLanguage = response.results[0]?.languageCode || languageCode;

      return {
        text: transcription,
        confidence: avgConfidence,
        detectedLanguage: detectedLanguage,
      };
    } catch (error: any) {
      console.error('Google Speech transcription error:', error);
      
      // Provide more specific error messages
      if (error.code === 3) {
        throw new Error('Invalid audio format or encoding. Please try a different audio format.');
      }
      if (error.code === 7) {
        throw new Error('Google Speech API quota exceeded. Please try again later.');
      }
      if (error.code === 16) {
        throw new Error('Google Speech API authentication failed. Please check your credentials.');
      }
      
      throw new Error(`Failed to transcribe audio: ${error.message || 'Unknown error'}`);
    }
  }
}

// Singleton instance
let googleSpeechServiceInstance: GoogleSpeechService | null = null;

export function getGoogleSpeechService(): GoogleSpeechService {
  if (!googleSpeechServiceInstance) {
    googleSpeechServiceInstance = new GoogleSpeechService();
  }
  return googleSpeechServiceInstance;
}

// Reset instance (useful for testing)
export function resetGoogleSpeechService(): void {
  googleSpeechServiceInstance = null;
}
