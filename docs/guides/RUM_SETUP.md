# AWS CloudWatch Real User Monitoring (RUM) Setup Guide

This guide explains how to set up and configure AWS CloudWatch Real User Monitoring (RUM) for the AWS Lambda Hackathon project's frontend application.

## 🎯 Overview

AWS CloudWatch RUM provides real-time monitoring of web application performance and user experience. It helps you:

- **Monitor Core Web Vitals** (LCP, FID, CLS)
- **Track user interactions** and session data
- **Identify performance bottlenecks**
- **Detect errors** in real-time
- **Analyze user journeys**

## 🚀 Quick Setup

### 1. Prerequisites

- AWS CLI installed and configured
- AWS credentials with appropriate permissions
- Node.js and npm/yarn installed

### 2. Run Setup Script

```bash
# Make script executable
chmod +x scripts/setup-rum.sh

# Run the setup script
./scripts/setup-rum.sh
```

The script will:

- Create RUM Application Monitor
- Set up IAM roles and policies
- Create Cognito Identity Pool
- Deploy CloudFormation stack with dashboards
- Generate environment variables

### 3. Configure Environment Variables

Copy the generated environment variables from `.env.rum` to your deployment configuration:

```bash
# Copy to your main .env file
cp .env.rum .env

# Or add to your deployment platform (Vercel, Netlify, etc.)
```

## 📊 Configuration Details

### Environment Variables

| Variable                        | Description                            | Example                                         |
| ------------------------------- | -------------------------------------- | ----------------------------------------------- |
| `VITE_AWS_RUM_APPLICATION_ID`   | RUM Application Monitor ID             | `abc123def456`                                  |
| `VITE_AWS_RUM_GUEST_ROLE_ARN`   | IAM Role ARN for unauthenticated users | `arn:aws:iam::123456789012:role/RUMServiceRole` |
| `VITE_AWS_RUM_IDENTITY_POOL_ID` | Cognito Identity Pool ID               | `us-east-1:abc123def456`                        |
| `VITE_AWS_REGION`               | AWS Region                             | `us-east-1`                                     |
| `VITE_APP_VERSION`              | Application version                    | `1.0.0`                                         |

### RUM Configuration

The RUM configuration includes:

```typescript
// Telemetries collected
telemetries: [
  'performance',    // Core Web Vitals, page load times
  'errors',         // JavaScript errors, unhandled rejections
  'http',           // API calls, network requests
  'interaction',    // User clicks, form submissions
  'user-session',   // Session data, user journey
]

// Performance thresholds
performanceThresholds: {
  pageLoadTime: 3000,           // 3 seconds
  firstContentfulPaint: 1500,   // 1.5 seconds
  largestContentfulPaint: 2500, // 2.5 seconds
  cumulativeLayoutShift: 0.1,   // 0.1
  firstInputDelay: 100,         // 100ms
  timeToInteractive: 3500,      // 3.5 seconds
}
```

## 🔧 Integration with Application

### 1. Initialize RUM in App

The RUM is automatically initialized in production mode:

```typescript
// apps/web/src/contexts/RumContext.tsx
export const AwsRumProvider: React.FC<RumProviderProps> = ({ children }) => {
  useEffect(() => {
    const initializeRUM = async () => {
      const isProd = process.env.NODE_ENV === 'production';

      if (isProd) {
        const rum = await initializeProductionRUM();
        // RUM is now active
      }
    };

    initializeRUM();
  }, []);
};
```

### 2. Track Custom Events

```typescript
import { useRumTracking } from './contexts/RumContext';

const MyComponent = () => {
  const { trackEvent, trackUserAction, trackPerformance } = useRumTracking();

  const handleButtonClick = () => {
    // Track user action
    trackUserAction('button_click', {
      buttonId: 'submit-form',
      page: 'checkout',
    });
  };

  const handleApiCall = async () => {
    const startTime = performance.now();

    try {
      await apiCall();

      // Track performance
      trackPerformance('api_response_time', performance.now() - startTime, {
        endpoint: '/api/data',
      });
    } catch (error) {
      // Track error
      trackError(error, 'api_call_failed');
    }
  };
};
```

### 3. Automatic Tracking

The following events are automatically tracked:

- **Page Views**: Every route change
- **Errors**: Unhandled errors and promise rejections
- **Performance**: Core Web Vitals, memory usage
- **User Interactions**: Clicks, form submissions
- **WebSocket Events**: Connection, messages, errors

## 📈 Monitoring Dashboard

### CloudWatch Dashboard

The setup creates a comprehensive dashboard with:

1. **Page Load Performance**

   - Page Load Time
   - First Contentful Paint
   - Largest Contentful Paint

2. **Error Rates**

   - Total Error Count
   - HTTP Error Count
   - JavaScript Error Count

3. **User Engagement**

   - Session Count
   - User Count
   - Session Duration

4. **Core Web Vitals**
   - First Input Delay
   - Cumulative Layout Shift

### Accessing the Dashboard

```bash
# Get dashboard URL from environment
echo $RUM_DASHBOARD_URL

# Or access directly
https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=awslambdahackathon-web-rum-dashboard
```

