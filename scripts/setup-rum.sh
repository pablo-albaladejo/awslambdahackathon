#!/bin/bash

# AWS CloudWatch RUM Setup Script
# This script sets up Real User Monitoring for the AWS Lambda Hackathon project

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
STACK_NAME="awslambdahackathon-rum"
REGION=${AWS_REGION:-"us-east-1"}
APP_NAME="awslambdahackathon-web"
APP_VERSION="1.0.0"

echo -e "${BLUE}🚀 AWS CloudWatch RUM Setup${NC}"
echo "=================================="

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Check if AWS credentials are configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS credentials not configured. Please run 'aws configure' first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ AWS CLI and credentials verified${NC}"

# Create RUM application monitor
echo -e "${YELLOW}📊 Creating RUM Application Monitor...${NC}"

RUM_APP_MONITOR_ID=$(aws rum create-app-monitor \
    --name "${APP_NAME}-monitor" \
    --domain "${APP_NAME}.com" \
    --app-monitor-configuration '{
        "AllowCookies": true,
        "EnableXRay": true,
        "SessionSampleRate": 100,
        "Telemetries": ["errors", "performance", "http", "interaction"]
    }' \
    --region "${REGION}" \
    --query 'Id' \
    --output text 2>/dev/null || echo "")

if [ -z "$RUM_APP_MONITOR_ID" ]; then
    echo -e "${YELLOW}⚠️  RUM Application Monitor might already exist, checking...${NC}"
    RUM_APP_MONITOR_ID=$(aws rum list-app-monitors \
        --region "${REGION}" \
        --query "AppMonitors[?Name=='${APP_NAME}-monitor'].Id" \
        --output text)
fi

if [ -z "$RUM_APP_MONITOR_ID" ]; then
    echo -e "${RED}❌ Failed to create or find RUM Application Monitor${NC}"
    exit 1
fi

echo -e "${GREEN}✅ RUM Application Monitor created: ${RUM_APP_MONITOR_ID}${NC}"

# Create IAM role for RUM
echo -e "${YELLOW}🔐 Creating IAM Role for RUM...${NC}"

# Create trust policy
cat > /tmp/rum-trust-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "Service": "rum.amazonaws.com"
            },
            "Action": "sts:AssumeRole"
        }
    ]
}
EOF

# Create role
ROLE_NAME="RUMServiceRole-${APP_NAME}"
aws iam create-role \
    --role-name "${ROLE_NAME}" \
    --assume-role-policy-document file:///tmp/rum-trust-policy.json \
    --region "${REGION}" 2>/dev/null || echo "Role might already exist"

# Attach policy
aws iam attach-role-policy \
    --role-name "${ROLE_NAME}" \
    --policy-arn "arn:aws:iam::aws:policy/service-role/AWSCloudWatchRUMServiceRolePolicy" \
    --region "${REGION}" 2>/dev/null || echo "Policy might already be attached"

# Get role ARN
ROLE_ARN=$(aws iam get-role \
    --role-name "${ROLE_NAME}" \
    --region "${REGION}" \
    --query 'Role.Arn' \
    --output text)

echo -e "${GREEN}✅ IAM Role created: ${ROLE_ARN}${NC}"

# Create Cognito Identity Pool for authenticated users
echo -e "${YELLOW}👥 Creating Cognito Identity Pool...${NC}"

IDENTITY_POOL_NAME="${APP_NAME}-identity-pool"
IDENTITY_POOL_ID=$(aws cognito-identity create-identity-pool \
    --identity-pool-name "${IDENTITY_POOL_NAME}" \
    --allow-unauthenticated-identities \
    --region "${REGION}" \
    --query 'IdentityPoolId' \
    --output text 2>/dev/null || echo "")

if [ -z "$IDENTITY_POOL_ID" ]; then
    echo -e "${YELLOW}⚠️  Identity Pool might already exist, checking...${NC}"
    IDENTITY_POOL_ID=$(aws cognito-identity list-identity-pools \
        --max-items 20 \
        --region "${REGION}" \
        --query "IdentityPools[?IdentityPoolName=='${IDENTITY_POOL_NAME}'].IdentityPoolId" \
        --output text)
