/**
 * Image Processor Service
 * Handles image processing with OCR and cultural interpretation
 * Uses Google Vision for OCR and OpenAI for cultural interpretation
 * Falls back to Tesseract.js and context-based interpretation when APIs unavailable
 * 
 * Requirements: 4.4, 4.5, 8.3 - Image interpretation with error handling and fallback
 */

import Tesseract from 'tesseract.js';
import { ContextContent } from './ContextManager.js';
import { 
  GoogleVisionService, 
  getGoogleVisionService, 
  GoogleVisionServiceError,
  VisionResponse 
} from './GoogleVisionService.js';
import { 
  OpenAIService, 
  getOpenAIService, 
  OpenAIServiceError 
} from './OpenAIService.js';

export interface ImageInterpretation {
  extractedText: string;
  translatedText?: string;
  detectedLanguage?: string;
  localMeaning: string;
  culturalSignificance: string;
  associatedBehavior: string;
  practicalImplications: string;
  aiPowered: boolean;
}

export interface ProcessImageRequest {
  imageBuffer: Buffer;
  contexts: ContextContent[];
  useAI?: boolean; // Whether to use AI services (default: true)
}

export class ImageProcessor {
  private visionService: GoogleVisionService;
  private openAIService: OpenAIService;

  constructor() {
    this.visionService = getGoogleVisionService();
    this.openAIService = getOpenAIService();
  }

  /**
   * Process an image: extract text, translate if needed, and provide interpretation
   * Uses Google Vision + OpenAI when available, falls back to Tesseract + context-based
   * @param request - The image processing request
   * @returns Full interpretation with extracted text and cultural context
   */
  async processImage(request: ProcessImageRequest): Promise<ImageInterpretation> {
    const { imageBuffer, contexts, useAI = true } = request;

    // Try Google Vision first if enabled
    let visionResult: VisionResponse | null = null;
    let extractedText = '';
    let translatedText: string | undefined;
    let detectedLanguage: string | undefined;
    let usedGoogleVision = false;

    if (useAI && this.visionService.isServiceEnabled()) {
      try {
        visionResult = await this.visionService.extractAndTranslate({ imageBuffer });
        extractedText = visionResult.extractedText;
        translatedText = visionResult.translatedText;
        detectedLanguage = visionResult.detectedLanguage;
        usedGoogleVision = true;
      } catch (error) {
        console.warn('Google Vision failed, falling back to Tesseract:', error);
        // Fall through to Tesseract fallback
      }
    }

    // Fallback to Tesseract if Google Vision not available or failed
    if (!usedGoogleVision) {
      try {
        extractedText = await this.extractTextWithTesseract(imageBuffer);
      } catch (error) {
        console.error('Tesseract OCR failed:', error);
        throw new ImageProcessorError(
          'Failed to extract text from image. Please try a clearer image.',
          'OCR_FAILED'
        );
      }
    }


    // If no text extracted, return early
    if (!extractedText || extractedText.trim().length === 0) {
      return {
        extractedText: '',
        localMeaning: 'No text could be extracted from the image.',
        culturalSignificance: 'Unable to determine cultural significance without text.',
        associatedBehavior: 'No specific behavior guidance available.',
        practicalImplications: 'Try uploading a clearer image with visible text.',
        aiPowered: false,
      };
    }

    // Use the translated text for interpretation if available
    const textForInterpretation = translatedText || extractedText;

    // Try OpenAI for cultural interpretation if enabled
    if (useAI && this.openAIService.isServiceAvailable() && contexts.length > 0) {
      try {
        const aiInterpretation = await this.openAIService.generateImageInterpretation(
          textForInterpretation,
          contexts
        );

        // Parse AI response into structured format
        const parsed = this.parseAIInterpretation(aiInterpretation, textForInterpretation);

        return {
          extractedText,
          translatedText,
          detectedLanguage,
          ...parsed,
          aiPowered: true,
        };
      } catch (error) {
        console.warn('OpenAI interpretation failed, falling back to context-based:', error);
        // Fall through to context-based interpretation
      }
    }

    // Fallback to context-based interpretation
    const contextInterpretation = await this.interpretWithContext(textForInterpretation, contexts);

    return {
      extractedText,
      translatedText,
      detectedLanguage,
      ...contextInterpretation,
      aiPowered: false,
    };
  }