## 🚨 Alerts and Notifications

### CloudWatch Alarms

The setup creates automatic alarms for:

1. **High Error Rate**

   - Triggers when error count > 10 in 5 minutes
   - Helps identify application issues quickly

2. **Slow Page Load**
   - Triggers when average page load time > 3 seconds
   - Indicates performance degradation

### Setting Up Notifications

```bash
# Create SNS topic for notifications
aws sns create-topic --name "rum-alerts" --region us-east-1

# Subscribe to topic
aws sns subscribe \
  --topic-arn "arn:aws:sns:us-east-1:123456789012:rum-alerts" \
  --protocol email \
  --notification-endpoint "your-email@example.com"
```

## 🔍 Troubleshooting

### Common Issues

1. **RUM not initializing**

   ```bash
   # Check environment variables
   echo $VITE_AWS_RUM_APPLICATION_ID

   # Check browser console for errors
   # Verify IAM permissions
   ```

2. **No data in dashboard**

   ```bash
   # Wait 5-15 minutes for data to appear
   # Check if application is generating traffic
   # Verify RUM configuration
   ```

3. **Permission errors**

   ```bash
   # Verify IAM role permissions
   aws iam get-role --role-name RUMServiceRole-awslambdahackathon-web

   # Check CloudWatch permissions
   aws cloudwatch describe-alarms --region us-east-1
   ```

### Debug Mode

Enable debug logging in development:

```typescript
// In development, RUM events are logged to console
logger.info('[RUM Event] user_login', { userId: '123' });
logger.info('[RUM Performance] page_load: 1200ms');
```

## 📊 Metrics and KPIs

### Key Performance Indicators

1. **Performance Metrics**

   - Page Load Time: < 3 seconds
   - First Contentful Paint: < 1.5 seconds
   - Largest Contentful Paint: < 2.5 seconds
   - First Input Delay: < 100ms

2. **Error Metrics**

   - Error Rate: < 1%
   - JavaScript Error Rate: < 0.5%
   - HTTP Error Rate: < 2%

3. **User Experience**
   - Session Duration: > 2 minutes
   - Bounce Rate: < 50%
   - Page Views per Session: > 3

### Custom Metrics

Track business-specific metrics:

```typescript
// Chat application metrics
trackPerformance('message_response_time', responseTime);
trackPerformance('websocket_connection_time', connectionTime);
trackEvent('chat_session_start', { sessionId: 'abc123' });
trackEvent('message_sent', { messageLength: 50 });
```

## 🔒 Security and Privacy

### Data Privacy

- **No PII**: RUM doesn't collect personally identifiable information
- **Session Data**: Only session-level data is collected
- **User Consent**: Consider implementing consent management

### Security Best Practices

1. **IAM Roles**: Use least privilege principle
2. **HTTPS Only**: Ensure all data transmission is encrypted
3. **Environment Variables**: Never commit secrets to version control
4. **Access Control**: Limit dashboard access to authorized users

## 🚀 Production Deployment

### 1. Environment Setup

```bash
# Production environment variables
VITE_AWS_RUM_APPLICATION_ID=your-rum-app-id
VITE_AWS_RUM_GUEST_ROLE_ARN=arn:aws:iam::account:role/RUMServiceRole
VITE_AWS_RUM_IDENTITY_POOL_ID=us-east-1:pool-id
VITE_AWS_REGION=us-east-1
VITE_APP_VERSION=1.0.0
```

### 2. Deployment Platforms

**Vercel:**

```bash
# Add to Vercel environment variables
vercel env add VITE_AWS_RUM_APPLICATION_ID
vercel env add VITE_AWS_RUM_GUEST_ROLE_ARN
# ... add all variables
```

**Netlify:**

```bash
# Add to Netlify environment variables in dashboard
# Or use netlify.toml
[context.production.environment]
  VITE_AWS_RUM_APPLICATION_ID = "your-rum-app-id"
```

**AWS Amplify:**

```bash
# Add to Amplify environment variables
amplify env add VITE_AWS_RUM_APPLICATION_ID
```

### 3. Verification

After deployment:

1. **Check RUM Console**: Verify data is being collected
2. **Monitor Dashboard**: Check for performance metrics
3. **Test Alerts**: Trigger test events to verify alarms
4. **Review Logs**: Check for any initialization errors

## 📚 Additional Resources

### Documentation

- [AWS CloudWatch RUM Documentation](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-RUM.html)
- [RUM Web Client Documentation](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-RUM-web-client.html)
- [CloudWatch Metrics](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/working_with_metrics.html)

### Tools

- [AWS RUM Web Client](https://www.npmjs.com/package/aws-rum-web)
- [CloudWatch CLI](https://docs.aws.amazon.com/cli/latest/reference/cloudwatch/)
- [AWS CloudFormation](https://docs.aws.amazon.com/cloudformation/)

### Best Practices

- [Web Performance Best Practices](https://web.dev/performance/)
- [Core Web Vitals](https://web.dev/vitals/)
- [Real User Monitoring](https://web.dev/rum/)

---

_This guide is maintained as part of the AWS Lambda Hackathon project. For questions or contributions, please refer to the project repository._
