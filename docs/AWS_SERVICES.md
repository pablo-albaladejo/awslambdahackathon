# AWS Services Used

This document provides an exhaustive list of the AWS services used in this project, along with a description of their roles.

## Core Services

-   **AWS Lambda**: The core of the serverless backend. All runtime code is executed in Lambda functions, which handle WebSocket connections, business logic, and API requests.
    *   **Handle WebSocket Connections:** Lambda functions are triggered by AWS API Gateway WebSocket events (e.g., `$connect`, `$disconnect`, `$default` for messages), managing the lifecycle of connections and routing messages.
    *   **Process Real-time Messages:** Each incoming message from a connected client triggers a Lambda function, which then processes the message (e.g., stores it in DynamoDB, broadcasts it to other connected users, or routes it to an MCP server for chatbot processing).
    *   **Manage User Authentication:** Lambda functions are responsible for authenticating users, validating tokens (e.g., from AWS Cognito), and authorizing access to real-time features.
    *   **Implement Business Logic:** All core business logic, such as storing chat messages, managing user sessions, and interacting with the DynamoDB database, is encapsulated within various Lambda functions.
    *   **Integrate with MCP:** Specific Lambda functions are designed to act as hosts for the Model Context Protocol (MCP), allowing them to communicate with external MCP servers to extend the chatbot's capabilities by leveraging external AI models or specialized tools.
    *   **Scalability and Cost-Efficiency:** By using Lambda, the backend automatically scales to handle varying loads without requiring manual server provisioning or management, and users only pay for the compute time consumed, making it highly cost-efficient for real-time applications.
    *   **Observability and Resilience:** Lambda functions are integrated with AWS CloudWatch for logging, metrics, and alarms, and incorporate resilience patterns like Circuit Breakers to enhance fault tolerance.

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
