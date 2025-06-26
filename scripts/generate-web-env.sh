#!/bin/bash

# Script to generate .env file for apps/web with AWS CDK stack outputs
# Usage: ./scripts/generate-web-env.sh [environment] [aws_profile] [region] [app_name]
# Default values: dev awslambdahackathon us-east-2 MyAwesomeApp

ENVIRONMENT=${1:-dev}
AWS_PROFILE=${2:-awslambdahackathon}
REGION=${3:-us-east-2}
APP_NAME=${4:-MyAwesomeApp}
OUTPUT_FILE="apps/web/.env.local"

echo "🔧 Generating environment file for:"
echo "   Environment: $ENVIRONMENT"
echo "   AWS Profile: $AWS_PROFILE"
echo "   Region: $REGION"
echo "   App Name: $APP_NAME"

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
API_STACK="RuntimeStack-$ENVIRONMENT"
WEB_STACK="WebStack-$ENVIRONMENT"

# Get values from stack outputs
USER_POOL_ID=$(get_output "$AUTH_STACK" "UserPoolId")
if [ -z "$USER_POOL_ID" ]; then
  echo "⚠️  Warning: USER_POOL_ID is empty. Check output 'UserPoolId' in stack $AUTH_STACK."
fi
USER_POOL_CLIENT_ID=$(get_output "$AUTH_STACK" "UserPoolClientId")
if [ -z "$USER_POOL_CLIENT_ID" ]; then
  echo "⚠️  Warning: USER_POOL_CLIENT_ID is empty. Check output 'UserPoolClientId' in stack $AUTH_STACK."
fi
IDENTITY_POOL_ID=$(get_output "$AUTH_STACK" "IdentityPoolId")
if [ -z "$IDENTITY_POOL_ID" ]; then
  echo "⚠️  Warning: IDENTITY_POOL_ID is empty. Check output 'IdentityPoolId' in stack $AUTH_STACK."
fi
API_URL=$(get_output "$API_STACK" "ApiUrl")
if [ -z "$API_URL" ]; then
  echo "⚠️  Warning: API_URL is empty. Check output 'ApiUrl' in stack $API_STACK."
fi
WEBSOCKET_URL=$(get_output "$API_STACK" "WebSocketUrl")
if [ -z "$WEBSOCKET_URL" ]; then
  echo "⚠️  Warning: WEBSOCKET_URL is empty. Check output 'WebSocketUrl' in stack $API_STACK."
fi
RUM_APP_MONITOR_ID=$(get_output "$WEB_STACK" "RumAppMonitorId")
if [ -z "$RUM_APP_MONITOR_ID" ]; then
  echo "⚠️  Warning: RUM_APP_MONITOR_ID is empty. Check output 'RumAppMonitorId' in stack $WEB_STACK."
fi

# Fallback for missing values
: "${USER_POOL_ID:=}"
: "${USER_POOL_CLIENT_ID:=}"
: "${IDENTITY_POOL_ID:=}"
: "${API_URL:=}"
: "${WEBSOCKET_URL:=}"
: "${RUM_APP_MONITOR_ID:=}"

cat > $OUTPUT_FILE <<EOL
VITE_AWS_REGION=$REGION
VITE_USER_POOL_ID=$USER_POOL_ID
VITE_USER_POOL_CLIENT_ID=$USER_POOL_CLIENT_ID
VITE_IDENTITY_POOL_ID=$IDENTITY_POOL_ID
VITE_API_BASE_URL=$API_URL
VITE_WEBSOCKET_URL=$WEBSOCKET_URL
VITE_AWS_RUM_APPLICATION_ID=$RUM_APP_MONITOR_ID
VITE_AWS_RUM_IDENTITY_POOL_ID=$IDENTITY_POOL_ID
EOL

echo ".env.local file generated at $OUTPUT_FILE with values from CDK outputs." 