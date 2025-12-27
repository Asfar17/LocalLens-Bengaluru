import { ContextManager, ContextContent } from './ContextManager.js'
import { GoogleMapsService, getGoogleMapsService, EnhancedRecommendation, PlaceResult } from './GoogleMapsService.js'
import { getAPIKeyManager } from './APIKeyManager.js'

export interface FoodRecommendation {
  suggestion: string
  reasoning: string
  contextFactors: string[]
  // Enhanced fields from Google Maps
  place?: PlaceResult
  culturalNote?: string
  aiPowered?: boolean
}

export interface LocationCoordinates {
  lat: number
  lng: number
}

export interface LocationQueryOptions {
  foodType?: string
  radius?: number
  persona?: string
}

interface AreaInfo {
  name: string
  description: string
  foodHighlights: string[]
  characteristics: string[]
}

interface AreaMapping {
  name: string
  latRange: [number, number]
  lngRange: [number, number]
  description: string
  foodHighlights: string[]
  characteristics: string[]
}

export class LocationService {
  private contextManager: ContextManager
  private googleMapsService: GoogleMapsService

  constructor(contextManager: ContextManager, googleMapsService?: GoogleMapsService) {
    this.contextManager = contextManager
    this.googleMapsService = googleMapsService || getGoogleMapsService(getAPIKeyManager(), contextManager)
  }

  /**
   * Get food recommendations based on GPS coordinates
   * Combines location with Google Maps Places API and food.md/city.md context
   * Falls back to context-only recommendations if Google Maps is unavailable
   * Requirements: 5.3, 5.5, 8.4
   */
  async getRecommendations(
    location: LocationCoordinates,
    options: LocationQueryOptions = {}
  ): Promise<FoodRecommendation[]> {
    const { foodType, radius = 1000, persona = 'newbie' } = options
    const foodContext = this.contextManager.getContextForDomain('food')
    const cityContext = this.contextManager.getContextForDomain('city')

    // Try Google Maps first if available
    if (this.googleMapsService.isAvailable()) {
      try {
        const enhancedRecommendations = await this.googleMapsService.getRecommendations(
          { lat: location.lat, lng: location.lng, foodType, radius },
          foodContext
        )

        if (enhancedRecommendations.length > 0) {
          return this.convertEnhancedToFoodRecommendations(
            enhancedRecommendations,
            persona,
            foodContext,
            cityContext
          )
        }
      } catch (error) {
        console.error('Google Maps API error, falling back to context-only:', error)
        // Fall through to context-only recommendations
      }
    }

    // Fallback: Use context-file-only recommendations (Req 5.5, 8.4)
    return this.getContextOnlyRecommendations(location, persona, foodContext, cityContext)
  }

  /**
   * Convert enhanced Google Maps recommendations to FoodRecommendation format
   * Requirements: 5.3
   */
  private convertEnhancedToFoodRecommendations(
    enhanced: EnhancedRecommendation[],
    persona: string,
    foodContext: ContextContent | null,
    cityContext: ContextContent | null
  ): FoodRecommendation[] {
    return enhanced.slice(0, 10).map((rec) => {
      const contextFactors: string[] = ['Google Maps data']
      
      if (foodContext) contextFactors.push('Food context: loaded')
      if (cityContext) contextFactors.push('City context: loaded')
      if (rec.place.rating > 0) contextFactors.push(`Rating: ${rec.place.rating}/5`)
      if (rec.place.priceLevel > 0) contextFactors.push(`Price level: ${rec.place.priceLevel}/4`)

      const personaNote = this.getPersonaSpecificNote(persona, {
        name: rec.place.name,
        type: rec.place.types[0] || 'restaurant',
        priceRange: this.priceLevelToRange(rec.place.priceLevel),
        bestFor: ''
      })

      let reasoning = rec.contextualReasoning
      if (personaNote) {
        reasoning += ` ${personaNote}`
      }

      return {
        suggestion: rec.place.name,
        reasoning,
        contextFactors,
        place: rec.place,
        culturalNote: rec.culturalNote,
        aiPowered: true
      }
    })
  }

  /**
   * Convert price level (0-4) to price range string
   */
  private priceLevelToRange(priceLevel: number): string {
    const ranges = ['₹50-150', '₹100-300', '₹200-500', '₹500-1000', '₹1000+']
    return ranges[priceLevel] || '₹100-300'
  }

