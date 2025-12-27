/**
 * Google Vision Service
 * Handles image OCR, language detection, and translation using Google Cloud APIs
 * 
 * Requirements: 4.1, 4.2, 4.3 - Image text extraction, language detection, translation
 */

import vision from '@google-cloud/vision';
import { TranslationServiceClient } from '@google-cloud/translate';
import { getAPIKeyManager } from './APIKeyManager.js';

export interface VisionRequest {
  imageBuffer: Buffer;
}

export interface VisionResponse {
  extractedText: string;
  detectedLanguage: string;
  translatedText?: string; // If non-English
  confidence: number;
}

// Language codes for common Indian languages
export const SUPPORTED_LANGUAGES = {
  ENGLISH: 'en',
  KANNADA: 'kn',
  HINDI: 'hi',
  TAMIL: 'ta',
  TELUGU: 'te',
} as const;

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[keyof typeof SUPPORTED_LANGUAGES];

export class GoogleVisionService {
  private visionClient: vision.ImageAnnotatorClient | null = null;
  private translateClient: TranslationServiceClient | null = null;
  private isEnabled: boolean = false;
  private projectId: string = '';

  constructor() {
    this.initializeClients();
  }

  /**
   * Initialize Google Cloud Vision and Translation clients
   * Uses GOOGLE_APPLICATION_CREDENTIALS env var or gcp-key.json file
   */
  private initializeClients(): void {
    const apiKeyManager = getAPIKeyManager();
    
    if (!apiKeyManager.isFeatureEnabled('vision')) {
      console.warn('⚠️  Google Vision Service disabled - API key not configured');
      this.isEnabled = false;
      return;
    }

    try {
      const keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS || 'gcp-key.json';
      
      // Initialize Vision client
      this.visionClient = new vision.ImageAnnotatorClient({
        keyFilename,
      });

      // Initialize Translation client
      this.translateClient = new TranslationServiceClient({
        keyFilename,
      });

      // Get project ID from environment or key file
      this.projectId = process.env.GOOGLE_CLOUD_PROJECT || 'bangalore-assistant';

      this.isEnabled = true;
      console.log('✅ Google Vision Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Google Vision Service:', error);
      this.isEnabled = false;
    }
  }


  /**
   * Check if the service is enabled and ready to use
   */
  isServiceEnabled(): boolean {
    return this.isEnabled && this.visionClient !== null;
  }

