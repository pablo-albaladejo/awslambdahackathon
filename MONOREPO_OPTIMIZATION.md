# Monorepo Dependency Optimization

## Overview

The project has been optimized to follow monorepo best practices by centralizing all dependencies in the root `package.json` file.

## Changes Made

### ✅ Centralized Dependencies

All dependencies have been moved to the root `package.json`:

#### Production Dependencies

- **React Ecosystem**: `react`, `react-dom`, `react-router-dom`
- **AWS SDK**: `@aws-sdk/client-cognito-identity-provider`, `@aws-sdk/client-secrets-manager`
- **AWS Amplify**: `@aws-amplify/ui-react`, `aws-amplify`
- **AWS Lambda Tools**: `@aws-lambda-powertools/*`, `@middy/*`
- **WebSocket**: `ws`, `aws-jwt-verify`
- **Infrastructure**: `aws-cdk-lib`, `constructs`, `serverless`
- **Build Tools**: `esbuild`, `vite`, `typescript`
- **Utilities**: `zod`, `fs-extra`, `source-map-support`

#### Development Dependencies

- **TypeScript**: `typescript`, `@types/*`
- **Testing**: `vitest`, `jest`, `@vitest/coverage-v8`
- **Linting**: `eslint`, `prettier`, `@typescript-eslint/*`
- **Build Tools**: `@vitejs/plugin-react`, `turbo`

### 📁 Simplified Package.json Files

#### Before (Individual packages had many dependencies)

```json
// apps/api/package.json
{
  "dependencies": {
    "@aws-sdk/client-cognito-identity-provider": "^3.596.0",
    "@aws-sdk/client-secrets-manager": "^3.596.0",
    "aws-jwt-verify": "^4.0.0",
    "ws": "^8.14.2"
    // ... many more
  }
}
```

#### After (Only workspace dependencies)

```json
// apps/api/package.json
{
  "dependencies": {
    "@awslambdahackathon/types": "*",
    "@awslambdahackathon/utils": "*"
  }
}
```

## Benefits

### 🚀 Performance Improvements

- **Faster installs**: Dependencies are installed once at the root
- **Reduced disk usage**: No duplicate packages across workspaces
- **Better caching**: Turbo can cache dependencies more effectively

### 🔧 Maintenance Benefits

- **Version consistency**: All packages use the same dependency versions
- **Easier updates**: Update dependencies in one place
- **Reduced conflicts**: No version mismatches between packages

### 📦 Workspace Management

- **Cleaner structure**: Each package only declares its workspace dependencies
- **Better organization**: Clear separation between shared and package-specific dependencies
- **Simplified CI/CD**: Easier to manage in build pipelines

## Package Structure

```
awslambdahackathon/
├── package.json                 # All dependencies centralized here
├── apps/
│   ├── api/
│   │   └── package.json        # Only workspace dependencies
│   ├── web/
│   │   └── package.json        # Only workspace dependencies
│   └── infrastructure/
│       └── package.json        # No dependencies needed
└── packages/
    ├── types/
    │   └── package.json        # No dependencies needed
    └── utils/
        └── package.json        # Only workspace dependencies
```

## Usage

### Installing Dependencies

```bash
# Install all dependencies (root level)
npm install

# Install specific dependency (adds to root)
npm install new-package

# Install dev dependency (adds to root)
npm install -D new-dev-package
```

### Running Commands

```bash
# Build all packages
npm run build

# Run tests across all packages
npm run test

# Type check all packages
npm run type-check
```

## Best Practices Followed

1. **Single Source of Truth**: All dependencies managed at root level
2. **Workspace Dependencies**: Only `@awslambdahackathon/*` packages declared in individual packages
3. **Version Consistency**: Same versions across all packages
4. **Clean Structure**: Minimal package.json files in sub-packages
5. **Turbo Optimization**: Better caching and build performance

## Verification

The optimization has been verified by:

- ✅ All packages build successfully
- ✅ Dependencies are properly resolved
- ✅ No duplicate packages in node_modules
- ✅ Workspace dependencies work correctly
- ✅ TypeScript compilation works across all packages

This optimization follows monorepo best practices and will improve development experience, build performance, and maintenance overhead.
