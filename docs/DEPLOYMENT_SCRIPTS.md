# Deployment Scripts

This directory contains scripts for deploying, destroying, and managing the AWS Lambda Hackathon infrastructure.

## Scripts Overview

### `deploy.sh`

Deploys the complete infrastructure including all CDK stacks and frontend.

### `destroy.sh`

Destroys all infrastructure resources created by the CDK stacks.

### `generate-web-env.sh`

Generates environment variables file for the frontend application.

### `create-default-users.sh`

Creates default users in Cognito User Pool (called internally by deploy.sh).

## Usage Examples

### Basic Deployment (Default Settings)

```bash
# Deploy with all default values
./scripts/deploy.sh

# This is equivalent to:
./scripts/deploy.sh dev awslambdahackathon us-east-2 demo@example.com MyAwesomeApp
```

### Custom Deployment

```bash
# Deploy with custom application name
./scripts/deploy.sh dev awslambdahackathon us-east-2 demo@example.com MyAwesomeApp

# Deploy to production with custom settings
./scripts/deploy.sh prod my-aws-profile us-west-2 admin@mycompany.com CompanyApp
```

### Parameters

All scripts follow this parameter order:

1. **Environment** (default: `dev`)

   - `dev` - Development environment
   - `prod` - Production environment
   - `staging` - Staging environment

2. **AWS Profile** (default: `awslambdahackathon`)

   - Your AWS CLI profile name
   - Must be configured in `~/.aws/credentials`

3. **AWS Region** (default: `us-east-2`)

   - AWS region for deployment
   - Examples: `us-east-1`, `us-west-2`, `eu-west-1`

4. **Default User Email** (deploy.sh only, default: `demo@example.com`)

   - Base email for creating default users
   - Users will be created as: `+admin@example.com`, `+user_one@example.com`, etc.

5. **App Name** (default: `MyAwesomeApp`)
   - **NEW**: Configurable application name used as prefix for all resources
   - Examples: `MyAwesomeApp`, `CompanyApp`, `ProjectName`

## Resource Naming

The `APP_NAME` parameter affects the naming of all AWS resources:

### Before (Hardcoded)

- Tables: `awslambdahackathon-websocket-connections-dev`
- APIs: `awslambdahackathon-api-dev`
- Buckets: `awslambdahackathon-web-dev`

### After (Configurable)

- Tables: `MyAwesomeApp-websocket-connections-dev`
- APIs: `MyAwesomeApp-api-dev`
- Buckets: `MyAwesomeApp-web-dev`

## Environment Variables Generated

The `generate-web-env.sh` script creates `apps/web/.env.local` with:

```bash
VITE_REGION=us-east-2
VITE_APP_NAME=MyAwesomeApp
VITE_USER_POOL_ID=us-east-2_xxxxxxxxx
VITE_USER_POOL_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_IDENTITY_POOL_ID=us-east-2:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
VITE_API_URL=https://xxxxxxxxxx.execute-api.us-east-2.amazonaws.com
VITE_WEBSOCKET_URL=wss://xxxxxxxxxx.execute-api.us-east-2.amazonaws.com/dev
VITE_RUM_APP_MONITOR_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
VITE_CLOUDFRONT_URL=https://xxxxxxxxxx.cloudfront.net
```

## Common Use Cases

### Development Team

```bash
# Each developer can use their own app name
./scripts/deploy.sh dev awslambdahackathon us-east-2 demo@example.com PabloApp
./scripts/deploy.sh dev awslambdahackathon us-east-2 demo@example.com MariaApp
./scripts/deploy.sh dev awslambdahackathon us-east-2 demo@example.com JuanApp
```

### Multiple Environments

```bash
# Development
./scripts/deploy.sh dev awslambdahackathon us-east-2 demo@example.com MyApp

# Staging
./scripts/deploy.sh staging awslambdahackathon us-east-2 staging@company.com MyApp

# Production
./scripts/deploy.sh prod awslambdahackathon us-east-2 admin@company.com MyApp
```

### Multiple Projects

```bash
# Project A
./scripts/deploy.sh dev awslambdahackathon us-east-2 demo@example.com ProjectA

# Project B
./scripts/deploy.sh dev awslambdahackathon us-east-2 demo@example.com ProjectB
```

## Cleanup

To destroy resources:

```bash
# Destroy with same parameters used for deployment
./scripts/destroy.sh dev awslambdahackathon us-east-2 MyAwesomeApp
```

## Troubleshooting

### Common Issues

1. **AWS Profile Not Found**

   ```bash
   # Configure your AWS profile
   aws configure --profile awslambdahackathon
   ```

2. **Insufficient Permissions**

   - Ensure your AWS user/role has necessary permissions for CDK deployment
   - Required services: CloudFormation, IAM, Lambda, API Gateway, S3, CloudFront, Cognito, DynamoDB

3. **Resource Name Conflicts**
   - If you get "already exists" errors, use a different `APP_NAME`
   - Or destroy existing resources first

### Debug Mode

Add `set -x` at the beginning of any script to see detailed execution:

```bash
# Edit script to add debug mode
sed -i '2i set -x' scripts/deploy.sh

# Run deployment
./scripts/deploy.sh dev awslambdahackathon us-east-2 demo@example.com MyApp
