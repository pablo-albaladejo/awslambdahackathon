# DynamoDB Data Model

This document presents the entity-relationship diagram for the Amazon DynamoDB tables used in the application, illustrating the data structure and relationships.

```mermaid
erDiagram
    USERS {
        string userId PK
        string email
        string username
        string createdAt
        string updatedAt
    }

    CONNECTIONS {
        string connectionId PK
        string userId FK
        string sessionId
        string connectedAt
        string lastActivityAt
        string status
    }

    SESSIONS {
        string sessionId PK
        string userId FK
        string title
        string createdAt
        string updatedAt
        string lastMessageAt
        int messageCount
        bool isActive
    }

    MESSAGES {
        string messageId PK
        string sessionId FK
        string timestamp
        string text
        bool isUser
        string userId FK
    }

    USERS ||--o{ SESSIONS : has
    USERS ||--o{ CONNECTIONS : has
    SESSIONS ||--o{ MESSAGES : has
    SESSIONS ||--o{ CONNECTIONS : "used by"
    USERS ||--o{ MESSAGES : "writes"

    SESSIONS ||--o{ MESSAGES : "has"
