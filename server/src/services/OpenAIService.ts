/**
 * OpenRouter Service (OpenAI-compatible)
 * Handles all OpenRouter API interactions for chat responses
 * Implements persona-based prompt customization and context-aware prompt building
 */

import OpenAI from 'openai'
import { APIKeyManager, getAPIKeyManager } from './APIKeyManager.js'
import { ContextContent } from './ContextManager.js'
import { RateLimiter } from './RateLimiter.js'
import { getEnv } from '../config/environment.js'

export type Persona = 'newbie' | 'student' | 'it-professional' | 'tourist'

export interface OpenAIRequest {
  query: string
  persona: Persona
  contextEnabled: boolean
  loadedContexts: ContextContent[]
}

export interface OpenAIResponse {
  response: string
  model: string
  tokensUsed: number
  contextsUsed?: string[]
}

export interface ImageInterpretationRequest {
  extractedText: string
  contexts: ContextContent[]
}

const PERSONA_INSTRUCTIONS: Record<Persona, string> = {
  'newbie': 'Use a friendly, reassuring tone with detailed explanations. The user is new to Bangalore and may not be familiar with local customs, places, or terminology. Be patient and thorough.',
  'student': 'Use a casual, practical tone. Focus on budget-friendly options and student-relevant information. Be relatable and mention affordable alternatives.',
  'it-professional': 'Be concise and efficient. Focus on time-saving tips and practical solutions. The user values their time, so get to the point quickly while being helpful.',
  'tourist': 'Be descriptive and culturally explanatory. Highlight must-see experiences and local specialties. Help them appreciate the unique aspects of Bangalore culture.'
}

// Using OpenRouter's model - gpt-4o-mini via OpenRouter
const MODEL = 'openai/gpt-4o-mini'

export class OpenAIService {
  private client: OpenAI | null = null
  private apiKeyManager: APIKeyManager
  private rateLimiter: RateLimiter
  private isAvailable: boolean = false

  constructor(apiKeyManager?: APIKeyManager) {
    this.apiKeyManager = apiKeyManager || getAPIKeyManager()
    this.rateLimiter = new RateLimiter({ maxRequests: 60, windowMs: 60000 }) // 60 requests per minute
    this.initialize()
  }

  private initialize(): void {
    const apiKey = this.apiKeyManager.getOpenRouterKey()
    const env = getEnv()
    
    if (apiKey) {
      this.client = new OpenAI({
        apiKey,
        baseURL: env.openrouterBaseUrl,
        defaultHeaders: {
          'HTTP-Referer': 'http://localhost:5000',
          'X-Title': 'Bangalore Survival Assistant'
        }
      })
      this.isAvailable = true
      console.log('✅ OpenRouter Service initialized')
    } else {
      console.warn('⚠️ OpenRouter Service: API key not available, service disabled')
      this.isAvailable = false
    }
  }


  /**
   * Check if the OpenAI service is available
   */
  isServiceAvailable(): boolean {
    return this.isAvailable && this.client !== null;
  }

  /**
   * Generate a response using OpenAI GPT-4o-mini
   */
  async generateResponse(request: OpenAIRequest): Promise<OpenAIResponse> {
    if (!this.isServiceAvailable()) {
      throw new OpenAIServiceError('OpenAI service is not available', 'SERVICE_UNAVAILABLE');
    }

    // Check rate limit
    if (!this.rateLimiter.isAllowed('openai-requests')) {
      throw new OpenAIServiceError('Rate limit exceeded. Please try again later.', 'RATE_LIMITED');
    }

    const systemPrompt = this.buildSystemPrompt(
      request.persona,
      request.contextEnabled,
      request.loadedContexts
    );
    const userPrompt = this.buildUserPrompt(request.query);

    try {
      const completion = await this.client!.chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 1000,
        temperature: 0.7,
      });

      const responseContent = completion.choices[0]?.message?.content || '';
      const tokensUsed = completion.usage?.total_tokens || 0;

