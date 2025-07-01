// WebSocket Constants
export const WEBSOCKET_CONSTANTS = {
  // Message types
  MESSAGE_TYPES: {
    AUTH: 'auth',
    MESSAGE: 'message',
    PING: 'ping',
  },

  // Actions
  ACTIONS: {
    AUTHENTICATE: 'authenticate',
    SEND_MESSAGE: 'sendMessage',
  },

  // Event types
  EVENT_TYPES: {
    CONNECT: 'CONNECT',
    DISCONNECT: 'DISCONNECT',
    MESSAGE: 'MESSAGE',
  },

  // Response status codes
  STATUS_CODES: {
    SUCCESS: 200,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    INTERNAL_SERVER_ERROR: 500,
  },

  // Timeouts and limits
  TIMEOUTS: {
    CONNECTION_TIMEOUT: 10000, // 10 seconds
    MESSAGE_TIMEOUT: 5000, // 5 seconds
  },

  // Message limits
  LIMITS: {
    MAX_MESSAGE_LENGTH: 10000, // 10KB
    MAX_CONNECTIONS_PER_USER: 3,
    MAX_REQUESTS_PER_MINUTE: 100,
  },

  // Logging
  LOGGING: {
    BODY_PREVIEW_LENGTH: 100,
    TOKEN_MASK: '***',
  },
} as const;

// Environment Constants
export const ENVIRONMENT_CONSTANTS = {
  DEFAULT_ENVIRONMENT: 'dev',
  DEFAULT_REGION: 'us-east-1',
  DEFAULT_STAGE: '$default',
} as const;

// Error Constants
export const ERROR_CONSTANTS = {
  CODES: {
    MISSING_CONNECTION_ID: 'MISSING_CONNECTION_ID',
    MISSING_BODY: 'MISSING_BODY',
    INVALID_MESSAGE_FORMAT: 'INVALID_MESSAGE_FORMAT',
    INVALID_MESSAGE_TYPE: 'INVALID_MESSAGE_TYPE',
    INVALID_JSON: 'INVALID_JSON',
    INVALID_ACTION: 'INVALID_ACTION',
    INVALID_EVENT_TYPE: 'INVALID_EVENT_TYPE',
    UNAUTHENTICATED_CONNECTION: 'UNAUTHENTICATED_CONNECTION',
    AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
    UNEXPECTED_ERROR: 'UNEXPECTED_ERROR',
  },

  MESSAGES: {
    MISSING_CONNECTION_ID: 'Missing connection ID in request context',
    MISSING_BODY: 'Request body is required',
    INVALID_MESSAGE_FORMAT:
      'Invalid message format. Expected {type, data} structure',
    INVALID_JSON: 'Invalid JSON in request body',
    AUTHENTICATION_REQUIRED: 'Authentication required',
    INVALID_ACTION: 'Invalid action',
    INVALID_EVENT_TYPE: 'Invalid event type for connection handler',
  },
} as const;

// Metric Constants
export const METRIC_CONSTANTS = {
  NAMES: {
    WEBSOCKET_REQUEST: 'WebSocketRequest',
    WEBSOCKET_MESSAGE: 'message_received',
    PING: 'ping',
    AUTHENTICATION_SUCCESS: 'authentication_success',
    AUTHENTICATION_FAILURE: 'authentication_failure',
  },

  DIMENSIONS: {
    ENVIRONMENT: 'Environment',
  },

  UNITS: {
    COUNT: 'Count',
  },
} as const;

// Correlation ID Constants
export const CORRELATION_CONSTANTS = {
  PREFIXES: {
    CONVERSATION: 'conv',
    CONNECTION: 'conn',
    REQUEST: 'req',
  },
} as const;

// Circuit Breaker Configuration
export const CIRCUIT_BREAKER_CONFIG = {
  DEFAULT_FAILURE_THRESHOLD: 3,
  DEFAULT_RECOVERY_TIMEOUT: 20000, // 20 seconds
  DEFAULT_EXPECTED_RESPONSE_TIME: 500, // 500ms
  DEFAULT_MONITORING_WINDOW: 60000, // 1 minute
  DEFAULT_MINIMUM_REQUEST_COUNT: 5,
  FAILURE_RATE_THRESHOLD: 0.5, // 50%
} as const;

// Authentication Configuration
export const AUTH_CONFIG = {
  CONNECTION_TTL_SECONDS: 24 * 60 * 60, // 24 hours
  TOKEN_USE: 'access' as const,
} as const;

// Message Configuration
export const MESSAGE_CONFIG = {
  MAX_CONTENT_LENGTH: 1000,
  ID_PREFIX: {
    MESSAGE: 'msg_',
  },
} as const;

// Performance Configuration
export const PERFORMANCE_CONFIG = {
  DEFAULT_TIMEOUT: 30000, // 30 seconds
  WARNING_THRESHOLD: 1000, // 1 second
  CRITICAL_THRESHOLD: 5000, // 5 seconds
} as const;

// Database Configuration
export const DATABASE_CONFIG = {
  TABLES: {
    CONNECTIONS: 'connections',
    MESSAGES: 'messages',
    SESSIONS: 'sessions',
    USERS: 'users',
  },
} as const;
