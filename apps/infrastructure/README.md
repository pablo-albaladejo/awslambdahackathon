# Infrastructure

This directory contains the AWS CDK infrastructure code for the AWS Lambda Hackathon project.

## Stacks

### AuthStack

- **Cognito User Pool**: Manages user authentication and authorization
- **User Pool Client**: Web application client for Cognito
- **User Groups**: Admins and Users groups
- **Default Password Secret**: Temporary password for default users

### BackendStack

- **Lambda Functions**: Serverless functions for API endpoints
- **Health Function**: `/health` endpoint with structured logging and metrics

### ApiStack

- **API Gateway**: REST API with Cognito authorization
- **CORS Configuration**: Restricted to CloudFront domain only
- **Authorized Endpoints**: All endpoints require valid Cognito JWT token
- **Public Endpoints**: `/public` endpoint for testing (no auth required)

### WebStack

- **S3 Bucket**: Static website hosting
- **CloudFront Distribution**: CDN for the frontend application
- **Origin Access Identity**: Secure access to S3 bucket

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

### Protected Endpoints (Require Authentication)

- `GET /health` - Health check with user context

### Public Endpoints (No Authentication Required)

- `GET /public` - Public health check for testing

## Deployment

```bash
# Deploy all stacks
npm run deploy

# Deploy specific environment
npm run deploy:dev
npm run deploy:prod

# Destroy all stacks
npm run destroy
```

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

## Environment Variables

- `CDK_DEFAULT_ACCOUNT`: AWS Account ID
- `CDK_DEFAULT_REGION`: AWS Region
- `environment`: Deployment environment (dev/prod)

## Outputs

After deployment, the following outputs are available:

- **ApiUrl**: API Gateway URL
- **UserPoolId**: Cognito User Pool ID
- **UserPoolClientId**: Cognito User Pool Client ID
- **WebsiteUrl**: CloudFront Distribution URL
- **DistributionId**: CloudFront Distribution ID