      return {
        response: responseContent,
        model: MODEL,
        tokensUsed
      };
    } catch (error) {
      throw this.handleOpenAIError(error);
    }
  }

  /**
   * Build the system prompt based on persona and context
   */
  private buildSystemPrompt(
    persona: Persona,
    contextEnabled: boolean,
    contexts: ContextContent[]
  ): string {
    let prompt = `You are the Bangalore Survival Assistant, helping users navigate life in Bangalore, India. You are knowledgeable, friendly, and culturally aware.`;

    // Add persona-specific instructions
    prompt += `\n\n${PERSONA_INSTRUCTIONS[persona]}`;

    // Add context if enabled
    if (contextEnabled && contexts.length > 0) {
      const contextNames = contexts.map(ctx => `${ctx.domain}.md`).join(', ')
      prompt += `\n\nYou have access to local knowledge from the following context files: ${contextNames}. Use this information to provide Bangalore-specific advice.`
      prompt += '\n\nIMPORTANT: At the end of your response, add a line starting with "📚 Sources:" followed by the context files you referenced (e.g., "📚 Sources: food.md, slang.md"). Only list files you actually used in your response.'
      prompt += '\n\nUse the following local knowledge to inform your responses. Reference this information when relevant:\n';
      for (const ctx of contexts) {
        prompt += `\n--- ${ctx.domain.toUpperCase()} (${ctx.domain}.md) ---\n${ctx.content}\n`;
      }
    } else {
      prompt += '\n\nLocal Bangalore context is currently DISABLED. Provide general advice without Bangalore-specific details. Do NOT reference any local context files. Give helpful general information that would apply anywhere.';
    }

    prompt += '\n\nKeep responses helpful, accurate, and appropriately detailed for the user\'s persona.';

    return prompt;
  }

  /**
   * Build the user prompt
   */
  private buildUserPrompt(query: string): string {
    return query;
  }


  /**
   * Generate cultural interpretation for image text
   */
  async generateImageInterpretation(
    extractedText: string,
    contexts: ContextContent[]
  ): Promise<string> {
    if (!this.isServiceAvailable()) {
      throw new OpenAIServiceError('OpenAI service is not available', 'SERVICE_UNAVAILABLE');
    }

    if (!this.rateLimiter.isAllowed('openai-requests')) {
      throw new OpenAIServiceError('Rate limit exceeded. Please try again later.', 'RATE_LIMITED');
    }

    const systemPrompt = `You are the Bangalore Survival Assistant helping users understand local signage, menus, and notices in Bangalore, India.

Use the following local knowledge to provide cultural context:
${contexts.map(ctx => `--- ${ctx.domain.toUpperCase()} ---\n${ctx.content}`).join('\n\n')}

When interpreting text from images:
1. Explain what the text means literally
2. Provide cultural context and local significance
3. Give practical implications for the user`;

    const userPrompt = `Please interpret this text extracted from an image in Bangalore:\n\n"${extractedText}"\n\nProvide the local meaning, cultural significance, and any practical implications.`;

    try {
      const completion = await this.client!.chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 800,
        temperature: 0.7,
      });

      return completion.choices[0]?.message?.content || 'Unable to interpret the text.';
    } catch (error) {
      throw this.handleOpenAIError(error);
    }
  }

  /**
   * Handle OpenRouter API errors and convert to service errors
   */
  private handleOpenAIError(error: unknown): OpenAIServiceError {
    if (error instanceof OpenAI.APIError) {
      const status = error.status
      const message = error.message

      console.error(`OpenRouter API Error - Status: ${status}, Message: ${message}`)

      if (status === 429) {
        return new OpenAIServiceError('OpenRouter rate limit exceeded. Please try again later.', 'RATE_LIMITED')
      }
      if (status === 401) {
        return new OpenAIServiceError('Invalid OpenRouter API key.', 'UNAUTHORIZED')
      }
      if (status === 500 || status === 502 || status === 503) {
        return new OpenAIServiceError('OpenRouter service is temporarily unavailable.', 'SERVICE_ERROR')
      }

      return new OpenAIServiceError(`OpenRouter API error: ${message}`, 'API_ERROR')
    }

    if (error instanceof Error) {
      return new OpenAIServiceError(`OpenRouter request failed: ${error.message}`, 'REQUEST_FAILED')
    }

    return new OpenAIServiceError('An unexpected error occurred with OpenRouter.', 'UNKNOWN_ERROR')
  }
}

/**
 * Custom error class for OpenAI service errors
 */
export class OpenAIServiceError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'OpenAIServiceError';
    this.code = code;
  }
}

// Singleton instance
let openAIServiceInstance: OpenAIService | null = null;

export function getOpenAIService(): OpenAIService {
  if (!openAIServiceInstance) {
    openAIServiceInstance = new OpenAIService();
  }
  return openAIServiceInstance;
}

// Reset instance (useful for testing)
export function resetOpenAIService(): void {
  openAIServiceInstance = null;
}
