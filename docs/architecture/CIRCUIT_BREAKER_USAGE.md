# Circuit Breaker Service Usage Guide

This document explains the implementation and usage of the `CircuitBreakerService` within the AWS Lambda backend of the real-time communication application, focusing on its role in enhancing resilience and fault tolerance.

## Locations where CircuitBreakerService is used

### 1. **Authentication Service** (`apps/runtime/src/services/authentication-service.ts`)

**Protected Operation:** JWT verification with Cognito

```typescript
// Use of the circuit breaker for JWT verification
const payload = await circuitBreakerService.execute(
  'cognito',
  'verifyJWT',
  async () => {
    return await this.verifier.verify(token);
  },
  async () => {
    // Fallback behavior when Cognito is unavailable
    logger.warn('Cognito service unavailable, using fallback authentication', {
      correlationId: this.generateCorrelationId(),
    });
    throw new Error('Authentication service temporarily unavailable');
  },
  {
    failureThreshold: 3, // 3 failures before opening the circuit
    recoveryTimeout: 30000, // 30 seconds wait
    expectedResponseTime: 2000, // 2 seconds expected response time
    monitoringWindow: 60000, // 1 minute monitoring window
    minimumRequestCount: 5, // Minimum 5 requests before opening the circuit
  }
);
```

**Configuration:**

- **Failure threshold:** 3 consecutive failures
- **Recovery time:** 30 seconds
- **Expected response time:** 2 seconds
- **Monitoring window:** 1 minute

### 2. **WebSocket Message Service** (`apps/runtime/src/services/websocket-message-service.ts`)

**Protected Operation:** Sending messages via API Gateway Management API

```typescript
// Use of the circuit breaker for sending WebSocket messages
await circuitBreakerService.execute(
  'apigateway-management',
  'postToConnection',
  async () => {
    return await client.send(
      new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: Buffer.from(JSON.stringify(message)),
      })
    );
  },
  async () => {
    // Fallback behavior when API Gateway is unavailable
    logger.warn('API Gateway Management API unavailable, message not sent', {
      connectionId,
      messageType: message.type,
      correlationId: this.generateCorrelationId(),
    });
    throw new Error('WebSocket service temporarily unavailable');
  },
  {
    failureThreshold: 5, // 5 failures before opening the circuit
    recoveryTimeout: 15000, // 15 seconds wait
    expectedResponseTime: 1000, // 1 second expected response time
    monitoringWindow: 30000, // 30 second monitoring window
    minimumRequestCount: 3, // Minimum 3 requests before opening the circuit
  }
);
```

**Configuration:**

- **Failure threshold:** 5 consecutive failures
- **Recovery time:** 15 seconds
- **Expected response time:** 1 second
- **Monitoring window:** 30 seconds

### 3. **Chat Service** (`apps/runtime/src/services/chat-service.ts`)

**Protected Operations:** Storing messages in DynamoDB

#### Storing user message:

```typescript
// Circuit breaker for storing user message
await circuitBreakerService.execute(
  'dynamodb',
  'storeUserMessage',
  async () => {
    return await ddbDocClient.send(
      new PutCommand({
        TableName: process.env.WEBSOCKET_MESSAGES_TABLE,
        Item: {
          ...userMessage,
          ttl: Math.floor(now.getTime() / 1000) + 24 * 60 * 60,
          type: 'user',
          connectionId,
          userId: user.userId,
        },
      })
    );
  },
  async () => {
    // Fallback behavior when DynamoDB is unavailable
    throw new Error('Database temporarily unavailable');
  },
  {
    failureThreshold: 3, // 3 failures before opening the circuit
    recoveryTimeout: 20000, // 20 seconds wait
    expectedResponseTime: 500, // 500ms expected response time
    monitoringWindow: 60000, // 1 minute monitoring window
    minimumRequestCount: 5, // Minimum 5 requests before opening the circuit
  }
);
```

#### Storing bot message:

```typescript
// Circuit breaker for storing bot message
await circuitBreakerService.execute(
  'dynamodb',
  'storeBotMessage',
  async () => {
    return await ddbDocClient.send(
      new PutCommand({
        TableName: process.env.WEBSOCKET_MESSAGES_TABLE,
        Item: {
          ...botMessage,
          ttl: Math.floor(now.getTime() / 1000) + 24 * 60 * 60,
          type: 'bot',
          connectionId,
          userId: user.userId,
        },
      })
    );
  },
  async () => {
    // Fallback behavior when DynamoDB is unavailable
    throw new Error('Database temporarily unavailable');
  },
  {
    failureThreshold: 3, // 3 failures before opening the circuit
    recoveryTimeout: 20000, // 20 seconds wait
    expectedResponseTime: 500, // 500ms expected response time
    monitoringWindow: 60000, // 1 minute monitoring window
    minimumRequestCount: 5, // Minimum 5 requests before opening the circuit
  }
);
```

**Configuration for DynamoDB:**

- **Failure threshold:** 3 consecutive failures
- **Recovery time:** 20 seconds
- **Expected response time:** 500ms
- **Monitoring window:** 1 minute

### 4. **Connection Service** (`apps/runtime/src/services/connection-service.ts`)

