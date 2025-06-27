# Performance Monitoring Service Usage Guide

Este documento explica dónde y cómo se utiliza el `PerformanceMonitoringService` en la aplicación de WebSocket.

## Ubicaciones donde se usa PerformanceMonitoringService

### 1. **Handlers de WebSocket** (Monitoreo de Performance General)

#### Conversation Handler (`apps/runtime/src/entry-points/api-gateway/websockets/conversation.ts`)

**Monitoreo de:** Performance general del handler de conversación

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

// Completar con éxito para autenticación
performanceMonitor.complete(true, {
  messageType: 'auth',
  action: data.action,
  hasToken: !!data.token,
});

// Completar con éxito para mensajes de chat
performanceMonitor.complete(true, {
  messageType: 'message',
  action: data.action,
  messageLength: data.message?.length,
  sessionId: data.sessionId,
});

// Completar con éxito para ping
performanceMonitor.complete(true, {
  messageType: 'ping',
  action: data.action,
});

// Completar con error
performanceMonitor.complete(false, {
  messageType: type,
  action,
  error: 'UNAUTHENTICATED_CONNECTION',
});
```

**Métricas Capturadas:**

- Duración de ejecución
- Uso de memoria
- Tipo de mensaje procesado
- Acción realizada
- Longitud del mensaje
- Estado de autenticación
- Errores específicos

#### Connection Handler (`apps/runtime/src/entry-points/api-gateway/websockets/connection.ts`)

**Monitoreo de:** Performance del ciclo de vida de conexiones

```typescript
// Start performance monitoring
const performanceMonitor = container
  .getPerformanceMonitoringService()
  .startMonitoring('websocket_connection', {
    connectionId: event.requestContext.connectionId,
    eventType: event.requestContext.eventType,
    requestId: event.requestContext.requestId,
  });

// Conexión exitosa
performanceMonitor.complete(true, {
  eventType: 'connect',
  connectionId,
});

// Desconexión exitosa
performanceMonitor.complete(true, {
  eventType: 'disconnect',
  connectionId,
});

// Desconexión con warning de limpieza fallida
performanceMonitor.complete(true, {
  eventType: 'disconnect',
  connectionId,
  warning: 'cleanup_failed',
  error: appError.type,
});

// Error de conexión
performanceMonitor.complete(false, {
  eventType: 'connect',
  connectionId,
  error: appError.type,
  errorMessage: appError.message,
});
```

**Métricas Capturadas:**

- Duración de conexión/desconexión
- Tipo de evento (connect/disconnect)
- Errores de limpieza
- Estado de la operación

### 2. **Servicios de Autenticación** (Monitoreo de JWT Verification)

#### AuthenticationService (`apps/runtime/src/services/authentication-service.ts`)

**Monitoreo de:** Performance de verificación de JWT con Cognito

```typescript
// Start performance monitoring for authentication
const performanceMonitor = container
  .getPerformanceMonitoringService()
  .startMonitoring('authentication_jwt_verification', {
    tokenLength: token?.length,
    hasToken: !!token,
    correlationId: this.generateCorrelationId(),
  });

// Autenticación exitosa
performanceMonitor.complete(true, {
  userId: user.userId,
  username: user.username,
  email: user.email,
  groups: user.groups,
});

// Token expirado
performanceMonitor.complete(false, {
  error: 'TOKEN_EXPIRED',
  errorType,
  exp: payload.exp,
  now,
});

// Token inválido
performanceMonitor.complete(false, {
  error: 'INVALID_TOKEN',
  errorType,
  errorMessage: error instanceof Error ? error.message : String(error),
});

