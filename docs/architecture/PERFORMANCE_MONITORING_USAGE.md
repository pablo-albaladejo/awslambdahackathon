# Performance Monitoring Service Usage Guide

This document explains where and how the `PerformanceMonitoringService` is used in the WebSocket application.

## Locations where PerformanceMonitoringService is used

### 1. **WebSocket Handlers** (General Performance Monitoring)

#### Conversation Handler (`apps/runtime/src/entry-points/api-gateway/websockets/conversation.ts`)

**Monitoring:** General performance of the conversation handler

```typescript
// Start performance monitoring
const performanceMonitor = container
  .getPerformanceMonitoringService()
  .startMonitoring('websocket_conversation', {
    connectionId: event.requestContext.connectionId,
    eventType: event.requestContext.eventType,
    routeKey: event.requestContext.routeKey,
    correlationId,
  });

// Complete successfully for authentication
performanceMonitor.complete(true, {
  messageType: 'auth',
  action: data.action,
  hasToken: !!data.token,
});

// Complete successfully for chat messages
performanceMonitor.complete(true, {
  messageType: 'message',
  action: data.action,
  messageLength: data.message?.length,
  sessionId: data.sessionId,
});

// Complete successfully for ping
performanceMonitor.complete(true, {
  messageType: 'ping',
  action: data.action,
});

// Complete with error
performanceMonitor.complete(false, {
  messageType: type,
  action,
  error: 'UNAUTHENTICATED_CONNECTION',
});
```

**Captured Metrics:**

- Execution duration
- Memory usage
- Processed message type
- Action performed
- Message length
- Authentication status
- Specific errors

#### Connection Handler (`apps/runtime/src/entry-points/api-gateway/websockets/connection.ts`)

**Monitoring:** Performance of the connection lifecycle

```typescript
// Start performance monitoring
const performanceMonitor = container
  .getPerformanceMonitoringService()
  .startMonitoring('websocket_connection', {
    connectionId: event.requestContext.connectionId,
    eventType: event.requestContext.eventType,
    requestId: event.requestContext.requestId,
  });

// Successful connection
performanceMonitor.complete(true, {
  eventType: 'connect',
  connectionId,
});

// Successful disconnection
performanceMonitor.complete(true, {
  eventType: 'disconnect',
  connectionId,
});

// Disconnection with failed cleanup warning
performanceMonitor.complete(true, {
  eventType: 'disconnect',
  connectionId,
  warning: 'cleanup_failed',
  error: appError.type,
});

// Connection error
performanceMonitor.complete(false, {
  eventType: 'connect',
  connectionId,
  error: appError.type,
  errorMessage: appError.message,
});
```

**Captured Metrics:**

- Connection/disconnection duration
- Event type (connect/disconnect)
- Cleanup errors
- Operation status

### 2. **Authentication Services** (JWT Verification Monitoring)

#### AuthenticationService (`apps/runtime/src/services/authentication-service.ts`)

**Monitoring:** Performance of JWT verification with Cognito

```typescript
// Start performance monitoring for authentication
const performanceMonitor = container
  .getPerformanceMonitoringService()
  .startMonitoring('authentication_jwt_verification', {
    tokenLength: token?.length,
    hasToken: !!token,
    correlationId: this.generateCorrelationId(),
  });

// Successful authentication
performanceMonitor.complete(true, {
  userId: user.userId,
  username: user.username,
  email: user.email,
  groups: user.groups,
});

// Expired token
performanceMonitor.complete(false, {
  error: 'TOKEN_EXPIRED',
  errorType,
  exp: payload.exp,
  now,
});

// Invalid token
performanceMonitor.complete(false, {
  error: 'INVALID_TOKEN',
  errorType,
  errorMessage: error instanceof Error ? error.message : String(error),
});

// Missing token
performanceMonitor.complete(false, {
  error: 'MISSING_TOKEN',
  errorType,
});
```

**Captured Metrics:**

- JWT verification duration
- Token length
- Authenticated user information
- Specific error types
- Expiration time vs. current time

### 3. **Chat Services** (Database Operations Monitoring)

#### ChatService (`apps/runtime/src/services/chat-service.ts`)

**Monitoring:** Performance of message processing and DB operations

