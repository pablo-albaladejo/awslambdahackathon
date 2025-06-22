#!/bin/bash

# Parse command line arguments
ENVIRONMENT=${1:-dev}
AWS_PROFILE=${2:-awslambdahackathon}
AWS_REGION=${3:-us-east-2}

echo "🚀 Starting deployment for environment: $ENVIRONMENT"
echo "🔧 AWS Profile: $AWS_PROFILE"
echo "🌍 AWS Region: $AWS_REGION"

# Set AWS environment variables
export AWS_PROFILE=$AWS_PROFILE
export AWS_DEFAULT_REGION=$AWS_REGION

# Function to handle errors
handle_error() {
    echo "❌ Deployment failed: $1"
    exit 1
}

# Step 0: Clean previous build artifacts
echo "🧹 Cleaning previous build artifacts..."
if ! npm run clean; then
    handle_error "Failed to clean artifacts"
fi

# Step 1: Build all packages
echo "📦 Building all packages..."
if ! npm run build; then
    handle_error "Failed to build packages"
fi

# Define stack names
API_STACK_NAME="ApiStack-$ENVIRONMENT"
WEB_STACK_NAME="WebStack-$ENVIRONMENT"

# Step 2: Deploy the API stack first
echo "🏗️  Deploying API stack: $API_STACK_NAME"
cd apps/infrastructure || handle_error "Failed to change to infrastructure directory"

if ! npx cdk deploy "$API_STACK_NAME" --require-approval never; then
    handle_error "Failed to deploy API stack"
fi

# Step 3: Get the API URL from the API stack outputs
echo "🔍 Getting API URL from $API_STACK_NAME outputs..."
API_URL=$(aws cloudformation describe-stacks \
    --stack-name "$API_STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
    --output text)

if [ -z "$API_URL" ]; then
    handle_error "Could not get API URL from stack outputs"
fi
echo "📍 API URL: $API_URL"

# Step 4: Create environment file for the frontend
cd ../.. || handle_error "Failed to return to root directory"
ENV_CONTENT="VITE_API_URL=$API_URL"
ENV_PATH="apps/web/.env.production"

echo "$ENV_CONTENT" > "$ENV_PATH"
echo "📝 Created .env.production for frontend"

# Step 5: Deploy the Web stack
echo "🌐 Deploying Web stack: $WEB_STACK_NAME"
cd apps/infrastructure || handle_error "Failed to change to infrastructure directory"

if ! npx cdk deploy "$WEB_STACK_NAME" --require-approval never; then
    handle_error "Failed to deploy Web stack"
fi

cd ../.. || handle_error "Failed to return to root directory"

# Step 6: Get the Website URL from the Web stack outputs
echo "🔍 Getting Website URL from $WEB_STACK_NAME outputs..."
WEBSITE_URL=$(aws cloudformation describe-stacks \
    --stack-name "$WEB_STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='WebsiteUrl'].OutputValue" \
    --output text)

if [ -z "$WEBSITE_URL" ]; then
    echo "⚠️  Could not get Website URL from stack outputs"
fi

# Step 7: Clean up environment file
#rm "$ENV_PATH"
#echo "🗑️  Removed .env.production file"

echo "✅ Deployment completed successfully!"
echo "🔗 API: $API_URL"
echo "🌐 Frontend: $WEBSITE_URL" 