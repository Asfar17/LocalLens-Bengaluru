/**
 * API Key Manager Service
 * Centralized service for secure API key management
 * Validates keys on startup and provides feature availability checks
 */

import { getEnv, EnvironmentConfig } from '../config/environment';

export interface APIKeyConfig {
  openrouter: string | undefined;
  googleCloud: string | undefined;
  googleMaps: string | undefined;
}

export interface APIKeyStatus {
  openrouter: boolean;
  googleSpeech: boolean;
  googleVision: boolean;
  googleMaps: boolean;
}

export type FeatureType = 'openrouter' | 'speech' | 'vision' | 'maps';

export class APIKeyManager {
  private keys: APIKeyConfig;
  private status: APIKeyStatus;

  constructor() {
    const env = getEnv();
    this.keys = {
      openrouter: env.openrouterApiKey,
      googleCloud: env.googleCloudApiKey,
      googleMaps: env.googleMapsApiKey,
    };
    this.status = this.computeStatus();
  }

  private computeStatus(): APIKeyStatus {
    return {
      openrouter: this.isValidKey(this.keys.openrouter),
      googleSpeech: this.isValidKey(this.keys.googleCloud),
      googleVision: this.isValidKey(this.keys.googleCloud),
      googleMaps: this.isValidKey(this.keys.googleMaps),
    };
  }

  private isValidKey(key: string | undefined): boolean {
    return typeof key === 'string' && key.trim().length > 0;
  }

  /**
   * Validates all API keys on startup and logs warnings for missing keys
   * Returns the status of all API keys
   */
  validateKeys(): APIKeyStatus {
    console.log('🔑 Validating API keys...');

    if (!this.status.openrouter) {
      console.warn('⚠️  OPENROUTER_API_KEY is missing - AI chat responses will be disabled');
    } else {
      console.log('✅ OpenRouter API key configured');
    }

    if (!this.status.googleSpeech) {
      console.warn('⚠️  GOOGLE_CLOUD_API_KEY is missing - Voice transcription will be disabled');
    } else {
      console.log('✅ Google Cloud API key configured (Speech/Vision)');
    }

    if (!this.status.googleMaps) {
      console.warn('⚠️  GOOGLE_MAPS_API_KEY is missing - Location recommendations will use context files only');
    } else {
      console.log('✅ Google Maps API key configured');
    }

    return this.status;
  }

  /**
   * Get the OpenRouter API key if available
   */
  getOpenRouterKey(): string | null {
    return this.status.openrouter ? this.keys.openrouter! : null;
  }

  /**
   * Get the Google Cloud API key if available
   */
  getGoogleCloudKey(): string | null {
    return this.status.googleSpeech ? this.keys.googleCloud! : null;
  }

  /**
   * Get the Google Maps API key if available
   */
  getGoogleMapsKey(): string | null {
    return this.status.googleMaps ? this.keys.googleMaps! : null;
  }

  /**
   * Check if a specific feature is enabled based on API key availability
   */
  isFeatureEnabled(feature: FeatureType): boolean {
    switch (feature) {
      case 'openrouter':
        return this.status.openrouter;
      case 'speech':
        return this.status.googleSpeech;
      case 'vision':
        return this.status.googleVision;
      case 'maps':
        return this.status.googleMaps;
      default:
        return false;
    }
  }

  /**
   * Get the current status of all API keys
   */
  getStatus(): APIKeyStatus {
    return { ...this.status };
  }

  /**
   * Get a summary of enabled/disabled features for logging
   */
  getFeatureSummary(): string {
    const features = [
      `OpenRouter: ${this.status.openrouter ? '✅' : '❌'}`,
      `Speech: ${this.status.googleSpeech ? '✅' : '❌'}`,
      `Vision: ${this.status.googleVision ? '✅' : '❌'}`,
      `Maps: ${this.status.googleMaps ? '✅' : '❌'}`,
    ];
    return features.join(' | ');
  }
}

// Singleton instance
let apiKeyManagerInstance: APIKeyManager | null = null;

export function getAPIKeyManager(): APIKeyManager {
  if (!apiKeyManagerInstance) {
    apiKeyManagerInstance = new APIKeyManager();
  }
  return apiKeyManagerInstance;
}

// Reset instance (useful for testing)
export function resetAPIKeyManager(): void {
  apiKeyManagerInstance = null;
}
