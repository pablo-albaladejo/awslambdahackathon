# DynamoDB Data Model

This document presents the entity-relationship diagram for the Amazon DynamoDB tables used in the application, illustrating the data structure and relationships.

```mermaid
erDiagram
    CONNECTIONS {
        string connectionId PK
        string userId
        string sessionId
        string connectedAt
        string lastActivityAt
        string status
    }

    MESSAGES {
        string sessionId PK
        string timestamp SK
        string messageId
        string text
        bool isUser
        string userId
    }

    USERS {
        string userId PK
        string email
        string username
        string createdAt
        string updatedAt
    }

    SESSIONS {
        string sessionId PK
        string userId
        string title
        string createdAt
        string updatedAt
        string lastMessageAt
        int messageCount
        bool isActive
    }

    USERS ||--o{ SESSIONS : "has"
    USERS ||--o{ CONNECTIONS : "has"
    SESSIONS ||--o{ MESSAGES : "has"
