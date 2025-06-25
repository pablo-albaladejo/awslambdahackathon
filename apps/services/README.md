# Services App

This app contains various backend services for the AWS Lambda Hackathon project.

## Structure

- `src/mcp/` - MCP (Model Context Protocol) related services
  - `mcp-host.ts` - MCP host handler for chat functionality

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode
npm run dev

# Run tests
npm test

# Type checking
npm run type-check
```

## Services

### MCP Host

The MCP host service provides chat functionality with session management. It currently implements a simple echo behavior and can be extended to integrate with actual MCP servers.

Features:

- Session management with automatic cleanup
- Request/response logging
- Metrics and tracing
- Error handling
