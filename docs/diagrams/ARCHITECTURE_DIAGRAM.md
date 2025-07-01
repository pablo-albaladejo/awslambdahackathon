# High-Level Architecture Diagram

This diagram provides a high-level overview of the serverless real-time communication application's architecture on AWS, illustrating the main components and their interactions, including the integration points for AWS Lambda and the Model Context Protocol (MCP).

```mermaid
graph LR
    A[React Frontend]
    B[CloudFront]
    C[S3 Bucket]
    D[API Gateway - REST]
    E[API Gateway - WebSocket]
    F[AWS Lambda Functions]
    G[Amazon DynamoDB]
    H[Amazon Cognito]
    I[Amazon CloudWatch]
    J[Model Context Protocol - Server]

    A -->|HTTPS| B
    B -->|Serves Content| C
    A -->|REST API Calls | D
    A -->|WebSocket Connection | E

    D -->|Triggers| F
    E -->|Triggers| F

    F -->|Reads/Writes| G
    F -->|Authenticates With| H
    F -->|Sends Logs/Metrics| I
    F -->|MCP Requests| J
    J -->|MCP Responses| F
```
