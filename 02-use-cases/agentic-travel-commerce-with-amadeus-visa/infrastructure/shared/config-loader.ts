import * as fs from 'fs';
import * as path from 'path';

/**
 * Deployment configuration interface
 * All fields except deploymentId are optional with sensible defaults
 */
export interface DeploymentConfig {
  deploymentId: string;
  description?: string;

  aws?: {
    region?: string;
  };

  cognito?: {
    resourceServer?: {
      identifier?: string;
      displayName?: string;
    };
    oauth?: {
      scopeName?: string;
      scopeDescription?: string;
    };
    machineClient?: {
      name?: string;
    };
    domainPrefix?: string;
  };

  ssmParameterPaths?: {
    prefix?: string;
    travel?: {
      openweatherApiKey?: string;
      tavilyApiKey?: string;
      googleMapsKey?: string;
      amadeusPublic?: string;
      amadeusSecret?: string;
    };
    gateway?: {
      urlPattern?: string;
    };
  };

  secretsManager?: {
    prefix?: string;
    visa?: {
      apiKey?: string;
      sharedSecret?: string;
      encryptionApiKey?: string;
      encryptionSharedSecret?: string;
      keyId?: string;
      serverMleCert?: string;
      mlePrivateCert?: string;
    };
  };

  visa?: {
    clientAppId?: string;
    iframeUrl?: string;
  };

  amplify?: {
    frontendAppName?: string;
  };

  mcpTools?: {
    cartNamespace?: string;
    travelNamespace?: string;
    itineraryNamespace?: string;
  };
}

/**
 * Default configuration values that match current hardcoded behavior
 * This ensures 100% backward compatibility
 */
const DEFAULT_CONFIG: Partial<DeploymentConfig> = {
  aws: {
    region: 'us-east-1'
  },

  cognito: {
    resourceServer: {
      identifier: 'concierge-gateway',
      displayName: 'concierge-gateway-resource-server'
    },
    oauth: {
      scopeName: 'invoke',
      scopeDescription: 'Invoke gateway and targets'
    },
    machineClient: {
      name: 'concierge-gateway-machine-client'
    },
    domainPrefix: 'concierge'
  },

  ssmParameterPaths: {
    prefix: '/agentic-commerce',
    travel: {
      openweatherApiKey: '/agentic-commerce/travel/openweather-api-key',
      tavilyApiKey: '/agentic-commerce/travel/tavily-api-key',
      googleMapsKey: '/agentic-commerce/travel/google-maps-key',
      amadeusPublic: '/agentic-commerce/travel/amadeus-public',
      amadeusSecret: '/agentic-commerce/travel/amadeus-secret'
    },
    gateway: {
      urlPattern: '/agentic-commerce/{deploymentId}/gateway-url'
    }
  },

  secretsManager: {
    prefix: 'visa',
    visa: {
      apiKey: 'visa/api-key',
      sharedSecret: 'visa/shared-secret',
      encryptionApiKey: 'visa/encryption-api-key',
      encryptionSharedSecret: 'visa/encryption-shared-secret',
      keyId: 'visa/vic_key_id',
      serverMleCert: 'visa/server-mle-cert',
      mlePrivateCert: 'visa/mle-private-cert'
    }
  },

  visa: {
    clientAppId: 'VICTestAccountTR',
    iframeUrl: 'https://sbx.vts.auth.visa.com'
  },

  amplify: {
    frontendAppName: 'agentic-commerce-frontend'
  },

  mcpTools: {
    cartNamespace: 'carttools___',
    travelNamespace: 'traveltools___',
    itineraryNamespace: 'itinerarytools___'
  }
};

/**
 * Deep merge two objects, with source overriding target
 */
