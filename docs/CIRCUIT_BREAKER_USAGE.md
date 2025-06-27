# Circuit Breaker Service Usage Guide

Este documento explica dónde y cómo se utiliza el `CircuitBreakerService` en la aplicación de WebSocket.

## Ubicaciones donde se usa CircuitBreakerService

### 1. **Servicio de Autenticación** (`apps/runtime/src/services/authentication-service.ts`)

**Operación Protegida:** Verificación de JWT con Cognito

```typescript
// Uso del circuit breaker para verificación de JWT
const payload = await circuitBreakerService.execute(
  'cognito',
  'verifyJWT',
  async () => {
    return await this.verifier.verify(token);
  },
  async () => {
    // Comportamiento de fallback cuando Cognito no está disponible
    logger.warn('Cognito service unavailable, using fallback authentication', {
      correlationId: this.generateCorrelationId(),
    });
    throw new Error('Authentication service temporarily unavailable');
  },
  {
    failureThreshold: 3, // 3 fallos antes de abrir el circuito
    recoveryTimeout: 30000, // 30 segundos de espera
    expectedResponseTime: 2000, // 2 segundos de tiempo de respuesta esperado
    monitoringWindow: 60000, // Ventana de monitoreo de 1 minuto
    minimumRequestCount: 5, // Mínimo 5 requests antes de abrir el circuito
  }
);
```

**Configuración:**

- **Umbral de fallos:** 3 fallos consecutivos
- **Tiempo de recuperación:** 30 segundos
- **Tiempo de respuesta esperado:** 2 segundos
- **Ventana de monitoreo:** 1 minuto

### 2. **Servicio de WebSocket Message** (`apps/runtime/src/services/websocket-message-service.ts`)

**Operación Protegida:** Envío de mensajes a través de API Gateway Management API

```typescript
// Uso del circuit breaker para envío de mensajes WebSocket
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
    // Comportamiento de fallback cuando API Gateway no está disponible
    logger.warn('API Gateway Management API unavailable, message not sent', {
      connectionId,
      messageType: message.type,
      correlationId: this.generateCorrelationId(),
    });
    throw new Error('WebSocket service temporarily unavailable');
  },
  {
    failureThreshold: 5, // 5 fallos antes de abrir el circuito
    recoveryTimeout: 15000, // 15 segundos de espera
    expectedResponseTime: 1000, // 1 segundo de tiempo de respuesta esperado
    monitoringWindow: 30000, // Ventana de monitoreo de 30 segundos
    minimumRequestCount: 3, // Mínimo 3 requests antes de abrir el circuito
  }
);
```

**Configuración:**

- **Umbral de fallos:** 5 fallos consecutivos
- **Tiempo de recuperación:** 15 segundos
- **Tiempo de respuesta esperado:** 1 segundo
- **Ventana de monitoreo:** 30 segundos

### 3. **Servicio de Chat** (`apps/runtime/src/services/chat-service.ts`)

**Operaciones Protegidas:** Almacenamiento de mensajes en DynamoDB

#### Almacenamiento de mensaje de usuario:

```typescript
// Circuit breaker para almacenamiento de mensaje de usuario
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
    // Comportamiento de fallback cuando DynamoDB no está disponible
    throw new Error('Database temporarily unavailable');
  },
  {
    failureThreshold: 3, // 3 fallos antes de abrir el circuito
    recoveryTimeout: 20000, // 20 segundos de espera
    expectedResponseTime: 500, // 500ms de tiempo de respuesta esperado
    monitoringWindow: 60000, // Ventana de monitoreo de 1 minuto
    minimumRequestCount: 5, // Mínimo 5 requests antes de abrir el circuito
  }
);
```

#### Almacenamiento de mensaje de bot:

```typescript
// Circuit breaker para almacenamiento de mensaje de bot
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
    // Comportamiento de fallback cuando DynamoDB no está disponible
    throw new Error('Database temporarily unavailable');
  },
  {
    failureThreshold: 3, // 3 fallos antes de abrir el circuito
    recoveryTimeout: 20000, // 20 segundos de espera
    expectedResponseTime: 500, // 500ms de tiempo de respuesta esperado
    monitoringWindow: 60000, // Ventana de monitoreo de 1 minuto
    minimumRequestCount: 5, // Mínimo 5 requests antes de abrir el circuito
  }
);
```

**Configuración para DynamoDB:**

- **Umbral de fallos:** 3 fallos consecutivos
- **Tiempo de recuperación:** 20 segundos
- **Tiempo de respuesta esperado:** 500ms
- **Ventana de monitoreo:** 1 minuto

### 4. **Servicio de Connection** (`apps/runtime/src/services/connection-service.ts`)

**Operaciones Protegidas:** Gestión de conexiones en DynamoDB

#### Almacenamiento de conexión:

