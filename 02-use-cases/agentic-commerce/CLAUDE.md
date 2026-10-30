# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Travel with Agentic Commerce: AI-powered travel planning application built on AWS Bedrock AgentCore with Strands SDK. Features streaming responses from Claude Sonnet 4.5, Cognito authentication, and real-time metrics dashboard.

## Critical Architecture Decisions

### Deployment Order
**ALWAYS deploy frontend before backend.** The backend imports Cognito User Pool from the frontend CloudFormation stack. Deploying backend first will fail.

```bash
# Correct order:
cd infrastructure
./deploy-frontend.sh --cognito-domain my-unique-domain  # Creates Cognito
./deploy-agent.sh --bootstrap                           # First time only
./deploy-agent.sh                                       # Uses frontend Cognito
```

### Shared Authentication
- Frontend and backend share the same Cognito User Pool
- Frontend: Uses OAuth 2.0 Authorization Code flow for user authentication
- Backend Runtime → Gateway: Uses OAuth 2.0 Client Credentials flow for machine-to-machine auth
- Backend adds MCP resource server and OAuth client to the frontend's User Pool

### Streaming Architecture
- Uses Strands SDK `stream_async()` for token-by-token streaming
- Agent yields string chunks via async generator: `yield event["data"]`
- Frontend reads Server-Sent Events (SSE) format from AgentCore API
- Do NOT use `agent.run()` - it returns complete responses, not streams

### Container Platform
AgentCore requires ARM64 architecture. The Dockerfile uses `ghcr.io/astral-sh/uv:python3.13-bookworm-slim` and CDK specifies `Platform.LINUX_ARM64`.

## Development Commands

### Frontend
```bash
cd frontend

# Development with authentication disabled
echo "VITE_DEV_MODE=true" > .env
npm install
npm run dev  # http://localhost:8080

# Development with Cognito auth (after deployment)
# .env is auto-updated by deploy-frontend.sh
npm run dev

# Production build
npm run build
```

### Backend Agent
```bash
cd backend/agent

# Install dependencies
uv sync  # Creates venv and installs from pyproject.toml

# Local development (no auth, no memory)
agentcore dev  # Starts local server

# Test locally
agentcore invoke --dev '{"prompt": "Hello! What can you do?"}'
agentcore invoke --dev '{"prompt": "Plan a trip", "user_id": "test-user"}'

# Run tests
python -m pytest test/
python -m pytest test/test_main.py -v
python -m pytest test/ --cov=src --cov-report=html
```

### Backend CDK
```bash
cd backend/agent/cdk

npm install
npm run build       # Compile TypeScript
npm run test        # Run Jest tests
npm run cdk:deploy  # Deploy all stacks
```

### Deployment
```bash
cd infrastructure

# First time: Deploy frontend
./deploy-frontend.sh --cognito-domain my-app-unique-name

# First time: Bootstrap CDK for backend
./deploy-agent.sh --bootstrap

# Regular deployments
./deploy-agent.sh

# Deploy and test
./deploy-agent.sh --invoke

# Create test user
./setup-cognito.sh --user-pool-id <POOL_ID> --email test@example.com

# Cleanup
./destroy-agent.sh    # Backend first
./destroy-frontend.sh # Frontend second
```

## Key File Locations

### Agent Implementation
- `backend/agent/src/main.py` - Strands Agent entrypoint with streaming
- `backend/agent/src/model/load.py` - Model loading utilities
- `backend/agent/src/mcp_client/client.py` - MCP HTTP client
- `backend/agent/.bedrock_agentcore.yaml` - AgentCore CLI configuration

### Infrastructure
- `backend/agent/cdk/lib/stacks/agentcore-stack.ts` - Main CDK stack (Gateway, Memory, Runtime, Lambda)
- `backend/agent/cdk/lib/stacks/docker-image-stack.ts` - ECR and container build
- `backend/agent/Dockerfile` - Container definition (ARM64, uv package manager)
- `infrastructure/cf-frontend.yaml` - CloudFormation template for S3, CloudFront, Cognito

### MCP Tools
- `backend/agent/mcp/lambda/handler.py` - Lambda handler for all MCP tools
- Tools are routed by `bedrockAgentCoreToolName` in context (format: `LambdaTarget___tool_name`)

### Frontend
- `frontend/src/App.jsx` - Main app with streaming message handler
- `frontend/src/components/ChatInterface.jsx` - Chat UI
- `frontend/src/components/Sidebar.jsx` - Metrics dashboard
- `frontend/src/components/auth/AuthProvider.tsx` - Cognito OIDC wrapper
- `frontend/src/hooks/useAuth.ts` - Authentication hook

## Adding New MCP Tools

MCP tools are Lambda functions invoked through AgentCore Gateway.

1. **Implement tool in Lambda handler** (`backend/agent/mcp/lambda/handler.py`):
```python
def lambda_handler(event, context):
    extended_name = context.client_context.custom.get("bedrockAgentCoreToolName")
    tool_name = extended_name.split("___", 1)[1] if "___" in extended_name else None

    if tool_name == "my_new_tool":
        return _response(200, {"result": my_new_tool(event)})
    # ... other tools

def my_new_tool(event: Dict[str, Any]):
    return {"result": "success", "data": event.get("param1")}
```

2. **Add tool schema to Gateway** (`backend/agent/cdk/lib/stacks/agentcore-stack.ts`):
```typescript
toolSchema: {
    inlinePayload: [
        {
            name: "my_new_tool",
            description: "Clear description for the AI model",
            inputSchema: {
                type: "object",
                properties: {
                    param1: { type: 'string', description: 'Parameter description' }
                },
                required: ["param1"]
            }
        }
    ]
}
```

