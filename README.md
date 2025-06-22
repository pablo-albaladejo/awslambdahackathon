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

## API Handlers with Middy, Zod & Lambda Powertools

The API uses a modern, production-ready stack for Lambda handlers:

### Features

- **Middy**: Middleware framework for AWS Lambda with automatic request/response handling
- **Zod**: TypeScript-first schema validation for all requests
- **Lambda Powertools**: Centralized logging, tracing, and metrics across all handlers

### Handler Structure

All handlers follow a standardized pattern with:

```typescript
// Automatic middleware: JSON parsing, CORS, logging, error handling
export const handler = createHandler(myHandler, validationSchema);
```

### Built-in Middleware

- **JSON Body Parser**: Automatic parsing of request bodies
- **CORS**: Cross-origin resource sharing headers
- **Request/Response Logger**: Structured logging of all requests
- **Error Handler**: Standardized error responses
- **Validator**: Schema validation with detailed error messages

### Observability

- **Structured Logging**: All logs include request context and structured data
- **Custom Metrics**: Business metrics automatically sent to CloudWatch
- **Distributed Tracing**: Custom spans for business logic
- **Error Tracking**: Automatic error logging with full context

### Testing

Use the test script to verify handlers work correctly:

```sh
# Test all endpoints
./scripts/test-api.sh [API_URL]

# Example: Test deployed API
./scripts/test-api.sh https://your-api-gateway-url.amazonaws.com
```

For detailed documentation, see [apps/api/README.md](apps/api/README.md).

---

## Notes

- The Lambda build must be up-to-date before running `deploy` or `synth`.
- All infrastructure (API Gateway, Lambdas, DynamoDB, S3, CloudFront) is managed only with CDK.
- Do not use `serverless.yml` or the Serverless Framework.
- The frontend is automatically deployed to S3 + CloudFront during infrastructure deployment.
- Default AWS profile: `awslambdahackathon`
- Default AWS region: `us-east-2`

---

## Production-Grade Code Quality & Linting

This monorepo is configured to maintain a professional code quality standard across all packages (backend and frontend).

### Linting & Formatting

- **Global lint:**
  - Run `npm run lint` to check all source code (excluding generated files like `dist` and `cdk.out`).
  - Run `npm run lint:fix` to automatically fix style and formatting issues that ESLint can resolve.
- **Formatting:**
  - Use `npm run format` to apply Prettier to all code.
  - Use `npm run format:check` to verify formatting without modifying files.

### Mandatory Best Practices

- **Do not use `any`:** Always explicitly type your variables, arguments, and return values. Use `unknown` and type guards if necessary.
- **Do not use `console.log`/`console.error` in production:** Use a logging system or `// LOG:` comments to mark log points.
- **Do not lint or modify generated files:** The `dist` and `cdk.out` folders are excluded from linting.
- **Robust error handling:** Always use try/catch and handle errors with explicit types.
- **Centralized configuration:** All ESLint and Prettier rules are in the root of the monorepo.

### Example Workflow

```sh
# Check that all code meets the standard
npm run lint

# Automatically fix what can be fixed
npm run lint:fix

# Format all code
npm run format

# Before committing, make sure there are no lint or build errors
npm run build
npm run lint
```

### CI/CD

You can integrate these commands into your CI/CD pipeline to ensure that only code meeting the quality standard is deployed.

---

Questions? Want to add new rules? Edit `.eslintrc.js` or `package.json` in the root and run the commands above to validate the result.

Questions? Check the stacks in `apps/infrastructure/src` or ask your favorite AI 😉
