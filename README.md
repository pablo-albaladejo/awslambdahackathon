# AWS Lambda Chat Application

This repository contains a real-time, serverless chat application built on AWS Lambda with a React-based web frontend. It serves as a comprehensive example of a modern, event-driven architecture on AWS, demonstrating scalability, resilience, and extensibility through the Model Context Protocol (MCP).

## Table of Contents

1.  [Features](#features)
2.  [Architecture Overview](#architecture-overview)
    *   [High-Level Architecture Diagram](#high-level-architecture-diagram)
    *   [WebSocket Communication Flow](#websocket-communication-flow)
    *   [DynamoDB Data Model](#dynamodb-data-model)
3.  [Tech Stack](#tech-stack)
4.  [Getting Started](#getting-started)
    *   [Prerequisites](#prerequisites)
    *   [Installation](#installation)
5.  [Development](#development)
    *   [Available Scripts](#available-scripts)
6.  [Deployment](#deployment)
7.  [Detailed Documentation](#detailed-documentation)
    *   [AWS Services Used](#aws-services-used)
    *   [AWS Cloud Development Kit (CDK)](#aws-cloud-development-kit-cdk)
    *   [Deployment Scripts](#deployment-scripts)
    *   [Shared Types and Schemas](#shared-types-and-schemas)
    *   [Utilities Package](#utilities-package)
    *   [Web Performance Optimizations](#web-performance-optimizations)
    *   [Architecture Details](#architecture-details)
        *   [Circuit Breaker Usage](#circuit-breaker-usage)
        *   [Middy Integration](#middy-integration)
        *   [Monitoring and Alerts](#monitoring-and-alerts)
        *   [Performance Monitoring Usage](#performance-monitoring-usage)
        *   [Validation and Configuration](#validation-and-configuration)
    *   [Guides](#guides)
        *   [AWS CloudWatch RUM Setup Guide](#aws-cloudwatch-rum-setup-guide)
8.  [License](#license)

## Features

*   **Real-Time Messaging**: WebSocket-based communication for instant message delivery.
*   **User Authentication**: Secure user sign-up and sign-in functionality using AWS Cognito.
*   **Serverless Backend**: Powered by AWS Lambda for automatic scalability and cost-efficiency.
*   **Infrastructure as Code**: The entire infrastructure is defined and deployed using the AWS Cloud Development Kit (CDK).
*   **Monorepo Structure**: Organized as a monorepo using Turborepo for efficient management of multiple applications and packages.
*   **Observability**: Comprehensive monitoring, logging, and alerting with AWS CloudWatch and Real User Monitoring (RUM).
*   **Resilience**: Implementation of Circuit Breaker patterns to enhance fault tolerance and prevent cascading failures.
*   **Extensibility with MCP Lambda**: Integration of the Model Context Protocol (MCP) to enable advanced chatbot functionalities and seamless interaction with external AI models or tools.

## Architecture Overview

The project is structured as a monorepo and follows a layered architecture, separating concerns into `apps` (frontend, backend, infrastructure) and `packages` (shared code).

*   `apps/web`: A React frontend built with Vite, providing the user interface for the chat application. It interacts with the backend via REST and WebSocket APIs.
*   `apps/runtime`: The serverless backend, implemented as a collection of AWS Lambda functions. It handles core business logic, including WebSocket connection management, user authentication, message processing, and integration with external services. It leverages **Middy.js** for middleware to streamline logging, validation, and error handling.
*   `apps/cdk`: Contains the AWS CDK stacks responsible for defining and deploying all the necessary cloud infrastructure, including API Gateway (for both REST and WebSocket endpoints), Lambda functions, DynamoDB tables, Cognito User Pools, S3 buckets, and CloudFront distributions.
*   `packages/`: Houses shared utilities, TypeScript types, and configurations used across the different applications to maintain consistency and reduce code duplication.

### High-Level Architecture Diagram

For a visual overview of the entire application architecture, including the flow between components and the integration of MCP, refer to the [High-Level Architecture Diagram](./docs/diagrams/ARCHITECTURE_DIAGRAM.md).

### WebSocket Communication Flow

To understand the sequence of events in the real-time communication, from client connection to message exchange and MCP integration, see the [WebSocket Communication Flow Diagram](./docs/diagrams/WEBSOCKET_FLOW_DIAGRAM.md).

### DynamoDB Data Model

Details on the data structure and relationships within the Amazon DynamoDB tables can be found in the [DynamoDB Data Model Diagram](./docs/diagrams/DATA_MODEL_DIAGRAM.md).

## Tech Stack

*   **Languages**: TypeScript, JavaScript
*   **Frontend**: React, Vite, AWS Amplify
*   **Backend**: Node.js, AWS Lambda, Middy.js
*   **Infrastructure as Code**: AWS Cloud Development Kit (CDK)
*   **Cloud Services**: AWS Lambda, AWS API Gateway (WebSocket & REST), AWS DynamoDB, AWS Cognito, Amazon S3, Amazon CloudFront, AWS CloudWatch, AWS X-Ray, AWS CloudWatch RUM
*   **Databases**: Amazon DynamoDB
*   **APIs/Protocols**: Model Context Protocol (MCP)
*   **Monorepo Management**: Turborepo
*   **Testing**: Vitest
*   **Linting/Formatting**: ESLint, Prettier

For a complete list of the AWS services used and their roles, please see the [AWS Services documentation](./docs/AWS_SERVICES.md).

## Getting Started

### Prerequisites

*   Node.js (v18 or higher)
*   npm (v10 or higher)
*   AWS CLI, configured with appropriate credentials and an AWS profile.

### Installation

1.  Clone the repository:
    ```bash
    git clone <repository-url>
    cd awslambdahackathon
    ```

2.  Install the dependencies from the root of the monorepo:
    ```bash
    npm install
    ```

## Development

To build all the apps and packages in the monorepo, run the following command from the root directory:

```bash
npm run build
```

To run the development servers for all applications simultaneously, use:

```bash
npm run dev
```

### Available Scripts

*   `npm run lint`: Lint the codebase for potential errors.
*   `npm run test`: Run tests for all packages.
*   `npm run format`: Format the code using Prettier.

## Deployment

The application can be deployed to your AWS account using the provided deployment scripts. This will provision the entire infrastructure and deploy the latest version of the code.

To deploy with default settings:
```bash
./scripts/deploy.sh
```

To tear down all the deployed resources:
```bash
./scripts/destroy.sh
```

For more detailed deployment instructions and parameters, refer to the [Deployment Scripts documentation](./docs/DEPLOYMENT_SCRIPTS.md).

## Detailed Documentation

For comprehensive information about the project's architecture, specific service usages, setup guides, and more, please refer to the dedicated documentation files in the `docs/` directory:

*   [**AWS Services Used**](./docs/AWS_SERVICES.md): An exhaustive list of all AWS services used in the project and their roles.
*   [**AWS Cloud Development Kit (CDK)**](./docs/CDK.md): Detailed information about the AWS CDK code and infrastructure deployment.
*   [**Deployment Scripts**](./docs/DEPLOYMENT_SCRIPTS.md): Guides and examples for deploying, destroying, and managing the application.
*   [**Shared Types and Schemas**](./docs/TYPES_PACKAGE.md): Documentation for the shared TypeScript types and Zod schemas.
*   [**Utilities Package**](./docs/UTILS_PACKAGE.md): Information about the shared utility functions.
*   [**Web Performance Optimizations**](./docs/WEB_PERFORMANCE.md): Details on frontend performance optimizations.

### Architecture Details

*   [**Circuit Breaker Usage**](./docs/architecture/CIRCUIT_BREAKER_USAGE.md): Explains the implementation and usage of the Circuit Breaker pattern for resilience.
*   [**Middy Integration**](./docs/architecture/MIDDY_INTEGRATION.md): Describes the Middy middleware integration in AWS Lambda functions.
*   [**Monitoring and Alerts**](./docs/architecture/MONITORING_AND_ALERTS.md): Details the comprehensive monitoring and alerting system using AWS CloudWatch.
*   [**Performance Monitoring Usage**](./docs/architecture/PERFORMANCE_MONITORING_USAGE.md): Explains how the `PerformanceMonitoringService` is used in the backend.
*   [**Validation and Configuration**](./docs/architecture/VALIDATION_AND_CONFIG.md): Describes runtime validation with Zod and centralized configuration.

### Guides

*   [**AWS CloudWatch RUM Setup Guide**](./docs/guides/RUM_SETUP.md): Step-by-step instructions for setting up Real User Monitoring for the frontend.

## License

This project is licensed under the [MIT License](./LICENSE).
