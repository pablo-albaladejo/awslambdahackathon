# WebSocket Communication Flow

This diagram illustrates the sequence of events in the WebSocket communication flow within the AWS serverless architecture, from client connection to message exchange, including the role of AWS Lambda functions and Model Context Protocol (MCP) integration.

```mermaid
sequenceDiagram
    participant Client
    participant APIGateway as API Gateway (WebSocket)
    participant ConnLambda as Connection Handler (Lambda)
    participant AuthLambda as Auth Handler (Lambda)
    participant MsgLambda as Message Handler (Lambda)
    participant DynamoDB
    participant MCP as MCP Server

    Client->>APIGateway: Connect
    APIGateway->>ConnLambda: $connect event
    ConnLambda->>DynamoDB: Store Connection
    ConnLambda-->>APIGateway: 200 OK
    APIGateway-->>Client: Connection Established

    Client->>APIGateway: Send Auth Message
    APIGateway->>AuthLambda: $default event (auth)
    AuthLambda->>DynamoDB: Validate Connection
    AuthLambda-->>APIGateway: 200 OK
    APIGateway-->>Client: Auth Response

    Client->>APIGateway: Send Chat Message
    APIGateway->>MsgLambda: $default event (message)
    MsgLambda->>DynamoDB: Store Message
    MsgLambda->>MCP: Process Message (e.g., AI response)
    MCP-->>MsgLambda: MCP Response
    MsgLambda-->>APIGateway: 200 OK
    APIGateway-->>Client: Message Response

    Client->>APIGateway: Disconnect
    APIGateway->>ConnLambda: $disconnect event
    ConnLambda->>DynamoDB: Remove Connection
    ConnLambda-->>APIGateway: 200 OK
