/**
 * Rate Limiter Service
 * Implements sliding window rate limiting to prevent excessive API usage
 * Requirements: 2.6 - THE OpenAI_Service SHALL implement rate limiting to prevent excessive API usage
 */

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

// Default rate limit configurations per endpoint
export const DEFAULT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  query: { maxRequests: 30, windowMs: 60 * 1000 },      // 30 requests per minute
  voice: { maxRequests: 10, windowMs: 60 * 1000 },      // 10 requests per minute
  image: { maxRequests: 10, windowMs: 60 * 1000 },      // 10 requests per minute
  session: { maxRequests: 60, windowMs: 60 * 1000 },    // 60 requests per minute
  contexts: { maxRequests: 60, windowMs: 60 * 1000 },   // 60 requests per minute
  default: { maxRequests: 100, windowMs: 60 * 1000 },   // 100 requests per minute
};

export class RateLimiter {
  private requests: Map<string, number[]>;
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig = DEFAULT_RATE_LIMITS.default) {
    this.requests = new Map();
    this.config = config;
  }

  /**
   * Check if a request is allowed under the rate limit
   * Uses sliding window algorithm for accurate rate limiting
   */
  checkLimit(identifier: string): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Get existing timestamps for this identifier
    let timestamps = this.requests.get(identifier) || [];

    // Filter out timestamps outside the current window (sliding window)
    timestamps = timestamps.filter(ts => ts > windowStart);

    // Calculate remaining requests
    const remaining = Math.max(0, this.config.maxRequests - timestamps.length);
    const resetTime = timestamps.length > 0 
      ? timestamps[0] + this.config.windowMs 
      : now + this.config.windowMs;

    // Check if request is allowed
    if (timestamps.length >= this.config.maxRequests) {
      const retryAfter = Math.ceil((timestamps[0] + this.config.windowMs - now) / 1000);
      return {
        allowed: false,
        remaining: 0,
        resetTime,
        retryAfter: Math.max(1, retryAfter),
      };
    }

    // Record this request
    timestamps.push(now);
    this.requests.set(identifier, timestamps);

    return {
      allowed: true,
      remaining: remaining - 1,
      resetTime,
    };
  }

  /**
   * Check if a request would be allowed without recording it
   */
  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    const timestamps = this.requests.get(identifier) || [];
    const validTimestamps = timestamps.filter(ts => ts > windowStart);
    return validTimestamps.length < this.config.maxRequests;
  }

  /**
   * Get remaining requests for an identifier
   */
  getRemainingRequests(identifier: string): number {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    const timestamps = this.requests.get(identifier) || [];
    const validTimestamps = timestamps.filter(ts => ts > windowStart);
    return Math.max(0, this.config.maxRequests - validTimestamps.length);
  }

  /**
   * Get time until rate limit resets for an identifier
   */
  getResetTime(identifier: string): number {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    const timestamps = this.requests.get(identifier) || [];
    const validTimestamps = timestamps.filter(ts => ts > windowStart);
    
    if (validTimestamps.length === 0) {
      return now + this.config.windowMs;
    }
    
    return validTimestamps[0] + this.config.windowMs;
  }

  /**
   * Clear all rate limit data (useful for testing)
   */
  clear(): void {
    this.requests.clear();
  }

  /**
   * Clear rate limit data for a specific identifier
   */
  clearIdentifier(identifier: string): void {
    this.requests.delete(identifier);
  }

  /**
   * Get current configuration
   */
  getConfig(): RateLimitConfig {
    return { ...this.config };
  }
}


/**
 * Rate Limiter Manager
 * Manages multiple rate limiters for different endpoints
 */
export class RateLimiterManager {
  private limiters: Map<string, RateLimiter>;
  private configs: Record<string, RateLimitConfig>;

  constructor(configs: Record<string, RateLimitConfig> = DEFAULT_RATE_LIMITS) {
    this.limiters = new Map();
    this.configs = configs;
  }

  /**
   * Get or create a rate limiter for a specific endpoint
   */
  private getLimiter(endpoint: string): RateLimiter {
    if (!this.limiters.has(endpoint)) {
      const config = this.configs[endpoint] || this.configs.default || DEFAULT_RATE_LIMITS.default;
      this.limiters.set(endpoint, new RateLimiter(config));
    }
    return this.limiters.get(endpoint)!;
  }

  /**
   * Check rate limit for a specific endpoint and identifier
   */
  checkLimit(endpoint: string, identifier: string): RateLimitResult {
    const limiter = this.getLimiter(endpoint);
    return limiter.checkLimit(identifier);
  }

  /**
   * Check if request is allowed for a specific endpoint
   */
  isAllowed(endpoint: string, identifier: string): boolean {
    const limiter = this.getLimiter(endpoint);
    return limiter.isAllowed(identifier);
  }

  /**
   * Get remaining requests for a specific endpoint
   */
  getRemainingRequests(endpoint: string, identifier: string): number {
    const limiter = this.getLimiter(endpoint);
    return limiter.getRemainingRequests(identifier);
  }

  /**
   * Clear all rate limiters
   */
  clearAll(): void {
    this.limiters.forEach(limiter => limiter.clear());
  }

  /**
   * Update configuration for an endpoint
   */
  updateConfig(endpoint: string, config: RateLimitConfig): void {
    this.configs[endpoint] = config;
    // Remove existing limiter so it gets recreated with new config
    this.limiters.delete(endpoint);
  }
}

// Singleton instance for application-wide rate limiting
let rateLimiterManager: RateLimiterManager | null = null;

export function getRateLimiterManager(): RateLimiterManager {
  if (!rateLimiterManager) {
    rateLimiterManager = new RateLimiterManager();
  }
  return rateLimiterManager;
}

// Reset manager (useful for testing)
export function resetRateLimiterManager(): void {
  if (rateLimiterManager) {
    rateLimiterManager.clearAll();
  }
  rateLimiterManager = null;
}
