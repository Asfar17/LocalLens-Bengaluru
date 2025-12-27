/**
 * Typed environment configuration for the Bangalore Survival Assistant
 * Provides type-safe access to environment variables
 */

export interface EnvironmentConfig {
  // Server
  port: number;
  nodeEnv: 'development' | 'production' | 'test';

  // Database
  mongodbUri: string;

  // OpenRouter (OpenAI-compatible)
  openrouterApiKey: string | undefined;
  openrouterBaseUrl: string;

  // Google Cloud (Speech-to-Text, Vision, Translate)
  googleCloudApiKey: string | undefined;

  // Google Maps (Places API)
  googleMapsApiKey: string | undefined;

  // Security
  allowedOrigins: string[];
}

function parseAllowedOrigins(origins: string | undefined): string[] {
  if (!origins) {
    return ['http://localhost:3000', 'http://localhost:5173'];
  }
  return origins.split(',').map(origin => origin.trim()).filter(Boolean);
}

function getNodeEnv(): 'development' | 'production' | 'test' {
  const env = process.env.NODE_ENV;
  if (env === 'production' || env === 'test') {
    return env;
  }
  return 'development';
}

export function getEnvironmentConfig(): EnvironmentConfig {
  return {
    port: parseInt(process.env.PORT || '5000', 10),
    nodeEnv: getNodeEnv(),
    mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/bangalore-assistant',
    openrouterApiKey: process.env.OPENROUTER_API_KEY,
    openrouterBaseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    googleCloudApiKey: process.env.GOOGLE_CLOUD_API_KEY,
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
    allowedOrigins: parseAllowedOrigins(process.env.ALLOWED_ORIGINS),
  };
}

// Singleton instance for easy access
let envConfig: EnvironmentConfig | null = null;

export function getEnv(): EnvironmentConfig {
  if (!envConfig) {
    envConfig = getEnvironmentConfig();
  }
  return envConfig;
}

// Reset config (useful for testing)
export function resetEnvConfig(): void {
  envConfig = null;
}
