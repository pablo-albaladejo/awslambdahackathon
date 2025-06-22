# AWS Lambda Hackathon Monorepo

This monorepo uses Turborepo, AWS CDK, TypeScript, Vite, Vitest, and a shared linter to create a modern architecture for frontend, serverless backend, and AWS resources.

## Structure

- `apps/web`: Frontend (Vite + React)
- `apps/api`: Lambdas (TypeScript)
- `apps/infrastructure`: Infrastructure (CDK)
- `packages/types`, `packages/utils`, `packages/eslint-config`: Shared packages

---

## Installation and Build

From the root of the monorepo:

```sh
npm install
npm run build
```

This will install all dependencies and build all packages and Lambdas.

---

## Infrastructure Synth (Preview CloudFormation)

```sh
cd apps/infrastructure
npm run synth
```

This will generate the CloudFormation template without deploying anything.

---

## Deploy to AWS

### Option 1: Intelligent Deployment Script (Recommended)

The intelligent deployment script handles the complete deployment automatically:

```sh
# Deploy to development environment (uses defaults: awslambdahackathon profile, us-east-2 region)
node scripts/deploy.js dev

# Deploy to production environment (uses defaults: awslambdahackathon profile, us-east-2 region)
node scripts/deploy.js prod

# Deploy with custom AWS profile and region
node scripts/deploy.js dev my-aws-profile us-west-2

# Deploy to production with custom settings
node scripts/deploy.js prod my-aws-profile eu-west-1
```

**Script Parameters:**

- `environment`: `dev` or `prod` (default: `dev`)
- `awsProfile`: AWS profile name (default: `awslambdahackathon`)
- `awsRegion`: AWS region (default: `us-east-2`)

This script will:

1. Build all packages
2. Deploy complete infrastructure (CDK) including:
   - API Gateway + Lambda functions
   - DynamoDB table
   - S3 bucket for frontend hosting
   - CloudFront distribution for frontend
   - Automatic deployment of frontend files to S3
3. Extract the API URL and Website URL from CDK outputs
4. Create environment file for frontend with the correct API URL

### Option 2: Manual Infrastructure Deployment

```sh
# Deploy infrastructure (includes frontend hosting)
cd apps/infrastructure
npm run deploy:dev
```

---

## Cleanup

To destroy all infrastructure:

```sh
cd apps/infrastructure
npm run destroy
```

---

## Development

### Start Development Servers

```sh
# Start all development servers
npm run dev

# Or start specific apps
cd apps/web && npm run dev
cd apps/api && npm run dev
```

### Testing

```sh
# Run all tests
npm run test

# Run tests with coverage
npm run test:coverage
```

---

## Infrastructure Components

The CDK stack deploys:

- **API Gateway**: REST API endpoints
- **Lambda Functions**: Serverless backend logic
- **DynamoDB**: Database for users
- **S3 Bucket**: Static website hosting for frontend
- **CloudFront**: CDN for frontend with HTTPS and caching
- **IAM Roles**: Proper permissions for all services

---

## Notes

- The Lambda build must be up-to-date before running `deploy` or `synth`.
- All infrastructure (API Gateway, Lambdas, DynamoDB, S3, CloudFront) is managed only with CDK.
- Do not use `serverless.yml` or the Serverless Framework.
- The frontend is automatically deployed to S3 + CloudFront during infrastructure deployment.
- Default AWS profile: `awslambdahackathon`
- Default AWS region: `us-east-2`

---

Questions? Check the stacks in `apps/infrastructure/src` or ask your favorite AI 😉
