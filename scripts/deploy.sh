#!/bin/bash

# Parse command line arguments
ENVIRONMENT=${1:-dev}
AWS_PROFILE=${2:-awslambdahackathon}
AWS_REGION=${3:-us-east-2}
DEFAULT_USER_EMAIL=${4:-demo@example.com}

echo "🚀 Starting deployment for environment: $ENVIRONMENT"
echo "🔧 AWS Profile: $AWS_PROFILE"
echo "🌍 AWS Region: $AWS_REGION"
echo "📧 Default User Email: $DEFAULT_USER_EMAIL"

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
if ! npm run lint; then
    handle_error "Lint check failed"
fi

if ! npm run build; then
    handle_error "Build verification failed"
fi

# Step 1: Clean previous build artifacts
echo "🧹 Cleaning previous build artifacts..."
if ! npm run clean; then
    handle_error "Failed to clean artifacts"
fi

# Step 2: Build backend packages (types, utils, infrastructure, api)
echo "📦 Building backend packages..."
cd packages/types && npm run build && cd ../..
cd packages/utils && npm run build && cd ../..
cd apps/infrastructure && npm run build && cd ../..
cd apps/api && npm run build && cd ../..

# Define stack names
AUTH_STACK_NAME="AuthStack-$ENVIRONMENT"
BACKEND_STACK_NAME="BackendStack-$ENVIRONMENT"
API_STACK_NAME="ApiStack-$ENVIRONMENT"
WEB_STACK_NAME="WebStack-$ENVIRONMENT"
RUM_STACK_NAME="RumStack-$ENVIRONMENT"

# Step 3: Deploy the Backend stack first
echo "🏗️  Deploying Backend stack: $BACKEND_STACK_NAME"
cd apps/infrastructure || handle_error "Failed to change to infrastructure directory"

if ! npx cdk deploy "$BACKEND_STACK_NAME" --require-approval never; then
    handle_error "Failed to deploy Backend stack"
fi

# Step 4: Deploy the Auth stack
echo "🔒 Deploying Auth stack: $AUTH_STACK_NAME"
if ! npx cdk deploy "$AUTH_STACK_NAME" --require-approval never --context defaultUserEmail="$DEFAULT_USER_EMAIL"; then
    handle_error "Failed to deploy Auth stack"
fi

# Step 4.5: Deploy the RUM stack (independent)
echo "📊 Deploying RUM stack: $RUM_STACK_NAME"
if ! npx cdk deploy "$RUM_STACK_NAME" --require-approval never; then
    handle_error "Failed to deploy RUM stack"
fi

# Step 4.6: Create default users via script
echo "🔑 Creating default users..."
TEMP_PASSWORD_SECRET_ID="awslambdahackathon-default-user-password-$ENVIRONMENT"
USER_POOL_ID_OUTPUT=$(aws cloudformation describe-stacks --stack-name "$AUTH_STACK_NAME" --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text)

if [ -z "$USER_POOL_ID_OUTPUT" ]; then
    handle_error "Could not get UserPoolId from Auth stack output"
fi

cd ../.. || handle_error "Failed to return to project root"

export USER_POOL_ID="$USER_POOL_ID_OUTPUT"
export TEMP_PASSWORD_SECRET_ID="$TEMP_PASSWORD_SECRET_ID"
export DEFAULT_USER_EMAIL_BASE="$DEFAULT_USER_EMAIL"
export AWS_REGION="$AWS_REGION"

if ! sh scripts/create-default-users.sh; then
    handle_error "Failed to create default users"
fi

# Unset environment variables for security
unset USER_POOL_ID
unset TEMP_PASSWORD_SECRET_ID
unset DEFAULT_USER_EMAIL_BASE
# We keep AWS_REGION

cd apps/infrastructure || handle_error "Failed to change back to infrastructure directory"

# Step 5: Deploy the API stack
echo "🏗️  Deploying API stack: $API_STACK_NAME"
if ! npx cdk deploy "$API_STACK_NAME" --require-approval never; then
    handle_error "Failed to deploy API stack"
fi

