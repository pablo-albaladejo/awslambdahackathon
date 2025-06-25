#!/bin/bash

# Parse command line arguments
ENVIRONMENT=${1:-dev}
AWS_PROFILE=${2:-awslambdahackathon}
AWS_REGION=${3:-us-east-2}

echo "🗑️  Starting destruction for environment: $ENVIRONMENT"
echo "🔧 AWS Profile: $AWS_PROFILE"
echo "🌍 AWS Region: $AWS_REGION"

# Set AWS environment variables
export AWS_PROFILE=$AWS_PROFILE
export AWS_DEFAULT_REGION=$AWS_REGION

# Function to handle errors
handle_error() {
    echo "❌ Destruction failed: $1"
    exit 1
}

# Function to confirm destruction
confirm_destruction() {
    echo "⚠️  WARNING: This will destroy ALL resources for environment: $ENVIRONMENT"
    echo "⚠️  This action cannot be undone!"
    read -p "Are you sure you want to continue? (yes/no): " -r
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        echo "❌ Destruction cancelled by user"
        exit 0
    fi
}

# Confirm destruction before proceeding
confirm_destruction

# Define stack names
AUTH_STACK_NAME="AuthStack-$ENVIRONMENT"
RUNTIME_STACK_NAME="RuntimeStack-$ENVIRONMENT"
API_STACK_NAME="ApiStack-$ENVIRONMENT"
WEB_STACK_NAME="WebStack-$ENVIRONMENT"

# Step 1: Destroy all stacks
echo "🏗️  Destroying stacks: $API_STACK_NAME, $WEB_STACK_NAME, $RUNTIME_STACK_NAME"
cd apps/cdk || handle_error "Failed to change to cdk directory"

# We can destroy them in parallel with --all
if ! npx cdk destroy --all --context environment="$ENVIRONMENT" --force; then
    handle_error "Failed to destroy stacks"
fi

echo "✅ Stacks destroyed successfully!"

# Step 2: Clean up local files
cd ../.. || handle_error "Failed to return to root directory"
echo "🧹 Cleaning up local files..."

# Remove environment file for frontend if it exists
ENV_PATH="apps/web/.env.production"
if [ -f "$ENV_PATH" ]; then
    rm "$ENV_PATH"
    echo "🗑️  Removed .env.production file"
fi

echo "✅ Destruction process completed!" 