  /**
   * Extract text from an image using Tesseract.js (fallback OCR)
   * @param imageBuffer - The image data as a Buffer
   * @returns The extracted text from the image
   */
  private async extractTextWithTesseract(imageBuffer: Buffer): Promise<string> {
    try {
      const result = await Tesseract.recognize(imageBuffer, 'eng+kan', {
        logger: () => {} // Suppress progress logs
      });
      return result.data.text.trim();
    } catch (error) {
      console.error('Tesseract OCR extraction failed:', error);
      throw new Error('Failed to extract text from image');
    }
  }

  /**
   * Parse AI interpretation response into structured format
   */
  private parseAIInterpretation(
    aiResponse: string,
    extractedText: string
  ): Omit<ImageInterpretation, 'extractedText' | 'translatedText' | 'detectedLanguage' | 'aiPowered'> {
    // AI response is typically a flowing text, we'll structure it
    // Look for common patterns in the response
    const response = aiResponse.trim();

    // Try to extract sections if they exist
    const localMeaningMatch = response.match(/(?:literal|meaning|says?|reads?)[:\s]*([^.]+\.)/i);
    const culturalMatch = response.match(/(?:cultural|significance|context)[:\s]*([^.]+\.)/i);
    const practicalMatch = response.match(/(?:practical|implication|should|recommend)[:\s]*([^.]+\.)/i);

    return {
      localMeaning: localMeaningMatch?.[1]?.trim() || response.split('.')[0] + '.',
      culturalSignificance: culturalMatch?.[1]?.trim() || this.extractSection(response, 'cultural'),
      associatedBehavior: this.extractSection(response, 'behavior'),
      practicalImplications: practicalMatch?.[1]?.trim() || this.extractSection(response, 'practical'),
    };
  }

  /**
   * Extract a section from AI response based on keywords
   */
  private extractSection(response: string, type: 'cultural' | 'behavior' | 'practical'): string {
    const sentences = response.split(/[.!?]+/).filter(s => s.trim());
    
    const keywords: Record<string, string[]> = {
      cultural: ['culture', 'tradition', 'local', 'bangalore', 'india', 'custom', 'significance'],
      behavior: ['should', 'expect', 'typical', 'common', 'usually', 'often', 'behavior'],
      practical: ['tip', 'recommend', 'suggest', 'practical', 'advice', 'note', 'remember'],
    };

    const relevantSentences = sentences.filter(sentence => 
      keywords[type].some(keyword => sentence.toLowerCase().includes(keyword))
    );

    if (relevantSentences.length > 0) {
      return relevantSentences.slice(0, 2).join('. ').trim() + '.';
    }

    // Default messages if no relevant content found
    const defaults: Record<string, string> = {
      cultural: 'This appears to be a local sign or notice in Bangalore.',
      behavior: 'Follow standard local etiquette when encountering such signs.',
      practical: 'When in doubt, ask a local for clarification.',
    };

    return defaults[type];
  }


  /**
   * Interpret image text using context files (fallback when AI unavailable)
   */
  private async interpretWithContext(
    extractedText: string,
    contexts: ContextContent[]
  ): Promise<Omit<ImageInterpretation, 'extractedText' | 'translatedText' | 'detectedLanguage' | 'aiPowered'>> {
    // If no contexts are loaded, return basic interpretation
    if (contexts.length === 0) {
      return {
        localMeaning: extractedText,
        culturalSignificance: 'Context files not loaded - unable to provide cultural interpretation',
        associatedBehavior: 'Context files not loaded - unable to provide behavior guidance',
        practicalImplications: 'Context files not loaded - unable to provide practical implications'
      };
    }

    // Search for relevant context based on extracted text
    const localMeaning = this.findLocalMeaning(extractedText, contexts);
    const culturalSignificance = this.findCulturalSignificance(extractedText, contexts);
    const associatedBehavior = this.findAssociatedBehavior(extractedText, contexts);
    const practicalImplications = this.findPracticalImplications(extractedText, contexts);

    return {
      localMeaning,
      culturalSignificance,
      associatedBehavior,
      practicalImplications
    };
  }

