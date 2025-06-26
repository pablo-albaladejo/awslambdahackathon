#!/bin/bash

# Parse command line arguments
ENVIRONMENT=${1:-dev}
AWS_PROFILE=${2:-awslambdahackathon}
AWS_REGION=${3:-us-east-2}
DEFAULT_USER_EMAIL=${4:-demo@example.com}
APP_NAME=${5:-MyAwesomeApp}

echo "🚀 Starting deployment for environment: $ENVIRONMENT"
echo "🔧 AWS Profile: $AWS_PROFILE"
echo "🌍 AWS Region: $AWS_REGION"
echo "📧 Default User Email: $DEFAULT_USER_EMAIL"
echo "🏷️  App Name: $APP_NAME"

# Set AWS environment variables
export AWS_PROFILE=$AWS_PROFILE
export AWS_DEFAULT_REGION=$AWS_REGION
export AWS_PAGER=""

# Function to handle errors
handle_error() {
    echo "❌ Deployment failed: $1"
    exit 1
}

# Step 0: Lint and build to verify code quality
echo "🔍 Running lint and build verification..."
npm run lint || handle_error "Lint check failed"
npm run build || handle_error "Build verification failed"

# Step 1: Clean previous build artifacts
echo "🧹 Cleaning previous build artifacts..."
npm run clean || handle_error "Failed to clean artifacts"

# Step 2: Build runtime packages
echo "📦 Building runtime packages..."
RUNTIME_STACK_NAME="RuntimeStack-$ENVIRONMENT"
cd packages/types    && npm run build && cd ../..
cd packages/utils    && npm run build && cd ../..
cd apps/cdk && npm run build && cd ../..

# Define stack names
AUTH_STACK_NAME="AuthStack-$ENVIRONMENT"
RUNTIME_STACK_NAME="RuntimeStack-$ENVIRONMENT"
WEB_STACK_NAME="WebStack-$ENVIRONMENT"

# Step 3: Deploy all stacks together to handle dependencies properly
echo "🏗️  Deploying all stacks together..."
cd apps/cdk || handle_error "Failed to cd to cdk"
APP_NAME=$APP_NAME npx cdk deploy --all \
    --require-approval never \
    --context defaultUserEmail="$DEFAULT_USER_EMAIL" \
  || handle_error "Failed to deploy stacks"

# Step 4: Retrieve the Cognito Identity Pool ID from AuthStack outputs
echo "🔍 Retrieving Auth Identity Pool ID..."
AUTH_IDENTITY_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name "$AUTH_STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='IdentityPoolId'].OutputValue" \
  --output text) || handle_error "Could not get IdentityPoolId from Auth stack output"

echo "🔑 Auth Identity Pool ID: $AUTH_IDENTITY_POOL_ID"

# Step 5: Retrieve the RUM AppMonitor ID from WebStack
echo "🔍 Retrieving RUM AppMonitor ID..."
RUM_APP_MONITOR_ID=$(aws cloudformation describe-stacks \
  --stack-name "$WEB_STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='RumAppMonitorId'].OutputValue" \
  --output text 2>/dev/null || echo "")

if [ -z "$RUM_APP_MONITOR_ID" ]; then
  echo "⚠️  Warning: Could not get RUM App Monitor ID. RUM monitoring might not be available."
  RUM_APP_MONITOR_ID=""
else
  echo "📊 RUM App Monitor ID: $RUM_APP_MONITOR_ID"
fi

# Step 6: Create default users via script
echo "🔑 Creating default users..."
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name "$AUTH_STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" \
  --output text) || handle_error "Could not get UserPoolId"

cd ../.. || handle_error "Failed to return to project root"
export USER_POOL_ID
export TEMP_PASSWORD_SECRET_ID="$APP_NAME-default-user-password-$ENVIRONMENT"
export DEFAULT_USER_EMAIL_BASE="$DEFAULT_USER_EMAIL"
export AWS_REGION=$AWS_REGION

sh scripts/create-default-users.sh || handle_error "Failed to create default users"

# Unset temp variables
unset USER_POOL_ID
unset TEMP_PASSWORD_SECRET_ID
unset DEFAULT_USER_EMAIL_BASE

# Step 7: Get stack outputs for frontend build
echo "🔍 Getting stack outputs..."
API_URL=$(aws cloudformation describe-stacks --stack-name "$RUNTIME_STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
  --output text 2>/dev/null || echo "")

if [ -z "$API_URL" ]; then
  handle_error "Could not get API URL from RuntimeStack. Make sure the stack was deployed successfully."