```typescript
// Start performance monitoring for chat message processing
const performanceMonitor = container
  .getPerformanceMonitoringService()
  .startMonitoring('chat_message_processing', {
    connectionId,
    messageLength: message?.length,
    hasSessionId: !!sessionId,
    sessionId,
  });

// Successful processing
performanceMonitor.complete(true, {
  userId: user.userId,
  sessionId: currentSessionId,
  messageLength: message.length,
  messageType: 'user_and_bot',
});

// Processing error
performanceMonitor.complete(false, {
  error: error instanceof Error ? error.message : String(error),
  connectionId,
  messageLength: message?.length,
  sessionId,
});
```

**Captured Metrics:**

- Message processing duration
- Message length
- Session ID
- Database operations (storing user and bot messages)
- Processing errors

## Monitoring Configurations

### Performance Thresholds

```typescript
interface PerformanceThresholds {
  websocket_conversation: {
    duration: 5000,        // 5 seconds max
    memoryUsage: 100 * 1024 * 1024, // 100MB max
    errorRate: 0.05,       // 5% max errors
  };
  websocket_connection: {
    duration: 2000,        // 2 seconds max
    memoryUsage: 50 * 1024 * 1024,  // 50MB max
    errorRate: 0.02,       // 2% max errors
  };
  authentication_jwt_verification: {
    duration: 3000,        // 3 seconds max
    memoryUsage: 20 * 1024 * 1024,  // 20MB max
    errorRate: 0.10,       // 10% max errors
  };
  chat_message_processing: {
    duration: 1000,        // 1 second max
    memoryUsage: 30 * 1024 * 1024,  // 30MB max
    errorRate: 0.05,       // 5% max errors
  };
}
```

### Business Metrics

```typescript
interface BusinessMetrics {
  websocket_conversation: {
    messagesPerMinute: number;
    averageMessageLength: number;
    authenticationSuccessRate: number;
    messageTypes: {
      auth: number;
      message: number;
      ping: number;
    };
  };
  websocket_connection: {
    connectionsPerMinute: number;
    averageConnectionDuration: number;
    disconnectReasons: {
      normal: number;
      error: number;
      timeout: number;
    };
  };
  authentication_jwt_verification: {
    verificationAttemptsPerMinute: number;
    successRate: number;
    errorTypes: {
      MISSING_TOKEN: number;
      TOKEN_EXPIRED: number;
      INVALID_TOKEN: number;
    };
  };
  chat_message_processing: {
    messagesProcessedPerMinute: number;
    averageProcessingTime: number;
    databaseOperationsPerMessage: number;
  };
}
```

## Integration with CloudWatch

### Custom Metrics

```typescript
// Duration metrics
await cloudWatch
  .putMetricData({
    Namespace: 'WebSocket/Performance',
    MetricData: [
      {
        MetricName: 'HandlerDuration',
        Dimensions: [
          { Name: 'Handler', Value: 'websocket_conversation' },
          { Name: 'Environment', Value: process.env.ENVIRONMENT || 'dev' },
        ],
        Value: duration,
        Unit: 'Milliseconds',
        Timestamp: new Date(),
      },
    ],
  })
  .promise();

// Memory metrics
await cloudWatch
  .putMetricData({
    Namespace: 'WebSocket/Performance',
    MetricData: [
      {
        MetricName: 'MemoryUsage',
        Dimensions: [
          { Name: 'Handler', Value: 'websocket_conversation' },
          { Name: 'Environment', Value: process.env.ENVIRONMENT || 'dev' },
        ],
        Value: memoryUsage,
        Unit: 'Bytes',
        Timestamp: new Date(),
      },
    ],
  })
  .promise();

// Error rate metrics
await cloudWatch
  .putMetricData({
    Namespace: 'WebSocket/Performance',
    MetricData: [
      {
        MetricName: 'ErrorRate',
        Dimensions: [
          { Name: 'Handler', Value: 'websocket_conversation' },
          { Name: 'Environment', Value: process.env.ENVIRONMENT || 'dev' },
        ],
        Value: errorRate,
        Unit: 'Percent',
        Timestamp: new Date(),
      },
    ],
  })
  .promise();
```

### Automatic Alerts

