/**
 * Plugin system for extending EtsyClient functionality
 */

import { EtsyApiError } from './types';

/**
 * Request configuration passed to plugins
 */
export interface PluginRequestConfig {
  method: string;
  endpoint: string;
  params?: Record<string, unknown>;
  headers?: Record<string, string>;
  body?: unknown;
}

/**
 * Response object passed to plugins
 */
export interface PluginResponse<T = unknown> {
  data: T;
  status: number;
  headers?: Record<string, string>;
}

/**
 * Plugin interface that can be implemented to extend client functionality
 */
export interface EtsyPlugin {
  /**
   * Plugin name (for identification and debugging)
   */
  name: string;

  /**
   * Plugin version (optional)
   */
  version?: string;

  /**
   * Hook called before making a request
   * Can modify the request or throw an error to prevent the request
   */
  onBeforeRequest?: (config: PluginRequestConfig) => Promise<PluginRequestConfig> | PluginRequestConfig;

  /**
   * Hook called after receiving a successful response
   * Can transform the response data
   */
  onAfterResponse?: <T>(response: PluginResponse<T>) => Promise<PluginResponse<T>> | PluginResponse<T>;

  /**
   * Hook called when an error occurs
   * Can handle or transform the error
   */
  onError?: (error: Error) => Promise<void> | void;

  /**
   * Hook called when plugin is initialized
   */
  onInit?: () => Promise<void> | void;

  /**
   * Hook called when plugin is destroyed/removed
   */
  onDestroy?: () => Promise<void> | void;
}

/**
 * Plugin manager for handling multiple plugins
 */
export class PluginManager {
  private plugins: EtsyPlugin[] = [];

  /**
   * Register a plugin
   */
  async register(plugin: EtsyPlugin): Promise<void> {
    // Check for duplicate names
    if (this.plugins.some(p => p.name === plugin.name)) {
      throw new Error(`Plugin with name "${plugin.name}" is already registered`);
    }

    this.plugins.push(plugin);

    // Call onInit if available
    if (plugin.onInit) {
      await plugin.onInit();
    }
  }

  /**
   * Unregister a plugin by name
   */
  async unregister(pluginName: string): Promise<boolean> {
    const index = this.plugins.findIndex(p => p.name === pluginName);

    if (index === -1) {
      return false;
    }

    const plugin = this.plugins[index];
    if (!plugin) {
      return false;
    }

    // Call onDestroy if available
    if (plugin.onDestroy) {
      await plugin.onDestroy();
    }

    this.plugins.splice(index, 1);
    return true;
  }

  /**
   * Get all registered plugins
   */
  getPlugins(): ReadonlyArray<EtsyPlugin> {
    return this.plugins;
  }

  /**
   * Get a plugin by name
   */
  getPlugin(name: string): EtsyPlugin | undefined {
    return this.plugins.find(p => p.name === name);
  }

  /**
   * Execute onBeforeRequest hooks
   */
  async executeBeforeRequest(config: PluginRequestConfig): Promise<PluginRequestConfig> {
    let currentConfig = config;

    for (const plugin of this.plugins) {
      if (plugin.onBeforeRequest) {
        currentConfig = await plugin.onBeforeRequest(currentConfig);
      }
    }

    return currentConfig;
  }

  /**
   * Execute onAfterResponse hooks
   */
  async executeAfterResponse<T>(response: PluginResponse<T>): Promise<PluginResponse<T>> {
    let currentResponse = response;

    for (const plugin of this.plugins) {
      if (plugin.onAfterResponse) {
        currentResponse = await plugin.onAfterResponse(currentResponse);
      }
    }

    return currentResponse;
  }

  /**
   * Execute onError hooks
   */
  async executeOnError(error: Error): Promise<void> {
    for (const plugin of this.plugins) {
      if (plugin.onError) {
        await plugin.onError(error);
      }
    }
  }

  /**
   * Clear all plugins
   */
  async clear(): Promise<void> {
    for (const plugin of this.plugins) {
      if (plugin.onDestroy) {
        await plugin.onDestroy();
      }
    }

    this.plugins = [];
  }
}

// ============================================================================
// Built-in Plugins
// ============================================================================

/**
 * Analytics plugin configuration
 */
export interface AnalyticsPluginConfig {
  trackingId: string;
  trackEndpoint?: (endpoint: string, method: string, duration: number) => void;
  trackError?: (error: Error) => void;
}

/**
 * Analytics plugin for tracking API usage
 */
export function createAnalyticsPlugin(config: AnalyticsPluginConfig): EtsyPlugin {
  const requestTimes = new Map<string, number>();

  return {
    name: 'analytics',
    version: '1.0.0',

    onBeforeRequest(requestConfig): PluginRequestConfig {
      const requestId = `${requestConfig.method}:${requestConfig.endpoint}:${Date.now()}`;
      requestTimes.set(requestId, Date.now());
      return requestConfig;
    },

    onAfterResponse<T>(response: PluginResponse<T>): PluginResponse<T> {
      if (config.trackEndpoint) {
        // Track successful request
        const requestId = Array.from(requestTimes.keys()).pop();
        if (requestId) {
          const startTime = requestTimes.get(requestId);
          if (startTime) {
            const duration = Date.now() - startTime;
            const parts = requestId.split(':');
            const method = parts[0];
            const endpoint = parts[1];
            if (endpoint && method) {
              config.trackEndpoint(endpoint, method, duration);
            }
            requestTimes.delete(requestId);
          }
        }
      }
      return response;
    },

    onError(error): void {
      if (config.trackError) {
        config.trackError(error);
      }
    },
  };
}