  /**
   * Find local meaning beyond literal translation
   */
  private findLocalMeaning(text: string, contexts: ContextContent[]): string {
    const textLower = text.toLowerCase();
    const meanings: string[] = [];

    // Check slang context for local phrases
    const slangContext = contexts.find(c => c.domain === 'slang');
    if (slangContext) {
      const slangMatch = this.searchInContent(textLower, slangContext.content);
      if (slangMatch) {
        meanings.push(`Local phrase meaning: ${slangMatch}`);
      }
    }

    // Check city context for location-specific terms
    const cityContext = contexts.find(c => c.domain === 'city');
    if (cityContext) {
      const cityMatch = this.searchInContent(textLower, cityContext.content);
      if (cityMatch) {
        meanings.push(`Local context: ${cityMatch}`);
      }
    }

    // Check food context for menu items
    const foodContext = contexts.find(c => c.domain === 'food');
    if (foodContext) {
      const foodMatch = this.searchInContent(textLower, foodContext.content);
      if (foodMatch) {
        meanings.push(`Food reference: ${foodMatch}`);
      }
    }

    if (meanings.length === 0) {
      return `The text "${text}" appears to be a local sign or notice. Without specific context matches, the literal meaning applies.`;
    }

    return meanings.join('\n');
  }

  /**
   * Find cultural significance of the text
   */
  private findCulturalSignificance(text: string, contexts: ContextContent[]): string {
    const textLower = text.toLowerCase();
    const significances: string[] = [];

    // Check etiquette context for cultural norms
    const etiquetteContext = contexts.find(c => c.domain === 'etiquette');
    if (etiquetteContext) {
      const etiquetteMatch = this.searchInContent(textLower, etiquetteContext.content);
      if (etiquetteMatch) {
        significances.push(etiquetteMatch);
      }
    }

    // Check city context for cultural references
    const cityContext = contexts.find(c => c.domain === 'city');
    if (cityContext) {
      // Look for cultural keywords
      const culturalKeywords = ['temple', 'festival', 'tradition', 'custom', 'religious', 'sacred'];
      for (const keyword of culturalKeywords) {
        if (textLower.includes(keyword)) {
          const match = this.searchInContent(keyword, cityContext.content);
          if (match) {
            significances.push(match);
          }
        }
      }
    }

    if (significances.length === 0) {
      return 'This appears to be a general notice without specific cultural significance in the local context.';
    }

    return significances.join('\n');
  }

  /**
   * Find associated behavior guidance
   */
  private findAssociatedBehavior(text: string, contexts: ContextContent[]): string {
    const textLower = text.toLowerCase();
    const behaviors: string[] = [];

    // Check etiquette context for behavior guidance
    const etiquetteContext = contexts.find(c => c.domain === 'etiquette');
    if (etiquetteContext) {
      const behaviorKeywords = ['remove', 'shoes', 'dress', 'code', 'silence', 'queue', 'line', 'wait', 'no', 'prohibited', 'allowed', 'entry'];
      for (const keyword of behaviorKeywords) {
        if (textLower.includes(keyword)) {
          const match = this.searchInContent(keyword, etiquetteContext.content);
          if (match) {
            behaviors.push(match);
          }
        }
      }
    }

    // Check traffic context for transport-related signs
    const trafficContext = contexts.find(c => c.domain === 'traffic');
    if (trafficContext) {
      const trafficKeywords = ['auto', 'taxi', 'bus', 'metro', 'parking', 'stop', 'stand', 'fare', 'meter'];
      for (const keyword of trafficKeywords) {
        if (textLower.includes(keyword)) {
          const match = this.searchInContent(keyword, trafficContext.content);
          if (match) {
            behaviors.push(match);
          }
        }
      }
    }

    if (behaviors.length === 0) {
      return 'Follow standard local etiquette. When in doubt, observe what locals do or ask politely.';
    }

    return behaviors.join('\n');
  }


  /**
   * Find practical implications for newcomers
   */
  private findPracticalImplications(text: string, contexts: ContextContent[]): string {
    const textLower = text.toLowerCase();
    const implications: string[] = [];

    // Detect common sign types and provide practical advice
    if (this.isMenuOrFoodSign(textLower)) {
      const foodContext = contexts.find(c => c.domain === 'food');
      if (foodContext) {
        implications.push('This appears to be a food-related sign.');
        const foodMatch = this.searchInContent(textLower, foodContext.content);
        if (foodMatch) {
          implications.push(`Tip: ${foodMatch}`);
        }
      }
    }

    if (this.isTransportSign(textLower)) {
      const trafficContext = contexts.find(c => c.domain === 'traffic');
      if (trafficContext) {
        implications.push('This appears to be a transport-related sign.');
        const trafficMatch = this.searchInContent(textLower, trafficContext.content);
        if (trafficMatch) {
          implications.push(`Tip: ${trafficMatch}`);
        }
      }
    }

    if (this.isPriceOrRateSign(textLower)) {
      implications.push('This shows pricing information. Prices in India are typically in Rupees (₹).');
      implications.push('Tip: Always confirm the final price before purchasing or using a service.');
    }

    if (implications.length === 0) {
      return 'As a newcomer, if you\'re unsure about what this sign means, don\'t hesitate to ask a local. Most people are happy to help explain.';
    }

    return implications.join('\n');
  }