```typescript
// Alert for excessive duration
const durationAlarm = new cloudwatch.Alarm(this, 'WebSocketDurationAlarm', {
  metric: new cloudwatch.Metric({
    namespace: 'WebSocket/Performance',
    metricName: 'HandlerDuration',
    dimensionsMap: {
      Handler: 'websocket_conversation',
      Environment: process.env.ENVIRONMENT || 'dev',
    },
    statistic: 'Average',
    period: Duration.minutes(1),
  }),
  threshold: 5000, // 5 seconds
  evaluationPeriods: 2,
  alarmDescription: 'WebSocket handler taking too long to respond',
});

// Alert for excessive memory usage
const memoryAlarm = new cloudwatch.Alarm(this, 'WebSocketMemoryAlarm', {
  metric: new cloudwatch.Metric({
    namespace: 'WebSocket/Performance',
    metricName: 'MemoryUsage',
    dimensionsMap: {
      Handler: 'websocket_conversation',
      Environment: process.env.ENVIRONMENT || 'dev',
    },
    statistic: 'Average',
    period: Duration.minutes(1),
  }),
  threshold: 100 * 1024 * 1024, // 100MB
  evaluationPeriods: 2,
  alarmDescription: 'WebSocket handler using too much memory',
});

// Alert for high error rate
const errorRateAlarm = new cloudwatch.Alarm(this, 'WebSocketErrorRateAlarm', {
  metric: new cloudwatch.Metric({
    namespace: 'WebSocket/Performance',
    metricName: 'ErrorRate',
    dimensionsMap: {
      Handler: 'websocket_conversation',
      Environment: process.env.ENVIRONMENT || 'dev',
    },
    statistic: 'Average',
    period: Duration.minutes(5),
  }),
  threshold: 5, // 5%
  evaluationPeriods: 2,
  alarmDescription: 'WebSocket handler error rate too high',
});
```

## Monitoring Dashboards

### General Performance Dashboard

```typescript
const performanceDashboard = new cloudwatch.Dashboard(
  this,
  'WebSocketPerformanceDashboard',
  {
    dashboardName: 'WebSocket-Performance',
    widgets: [
      [
        new cloudwatch.GraphWidget({
          title: 'Handler Duration',
          left: [
            new cloudwatch.Metric({
              namespace: 'WebSocket/Performance',
              metricName: 'HandlerDuration',
              dimensionsMap: { Handler: 'websocket_conversation' },
              statistic: 'Average',
            }),
            new cloudwatch.Metric({
              namespace: 'WebSocket/Performance',
              metricName: 'HandlerDuration',
              dimensionsMap: { Handler: 'websocket_connection' },
              statistic: 'Average',
            }),
          ],
          width: 12,
          height: 6,
        }),
      ],
      [
        new cloudwatch.GraphWidget({
          title: 'Memory Usage',
          left: [
            new cloudwatch.Metric({
              namespace: 'WebSocket/Performance',
              metricName: 'MemoryUsage',
              dimensionsMap: { Handler: 'websocket_conversation' },
              statistic: 'Average',
            }),
          ],
          width: 12,
          height: 6,
        }),
      ],
      [
        new cloudwatch.GraphWidget({
          title: 'Error Rate',
          left: [
            new cloudwatch.Metric({
              namespace: 'WebSocket/Performance',
              metricName: 'ErrorRate',
              dimensionsMap: { Handler: 'websocket_conversation' },
              statistic: 'Average',
            }),
          ],
          width: 12,
          height: 6,
        }),
      ],
    ],
  }
);
```

## Benefits of Performance Monitoring

### 1. **Real-Time Visibility**

- Real-time performance metrics
- Quick identification of bottlenecks
- Monitoring of performance trends

### 2. **Proactive Alerts**

- Early detection of problems
- Automatic alerts when thresholds are exceeded
- Reduction of incident response time

### 3. **Performance Optimization**

- Identification of slow operations
- Analysis of usage patterns
- Optimization based on real data

### 4. **Capacity Analysis**

- Resource planning
- Prediction of scaling needs
- Cost optimization

### 5. **Improved Debugging**

- Detailed error context
- Request traceability
- Root cause analysis

## Next Steps

1. **Alert Configuration:** Implement CloudWatch alerts based on performance metrics
2. **Custom Dashboards:** Create specific dashboards for different teams
3. **Trend Analysis:** Implement long-term trend analysis
4. **Automatic Optimization:** Configure auto-scaling based on performance metrics
5. **Performance Testing:** Create automated performance tests

The `PerformanceMonitoringService` is now fully integrated into all critical components of the application, providing full visibility of performance and facilitating continuous optimization.
