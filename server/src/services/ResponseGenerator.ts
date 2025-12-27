import { ContextManager, ContextContent } from './ContextManager.js'
import { LocationService, LocationCoordinates, FoodRecommendation } from './LocationService.js'
import { OpenAIService, getOpenAIService, OpenAIServiceError, Persona } from './OpenAIService.js'

export type { Persona } from './OpenAIService.js'

interface QueryRequest {
  query: string
  persona: Persona
  bangaloreContextEnabled: boolean
  loadedContexts: string[]
  location?: LocationCoordinates
}

interface QueryResponse {
  response: string
  contextUsed: string[]
  contextFilesUsed: string[]
  persona: Persona
  bangaloreContextActive: boolean
  aiPowered: boolean
  locationRecommendations?: FoodRecommendation[]
}

export class ResponseGenerator {
  private contextManager: ContextManager
  private locationService: LocationService
  private openAIService: OpenAIService

  constructor(contextManager: ContextManager, openAIService?: OpenAIService) {
    this.contextManager = contextManager
    this.locationService = new LocationService(contextManager)
    this.openAIService = openAIService || getOpenAIService()
  }

  async generateResponse(request: QueryRequest): Promise<QueryResponse> {
    const { query, persona, bangaloreContextEnabled, loadedContexts, location } = request

    // Load contexts if not already loaded
    const contextContents: ContextContent[] = []
    for (const contextId of loadedContexts) {
      if (!this.contextManager.isContextLoaded(contextId)) {
        await this.contextManager.loadContext(contextId)
      }
      const content = this.contextManager.getContextForDomain(contextId)
      if (content) {
        contextContents.push(content)
      }
    }


    // Get location-based recommendations if location is provided and it's a food query
    let locationRecommendations: FoodRecommendation[] | undefined
    if (location && this.isFoodQuery(query.toLowerCase())) {
      locationRecommendations = await this.locationService.getRecommendations(location, { persona })
    }

    // Try OpenAI first if available
    if (this.openAIService.isServiceAvailable()) {
      try {
        const aiResponse = await this.openAIService.generateResponse({
          query,
          persona,
          contextEnabled: bangaloreContextEnabled,
          loadedContexts: contextContents
        })

        // Extract context files used from the response (if mentioned in "📚 Sources:" line)
        const contextFilesUsed = bangaloreContextEnabled
          ? this.extractContextFilesFromResponse(aiResponse.response, loadedContexts)
          : []

        return {
          response: aiResponse.response,
          contextUsed: bangaloreContextEnabled ? loadedContexts : [],
          contextFilesUsed,
          persona,
          bangaloreContextActive: bangaloreContextEnabled,
          aiPowered: true,
          locationRecommendations
        }
      } catch (error) {
        // Log the error and fall back to context-based response
        console.error('OpenAI request failed, falling back to context-based response:', error)
        return this.generateFallbackResponse(query, persona, bangaloreContextEnabled, loadedContexts, locationRecommendations)
      }
    }

    // OpenAI not available, use fallback
    return this.generateFallbackResponse(query, persona, bangaloreContextEnabled, loadedContexts, locationRecommendations)
  }

  /**
   * Extract context files mentioned in the AI response
   */
  private extractContextFilesFromResponse(response: string, loadedContexts: string[]): string[] {
    const sourcesMatch = response.match(/📚 Sources?:\s*(.+)/i)
    if (sourcesMatch) {
      const sourcesText = sourcesMatch[1].toLowerCase()
      return loadedContexts.filter(ctx =>
        sourcesText.includes(ctx) || sourcesText.includes(`${ctx}.md`)
      ).map(ctx => `${ctx}.md`)
    }
    // If no explicit sources, return all loaded contexts as potentially used
    return loadedContexts.map(ctx => `${ctx}.md`)
  }

  /**
   * Generate a fallback response using context files when OpenAI is unavailable
   */
  private generateFallbackResponse(
    query: string,
    persona: Persona,
    bangaloreContextEnabled: boolean,
    loadedContexts: string[],
    locationRecommendations?: FoodRecommendation[]
  ): QueryResponse {
    // If context is disabled, return generic response
    if (!bangaloreContextEnabled) {
      return {
        response: this.generateGenericResponse(query, persona),
        contextUsed: [],
        contextFilesUsed: [],
        persona,
        bangaloreContextActive: false,
        aiPowered: false
      }
    }

    // Search for relevant content
    const relevantContent = this.contextManager.searchInContexts(query, loadedContexts)

    // Generate context-aware response
    const response = this.generateContextAwareResponse(query, persona, relevantContent, locationRecommendations)

    // Determine which context files were actually used
    const contextFilesUsed = this.determineUsedContextFiles(relevantContent, loadedContexts)

    return {
      response,
      contextUsed: loadedContexts,
      contextFilesUsed,
      persona,
      bangaloreContextActive: true,
      aiPowered: false,
      locationRecommendations
    }
  }