```typescript
// Circuit breaker para almacenamiento de conexión
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
    // Comportamiento de fallback cuando DynamoDB no está disponible
    throw new Error('Database temporarily unavailable');
  },
  {
    failureThreshold: 3, // 3 fallos antes de abrir el circuito
    recoveryTimeout: 20000, // 20 segundos de espera
    expectedResponseTime: 500, // 500ms de tiempo de respuesta esperado
    monitoringWindow: 60000, // Ventana de monitoreo de 1 minuto
    minimumRequestCount: 5, // Mínimo 5 requests antes de abrir el circuito
  }
);
```

#### Eliminación de conexión:

```typescript
// Circuit breaker para eliminación de conexión
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
    // Comportamiento de fallback cuando DynamoDB no está disponible
    throw new Error('Database temporarily unavailable');
  },
  {
    failureThreshold: 3, // 3 fallos antes de abrir el circuito
    recoveryTimeout: 20000, // 20 segundos de espera
    expectedResponseTime: 500, // 500ms de tiempo de respuesta esperado
    monitoringWindow: 60000, // Ventana de monitoreo de 1 minuto
    minimumRequestCount: 5, // Mínimo 5 requests antes de abrir el circuito
  }
);
```

## Monitoreo de Circuit Breakers

### En los Handlers de WebSocket

**Archivo:** `apps/runtime/src/entry-points/api-gateway/websockets/conversation.ts`

```typescript
// Ejemplo: Obtener estadísticas del circuit breaker para monitoreo
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

### Estadísticas Disponibles

```typescript
interface CircuitBreakerStats {
  state: CircuitState; // CLOSED, OPEN, HALF_OPEN
  failureCount: number; // Número total de fallos
  successCount: number; // Número total de éxitos
  totalRequests: number; // Total de requests
  lastFailureTime: Date | null; // Último fallo
  lastSuccessTime: Date | null; // Último éxito
  nextAttemptTime: Date | null; // Próximo intento (si está abierto)
  failureRate: number; // Tasa de fallos (0-1)
}
```

## Estados del Circuit Breaker

### 1. **CLOSED** (Cerrado)

- **Estado:** Operación normal
- **Comportamiento:** Las requests pasan normalmente
- **Transición a OPEN:** Cuando se alcanza el umbral de fallos

### 2. **OPEN** (Abierto)

- **Estado:** Circuito abierto, fallo rápido
- **Comportamiento:** Las requests fallan inmediatamente sin intentar la operación
- **Transición a HALF_OPEN:** Después del tiempo de recuperación

### 3. **HALF_OPEN** (Semi-abierto)

- **Estado:** Probando si el servicio se recuperó
- **Comportamiento:** Permite una request de prueba
- **Transición a CLOSED:** Si la request de prueba es exitosa
- **Transición a OPEN:** Si la request de prueba falla

## Configuraciones por Servicio

### Cognito (Autenticación)

```typescript
{
  failureThreshold: 3,        // Sensible a fallos
  recoveryTimeout: 30000,     // Recuperación lenta
  expectedResponseTime: 2000, // JWT verification puede ser lenta
  monitoringWindow: 60000,    // Ventana larga para estabilidad
  minimumRequestCount: 5,     // Mínimo de requests para estabilidad
}
```

### API Gateway Management API

```typescript
{
  failureThreshold: 5,        // Más tolerante a fallos
  recoveryTimeout: 15000,     // Recuperación rápida
  expectedResponseTime: 1000, // Respuesta rápida esperada
  monitoringWindow: 30000,    // Ventana corta para respuesta rápida
  minimumRequestCount: 3,     // Menos requests para estabilidad
}
```

### DynamoDB (Base de Datos)

```typescript
{
  failureThreshold: 3,        // Sensible a fallos de DB
  recoveryTimeout: 20000,     // Recuperación moderada
  expectedResponseTime: 500,  // Respuesta rápida esperada
  monitoringWindow: 60000,    // Ventana larga para estabilidad
  minimumRequestCount: 5,     // Mínimo de requests para estabilidad
}
```

## Beneficios del Circuit Breaker

### 1. **Resiliencia**

- Previene fallos en cascada
- Aísla servicios problemáticos
- Permite recuperación automática

### 2. **Performance**

- Fallo rápido cuando los servicios están caídos
- Reduce latencia en requests fallidas
- Evita timeouts innecesarios

### 3. **Monitoreo**

- Visibilidad del estado de los servicios
- Métricas de fallos y éxitos
- Alertas automáticas

### 4. **Graceful Degradation**

- Comportamientos de fallback
- Experiencia de usuario mejorada
- Continuidad del servicio

## Próximos Pasos

1. **Monitoreo en CloudWatch:** Configurar alertas basadas en el estado de los circuit breakers
2. **Métricas Personalizadas:** Crear dashboards para visualizar el estado de los servicios
3. **Configuración Dinámica:** Permitir ajuste de configuraciones sin redeploy
4. **Testing:** Crear tests para validar el comportamiento de los circuit breakers

El `CircuitBreakerService` está ahora completamente integrado en todos los servicios que realizan llamadas externas, proporcionando resiliencia y monitoreo robusto para la aplicación de WebSocket.