  /**
   * Extract text from an image using Google Cloud Vision OCR
   * @param imageBuffer - The image data as a Buffer
   * @returns The extracted text from the image
   */
  private async detectText(imageBuffer: Buffer): Promise<{ text: string; confidence: number }> {
    if (!this.visionClient) {
      throw new Error('Vision client not initialized');
    }

    try {
      const [result] = await this.visionClient.textDetection({
        image: { content: imageBuffer.toString('base64') },
      });

      const detections = result.textAnnotations;
      
      if (!detections || detections.length === 0) {
        return { text: '', confidence: 0 };
      }

      // First annotation contains the full text
      const fullText = detections[0].description || '';
      
      // Calculate average confidence from individual word detections
      const confidences = detections
        .slice(1) // Skip first (full text) annotation
        .map(d => d.confidence || 0)
        .filter(c => c > 0);
      
      const avgConfidence = confidences.length > 0
        ? confidences.reduce((a, b) => a + b, 0) / confidences.length
        : 0.8; // Default confidence if not provided

      return {
        text: fullText.trim(),
        confidence: avgConfidence,
      };
    } catch (error: any) {
      console.error('Google Vision text detection error:', error);
      throw new Error(`Failed to extract text from image: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Detect the language of the given text
   * @param text - The text to analyze
   * @returns The detected language code
   */
  private async detectLanguage(text: string): Promise<string> {
    if (!this.translateClient) {
      throw new Error('Translation client not initialized');
    }

    if (!text || text.trim().length === 0) {
      return SUPPORTED_LANGUAGES.ENGLISH;
    }

    try {
      const [response] = await this.translateClient.detectLanguage({
        parent: `projects/${this.projectId}/locations/global`,
        content: text,
      });

      const languages = response.languages;
      if (!languages || languages.length === 0) {
        return SUPPORTED_LANGUAGES.ENGLISH;
      }

      // Return the most confident language detection
      const detected = languages[0];
      return detected.languageCode || SUPPORTED_LANGUAGES.ENGLISH;
    } catch (error: any) {
      console.error('Language detection error:', error);
      // Default to English if detection fails
      return SUPPORTED_LANGUAGES.ENGLISH;
    }
  }

  /**
   * Translate text to English
   * @param text - The text to translate
   * @param sourceLanguage - The source language code
   * @returns The translated text
   */
  private async translateToEnglish(text: string, sourceLanguage: string): Promise<string> {
    if (!this.translateClient) {
      throw new Error('Translation client not initialized');
    }

    if (!text || text.trim().length === 0) {
      return text;
    }

    // Don't translate if already English
    if (sourceLanguage === SUPPORTED_LANGUAGES.ENGLISH || sourceLanguage === 'en') {
      return text;
    }

    try {
      const [response] = await this.translateClient.translateText({
        parent: `projects/${this.projectId}/locations/global`,
        contents: [text],
        sourceLanguageCode: sourceLanguage,
        targetLanguageCode: SUPPORTED_LANGUAGES.ENGLISH,
      });

      const translations = response.translations;
      if (!translations || translations.length === 0) {
        return text;
      }

      return translations[0].translatedText || text;
    } catch (error: any) {
      console.error('Translation error:', error);
      // Return original text if translation fails
      return text;
    }
  }


  /**
   * Extract text from image, detect language, and translate if non-English
   * Main public method combining OCR, language detection, and translation
   * @param request - The vision request containing the image buffer
   * @returns VisionResponse with extracted text, language, and optional translation
   */
  async extractAndTranslate(request: VisionRequest): Promise<VisionResponse> {
    if (!this.isServiceEnabled()) {
      throw new GoogleVisionServiceError(
        'Google Vision Service is not enabled. Please configure GOOGLE_CLOUD_API_KEY.',
        'SERVICE_UNAVAILABLE'
      );
    }

    if (!request.imageBuffer || request.imageBuffer.length === 0) {
      throw new GoogleVisionServiceError('Empty image buffer provided', 'INVALID_INPUT');
    }

    try {
      // Step 1: Extract text using OCR
      const { text: extractedText, confidence } = await this.detectText(request.imageBuffer);

      if (!extractedText || extractedText.trim().length === 0) {
        return {
          extractedText: '',
          detectedLanguage: SUPPORTED_LANGUAGES.ENGLISH,
          confidence: 0,
        };
      }

      // Step 2: Detect language
      const detectedLanguage = await this.detectLanguage(extractedText);

      // Step 3: Translate if non-English
      let translatedText: string | undefined;
      if (detectedLanguage !== SUPPORTED_LANGUAGES.ENGLISH && detectedLanguage !== 'en') {
        translatedText = await this.translateToEnglish(extractedText, detectedLanguage);
      }

      return {
        extractedText,
        detectedLanguage,
        translatedText,
        confidence,
      };
    } catch (error: any) {
      if (error instanceof GoogleVisionServiceError) {
        throw error;
      }
      
      console.error('Google Vision extractAndTranslate error:', error);
      throw new GoogleVisionServiceError(
        `Failed to process image: ${error.message || 'Unknown error'}`,
        'PROCESSING_ERROR'
      );
    }
  }

  /**
   * Get the list of supported languages for translation
   */
  getSupportedLanguages(): string[] {
    return Object.values(SUPPORTED_LANGUAGES);
  }
}

/**
 * Custom error class for Google Vision service errors
 */
export class GoogleVisionServiceError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'GoogleVisionServiceError';
    this.code = code;
  }
}

// Singleton instance
let googleVisionServiceInstance: GoogleVisionService | null = null;

export function getGoogleVisionService(): GoogleVisionService {
  if (!googleVisionServiceInstance) {
    googleVisionServiceInstance = new GoogleVisionService();
  }
  return googleVisionServiceInstance;
}

// Reset instance (useful for testing)
export function resetGoogleVisionService(): void {
  googleVisionServiceInstance = null;
}