  /**
   * Search for relevant content in a context file
   */
  private searchInContent(query: string, content: string): string | null {
    const lines = content.split('\n');
    const queryLower = query.toLowerCase();

    // Find lines containing the query
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      if (line.includes(queryLower)) {
        // Return the line and some surrounding context
        const start = Math.max(0, i - 1);
        const end = Math.min(lines.length, i + 3);
        const contextLines = lines.slice(start, end)
          .filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('|---'))
          .join(' ')
          .trim();
        
        if (contextLines.length > 0) {
          // Truncate if too long
          return contextLines.length > 300 
            ? contextLines.substring(0, 300) + '...'
            : contextLines;
        }
      }
    }

    return null;
  }

  /**
   * Check if text appears to be from a menu or food sign
   */
  private isMenuOrFoodSign(text: string): boolean {
    const foodKeywords = ['dosa', 'idli', 'coffee', 'tea', 'chai', 'biryani', 'rice', 'roti', 
      'menu', 'price', 'rs', '₹', 'veg', 'non-veg', 'meals', 'tiffin', 'restaurant', 'hotel',
      'darshini', 'udupi', 'thali', 'sambar', 'chutney'];
    return foodKeywords.some(keyword => text.includes(keyword));
  }

  /**
   * Check if text appears to be from a transport sign
   */
  private isTransportSign(text: string): boolean {
    const transportKeywords = ['auto', 'taxi', 'cab', 'bus', 'metro', 'station', 'stop',
      'fare', 'meter', 'ola', 'uber', 'bmtc', 'ksrtc', 'platform', 'route', 'parking'];
    return transportKeywords.some(keyword => text.includes(keyword));
  }

  /**
   * Check if text appears to show prices or rates
   */
  private isPriceOrRateSign(text: string): boolean {
    const pricePatterns = ['rs', '₹', 'rupee', 'price', 'rate', 'fare', 'charge', 'cost', 'fee'];
    return pricePatterns.some(pattern => text.includes(pattern));
  }

  // Legacy method for backward compatibility
  /**
   * Extract text from an image using OCR (Tesseract.js)
   * @deprecated Use processImage() instead for full functionality
   * @param imageBuffer - The image data as a Buffer
   * @returns The extracted text from the image
   */
  async extractText(imageBuffer: Buffer): Promise<string> {
    // Try Google Vision first
    if (this.visionService.isServiceEnabled()) {
      try {
        const result = await this.visionService.extractAndTranslate({ imageBuffer });
        return result.translatedText || result.extractedText;
      } catch (error) {
        console.warn('Google Vision failed, falling back to Tesseract:', error);
      }
    }

    // Fallback to Tesseract
    return this.extractTextWithTesseract(imageBuffer);
  }

  // Legacy method for backward compatibility
  /**
   * Interpret an image by providing local meaning with context
   * @deprecated Use processImage() instead for full functionality
   * @param extractedText - The text extracted from the image
   * @param contexts - Array of loaded context files
   * @returns Full interpretation with local meaning
   */
  async interpretImage(
    extractedText: string,
    contexts: ContextContent[]
  ): Promise<ImageInterpretation> {
    return this.processImage({
      imageBuffer: Buffer.from(''), // Empty buffer since we already have text
      contexts,
      useAI: false, // Use context-based interpretation for legacy method
    }).then(result => ({
      ...result,
      extractedText, // Use the provided text
    }));
  }
}

/**
 * Custom error class for Image Processor errors
 */
export class ImageProcessorError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'ImageProcessorError';
    this.code = code;
  }
}

// Singleton instance
let imageProcessorInstance: ImageProcessor | null = null;

export function getImageProcessor(): ImageProcessor {
  if (!imageProcessorInstance) {
    imageProcessorInstance = new ImageProcessor();
  }
  return imageProcessorInstance;
}

// Reset instance (useful for testing)
export function resetImageProcessor(): void {
  imageProcessorInstance = null;
}