fi

if [ -z "$IDENTITY_POOL_ID" ]; then
    echo -e "${RED}❌ Failed to create or find Cognito Identity Pool${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Cognito Identity Pool created: ${IDENTITY_POOL_ID}${NC}"

# Create CloudFormation stack for additional resources
echo -e "${YELLOW}☁️  Creating CloudFormation stack for RUM resources...${NC}"

cat > /tmp/rum-stack.yaml << EOF
AWSTemplateFormatVersion: '2010-09-09'
Description: 'AWS CloudWatch RUM Resources for AWS Lambda Hackathon'

Parameters:
  RumAppMonitorId:
    Type: String
    Default: '${RUM_APP_MONITOR_ID}'
    Description: RUM Application Monitor ID
  
  IdentityPoolId:
    Type: String
    Default: '${IDENTITY_POOL_ID}'
    Description: Cognito Identity Pool ID

Resources:
  # CloudWatch Dashboard for RUM metrics
  RumDashboard:
    Type: AWS::CloudWatch::Dashboard
    Properties:
      DashboardName: '${APP_NAME}-rum-dashboard'
      DashboardBody: !Sub |
        {
          "widgets": [
            {
              "type": "metric",
              "x": 0,
              "y": 0,
              "width": 12,
              "height": 6,
              "properties": {
                "metrics": [
                  ["AWS/RUM", "PageLoadTime", "AppMonitorName", "\${RumAppMonitorId}"],
                  [".", "FirstContentfulPaint", ".", "."],
                  [".", "LargestContentfulPaint", ".", "."]
                ],
                "view": "timeSeries",
                "stacked": false,
                "region": "${REGION}",
                "title": "Page Load Performance",
                "period": 300
              }
            },
            {
              "type": "metric",
              "x": 12,
              "y": 0,
              "width": 12,
              "height": 6,
              "properties": {
                "metrics": [
                  ["AWS/RUM", "ErrorCount", "AppMonitorName", "\${RumAppMonitorId}"],
                  [".", "HttpErrorCount", ".", "."],
                  [".", "JsErrorCount", ".", "."]
                ],
                "view": "timeSeries",
                "stacked": false,
                "region": "${REGION}",
                "title": "Error Rates",
                "period": 300
              }
            },
            {
              "type": "metric",
              "x": 0,
              "y": 6,
              "width": 12,
              "height": 6,
              "properties": {
                "metrics": [
                  ["AWS/RUM", "SessionCount", "AppMonitorName", "\${RumAppMonitorId}"],
                  [".", "UserCount", ".", "."]
                ],
                "view": "timeSeries",
                "stacked": false,
                "region": "${REGION}",
                "title": "User Engagement",
                "period": 300
              }
            },
            {
              "type": "metric",
              "x": 12,
              "y": 6,
              "width": 12,
              "height": 6,
              "properties": {
                "metrics": [
                  ["AWS/RUM", "FirstInputDelay", "AppMonitorName", "\${RumAppMonitorId}"],
                  [".", "CumulativeLayoutShift", ".", "."]
                ],
                "view": "timeSeries",
                "stacked": false,
                "region": "${REGION}",
                "title": "Core Web Vitals",
                "period": 300
              }
            }
          ]
        }

  # CloudWatch Alarms for RUM metrics
  HighErrorRateAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmName: '${APP_NAME}-high-error-rate'
      AlarmDescription: 'High error rate detected in RUM'
      MetricName: ErrorCount
      Namespace: AWS/RUM
      Statistic: Sum
      Period: 300
      EvaluationPeriods: 2
      Threshold: 10
      ComparisonOperator: GreaterThanThreshold
      Dimensions:
        - Name: AppMonitorName
          Value: !Ref RumAppMonitorId

  SlowPageLoadAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmName: '${APP_NAME}-slow-page-load'
      AlarmDescription: 'Slow page load times detected'
      MetricName: PageLoadTime
      Namespace: AWS/RUM
      Statistic: Average
      Period: 300
      EvaluationPeriods: 2
      Threshold: 3000
      ComparisonOperator: GreaterThanThreshold
      Dimensions:
        - Name: AppMonitorName
          Value: !Ref RumAppMonitorId

