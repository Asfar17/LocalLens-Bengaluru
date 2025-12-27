/**
 * Google Maps Service
 * Handles location-based restaurant recommendations using Google Maps Places API
 * Requirements: 5.1, 5.2, 5.4
 */

import { Client, PlaceType1, PlacesNearbyRanking } from '@googlemaps/google-maps-services-js';
import { APIKeyManager, getAPIKeyManager } from './APIKeyManager.js';
import { ContextManager, ContextContent } from './ContextManager.js';

export interface LocationQuery {
  lat: number;
  lng: number;
  foodType?: string; // e.g., 'dosa', 'biryani', 'coffee'
  radius?: number; // meters, default 1000
}

export interface PlaceResult {
  name: string;
  address: string;
  rating: number;
  distance: number;
  priceLevel: number;
  types: string[];
  placeId: string;
}

export interface EnhancedRecommendation {
  place: PlaceResult;
  contextualReasoning: string;
  culturalNote?: string;
}

// Food type to Google Places keyword mapping
const FOOD_TYPE_KEYWORDS: Record<string, string[]> = {
  dosa: ['dosa', 'south indian', 'udupi', 'darshini'],
  idli: ['idli', 'south indian', 'udupi', 'darshini'],
  biryani: ['biryani', 'hyderabadi', 'muslim'],
  coffee: ['coffee', 'cafe', 'filter coffee'],
  thali: ['thali', 'meals', 'south indian'],
  pizza: ['pizza', 'italian'],
  burger: ['burger', 'american'],
  chinese: ['chinese', 'indo chinese', 'manchurian'],
  north_indian: ['north indian', 'punjabi', 'mughlai'],
  street_food: ['chaat', 'street food', 'snacks'],
  dessert: ['dessert', 'sweets', 'bakery', 'ice cream'],
  vegetarian: ['vegetarian', 'pure veg', 'veg'],
  non_vegetarian: ['non veg', 'military hotel', 'meat'],
};

export class GoogleMapsService {
  private client: Client;
  private apiKeyManager: APIKeyManager;
  private contextManager: ContextManager;

  constructor(apiKeyManager?: APIKeyManager, contextManager?: ContextManager) {
    this.client = new Client({});
    this.apiKeyManager = apiKeyManager || getAPIKeyManager();
    this.contextManager = contextManager || new ContextManager();
  }

  /**
   * Check if Google Maps service is available
   */
  isAvailable(): boolean {
    return this.apiKeyManager.isFeatureEnabled('maps');
  }


  /**
   * Get enhanced food recommendations based on location
   * Combines Google Places API results with food.md context
   * Requirements: 5.1, 5.2, 5.4
   */
  async getRecommendations(
    query: LocationQuery,
    foodContext: ContextContent | null = null
  ): Promise<EnhancedRecommendation[]> {
    const apiKey = this.apiKeyManager.getGoogleMapsKey();
    
    if (!apiKey) {
      console.warn('Google Maps API key not available, returning empty results');
      return [];
    }

    try {
      // Search for nearby places
      const places = await this.searchNearbyPlaces(query, apiKey);
      
      // Get food context if not provided
      const context = foodContext || this.contextManager.getContextForDomain('food');
      
      // Enhance results with context
      return this.enhanceWithContext(places, context, query);
    } catch (error) {
      console.error('Error getting recommendations from Google Maps:', error);
      throw error;
    }
  }