// Token faltante
performanceMonitor.complete(false, {
  error: 'MISSING_TOKEN',
  errorType,
});
```

**Métricas Capturadas:**

- Duración de verificación JWT
- Longitud del token
- Información del usuario autenticado
- Tipos de error específicos
- Tiempo de expiración vs tiempo actual

### 3. **Servicios de Chat** (Monitoreo de Operaciones de Base de Datos)

#### ChatService (`apps/runtime/src/services/chat-service.ts`)

**Monitoreo de:** Performance de procesamiento de mensajes y operaciones de DB

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

// Procesamiento exitoso
performanceMonitor.complete(true, {
  userId: user.userId,
  sessionId: currentSessionId,
  messageLength: message.length,
  messageType: 'user_and_bot',
});

// Error en procesamiento
performanceMonitor.complete(false, {
  error: error instanceof Error ? error.message : String(error),
  connectionId,
  messageLength: message?.length,
  sessionId,
});
```

**Métricas Capturadas:**

- Duración de procesamiento de mensajes
- Longitud del mensaje
- ID de sesión
- Operaciones de base de datos (almacenamiento de mensajes de usuario y bot)
- Errores de procesamiento

## Configuraciones de Monitoreo

### Umbrales de Performance

```typescript
interface PerformanceThresholds {
  websocket_conversation: {
    duration: 5000,        // 5 segundos máximo
    memoryUsage: 100 * 1024 * 1024, // 100MB máximo
    errorRate: 0.05,       // 5% máximo de errores
  };
  websocket_connection: {
    duration: 2000,        // 2 segundos máximo
    memoryUsage: 50 * 1024 * 1024,  // 50MB máximo
    errorRate: 0.02,       // 2% máximo de errores
  };
  authentication_jwt_verification: {
    duration: 3000,        // 3 segundos máximo
    memoryUsage: 20 * 1024 * 1024,  // 20MB máximo
    errorRate: 0.10,       // 10% máximo de errores
  };
  chat_message_processing: {
    duration: 1000,        // 1 segundo máximo
    memoryUsage: 30 * 1024 * 1024,  // 30MB máximo
    errorRate: 0.05,       // 5% máximo de errores
  };
}
```

### Métricas de Negocio

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

## Integración con CloudWatch

### Métricas Personalizadas

```typescript
// Métricas de duración
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

// Métricas de memoria
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

// Métricas de tasa de errores
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

### Alertas Automáticas

```typescript
// Alerta por duración excesiva
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
  threshold: 5000, // 5 segundos
  evaluationPeriods: 2,
  alarmDescription: 'WebSocket handler taking too long to respond',
});

// Alerta por uso de memoria excesivo
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

// Alerta por tasa de errores alta
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

## Dashboards de Monitoreo

### Dashboard de Performance General

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

## Beneficios del Performance Monitoring

### 1. **Visibilidad en Tiempo Real**

- Métricas de performance en tiempo real
- Identificación rápida de cuellos de botella
- Monitoreo de tendencias de performance

### 2. **Alertas Proactivas**

- Detección temprana de problemas
- Alertas automáticas cuando se exceden umbrales
- Reducción del tiempo de respuesta a incidentes

### 3. **Optimización de Performance**

- Identificación de operaciones lentas
- Análisis de patrones de uso
- Optimización basada en datos reales

### 4. **Análisis de Capacidad**

- Planificación de recursos
- Predicción de necesidades de escalado
- Optimización de costos

### 5. **Debugging Mejorado**

- Contexto detallado de errores
- Trazabilidad de requests
- Análisis de causas raíz

## Próximos Pasos

1. **Configuración de Alertas:** Implementar alertas de CloudWatch basadas en métricas de performance
2. **Dashboards Personalizados:** Crear dashboards específicos para diferentes equipos
3. **Análisis de Tendencias:** Implementar análisis de tendencias a largo plazo
4. **Optimización Automática:** Configurar auto-scaling basado en métricas de performance
5. **Testing de Performance:** Crear tests de performance automatizados

El `PerformanceMonitoringService` está ahora completamente integrado en todos los componentes críticos de la aplicación, proporcionando visibilidad completa del performance y facilitando la optimización continua.