/**
 * Retry plugin configuration
 */
export interface RetryPluginConfig {
  maxRetries?: number;
  retryDelay?: number;
  retryableStatusCodes?: number[];
  onRetry?: (attempt: number, error: Error) => void;
}

/**
 * Retry plugin for automatic retries on failure
 */
export function createRetryPlugin(config: RetryPluginConfig = {}): EtsyPlugin {
  const {
    retryableStatusCodes = [408, 429, 500, 502, 503, 504],
  } = config;

  return {
    name: 'retry',
    version: '1.0.0',

    async onError(error): Promise<void> {
      if (error instanceof EtsyApiError) {
        const statusCode = error.statusCode;
        if (statusCode && retryableStatusCodes.includes(statusCode)) {
          // This would be used by the client to trigger a retry
          // The actual retry logic would be in the client implementation
          if (config.onRetry) {
            config.onRetry(1, error);
          }
        }
      }
    },
  };
}

/**
 * Logging plugin configuration
 */
export interface LoggingPluginConfig {
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  logger?: {
    debug: (message: string, ...args: unknown[]) => void;
    info: (message: string, ...args: unknown[]) => void;
    warn: (message: string, ...args: unknown[]) => void;
    error: (message: string, ...args: unknown[]) => void;
  };
}

/**
 * Logging plugin for debugging
 */
export function createLoggingPlugin(config: LoggingPluginConfig = {}): EtsyPlugin {
  const logger = config.logger || console;
  const logLevel = config.logLevel || 'info';

  const shouldLog = (level: string): boolean => {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  };

  return {
    name: 'logging',
    version: '1.0.0',

    onBeforeRequest(requestConfig): PluginRequestConfig {
      if (shouldLog('debug')) {
        logger.debug('[Etsy API] Request:', {
          method: requestConfig.method,
          endpoint: requestConfig.endpoint,
          params: requestConfig.params,
        });
      }
      return requestConfig;
    },

    onAfterResponse<T>(response: PluginResponse<T>): PluginResponse<T> {
      if (shouldLog('debug')) {
        logger.debug('[Etsy API] Response:', {
          status: response.status,
          data: response.data,
        });
      }
      return response;
    },

    onError(error): void {
      if (shouldLog('error')) {
        logger.error('[Etsy API] Error:', error);

        if (error instanceof EtsyApiError) {
          logger.error('[Etsy API] Error Details:', {
            statusCode: error.statusCode,
            endpoint: error.endpoint,
            suggestions: error.suggestions,
          });
        }
      }
    },
  };
}

/**
 * Caching plugin configuration
 */
export interface CachingPluginConfig {
  ttl?: number; // Time to live in seconds
  keyGenerator?: (config: PluginRequestConfig) => string;
}

/**
 * Simple caching plugin
 */
export function createCachingPlugin(config: CachingPluginConfig = {}): EtsyPlugin {
  const cache = new Map<string, { data: unknown; expiresAt: number }>();
  const ttl = (config.ttl || 300) * 1000; // Default 5 minutes

  const generateKey = (requestConfig: PluginRequestConfig): string => {
    if (config.keyGenerator) {
      return config.keyGenerator(requestConfig);
    }
    return `${requestConfig.method}:${requestConfig.endpoint}:${JSON.stringify(requestConfig.params || {})}`;
  };

  return {
    name: 'caching',
    version: '1.0.0',

    onBeforeRequest(requestConfig): PluginRequestConfig {
      // Only cache GET requests
      if (requestConfig.method.toUpperCase() === 'GET') {
        const key = generateKey(requestConfig);
        const cached = cache.get(key);

        if (cached && Date.now() < cached.expiresAt) {
          // Return cached response (would need client integration)
          // This is a simplified example
        }
      }
      return requestConfig;
    },

    onAfterResponse<T>(response: PluginResponse<T>): PluginResponse<T> {
      // Store response in cache
      const key = `GET:${response.status}`;
      cache.set(key, {
        data: response.data,
        expiresAt: Date.now() + ttl,
      });
      return response;
    },

    onDestroy(): void {
      cache.clear();
    },
  };
}

/**
 * Rate limit plugin configuration
 */
export interface RateLimitPluginConfig {
  maxRequestsPerSecond?: number;
  onRateLimitExceeded?: () => void;
}

/**
 * Rate limiting plugin
 */
export function createRateLimitPlugin(config: RateLimitPluginConfig = {}): EtsyPlugin {
  const maxRequestsPerSecond = config.maxRequestsPerSecond || 10;
  const requests: number[] = [];

  return {
    name: 'rateLimit',
    version: '1.0.0',

    async onBeforeRequest(requestConfig): Promise<PluginRequestConfig> {
      const now = Date.now();
      const oneSecondAgo = now - 1000;

      // Remove requests older than 1 second
      while (requests.length > 0 && requests[0] !== undefined && requests[0] < oneSecondAgo) {
        requests.shift();
      }

      if (requests.length >= maxRequestsPerSecond) {
        if (config.onRateLimitExceeded) {
          config.onRateLimitExceeded();
        }
        // Wait until we can make another request
        const oldestRequest = requests[0];
        if (oldestRequest !== undefined) {
          const waitTime = oldestRequest + 1000 - now;
          if (waitTime > 0) {
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }
      }

      requests.push(now);
      return requestConfig;
    },
  };
}