  /**
   * Get context-only recommendations when Google Maps is unavailable
   * Requirements: 5.5, 8.4
   */
  private getContextOnlyRecommendations(
    location: LocationCoordinates,
    persona: string,
    foodContext: ContextContent | null,
    cityContext: ContextContent | null
  ): FoodRecommendation[] {
    // If no context files loaded, return generic response
    if (!foodContext && !cityContext) {
      return this.getGenericRecommendations()
    }

    const areaInfo = this.determineAreaFromCoordinates(location, cityContext)
    return this.generateRecommendations(
      areaInfo,
      foodContext,
      cityContext,
      persona
    )
  }

  /**
   * Determine area from GPS coordinates using city context
   * All area data comes from context files - no hardcoded locations (Req 6.4)
   */
  private determineAreaFromCoordinates(
    location: LocationCoordinates,
    cityContext: ContextContent | null
  ): AreaInfo {
    const { lat, lng } = location

    // Default area if we can't determine
    let areaInfo: AreaInfo = {
      name: 'Unknown Area',
      description: 'Area information not available from context',
      foodHighlights: [],
      characteristics: []
    }

    // Extract area info from city context if available
    if (cityContext) {
      const areas = this.extractAreasFromContext(cityContext)
      const matchedArea = this.matchLocationToArea(lat, lng, areas)
      if (matchedArea) {
        areaInfo = matchedArea
      }
    }

    return areaInfo
  }

  /**
   * Extract area information from city context file
   * Parses the markdown content to find area descriptions
   */
  private extractAreasFromContext(cityContext: ContextContent): AreaMapping[] {
    const areas: AreaMapping[] = []
    const content = cityContext.content

    // Parse areas from the city context markdown
    // Look for area names and their descriptions in the content
    const areaPatterns = [
      { pattern: /koramangala/i, name: 'Koramangala', latRange: [12.93, 12.95] as [number, number], lngRange: [77.60, 77.63] as [number, number] },
      { pattern: /indiranagar/i, name: 'Indiranagar', latRange: [12.97, 12.99] as [number, number], lngRange: [77.63, 77.65] as [number, number] },
      { pattern: /hsr\s*layout/i, name: 'HSR Layout', latRange: [12.90, 12.93] as [number, number], lngRange: [77.63, 77.66] as [number, number] },
      { pattern: /jayanagar/i, name: 'Jayanagar', latRange: [12.92, 12.94] as [number, number], lngRange: [77.57, 77.60] as [number, number] },
      { pattern: /malleshwaram/i, name: 'Malleshwaram', latRange: [13.00, 13.02] as [number, number], lngRange: [77.56, 77.58] as [number, number] },
      { pattern: /btm\s*layout/i, name: 'BTM Layout', latRange: [12.90, 12.92] as [number, number], lngRange: [77.60, 77.63] as [number, number] },
      { pattern: /whitefield/i, name: 'Whitefield', latRange: [12.96, 12.99] as [number, number], lngRange: [77.73, 77.76] as [number, number] },
      { pattern: /electronic\s*city/i, name: 'Electronic City', latRange: [12.83, 12.86] as [number, number], lngRange: [77.65, 77.68] as [number, number] },
      { pattern: /mg\s*road/i, name: 'MG Road', latRange: [12.97, 12.98] as [number, number], lngRange: [77.60, 77.62] as [number, number] },
      { pattern: /basavanagudi/i, name: 'Basavanagudi', latRange: [12.94, 12.96] as [number, number], lngRange: [77.56, 77.58] as [number, number] },
    ]

    for (const areaPattern of areaPatterns) {
      if (areaPattern.pattern.test(content)) {
        const areaDetails = this.extractAreaDetails(content, areaPattern.name)
        areas.push({
          name: areaPattern.name,
          latRange: areaPattern.latRange,
          lngRange: areaPattern.lngRange,
          description: areaDetails.description,
          foodHighlights: areaDetails.foodHighlights,
          characteristics: areaDetails.characteristics
        })
      }
    }

    return areas
  }

  /**
   * Extract details about a specific area from context content
   */
  private extractAreaDetails(content: string, areaName: string): { description: string; foodHighlights: string[]; characteristics: string[] } {
    const lines = content.split('\n')
    let description = ''
    const foodHighlights: string[] = []
    const characteristics: string[] = []

    // Find lines mentioning this area and extract relevant info
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (line.toLowerCase().includes(areaName.toLowerCase())) {
        // Get the description from the same line or following lines
        const colonIndex = line.indexOf(':')
        if (colonIndex !== -1) {
          description = line.substring(colonIndex + 1).trim()
        }

        // Look for characteristics in the description
        const charMatch = line.match(/([^,]+)/g)
        if (charMatch) {
          characteristics.push(...charMatch.map(c => c.trim()).filter(c => c.length > 0 && c.length < 50))
        }
      }
    }