  /**
   * Determine which context files were used based on relevant content
   */
  private determineUsedContextFiles(relevantContent: string[], loadedContexts: string[]): string[] {
    const usedFiles: Set<string> = new Set()
    for (const content of relevantContent) {
      const match = content.match(/^\[(\w+)\//)
      if (match) {
        usedFiles.add(`${match[1]}.md`)
      }
    }
    // If no specific files found, return all loaded as potentially used
    return usedFiles.size > 0
      ? Array.from(usedFiles)
      : loadedContexts.map(ctx => `${ctx}.md`)
  }


  private generateGenericResponse(query: string, persona: Persona): string {
    const prefix = this.getPersonaPrefix(persona)
    return `${prefix}I can provide general information, but for Bangalore-specific advice, please enable the local context. Your question: "${query}"`
  }

  private generateContextAwareResponse(
    query: string, 
    persona: Persona, 
    relevantContent: string[],
    locationRecommendations?: FoodRecommendation[]
  ): string {
    const prefix = this.getPersonaPrefix(persona)
    const queryLower = query.toLowerCase()

    // Detect query intent
    if (this.isSlangQuery(queryLower)) {
      return this.handleSlangQuery(query, persona, relevantContent)
    }
    if (this.isFoodQuery(queryLower)) {
      return this.handleFoodQuery(query, persona, relevantContent, locationRecommendations)
    }
    if (this.isTrafficQuery(queryLower)) {
      return this.handleTrafficQuery(query, persona, relevantContent)
    }
    if (this.isEtiquetteQuery(queryLower)) {
      return this.handleEtiquetteQuery(query, persona, relevantContent)
    }

    // Default response with context
    if (relevantContent.length > 0) {
      return `${prefix}Based on local knowledge:\n\n${relevantContent[0]}`
    }

    return `${prefix}I'd be happy to help with questions about Bangalore! Try asking about local slang, food recommendations, traffic tips, or cultural etiquette.`
  }

  private getPersonaPrefix(persona: Persona): string {
    switch (persona) {
      case 'newbie':
        return "Welcome to Bangalore! 🌱 Here's what you need to know: "
      case 'student':
        return "Hey! Quick tip: "
      case 'it-professional':
        return "Here's the info: "
      case 'tourist':
        return "Great question! As a visitor, you'll find this helpful: "
      default:
        return ""
    }
  }

  private isSlangQuery(query: string): boolean {
    return /slang|meaning|what does|kannada|phrase|say|speak/.test(query)
  }

  private isFoodQuery(query: string): boolean {
    return /food|eat|restaurant|dosa|coffee|hungry|lunch|dinner|breakfast/.test(query)
  }

  private isTrafficQuery(query: string): boolean {
    return /traffic|commute|metro|bus|auto|uber|ola|travel|route|reach/.test(query)
  }

  private isEtiquetteQuery(query: string): boolean {
    return /etiquette|culture|custom|behave|tip|greeting|temple|office/.test(query)
  }


  private handleSlangQuery(query: string, persona: Persona, content: string[]): string {
    const prefix = this.getPersonaPrefix(persona)
    const slangContent = content.find(c => c.includes('[slang'))
    if (slangContent) {
      return `${prefix}${slangContent.replace(/\[slang\/[^\]]+\]:\s*/, '')}`
    }
    return `${prefix}Common Bangalore phrases: "Swalpa adjust maadi" (please adjust), "Guru" (buddy), "Sakkath" (awesome). What specific phrase would you like to know about?`
  }

  private handleFoodQuery(query: string, persona: Persona, content: string[], locationRecommendations?: FoodRecommendation[]): string {
    const prefix = this.getPersonaPrefix(persona)
    
    // If we have location-based recommendations, include them
    if (locationRecommendations && locationRecommendations.length > 0) {
      const recommendations = locationRecommendations
        .map(r => `• ${r.suggestion}: ${r.reasoning}`)
        .join('\n')
      return `${prefix}Based on your location, here are some recommendations:\n\n${recommendations}`
    }
    
    const foodContent = content.find(c => c.includes('[food'))
    if (foodContent) {
      return `${prefix}${foodContent.replace(/\[food\/[^\]]+\]:\s*/, '')}`
    }
    return `${prefix}Must-try in Bangalore: Masala Dosa, Filter Coffee, Bisi Bele Bath. For quick eats, try a Darshini (standing restaurant). VV Puram Food Street is great for street food!`
  }

  private handleTrafficQuery(query: string, persona: Persona, content: string[]): string {
    const prefix = this.getPersonaPrefix(persona)
    const trafficContent = content.find(c => c.includes('[traffic'))
    if (trafficContent) {
      return `${prefix}${trafficContent.replace(/\[traffic\/[^\]]+\]:\s*/, '')}`
    }
    return `${prefix}Bangalore traffic tip: Avoid Silk Board junction during peak hours (8-10 AM, 5-8 PM). Metro is your best friend for covered routes. For autos, always negotiate or ask "Meter hakri" (put the meter).`
  }

  private handleEtiquetteQuery(query: string, persona: Persona, content: string[]): string {
    const prefix = this.getPersonaPrefix(persona)
    const etiquetteContent = content.find(c => c.includes('[etiquette'))
    if (etiquetteContent) {
      return `${prefix}${etiquetteContent.replace(/\[etiquette\/[^\]]+\]:\s*/, '')}`
    }
    return `${prefix}Key etiquette: Use "Anna/Akka" (brother/sister) for strangers, remove shoes at temples and homes, "Adjust maadi" is the local motto. Bangalore is friendly - a smile goes a long way!`
  }
}
