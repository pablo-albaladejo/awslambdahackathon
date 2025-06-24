#!/bin/bash

# Script to generate .env file for apps/web with AWS CDK stack outputs
# Usage: ./scripts/generate-web-env.sh [environment] [aws_profile] [region]

ENVIRONMENT=${1:-dev}
AWS_PROFILE=${2:-awslambdahackathon}
REGION=${3:-us-east-2}
OUTPUT_FILE="apps/web/.env"

# Helper to get output from a stack
get_output() {
  local stack_name=$1
  local output_key=$2
  aws cloudformation describe-stacks \
    --stack-name "$stack_name" \
    --profile "$AWS_PROFILE" \
    --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='$output_key'].OutputValue" \
    --output text
}

# Stack names
AUTH_STACK="AuthStack-$ENVIRONMENT"
API_STACK="ApiStack-$ENVIRONMENT"
WEB_STACK="WebStack-$ENVIRONMENT"
RUM_STACK="RumStack-$ENVIRONMENT"

# Get values from stack outputs
USER_POOL_ID=$(get_output "$AUTH_STACK" "UserPoolId")
USER_POOL_CLIENT_ID=$(get_output "$AUTH_STACK" "UserPoolClientId")
IDENTITY_POOL_ID=$(get_output "$AUTH_STACK" "IdentityPoolId$ENVIRONMENT")
API_URL=$(get_output "$API_STACK" "ApiUrl")
WEBSOCKET_URL=$(get_output "$API_STACK" "WebSocketUrl")
RUM_APP_MONITOR_ID=$(get_output "$RUM_STACK" "RumAppMonitorId$ENVIRONMENT")
CLOUDFRONT_URL=$(get_output "$WEB_STACK" "WebsiteUrl")

# Fallback for missing values
: "${USER_POOL_ID:=}"
: "${USER_POOL_CLIENT_ID:=}"
: "${IDENTITY_POOL_ID:=}"
: "${API_URL:=}"
: "${WEBSOCKET_URL:=}"
: "${RUM_APP_MONITOR_ID:=}"
: "${CLOUDFRONT_URL:=}"

cat > $OUTPUT_FILE <<EOL
VITE_REGION=$REGION
VITE_USER_POOL_ID=$USER_POOL_ID
VITE_USER_POOL_CLIENT_ID=$USER_POOL_CLIENT_ID
VITE_IDENTITY_POOL_ID=$IDENTITY_POOL_ID
VITE_API_URL=$API_URL
VITE_WEBSOCKET_URL=$WEBSOCKET_URL
VITE_RUM_APP_MONITOR_ID=$RUM_APP_MONITOR_ID
VITE_CLOUDFRONT_URL=$CLOUDFRONT_URL
EOL

echo ".env file generated at $OUTPUT_FILE with values from CDK outputs." 