**Protected Operations:** Managing connections in DynamoDB

#### Storing connection:

```typescript
// Circuit breaker for storing connection
await circuitBreakerService.execute(
  'dynamodb',
  'storeConnection',
  async () => {
    return await ddbDocClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: connection,
      })
    );
  },
  async () => {
    // Fallback behavior when DynamoDB is unavailable
    throw new Error('Database temporarily unavailable');
  },
  {
    failureThreshold: 3, // 3 failures before opening the circuit
    recoveryTimeout: 20000, // 20 seconds wait
    expectedResponseTime: 500, // 500ms expected response time
    monitoringWindow: 60000, // 1 minute monitoring window
    minimumRequestCount: 5, // Minimum 5 requests before opening the circuit
  }
);
```

#### Removing connection:

```typescript
// Circuit breaker for removing connection
await circuitBreakerService.execute(
  'dynamodb',
  'removeConnection',
  async () => {
    return await ddbDocClient.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: { connectionId },
      })
    );
  },
  async () => {
    // Fallback behavior when DynamoDB is unavailable
    throw new Error('Database temporarily unavailable');
  },
  {
    failureThreshold: 3, // 3 failures before opening the circuit
    recoveryTimeout: 20000, // 20 seconds wait
    expectedResponseTime: 500, // 500ms expected response time
    monitoringWindow: 60000, // 1 minute monitoring window
    minimumRequestCount: 5, // Minimum 5 requests before opening the circuit
  }
);
```

## Monitoring Circuit Breakers

### In WebSocket Handlers

**File:** `apps/runtime/src/entry-points/api-gateway/websockets/conversation.ts`

```typescript
// Example: Get circuit breaker stats for monitoring
const circuitBreakerStats = container
  .getCircuitBreakerService()
  .getCircuitBreakerStats('cognito', 'verifyJWT');
if (circuitBreakerStats) {
  logger.info('Circuit breaker status', {
    service: 'cognito',
    operation: 'verifyJWT',
    state: circuitBreakerStats.state,
    failureRate: circuitBreakerStats.failureRate,
    totalRequests: circuitBreakerStats.totalRequests,
  });
}
```

### Available Statistics

```typescript
interface CircuitBreakerStats {
  state: CircuitState; // CLOSED, OPEN, HALF_OPEN
  failureCount: number; // Total number of failures
  successCount: number; // Total number of successes
  totalRequests: number; // Total requests
  lastFailureTime: Date | null; // Last failure
  lastSuccessTime: Date | null; // Last success
  nextAttemptTime: Date | null; // Next attempt (if open)
  failureRate: number; // Failure rate (0-1)
}
```

## Circuit Breaker States

### 1. **CLOSED**

- **State:** Normal operation
- **Behavior:** Requests pass through normally
- **Transition to OPEN:** When the failure threshold is reached

### 2. **OPEN**

- **State:** Circuit open, fast fail
- **Behavior:** Requests fail immediately without attempting the operation
- **Transition to HALF_OPEN:** After the recovery timeout

### 3. **HALF_OPEN**

- **State:** Testing if the service has recovered
- **Behavior:** Allows a single test request
- **Transition to CLOSED:** If the test request is successful
- **Transition to OPEN:** If the test request fails

## Configurations per Service

### Cognito (Authentication)

```typescript
{
  failureThreshold: 3,        // Sensitive to failures
  recoveryTimeout: 30000,     // Slow recovery
  expectedResponseTime: 2000, // JWT verification can be slow
  monitoringWindow: 60000,    // Long window for stability
  minimumRequestCount: 5,     // Minimum requests for stability
}
```

### API Gateway Management API

```typescript
{
  failureThreshold: 5,        // More tolerant to failures
  recoveryTimeout: 15000,     // Fast recovery
  expectedResponseTime: 1000, // Fast response expected
  monitoringWindow: 30000,    // Short window for fast response
  minimumRequestCount: 3,     // Fewer requests for stability
}
```

### DynamoDB (Database)

```typescript
{
  failureThreshold: 3,        // Sensitive to DB failures
  recoveryTimeout: 20000,     // Moderate recovery
  expectedResponseTime: 500,  // Fast response expected
  monitoringWindow: 60000,    // Long window for stability
  minimumRequestCount: 5,     // Minimum requests for stability
}
```

## Benefits of the Circuit Breaker

### 1. **Resilience**

- Prevents cascading failures
- Isolates problematic services
- Allows for automatic recovery

### 2. **Performance**

- Fast failure when services are down
- Reduces latency on failed requests
- Avoids unnecessary timeouts

### 3. **Monitoring**

- Visibility into the status of services
- Failure and success metrics
- Automatic alerts

### 4. **Graceful Degradation**

- Fallback behaviors
- Improved user experience
- Service continuity

## Next Steps

1. **Monitoring in CloudWatch:** Configure alerts based on the state of the circuit breakers
2. **Custom Metrics:** Create dashboards to visualize the status of services
3. **Dynamic Configuration:** Allow adjustment of configurations without redeployment
4. **Testing:** Create tests to validate the behavior of the circuit breakers

The `CircuitBreakerService` is now fully integrated into all services that make external calls, providing resilience and robust monitoring for the WebSocket application.