3. **Redeploy**: `cd infrastructure && ./deploy-agent.sh`

## AgentCore Memory Strategies

The application uses 4 built-in memory strategies (30-day retention):

1. **Semantic Facts** (`/facts/{actorId}/`) - Long-term knowledge about users
2. **User Preferences** (`/preferences/{actorId}/`) - User-specific settings
3. **Session Summaries** (`/summaries/{actorId}/{sessionId}/`) - Conversation summaries
4. **Episodic Memory** (`/episodes/{actorId}/{sessionId}/`) - Event tracking with reflection

Memory is automatically managed by AgentCore when `BEDROCK_AGENTCORE_MEMORY_ID` environment variable is set (CDK configures this).

## Authentication Flow Details

### Frontend → AgentCore Runtime
1. User authenticates via Cognito Hosted UI (OAuth 2.0 Authorization Code flow)
2. Frontend stores JWT access token from Cognito
3. Frontend includes token in Authorization header: `Bearer ${token}`
4. AgentCore Runtime validates JWT against Cognito JWKS endpoint

### Runtime → Gateway (MCP Tools)
1. Runtime requests token from Cognito token endpoint (Client Credentials flow)
2. Uses `COGNITO_CLIENT_ID`, `COGNITO_CLIENT_SECRET`, and `COGNITO_SCOPE`
3. Receives access token with scope: `{app-name}-mcp/mcp-access`
4. Gateway validates JWT before invoking Lambda

## Environment Variables

### Frontend (.env - auto-configured by deploy script)
```env
VITE_DEV_MODE=false
VITE_COGNITO_DOMAIN=https://{prefix}.auth.{region}.amazoncognito.com
VITE_COGNITO_USER_POOL_ID={region}_{poolId}
VITE_COGNITO_CLIENT_ID={clientId}
VITE_COGNITO_REDIRECT_URI=https://{cloudfront-domain}.cloudfront.net
VITE_COGNITO_LOGOUT_URI=https://{cloudfront-domain}.cloudfront.net
VITE_AGENTCORE_API_URL=https://bedrock-agentcore.{region}.amazonaws.com/runtimes/{runtime-arn}/invocations
```

### Backend (set by CDK in container)
```bash
AWS_REGION=us-west-2
GATEWAY_URL=https://{gateway-id}.execute-api.{region}.amazonaws.com
BEDROCK_AGENTCORE_MEMORY_ID={memory-id}
COGNITO_CLIENT_ID={client-id}
COGNITO_CLIENT_SECRET={client-secret}
COGNITO_TOKEN_URL=https://{domain}.auth.{region}.amazoncognito.com/oauth2/token
COGNITO_SCOPE={app-name}-mcp/mcp-access
```

## Testing Patterns

### Local Agent Testing (no auth, no memory)
```bash
cd backend/agent
agentcore dev  # Terminal 1
agentcore invoke --dev '{"prompt": "Test message"}' # Terminal 2
```

### Integration Testing (after deployment)
```bash
cd backend/agent
agentcore invoke '{"prompt": "Plan a trip to Paris"}'
agentcore invoke '{"prompt": "What do I like?", "user_id": "test-user"}'
```

### Frontend Testing
```bash
cd frontend
VITE_DEV_MODE=true npm run dev  # Bypasses auth for local UI testing
```

## Common Issues

### "Frontend stack not found"
Deploy frontend before backend. Backend imports Cognito from frontend stack.

### "Architecture incompatible"
Ensure Dockerfile builds for ARM64. Check that CDK uses `Platform.LINUX_ARM64`.

### "Streaming not working"
- Use `stream_async()` not `run()` in agent code
- Yield events with `yield event["data"]`, don't return them
- Frontend must handle SSE format correctly

### "MCP tool not found"
- Tool name in handler must match Gateway schema
- Handler parses tool name from `LambdaTarget___tool_name` format
- Check CloudWatch logs: `/aws/lambda/{function-name}`

### "Memory not persisting"
- Verify `BEDROCK_AGENTCORE_MEMORY_ID` is set in container environment
- Check IAM permissions for memory access in CDK stack
- Memory is disabled in local dev (`agentcore dev`)

### ".env not updated after deployment"
Run `./infrastructure/update-env.sh` to manually refresh frontend configuration.

## Tech Stack Notes

- **Python Package Manager**: Uses `uv` for fast dependency resolution (not pip/poetry)
- **Frontend Build Tool**: Vite (not Create React App or webpack)
- **AgentCore Model**: Claude Sonnet 4.5 via global inference profile
- **Container Runtime**: Finch or Docker (Finch preferred on macOS)
- **CDK Language**: TypeScript (backend/agent/cdk)
- **CloudFormation**: Only for frontend stack (infrastructure/cf-frontend.yaml)

## Observability

### CloudWatch Logs
- Runtime: `/aws/bedrock-agentcore/runtimes/{runtime-id}`
- Lambda (MCP): `/aws/lambda/{function-name}`
- Frontend: CloudFront access logs in S3

### Metrics
- Namespace: `bedrock-agentcore`
- Key metrics: Invocations, Duration, Errors, Token Usage

### Tracing
X-Ray tracing is enabled via CDK configuration in agentcore-stack.ts.

## Cost Estimation

- Frontend: ~$2-4/month (S3, CloudFront, Cognito free tier)
- Backend: ~$5-50/month (variable based on usage: Lambda, Bedrock tokens, AgentCore invocations)
- Memory: 30-day retention included in AgentCore pricing
