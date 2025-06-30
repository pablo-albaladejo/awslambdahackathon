# AWS Lambda Chat Application

This repository contains a real-time, serverless chat application built on AWS Lambda with a React-based web frontend. It serves as a comprehensive example of a modern, event-driven architecture on AWS.

## Features

-   **Real-Time Messaging**: WebSocket-based communication for instant message delivery.
-   **User Authentication**: Secure user sign-up and sign-in functionality.
-   **Serverless Backend**: Powered by AWS Lambda for scalability and cost-efficiency.
-   **Infrastructure as Code**: The entire infrastructure is defined using the AWS Cloud Development Kit (CDK).
-   **Monorepo Structure**: Organized as a monorepo using Turborepo for efficient management of multiple applications and packages.

## Architecture

The project is structured as a monorepo and includes the following main components:

-   `apps/web`: A React frontend built with Vite that provides the user interface for the chat application.
-   `apps/runtime`: The serverless backend running on AWS Lambda. It handles the core business logic, including WebSocket connections, user authentication, and message processing. It leverages **Middy** for middleware to streamline logging, validation, and error handling.
-   `apps/cdk`: The AWS CDK stacks for deploying all the necessary cloud infrastructure, including API Gateway, Lambda functions, DynamoDB tables, and Cognito User Pools.
-   `packages/`: Shared utilities, types, and configurations used across the different applications to maintain consistency and reduce code duplication.

For a deeper dive into the technical design and patterns used in this project, please refer to the [architecture documentation](./docs/architecture/MIDDY_INTEGRATION.md).

## Tech Stack

-   **Frontend**: React, TypeScript, Vite, AWS Amplify
-   **Backend**: Node.js, TypeScript, AWS Lambda, Middy.js
-   **Infrastructure**: AWS CDK, DynamoDB, API Gateway (WebSocket & REST), Cognito, S3, CloudFront
-   **Tooling**: Turborepo, ESLint, Prettier, Vitest

For a complete list of the AWS services used and their roles, please see the [AWS Services documentation](./docs/AWS_SERVICES.md).

## Getting Started

### Prerequisites

-   Node.js (v18 or higher)
-   npm (v10 or higher)
-   AWS CLI, configured with appropriate credentials

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

-   `npm run lint`: Lint the codebase for potential errors.
-   `npm run test`: Run tests for all packages.
-   `npm run format`: Format the code using Prettier.

## Deployment

The application can be deployed to your AWS account using the provided script. This will provision the entire infrastructure and deploy the latest version of the code.

```bash
npm run deploy
```

To tear down all the deployed resources, you can run:

```bash
npm run destroy
```

## Documentation

For more detailed information about the architecture, setup guides, and usage, please refer to the [full documentation](./docs/).

## License

This project is licensed under the [MIT License](./LICENSE).
