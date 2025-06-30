# AWS Services Used

This document provides an exhaustive list of the AWS services used in this project, along with a description of their roles.

## Core Services

-   **AWS Lambda**: The core of the serverless backend. All runtime code is executed in Lambda functions, which handle WebSocket connections, business logic, and API requests.

-   **Amazon API Gateway**: Used for both WebSocket and REST APIs.
    -   **WebSocket API**: Manages real-time, bidirectional communication between the frontend and the backend.
    -   **REST API**: Provides standard HTTP endpoints for authentication and other non-real-time interactions.

-   **Amazon DynamoDB**: The primary database for the application. It is a fully managed NoSQL database used to store user data, messages, and connection information. It is configured for pay-per-request billing to ensure cost-efficiency.

-   **Amazon S3 (Simple Storage Service)**: Used to host the static assets for the React-based web frontend, including HTML, CSS, and JavaScript files.

-   **Amazon CloudFront**: A Content Delivery Network (CDN) that serves the web frontend. It caches the S3 assets at edge locations to provide low-latency access for users worldwide and secures the S3 bucket by using an Origin Access Identity (OAI).

-   **Amazon Cognito**: Provides user identity and access management. It handles user authentication, including sign-up, sign-in, and session management.

## Monitoring and Observability

-   **Amazon CloudWatch**: Used for monitoring, logging, and alarms.
    -   **Logs**: Aggregates logs from all Lambda functions.
    -   **Metrics**: Collects metrics to monitor the health and performance of the application.
    -   **Alarms**: Configured to trigger notifications if any of the key metrics breach predefined thresholds.

-   **AWS X-Ray**: Provides distributed tracing to help analyze and debug the serverless application. (Implied by the use of Powertools tracer)

-   **Amazon CloudWatch RUM (Real-User Monitoring)**: Used to collect and analyze performance data from the web frontend, providing insights into the user experience.

## Development and Deployment

-   **AWS Cloud Development Kit (CDK)**: The infrastructure for the entire application is defined as code using the CDK. This allows for repeatable and automated deployments.

-   **AWS IAM (Identity and Access Management)**: Manages permissions for all the AWS resources, ensuring that each service has only the access it needs to function (principle of least privilege).
