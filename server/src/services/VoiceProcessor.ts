/**
 * VoiceProcessor service for handling audio transcription
 * Converts voice input to text for the Bangalore Survival Assistant
 * Integrates with Google Cloud Speech-to-Text API
 * 
 * Requirements: 
 * - 3.3: Display transcribed text and process as query
 * - 3.4: Handle Google Speech API errors gracefully
 * - 8.2: Fall back to error message when service unavailable
 */

import { 
  GoogleSpeechService, 
  getGoogleSpeechService, 
  TranscriptionResponse as GoogleTranscriptionResponse,
  SUPPORTED_LANGUAGES,
  SupportedLanguage
} from './GoogleSpeechService';

export interface TranscriptionResult {
  text: string;
  confidence?: number;
  language?: string;
  aiPowered?: boolean;
}

export class VoiceProcessor {
  private googleSpeechService: GoogleSpeechService;
  private supportedFormats: string[] = [
    'audio/wav',
    'audio/wave',
    'audio/x-wav',
    'audio/mp3',
    'audio/mpeg',
    'audio/webm',
    'audio/ogg',
    'audio/flac',
    'audio/m4a',
    'audio/mp4'
  ];

  constructor() {
    this.googleSpeechService = getGoogleSpeechService();
  }

  /**
   * Check if the audio format is supported
   * @param mimeType - The MIME type of the audio file
   * @returns true if the format is supported
   */
  isSupportedFormat(mimeType: string): boolean {
    return this.supportedFormats.includes(mimeType.toLowerCase());
  }

  /**
   * Get list of supported audio formats
   * @returns Array of supported MIME types
   */
  getSupportedFormats(): string[] {
    return [...this.supportedFormats];
  }


  /**
   * Get list of supported languages for transcription
   * @returns Array of supported language codes
   */
  getSupportedLanguages(): string[] {
    return this.googleSpeechService.getSupportedLanguages();
  }

  /**
   * Check if Google Speech service is available
   * @returns true if the service is enabled and ready
   */
  isGoogleSpeechAvailable(): boolean {
    return this.googleSpeechService.isServiceEnabled();
  }

  /**
   * Transcribe audio to text
   * Uses Google Cloud Speech-to-Text when available, falls back to error message otherwise
   * 
   * @param audioBuffer - The audio data as a Buffer
   * @param mimeType - The MIME type of the audio
   * @param languageCode - Optional language code (defaults to 'en-IN')
   * @returns TranscriptionResult with the transcribed text
   */
  async transcribe(
    audioBuffer: Buffer, 
    mimeType: string,
    languageCode?: SupportedLanguage
  ): Promise<TranscriptionResult> {
    // Validate input
    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error('Empty audio buffer provided');
    }

    if (!this.isSupportedFormat(mimeType)) {
      throw new Error(
        `Unsupported audio format: ${mimeType}. Supported formats: ${this.supportedFormats.join(', ')}`
      );
    }

    // Validate audio buffer has meaningful content
    if (audioBuffer.length < 100) {
      throw new Error('Audio file too small - may be corrupted or empty');
    }

    // Try Google Speech Service first
    if (this.isGoogleSpeechAvailable()) {
      try {
        const result = await this.transcribeWithGoogle(audioBuffer, mimeType, languageCode);
        return {
          ...result,
          aiPowered: true,
        };
      } catch (error: any) {
        console.error('Google Speech transcription failed:', error.message);
        // Fall through to fallback response
        return this.getFallbackResponse(error.message);
      }
    }

    // Return fallback response when Google Speech is not available
    return this.getFallbackResponse('Voice transcription service not configured');
  }

  /**
   * Transcribe using Google Cloud Speech-to-Text
   * @param audioBuffer - The audio data
   * @param mimeType - The MIME type
   * @param languageCode - Optional language code
   * @returns TranscriptionResult from Google Speech
   */
  private async transcribeWithGoogle(
    audioBuffer: Buffer,
    mimeType: string,
    languageCode?: SupportedLanguage
  ): Promise<TranscriptionResult> {
    const response: GoogleTranscriptionResponse = await this.googleSpeechService.transcribe({
      audioBuffer,
      mimeType,
      languageCode: languageCode || SUPPORTED_LANGUAGES.ENGLISH_INDIA,
    });

    // Handle empty transcription
    if (!response.text || response.text.trim() === '') {
      return {
        text: '',
        confidence: 0,
        language: response.detectedLanguage,
        aiPowered: true,
      };
    }

    return {
      text: response.text,
      confidence: response.confidence,
      language: response.detectedLanguage,
      aiPowered: true,
    };
  }

  /**
   * Get fallback response when transcription service is unavailable
   * Requirement 8.2: Display error and suggest typing instead
   * 
   * @param reason - The reason for the fallback
   * @returns TranscriptionResult with error message
   */
  private getFallbackResponse(reason: string): TranscriptionResult {
    console.warn(`Voice transcription fallback: ${reason}`);
    
    return {
      text: '',
      confidence: 0,
      language: 'en-IN',
      aiPowered: false,
    };
  }
}