function deepMerge<T>(target: T, source: Partial<T>): T {
  const output = { ...target };

  for (const key in source) {
    const sourceValue = source[key];
    const targetValue = output[key];

    if (sourceValue === undefined) {
      continue;
    }

    if (typeof sourceValue === 'object' && sourceValue !== null && !Array.isArray(sourceValue)) {
      if (typeof targetValue === 'object' && targetValue !== null && !Array.isArray(targetValue)) {
        (output as any)[key] = deepMerge(targetValue, sourceValue);
      } else {
        (output as any)[key] = sourceValue;
      }
    } else {
      (output as any)[key] = sourceValue;
    }
  }

  return output;
}

/**
 * Load deployment configuration from file with defaults
 * @param configPath Path to deployment-config.json (relative or absolute)
 * @returns DeploymentConfig with all values populated (user values override defaults)
 */
export function loadConfig(configPath: string): DeploymentConfig {
  let rawConfig: any;

  try {
    const absolutePath = path.isAbsolute(configPath)
      ? configPath
      : path.resolve(process.cwd(), configPath);

    const configContent = fs.readFileSync(absolutePath, 'utf-8');
    rawConfig = JSON.parse(configContent);
  } catch (error) {
    throw new Error(`Failed to load deployment config from ${configPath}: ${error}`);
  }

  if (!rawConfig.deploymentId) {
    throw new Error('deployment-config.json must contain a "deploymentId" field');
  }

  // Deep merge user config with defaults
  const merged = deepMerge(DEFAULT_CONFIG as DeploymentConfig, rawConfig);
  merged.deploymentId = rawConfig.deploymentId;

  return merged;
}

/**
 * Get OAuth scope in format: {resourceServerIdentifier}/{scopeName}
 * @param config Deployment configuration
 * @returns OAuth scope string (e.g., "concierge-gateway/invoke")
 */
export function getOAuthScope(config: DeploymentConfig): string {
  const identifier = config.cognito?.resourceServer?.identifier || 'concierge-gateway';
  const scopeName = config.cognito?.oauth?.scopeName || 'invoke';
  return `${identifier}/${scopeName}`;
}

/**
 * Resolve template placeholders in strings
 * @param template String with placeholders like {deploymentId}
 * @param vars Variables to substitute
 * @returns Resolved string with placeholders replaced
 *
 * @example
 * resolveTemplate('/path/{deploymentId}/resource', { deploymentId: 'prod' })
 * // Returns: '/path/prod/resource'
 */
export function resolveTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return vars[key] !== undefined ? vars[key] : match;
  });
}

/**
 * Get SSM parameter path with template resolution
 * @param config Deployment configuration
 * @param pathKey Dot-notation path to the config value (e.g., 'travel.openweatherApiKey')
 * @param deploymentId Deployment ID for template substitution
 * @returns Resolved SSM parameter path
 */
export function getSSMPath(
  config: DeploymentConfig,
  pathKey: string,
  deploymentId: string
): string {
  const keys = pathKey.split('.');
  let value: any = config.ssmParameterPaths;

  for (const key of keys) {
    if (value && typeof value === 'object') {
      value = value[key];
    } else {
      value = undefined;
      break;
    }
  }

  if (typeof value === 'string') {
    return resolveTemplate(value, { deploymentId });
  }

  // Fallback to default if not found
  const defaultValue = (DEFAULT_CONFIG.ssmParameterPaths as any)?.[keys[0]]?.[keys[1]];
  return defaultValue ? resolveTemplate(defaultValue, { deploymentId }) : '';
}

/**
 * Get Secrets Manager secret name
 * @param config Deployment configuration
 * @param secretKey Dot-notation path to the secret (e.g., 'visa.apiKey')
 * @returns Secret name/path
 */
export function getSecretName(config: DeploymentConfig, secretKey: string): string {
  const keys = secretKey.split('.');
  let value: any = config.secretsManager;

  for (const key of keys) {
    if (value && typeof value === 'object') {
      value = value[key];
    } else {
      value = undefined;
      break;
    }
  }

  if (typeof value === 'string') {
    return value;
  }

  // Fallback to default
  const defaultValue = (DEFAULT_CONFIG.secretsManager as any)?.[keys[0]]?.[keys[1]];
  return defaultValue || '';
}