fi

WEBSOCKET_URL=$(aws cloudformation describe-stacks --stack-name "$RUNTIME_STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='WebSocketUrl'].OutputValue" \
  --output text 2>/dev/null || echo "")

if [ -z "$WEBSOCKET_URL" ]; then
  handle_error "Could not get WebSocket URL from RuntimeStack. Make sure the stack was deployed successfully."
fi

USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name "$AUTH_STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" \
  --output text 2>/dev/null || echo "")

if [ -z "$USER_POOL_ID" ]; then
  handle_error "Could not get User Pool ID from AuthStack. Make sure the stack was deployed successfully."
fi

USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks --stack-name "$AUTH_STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" \
  --output text 2>/dev/null || echo "")

if [ -z "$USER_POOL_CLIENT_ID" ]; then
  handle_error "Could not get User Pool Client ID from AuthStack. Make sure the stack was deployed successfully."
fi

# Get AWS Account ID dynamically
echo "🔍 Getting AWS Account ID..."
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "")

if [ -z "$AWS_ACCOUNT_ID" ]; then
  echo "⚠️  Warning: Could not get AWS Account ID. This might be due to missing credentials or permissions."
  echo "   The deployment will continue, but some features might not work correctly."
  AWS_ACCOUNT_ID="unknown"
fi

echo "📍 API URL: $API_URL"
echo "🔌 WebSocket URL: $WEBSOCKET_URL"
echo "🔑 User Pool ID: $USER_POOL_ID"
echo "📱 User Pool Client ID: $USER_POOL_CLIENT_ID"
echo "📊 RUM App Monitor ID: $RUM_APP_MONITOR_ID"
echo "🔑 Auth Identity Pool ID: $AUTH_IDENTITY_POOL_ID"
echo "🏦 AWS Account ID: $AWS_ACCOUNT_ID"

# Step 8: Build the frontend with environment variables
echo "📦 Building frontend application..."
cd apps/web || handle_error "Failed to cd to web"

# Remove any existing .env.production for security
rm -f .env.production

export VITE_API_BASE_URL="$API_URL"
export VITE_WEBSOCKET_URL="$WEBSOCKET_URL"
export VITE_USER_POOL_ID="$USER_POOL_ID"
export VITE_USER_POOL_CLIENT_ID="$USER_POOL_CLIENT_ID"
export VITE_AWS_REGION="$AWS_REGION"
export VITE_IDENTITY_POOL_ID="$AUTH_IDENTITY_POOL_ID"
export VITE_AWS_RUM_APPLICATION_ID="$RUM_APP_MONITOR_ID"
export VITE_AWS_RUM_IDENTITY_POOL_ID="$AUTH_IDENTITY_POOL_ID"

npm run build || handle_error "Failed to build frontend"

# Clear build-time env vars
unset VITE_API_BASE_URL
unset VITE_WEBSOCKET_URL
unset VITE_USER_POOL_ID
unset VITE_USER_POOL_CLIENT_ID
unset VITE_AWS_REGION
unset VITE_IDENTITY_POOL_ID
unset VITE_AWS_RUM_APPLICATION_ID
unset VITE_AWS_RUM_IDENTITY_POOL_ID

cd ../.. || handle_error "Failed to return to root"

# Step 9: Deploy frontend files to S3
WEBSITE_BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name "$WEB_STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='WebsiteBucketName'].OutputValue" \
  --output text)

WEB_ASSET_PATH=${WEB_ASSET_PATH:-apps/web/dist}
echo "📤 Deploying frontend files to S3 from $WEB_ASSET_PATH to $WEBSITE_BUCKET_NAME..."
aws s3 sync "$WEB_ASSET_PATH/" "s3://$WEBSITE_BUCKET_NAME/" --delete

# Step 10: Invalidate CloudFront cache
echo "🔄 Invalidating CloudFront cache..."
DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
  --stack-name "$WEB_STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" \
  --output text)

if [ -n "$DISTRIBUTION_ID" ]; then
  aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths "/*"
  echo "✅ CloudFront cache invalidation initiated"
fi

# Step 11: Get the Website URL from the Web stack outputs
echo "🔍 Getting Website URL from $WEB_STACK_NAME..."
WEBSITE_URL=$(aws cloudformation describe-stacks \
  --stack-name "$WEB_STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='WebsiteUrl'].OutputValue" \
  --output text)

echo "✅ Deployment completed successfully!"
echo "🔗 API: $API_URL"
echo "🌐 Frontend: $WEBSITE_URL"