Outputs:
  RumAppMonitorId:
    Description: RUM Application Monitor ID
    Value: !Ref RumAppMonitorId
    Export:
      Name: !Sub '${STACK_NAME}-RumAppMonitorId'
  
  IdentityPoolId:
    Description: Cognito Identity Pool ID
    Value: !Ref IdentityPoolId
    Export:
      Name: !Sub '${STACK_NAME}-IdentityPoolId'
  
  RoleArn:
    Description: IAM Role ARN for RUM
    Value: '${ROLE_ARN}'
    Export:
      Name: !Sub '${STACK_NAME}-RoleArn'
EOF

# Deploy CloudFormation stack
aws cloudformation deploy \
    --template-file /tmp/rum-stack.yaml \
    --stack-name "${STACK_NAME}" \
    --region "${REGION}" \
    --capabilities CAPABILITY_IAM \
    --parameter-overrides \
        RumAppMonitorId="${RUM_APP_MONITOR_ID}" \
        IdentityPoolId="${IDENTITY_POOL_ID}"

echo -e "${GREEN}✅ CloudFormation stack deployed successfully${NC}"

# Generate environment variables
echo -e "${YELLOW}📝 Generating environment variables...${NC}"

cat > .env.rum << EOF
# AWS CloudWatch RUM Configuration
VITE_AWS_RUM_APPLICATION_ID=${RUM_APP_MONITOR_ID}
VITE_AWS_RUM_GUEST_ROLE_ARN=${ROLE_ARN}
VITE_AWS_RUM_IDENTITY_POOL_ID=${IDENTITY_POOL_ID}
VITE_AWS_REGION=${REGION}
VITE_APP_VERSION=${APP_VERSION}

# RUM Dashboard URL
RUM_DASHBOARD_URL=https://${REGION}.console.aws.amazon.com/cloudwatch/home?region=${REGION}#dashboards:name=${APP_NAME}-rum-dashboard
EOF

echo -e "${GREEN}✅ Environment variables saved to .env.rum${NC}"

# Clean up temporary files
rm -f /tmp/rum-trust-policy.json /tmp/rum-stack.yaml

# Display summary
echo -e "${BLUE}📊 RUM Setup Summary${NC}"
echo "========================"
echo -e "${GREEN}✅ RUM Application Monitor ID: ${RUM_APP_MONITOR_ID}${NC}"
echo -e "${GREEN}✅ IAM Role ARN: ${ROLE_ARN}${NC}"
echo -e "${GREEN}✅ Cognito Identity Pool ID: ${IDENTITY_POOL_ID}${NC}"
echo -e "${GREEN}✅ CloudFormation Stack: ${STACK_NAME}${NC}"
echo -e "${GREEN}✅ Environment file: .env.rum${NC}"
echo ""
echo -e "${YELLOW}🔗 Useful Links:${NC}"
echo -e "  • RUM Console: https://${REGION}.console.aws.amazon.com/rum/home?region=${REGION}"
echo -e "  • CloudWatch Dashboard: https://${REGION}.console.aws.amazon.com/cloudwatch/home?region=${REGION}#dashboards:name=${APP_NAME}-rum-dashboard"
echo -e "  • CloudFormation Stack: https://${REGION}.console.aws.amazon.com/cloudformation/home?region=${REGION}#/stacks/stackinfo?stackId=${STACK_NAME}"
echo ""
echo -e "${BLUE}🚀 Next Steps:${NC}"
echo "1. Copy the environment variables from .env.rum to your deployment configuration"
echo "2. Update your frontend code to use the RUM configuration"
echo "3. Deploy your application with the new environment variables"
echo "4. Monitor your application performance in the CloudWatch RUM console"
echo ""
echo -e "${GREEN}🎉 RUM setup completed successfully!${NC}" 