  /**
   * Search for nearby food establishments using Google Places API
   * Requirements: 5.1
   */
  async searchNearbyPlaces(
    query: LocationQuery,
    apiKey?: string
  ): Promise<PlaceResult[]> {
    const key = apiKey || this.apiKeyManager.getGoogleMapsKey();
    
    if (!key) {
      throw new Error('Google Maps API key not available');
    }

    const { lat, lng, foodType, radius = 1000 } = query;

    try {
      // Build keyword based on food type
      const keyword = this.buildSearchKeyword(foodType);

      const response = await this.client.placesNearby({
        params: {
          location: { lat, lng },
          radius,
          type: PlaceType1.restaurant,
          keyword,
          key,
          rankby: PlacesNearbyRanking.prominence,
        },
      });

      if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
        console.error('Google Places API error:', response.data.status, response.data.error_message);
        throw new Error(`Google Places API error: ${response.data.status}`);
      }

      const results = response.data.results || [];
      
      return results.map((place) => this.mapPlaceToResult(place, lat, lng));
    } catch (error) {
      console.error('Error searching nearby places:', error);
      throw error;
    }
  }

  /**
   * Build search keyword based on food type
   * Requirements: 5.4
   */
  private buildSearchKeyword(foodType?: string): string {
    if (!foodType) {
      return 'restaurant food';
    }

    const normalizedType = foodType.toLowerCase().replace(/\s+/g, '_');
    const keywords = FOOD_TYPE_KEYWORDS[normalizedType];
    
    if (keywords && keywords.length > 0) {
      // Return the primary keyword for the food type
      return keywords[0];
    }

    // Use the food type directly as keyword
    return foodType;
  }


  /**
   * Map Google Places result to our PlaceResult interface
   */
  private mapPlaceToResult(
    place: any,
    userLat: number,
    userLng: number
  ): PlaceResult {
    const placeLat = place.geometry?.location?.lat || 0;
    const placeLng = place.geometry?.location?.lng || 0;
    
    return {
      name: place.name || 'Unknown',
      address: place.vicinity || place.formatted_address || 'Address not available',
      rating: place.rating || 0,
      distance: this.calculateDistance(userLat, userLng, placeLat, placeLng),
      priceLevel: place.price_level || 0,
      types: place.types || [],
      placeId: place.place_id || '',
    };
  }

  /**
   * Calculate distance between two coordinates in meters
   * Uses Haversine formula
   */
  private calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return Math.round(R * c);
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Enhance place results with contextual information from food.md
   * Requirements: 5.2
   */
  private enhanceWithContext(
    places: PlaceResult[],
    foodContext: ContextContent | null,
    query: LocationQuery
  ): EnhancedRecommendation[] {
    return places.map((place) => {
      const contextualReasoning = this.generateContextualReasoning(place, foodContext, query);
      const culturalNote = this.getCulturalNote(place, foodContext);

      return {
        place,
        contextualReasoning,
        culturalNote,
      };
    });
  }


  /**
   * Generate contextual reasoning for a place recommendation
   * Explains why the recommendation fits the user's query and location
   * Requirements: 5.2, 5.3
   */
  private generateContextualReasoning(
    place: PlaceResult,
    foodContext: ContextContent | null,
    query: LocationQuery
  ): string {
    const parts: string[] = [];

    // Distance reasoning
    if (place.distance < 500) {
      parts.push(`Very close by (${place.distance}m)`);
    } else if (place.distance < 1000) {
      parts.push(`Within walking distance (${place.distance}m)`);
    } else {
      parts.push(`${Math.round(place.distance / 100) / 10}km away`);
    }

    // Rating reasoning
    if (place.rating >= 4.5) {
      parts.push('highly rated by locals');
    } else if (place.rating >= 4.0) {
      parts.push('well-reviewed');
    } else if (place.rating > 0) {
      parts.push(`rated ${place.rating}/5`);
    }

    // Price level reasoning
    const priceDescriptions = ['budget-friendly', 'affordable', 'moderate', 'upscale', 'premium'];
    if (place.priceLevel >= 0 && place.priceLevel < priceDescriptions.length) {
      parts.push(priceDescriptions[place.priceLevel]);
    }

    // Food type match reasoning
    if (query.foodType) {
      const matchInfo = this.checkFoodTypeMatch(place, query.foodType, foodContext);
      if (matchInfo) {
        parts.push(matchInfo);
      }
    }

    return parts.join(', ') + '.';
  }

  /**
   * Check if place matches the requested food type and provide context
   */
  private checkFoodTypeMatch(
    place: PlaceResult,
    foodType: string,
    foodContext: ContextContent | null
  ): string | null {
    const normalizedType = foodType.toLowerCase();
    const placeName = place.name.toLowerCase();
    const placeTypes = place.types.map((t) => t.toLowerCase());

    // Check if place name or types contain food type keywords
    const keywords = FOOD_TYPE_KEYWORDS[normalizedType.replace(/\s+/g, '_')] || [normalizedType];
    
    for (const keyword of keywords) {
      if (placeName.includes(keyword) || placeTypes.some((t) => t.includes(keyword))) {
        return `matches your search for ${foodType}`;
      }
    }

    // Check context for additional matching info
    if (foodContext) {
      const contextMatch = this.findContextMatch(place.name, foodContext.content);
      if (contextMatch) {
        return contextMatch;
      }
    }

    return null;
  }

  /**
   * Find matching information from food context
   */
  private findContextMatch(placeName: string, contextContent: string): string | null {
    const lines = contextContent.split('\n');
    const normalizedName = placeName.toLowerCase();

    for (const line of lines) {
      if (line.toLowerCase().includes(normalizedName)) {
        // Extract relevant info from the line
        const colonIndex = line.indexOf(':');
        if (colonIndex !== -1) {
          return line.substring(colonIndex + 1).trim().substring(0, 100);
        }
      }
    }

    return null;
  }


  /**
   * Get cultural note for a place based on food context
   */
  private getCulturalNote(
    place: PlaceResult,
    foodContext: ContextContent | null
  ): string | undefined {
    if (!foodContext) return undefined;

    const content = foodContext.content.toLowerCase();
    const placeName = place.name.toLowerCase();
    const placeTypes = place.types.map((t) => t.toLowerCase());

    // Check for restaurant type cultural notes
    if (placeName.includes('darshini') || placeTypes.includes('darshini')) {
      return 'Darshini: Quick service standing-and-eating format. Order at counter, eat quickly.';
    }

    if (placeName.includes('udupi') || content.includes('udupi')) {
      if (placeName.includes('udupi')) {
        return 'Udupi restaurant: Authentic vegetarian South Indian cuisine. Try the dosas and thalis.';
      }
    }

    if (placeName.includes('military') || placeName.includes('nagarjuna') || placeName.includes('meghana')) {
      return 'Military hotel style: Non-vegetarian Karnataka cuisine. Known for mutton and chicken dishes.';
    }

    // Check for craft beer/pub
    if (placeTypes.includes('bar') || placeName.includes('brewery') || placeName.includes('pub')) {
      return 'Bangalore has a thriving craft beer scene. Try house-brewed beers at microbreweries.';
    }

    // Check for cafe
    if (placeTypes.includes('cafe') || placeName.includes('coffee')) {
      return 'Filter coffee is a Bangalore specialty. Best enjoyed before 9 AM for authentic experience.';
    }

    return undefined;
  }

  /**
   * Filter places by food type
   * Requirements: 5.4
   */
  filterByFoodType(places: PlaceResult[], foodType: string): PlaceResult[] {
    if (!foodType) return places;

    const normalizedType = foodType.toLowerCase().replace(/\s+/g, '_');
    const keywords = FOOD_TYPE_KEYWORDS[normalizedType] || [foodType.toLowerCase()];

    return places.filter((place) => {
      const placeName = place.name.toLowerCase();
      const placeTypes = place.types.map((t) => t.toLowerCase());

      return keywords.some(
        (keyword) =>
          placeName.includes(keyword) ||
          placeTypes.some((t) => t.includes(keyword))
      );
    });
  }

  /**
   * Get food type suggestions based on context
   */
  getFoodTypeSuggestions(): string[] {
    return Object.keys(FOOD_TYPE_KEYWORDS).map((key) =>
      key.replace(/_/g, ' ')
    );
  }
}

// Singleton instance
let googleMapsServiceInstance: GoogleMapsService | null = null;

export function getGoogleMapsService(
  apiKeyManager?: APIKeyManager,
  contextManager?: ContextManager
): GoogleMapsService {
  if (!googleMapsServiceInstance) {
    googleMapsServiceInstance = new GoogleMapsService(apiKeyManager, contextManager);
  }
  return googleMapsServiceInstance;
}

// Reset instance (useful for testing)
export function resetGoogleMapsService(): void {
  googleMapsServiceInstance = null;
}
