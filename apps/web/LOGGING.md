# Frontend Logging with CloudWatch RUM

This frontend application uses AWS CloudWatch RUM (Real User Monitoring) for comprehensive logging and monitoring.

## Features

- **Real-time monitoring** of user interactions
- **Error tracking** with full stack traces
- **Performance monitoring** of page loads and interactions
- **HTTP request monitoring** for API calls
- **Automatic fallback** to console logging when RUM is not available

## Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# CloudWatch RUM Configuration
VITE_RUM_APPLICATION_ID=your-application-id
VITE_RUM_APPLICATION_VERSION=1.0.0
VITE_RUM_APPLICATION_REGION=us-east-1
VITE_RUM_GUEST_ROLE_ARN=arn:aws:iam::123456789012:role/RUM-Monitoring-...
VITE_RUM_IDENTITY_POOL_ID=us-east-1:12345678-1234-1234-1234-123456789012
VITE_RUM_ENDPOINT=https://dataplane.rum.us-east-1.amazonaws.com
```

### Setup CloudWatch RUM

1. **Create RUM App Monitor** in AWS Console:

   - Go to CloudWatch > RUM
   - Create app monitor
   - Get the Application ID, Guest Role ARN, and Identity Pool ID

2. **Configure IAM Roles**:
   - Guest role for unauthenticated users
   - User role for authenticated users (optional)

## Usage

### Basic Logging

```typescript
import { logger } from '@awslambdahackathon/utils';

// Info logging
logger.info('User logged in', { userId: '123', method: 'email' });

// Error logging
logger.error('API call failed', {
  endpoint: '/api/users',
  status: 500,
  error: error.message,
});

// Warning logging
logger.warn('Deprecated feature used', { feature: 'old-api' });

// Debug logging
logger.debug('Component rendered', { component: 'UserProfile' });
```

### Automatic Monitoring

CloudWatch RUM automatically monitors:

- **Page views** and navigation
- **JavaScript errors** with stack traces
- **Performance metrics** (load times, interactions)
- **HTTP requests** to your API
- **User sessions** and interactions

## Viewing Logs

### CloudWatch Console

1. Go to **CloudWatch > RUM**
2. Select your application
3. View real-time metrics and logs

### Available Metrics

- **Error rate** and error details
- **Page load performance**
- **User session duration**
- **Geographic distribution**
- **Device and browser statistics**

### Log Structure

Each log entry includes:

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "info",
  "message": "User action",
  "data": {
    "userId": "123",
    "action": "login"
  },
  "sessionId": "session-123",
  "userId": "user-123",
  "userAgent": "Mozilla/5.0...",
  "url": "https://yourapp.com/dashboard"
}
```

## Fallback Behavior

When CloudWatch RUM is not available (development, network issues, etc.), the logger automatically falls back to console logging:

```typescript
// Falls back to console.log, console.error, etc.
logger.info('This will use console.log if RUM is not available');
```

## Best Practices

1. **Structured Logging**: Always pass structured data as the second parameter
2. **Error Context**: Include relevant context when logging errors
3. **Performance**: Avoid logging sensitive information
4. **Sampling**: Use appropriate sampling rates for high-traffic applications

## Troubleshooting

### RUM Not Initializing

- Check environment variables are set correctly
- Verify IAM roles have proper permissions
- Check browser console for initialization errors

### No Logs Appearing

- Verify Application ID is correct
- Check network connectivity to RUM endpoint
- Ensure telemetries are enabled in configuration

### Performance Impact

- RUM has minimal performance impact
- Use sampling rates to reduce data volume
- Monitor bundle size with RUM included
