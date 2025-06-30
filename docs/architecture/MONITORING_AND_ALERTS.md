# Monitoring and Alerting System

This document describes the comprehensive monitoring and alerting system implemented for the AWS Lambda Hackathon application.

## Overview

The application now includes a complete monitoring and alerting system with:

- **Custom CloudWatch Metrics** for all critical operations
- **Structured Logging** with correlation IDs for request tracking
- **CloudWatch Alarms** for proactive alerting
- **CloudWatch Dashboard** for real-time visualization
- **SNS Notifications** for alarm delivery

## Metrics Collected

### Authentication Metrics

- `authentication_duration` - Time taken for authentication operations
- `authentication_success_count` - Number of successful authentications
- `authentication_failure_count` - Number of failed authentications
- `authentication_total_count` - Total number of authentication attempts

### Database Metrics

- `database_store_connection_duration` - Time to store connection in DynamoDB
- `database_get_connection_duration` - Time to retrieve connection from DynamoDB
- `database_remove_connection_duration` - Time to remove connection from DynamoDB
- `database_cleanup_expired_duration` - Time for cleanup operations
- Success/failure counts for each operation

### WebSocket Metrics

- `websocket_connect_duration` - Time for WebSocket connections
- `websocket_disconnect_duration` - Time for WebSocket disconnections
- `websocket_message_sent_duration` - Time to send messages
- `websocket_message_received_duration` - Time to process received messages
- `websocket_ping_duration` - Time for ping operations
- `websocket_message_processed_duration` - Time to process messages
- Success/failure counts for each operation

### Business Metrics

- `authentication_success` - Successful authentication events
- `authentication_failure` - Failed authentication events
- `message_processed` - Successfully processed messages
- `error_count` - Total error count by type and operation

### System Metrics

- `active_connections` - Number of active WebSocket connections
- `message_throughput_sent` - Messages sent per second
- `message_throughput_received` - Messages received per second

## CloudWatch Alarms

### Lambda Performance Alarms

- **Lambda Error Rate**: Triggers when error rate exceeds 5%
- **Lambda Duration**: Triggers when average duration exceeds 10 seconds

### Authentication Alarms

- **Authentication Error Rate**: Triggers when authentication failures exceed 10 per 5 minutes
- **High Latency**: Triggers when authentication takes longer than 5 seconds
- **Low Success Rate**: Triggers when success rate falls below 90%

### Database Alarms

- **Database Error Rate**: Triggers when database operation failures exceed 5 per 5 minutes

### WebSocket Alarms

- **WebSocket Error Rate**: Triggers when WebSocket operation failures exceed 10 per 5 minutes

## CloudWatch Dashboard

The application creates a comprehensive dashboard with the following widgets:

1. **Lambda Performance**

   - Duration metrics
   - Error counts

2. **Authentication Metrics**

   - Authentication duration
   - Success/failure counts

3. **Database Operations**

   - Database operation duration
   - Success/failure counts

4. **WebSocket Metrics**
   - WebSocket operation duration
   - Success/failure counts

## Structured Logging

All logs now include:

- **Correlation IDs** for request tracking across services
- **Structured JSON format** for easy parsing
- **Consistent log levels** (DEBUG, INFO, WARN, ERROR)
- **Contextual information** for each operation

### Log Format Example

```json
{
  "level": "INFO",
  "message": "User authenticated successfully",
  "userId": "user-123",
  "username": "john.doe",
  "correlationId": "auth-1234567890-abc123def",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## SNS Notifications

All CloudWatch alarms are configured to send notifications to an SNS topic. The topic ARN is available as a CloudFormation output.

### Notification Format

```json
{
  "AlarmName": "MyAwesomeApp-auth-error-rate-dev",
  "AlarmDescription": "Authentication error rate is too high",
  "AWSAccountId": "123456789012",
  "NewStateValue": "ALARM",
  "NewStateReason": "Threshold Crossed",
  "StateChangeTime": "2024-01-01T12:00:00.000Z",
  "Region": "us-east-1",
  "AlarmArn": "arn:aws:cloudwatch:us-east-1:123456789012:alarm:MyAwesomeApp-auth-error-rate-dev"
}
```

## Configuration

### Environment Variables

The following environment variables are used for monitoring:

- `POWERTOOLS_METRICS_NAMESPACE` - CloudWatch metrics namespace
- `POWERTOOLS_SERVICE_NAME` - Service name for metrics
- `ENVIRONMENT` - Environment name (dev, staging, prod)
- `LOG_LEVEL` - Logging level (DEBUG, INFO, WARN, ERROR)

### IAM Permissions

Lambda functions require the following permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["cloudwatch:PutMetricData"],
      "Resource": "*"
    }
  ]
}
```

## Monitoring Best Practices

### 1. Set Up Email Notifications

Subscribe to the SNS topic with your email address to receive alarm notifications.

### 2. Configure Escalation

Set up escalation policies for critical alarms:

- PagerDuty integration for immediate response
- Slack/Teams notifications for team awareness
- Email escalation for management

### 3. Regular Review

- Review dashboard weekly for trends
- Analyze error patterns monthly
- Update thresholds based on historical data

### 4. Performance Optimization

- Monitor Lambda cold start times
- Track DynamoDB read/write capacity
- Watch WebSocket connection patterns

## Troubleshooting

### Common Issues

1. **Metrics Not Appearing**

   - Check IAM permissions
   - Verify namespace configuration
   - Ensure correlation IDs are being generated

2. **Alarms Not Triggering**

   - Verify metric names match alarm configuration
   - Check evaluation periods and thresholds
   - Ensure SNS topic is properly configured

3. **High Log Volume**
   - Adjust log levels for non-production environments
   - Implement log retention policies
   - Use CloudWatch Logs Insights for analysis

### Debug Commands

```bash
# Check CloudWatch metrics
aws cloudwatch list-metrics --namespace "MyAwesomeApp"

# Get alarm history
aws cloudwatch describe-alarm-history --alarm-name "MyAwesomeApp-auth-error-rate-dev"

# Check SNS topic subscriptions
aws sns list-subscriptions-by-topic --topic-arn "arn:aws:sns:us-east-1:123456789012:MyAwesomeApp-alarms-dev"
```

## Cost Considerations

- **CloudWatch Metrics**: $0.30 per metric per month
- **CloudWatch Alarms**: $0.10 per alarm metric per month
- **SNS Notifications**: $0.50 per million notifications
- **CloudWatch Logs**: $0.50 per GB ingested

### Cost Optimization

- Use metric math to reduce metric count
- Implement log retention policies
- Use sampling for high-volume metrics
- Consolidate similar alarms

## Future Enhancements

1. **X-Ray Integration** for distributed tracing
2. **Custom Dashboards** for business metrics
3. **Anomaly Detection** using CloudWatch Anomaly Detection
4. **Automated Remediation** using Lambda functions
5. **Performance Insights** for database optimization
