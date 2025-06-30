# AWS Cloud Development Kit (CDK)

This document details the AWS Cloud Development Kit (CDK) code used to define and deploy the infrastructure for the AWS Lambda Hackathon project.

## Configuration

### Environment Variables

The project uses environment variables for configuration:

```bash
# Required variables
export ENVIRONMENT=dev                    # Deployment environment (dev, prod, etc.)
export AWS_REGION=us-east-2              # AWS Region
export APP_NAME=MyAwesomeApp             # Application name (default: MyAwesomeApp)
export CDK_DEFAULT_ACCOUNT=123456789012  # AWS Account ID (Crucial for successful deployment)

# Optional variables
export AWS_PROFILE=awslambdahackathon    # AWS Profile for deployment
```

### Default Values

- `ENVIRONMENT`: `dev`
- `AWS_REGION`: `us-east-2`
- `APP_NAME`: `MyAwesomeApp`
- `AWS_PROFILE`: `awslambdahackathon`

## Stacks

### AuthStack

- **Cognito User Pool**: Manages user authentication and authorization
- **User Pool Client**: Web application client for Cognito
- **User Groups**: Admins and Users groups
- **Default Password Secret**: Temporary password for default users

### RuntimeStack

-   **AWS Lambda Functions**: Serverless functions for API endpoints.
-   **Health Function**: `/health` endpoint with structured logging and metrics.
-   **MCP Host Function**: `/mcp-host` endpoint specifically designed to host the Model Context Protocol (MCP) for chatbot integration.
-   **WebSocket Functions**: AWS Lambda functions handling `$connect`, `$disconnect`, and `$default` routes for real-time WebSocket communication.
-   **DynamoDB Tables**: Stores WebSocket connections and chat messages.

### WebStack

- **S3 Bucket**: Static website hosting
- **CloudFront Distribution**: CDN for the frontend application
- **Origin Access Identity**: Secure access to S3 bucket

### RumStack

- **RUM App Monitor**: Real User Monitoring for performance insights

## Deployment Scripts

### Deploy

```bash
# Deploy with default settings
./scripts/deploy.sh

# Deploy with custom parameters
./scripts/deploy.sh dev awslambdahackathon us-east-2 demo@example.com MyAwesomeApp

# Parameters: [environment] [aws_profile] [region] [default_user_email] [app_name]
```

### Destroy

```bash
# Destroy with default settings
./scripts/destroy.sh

# Destroy with custom parameters
./scripts/destroy.sh dev awslambdahackathon us-east-2 MyAwesomeApp

# Parameters: [environment] [aws_profile] [region] [app_name]
```

### Generate Environment Variables

```bash
# Generate .env file for frontend
./scripts/generate-web-env.sh

# Generate with custom parameters
./scripts/generate-web-env.sh dev awslambdahackathon us-east-2 MyAwesomeApp

# Parameters: [environment] [aws_profile] [region] [app_name]
```

## Security Configuration

### API Authorization

- All API endpoints (except `/public`) require a valid Cognito JWT token
- Tokens are validated by API Gateway Cognito Authorizer
- Unauthorized requests return 401 Unauthorized

### CORS Configuration

- **Allowed Origins**: Only the CloudFront distribution domain
- **Allowed Methods**: GET, POST, PUT, DELETE, OPTIONS
- **Allowed Headers**: Content-Type, Authorization, X-Amz-Date, X-Api-Key, X-Amz-Security-Token
- **Credentials**: Enabled for authenticated requests

### User Pool Configuration

- **Self Sign-up**: Disabled (users must be created by admin)
- **Sign-in Aliases**: Email only
- **Password Policy**: 8+ characters, uppercase, lowercase, digits, symbols
- **Account Recovery**: Email only

## API Endpoints

### REST API Endpoints

- `GET /health` - Health check with user context
- `POST /mcp-host` - MCP Host endpoint

### WebSocket API Routes

- `$connect` - Handle WebSocket connections
- `$disconnect` - Handle WebSocket disconnections
- `$default` - Handle WebSocket messages

## Testing

### Public Endpoint (No Auth Required)

```bash
curl https://your-api-gateway-url.amazonaws.com/prod/public
```

### Protected Endpoint (Auth Required)

```bash
# Get JWT token from Cognito
TOKEN=$(aws cognito-idp admin-initiate-auth \
  --user-pool-id YOUR_USER_POOL_ID \
  --client-id YOUR_CLIENT_ID \
  --auth-flow ADMIN_NO_SRP_AUTH \
  --auth-parameters USERNAME=your-email@example.com,PASSWORD=your-password \
  --query 'AuthenticationResult.IdToken' \
  --output text)

# Use token in Authorization header
curl -H "Authorization: Bearer $TOKEN" \
  https://your-api-gateway-url.amazonaws.com/prod/health
```

## Outputs

After deployment, the following outputs are available:

- **ApiUrl**: API Gateway URL
- **WebSocketUrl**: WebSocket API URL
- **UserPoolId**: Cognito User Pool ID
- **UserPoolClientId**: Cognito User Pool Client ID
- **WebsiteUrl**: CloudFront Distribution URL
- **DistributionId**: CloudFront Distribution ID
- **RumAppMonitorId**: RUM App Monitor ID