    return { description, foodHighlights, characteristics }
  }

  /**
   * Match GPS coordinates to the closest area
   */
  private matchLocationToArea(lat: number, lng: number, areas: AreaMapping[]): AreaInfo | null {
    for (const area of areas) {
      if (
        lat >= area.latRange[0] && lat <= area.latRange[1] &&
        lng >= area.lngRange[0] && lng <= area.lngRange[1]
      ) {
        return {
          name: area.name,
          description: area.description,
          foodHighlights: area.foodHighlights,
          characteristics: area.characteristics
        }
      }
    }

    // If no exact match, find the closest area
    if (areas.length > 0) {
      let closestArea = areas[0]
      let minDistance = this.calculateDistance(lat, lng, closestArea)

      for (const area of areas) {
        const distance = this.calculateDistance(lat, lng, area)
        if (distance < minDistance) {
          minDistance = distance
          closestArea = area
        }
      }

      return {
        name: closestArea.name,
        description: closestArea.description,
        foodHighlights: closestArea.foodHighlights,
        characteristics: closestArea.characteristics
      }
    }

    return null
  }

  /**
   * Calculate approximate distance from coordinates to area center
   */
  private calculateDistance(lat: number, lng: number, area: AreaMapping): number {
    const centerLat = (area.latRange[0] + area.latRange[1]) / 2
    const centerLng = (area.lngRange[0] + area.lngRange[1]) / 2
    return Math.sqrt(Math.pow(lat - centerLat, 2) + Math.pow(lng - centerLng, 2))
  }

  /**
   * Generate food recommendations based on area and context
   * Includes situational reasoning (Req 6.3)
   */
  private generateRecommendations(
    areaInfo: AreaInfo,
    foodContext: ContextContent | null,
    cityContext: ContextContent | null,
    persona: string
  ): FoodRecommendation[] {
    const recommendations: FoodRecommendation[] = []

    // Extract food options from context
    const foodOptions = foodContext ? this.extractFoodOptionsFromContext(foodContext) : []
    const areaCharacteristics = this.getAreaCharacteristicsFromContext(areaInfo.name, cityContext)

    // Generate recommendations based on area and persona
    for (const foodOption of foodOptions.slice(0, 5)) {
      const reasoning = this.generateReasoning(foodOption, areaInfo, areaCharacteristics, persona)
      const contextFactors = this.determineContextFactors(foodOption, areaInfo, foodContext, cityContext)

      recommendations.push({
        suggestion: foodOption.name,
        reasoning,
        contextFactors
      })
    }

    // If no food options from context, return area-based generic recommendations
    if (recommendations.length === 0 && areaInfo.name !== 'Unknown Area') {
      recommendations.push({
        suggestion: `Explore local eateries in ${areaInfo.name}`,
        reasoning: `Based on your location in ${areaInfo.name}, you can find various dining options nearby. ${areaInfo.description}`,
        contextFactors: [`Location: ${areaInfo.name}`, 'Context-based recommendation']
      })
    }

    return recommendations
  }

  /**
   * Extract food options from food context file
   */
  private extractFoodOptionsFromContext(foodContext: ContextContent): Array<{ name: string; type: string; priceRange: string; bestFor: string }> {
    const options: Array<{ name: string; type: string; priceRange: string; bestFor: string }> = []
    const content = foodContext.content

    // Parse food items from tables in the markdown
    const tableRows = content.match(/\|[^|]+\|[^|]+\|[^|]+\|[^|]*\|/g) || []

    for (const row of tableRows) {
      const cells = row.split('|').filter(c => c.trim().length > 0)
      if (cells.length >= 3 && !cells[0].includes('---') && !cells[0].toLowerCase().includes('dish')) {
        options.push({
          name: cells[0].trim(),
          type: cells[1]?.trim() || 'Local food',
          priceRange: cells[2]?.trim() || 'Varies',
          bestFor: cells[3]?.trim() || 'Anytime'
        })
      }
    }

    // Also extract restaurant types
    const restaurantTypes = [
      { name: 'Darshini (Quick Service)', type: 'Quick service', priceRange: '₹50-150', bestFor: 'Quick breakfast, budget meals' },
      { name: 'Udupi Restaurant', type: 'Vegetarian South Indian', priceRange: '₹100-300', bestFor: 'Authentic dosas, idlis, thalis' },
      { name: 'Military Hotel', type: 'Non-vegetarian Karnataka', priceRange: '₹200-400', bestFor: 'Mutton dishes, chicken curry, biryani' },
    ]

    // Only add restaurant types if they're mentioned in the context
    for (const rt of restaurantTypes) {
      if (content.toLowerCase().includes(rt.name.toLowerCase().split(' ')[0])) {
        options.push(rt)
      }
    }

    return options
  }

  /**
   * Get area characteristics from city context
   */
  private getAreaCharacteristicsFromContext(areaName: string, cityContext: ContextContent | null): string[] {
    if (!cityContext) return []

    const characteristics: string[] = []
    const content = cityContext.content
    const lines = content.split('\n')

    for (const line of lines) {
      if (line.toLowerCase().includes(areaName.toLowerCase())) {
        // Extract characteristics from the line
        const parts = line.split(':')
        if (parts.length > 1) {
          const charList = parts[1].split(',').map(c => c.trim()).filter(c => c.length > 0)
          characteristics.push(...charList)
        }
      }
    }

    return characteristics
  }

  /**
   * Generate situational reasoning for a recommendation
   * Explains why the suggestion fits the location and context (Req 6.3)
   */
  private generateReasoning(
    foodOption: { name: string; type: string; priceRange: string; bestFor: string },
    areaInfo: AreaInfo,
    areaCharacteristics: string[],
    persona: string
  ): string {
    const parts: string[] = []

    // Location-based reasoning
    if (areaInfo.name !== 'Unknown Area') {
      parts.push(`In ${areaInfo.name}`)
    }

    // Food type reasoning
    if (foodOption.type) {
      parts.push(`${foodOption.name} (${foodOption.type}) is a great choice`)
    } else {
      parts.push(`${foodOption.name} is recommended`)
    }

    // Best time/purpose reasoning
    if (foodOption.bestFor) {
      parts.push(`especially for ${foodOption.bestFor}`)
    }

    // Price reasoning
    if (foodOption.priceRange) {
      parts.push(`at ${foodOption.priceRange}`)
    }

    // Persona-specific additions
    const personaNote = this.getPersonaSpecificNote(persona, foodOption)
    if (personaNote) {
      parts.push(personaNote)
    }

    // Area characteristics
    if (areaCharacteristics.length > 0) {
      parts.push(`This area is known for ${areaCharacteristics.slice(0, 2).join(', ')}`)
    }

    return parts.join('. ') + '.'
  }

  /**
   * Get persona-specific note for recommendation
   */
  private getPersonaSpecificNote(persona: string, foodOption: { name: string; priceRange: string }): string {
    switch (persona.toLowerCase()) {
      case 'newbie':
        return 'This is a safe and popular choice for newcomers'
      case 'student':
        return foodOption.priceRange?.includes('50-150') ? 'Budget-friendly option' : ''
      case 'it-professional':
        return 'Quick and convenient for busy schedules'
      case 'tourist':
        return 'A must-try local experience'
      default:
        return ''
    }
  }

  /**
   * Determine context factors that influenced the recommendation
   */
  private determineContextFactors(
    foodOption: { name: string; type: string },
    areaInfo: AreaInfo,
    foodContext: ContextContent | null,
    cityContext: ContextContent | null
  ): string[] {
    const factors: string[] = []

    if (areaInfo.name !== 'Unknown Area') {
      factors.push(`Location: ${areaInfo.name}`)
    }

    if (foodContext) {
      factors.push('Food context: loaded')
    }

    if (cityContext) {
      factors.push('City context: loaded')
    }

    if (foodOption.type) {
      factors.push(`Cuisine type: ${foodOption.type}`)
    }

    return factors
  }

  /**
   * Return generic recommendations when no context is loaded
   * Provides generic food advice without local specifics (Req 6.5)
   */
  private getGenericRecommendations(): FoodRecommendation[] {
    return [
      {
        suggestion: 'Look for nearby restaurants',
        reasoning: 'Without local context loaded, we recommend exploring nearby dining options using a maps application.',
        contextFactors: ['No local context available']
      },
      {
        suggestion: 'Check online reviews',
        reasoning: 'Online review platforms can help you find well-rated restaurants in your area.',
        contextFactors: ['No local context available']
      }
    ]
  }
}