# Step 6: Get stack outputs
echo "🔍 Getting stack outputs..."
API_URL=$(aws cloudformation describe-stacks --stack-name "$API_STACK_NAME" --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text)
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name "$AUTH_STACK_NAME" --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text)
USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks --stack-name "$AUTH_STACK_NAME" --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" --output text)
RUM_APP_MONITOR_ID=$(aws cloudformation describe-stacks --stack-name "$RUM_STACK_NAME" --query "Stacks[0].Outputs[?OutputKey=='RumAppMonitorId'].OutputValue" --output text)
RUM_IDENTITY_POOL_ID=$(aws cloudformation describe-stacks --stack-name "$RUM_STACK_NAME" --query "Stacks[0].Outputs[?OutputKey=='RumIdentityPoolId'].OutputValue" --output text)

if [ -z "$API_URL" ] || [ -z "$USER_POOL_ID" ] || [ -z "$USER_POOL_CLIENT_ID" ] || [ -z "$RUM_APP_MONITOR_ID" ] || [ -z "$RUM_IDENTITY_POOL_ID" ]; then
    handle_error "Could not get all required stack outputs"
fi

echo "📍 API URL: $API_URL"
echo "🔑 User Pool ID: $USER_POOL_ID"
echo "📱 User Pool Client ID: $USER_POOL_CLIENT_ID"
echo "🔍 RUM App Monitor ID: $RUM_APP_MONITOR_ID"
echo "🔍 RUM Identity Pool ID: $RUM_IDENTITY_POOL_ID"

# Step 7: Build the frontend with environment variables
echo "📦 Building frontend application..."

# Return to project root directory (we're currently in apps/infrastructure)
cd ../.. || handle_error "Failed to return to project root"

cd apps/web || handle_error "Failed to change to web directory"

# Remove any existing .env.production file for security
rm -f .env.production

# Set environment variables for the build process
export VITE_API_URL="$API_URL"
export VITE_USER_POOL_ID="$USER_POOL_ID"
export VITE_USER_POOL_CLIENT_ID="$USER_POOL_CLIENT_ID"
export VITE_AWS_REGION="$AWS_REGION"
export VITE_RUM_APP_MONITOR_ID="$RUM_APP_MONITOR_ID"
export VITE_RUM_IDENTITY_POOL_ID="$RUM_IDENTITY_POOL_ID"

# Build with Vite (it will read VITE_API_URL from environment)
if ! npm run build; then
    handle_error "Failed to build frontend"
fi

# Clear the environment variables for security
unset VITE_API_URL
unset VITE_USER_POOL_ID
unset VITE_USER_POOL_CLIENT_ID
unset VITE_AWS_REGION
unset VITE_RUM_APP_MONITOR_ID
unset VITE_RUM_IDENTITY_POOL_ID

cd ../.. || handle_error "Failed to return to root directory"

# Step 8: Deploy the Web stack
echo "🌐 Deploying Web stack: $WEB_STACK_NAME"
cd apps/infrastructure || handle_error "Failed to change to infrastructure directory"

if ! npx cdk deploy "$WEB_STACK_NAME" --require-approval never; then
    handle_error "Failed to deploy Web stack"
fi

cd ../.. || handle_error "Failed to return to root directory"

# Step 9: Deploy frontend files to S3
echo "📤 Deploying frontend files to S3..."
WEBSITE_BUCKET_NAME="awslambdahackathon-web-$ENVIRONMENT"
aws s3 sync apps/web/dist/ s3://$WEBSITE_BUCKET_NAME/ --delete

# Step 10: Invalidate CloudFront cache
echo "🔄 Invalidating CloudFront cache..."
DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
    --stack-name "$WEB_STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" \
    --output text)

if [ ! -z "$DISTRIBUTION_ID" ]; then
    aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths "/*"
    echo "✅ CloudFront cache invalidation initiated"
fi

# Step 11: Get the Website URL from the Web stack outputs
echo "🔍 Getting Website URL from $WEB_STACK_NAME outputs..."
WEBSITE_URL=$(aws cloudformation describe-stacks \
    --stack-name "$WEB_STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='WebsiteUrl'].OutputValue" \
    --output text)

if [ -z "$WEBSITE_URL" ]; then
    echo "⚠️  Could not get Website URL from stack outputs"
fi

echo "✅ Deployment completed successfully!"
echo "🔗 API: $API_URL"
echo "🌐 Frontend: $WEBSITE_URL" 