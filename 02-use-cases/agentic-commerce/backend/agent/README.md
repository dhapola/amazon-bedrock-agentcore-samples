# Agent - Travel with Agentic Commerce

AWS Bedrock AgentCore agent with Strands SDK, streaming responses, and MCP tool integration.

## Architecture

```
AgentCore Runtime (Container - ARM64)
├── Strands SDK Agent (src/main.py)
│   ├── Streaming async responses
│   ├── Claude Sonnet 4.5 model (global inference profile)
│   └── Travel assistant system prompt
├── MCP Client (src/mcp_client/client.py)
│   └── HTTP client for tool integration
├── AgentCore Memory Integration
│   ├── Semantic Facts
│   ├── User Preferences
│   ├── Session Summaries
│   └── Episodic Memory
└── Environment Configuration

AgentCore Gateway (MCP Protocol)
├── JWT Authorization (Cognito)
├── Lambda Target (MCP Tools)
└── OAuth 2.0 Client Credentials

AgentCore Memory (30-day retention)
├── Semantic Memory Strategy
├── User Preference Strategy
├── Summary Memory Strategy
└── Episodic Memory Strategy
```

## Tech Stack

- **Python 3.13** with uv package manager
- **Strands SDK 1.13.0+** - Agent orchestration with streaming
- **AWS Bedrock AgentCore 1.0.3+** - Agent runtime platform
- **Claude Sonnet 4.5** - Global inference profile model
- **MCP 1.19.0+** - Model Context Protocol
- **AWS Lambda** - MCP tool execution
- **AWS CDK (TypeScript)** - Infrastructure as Code
- **Docker + Finch** - Container builds (ARM64)

## Project Structure

```
agent/
├── src/
│   ├── main.py              # Strands Agent with streaming
│   ├── mcp_client/
│   │   └── client.py        # MCP HTTP client
│   └── model/
│       └── load.py          # Model loading utilities
├── mcp/
│   └── lambda/
│       ├── handler.py       # MCP tool implementations
│       └── requirements.txt
├── cdk/
│   ├── bin/
│   │   └── cdk.ts           # CDK app entry
│   ├── lib/
│   │   ├── stacks/
│   │   │   ├── agentcore-stack.ts    # AgentCore resources
│   │   │   ├── docker-image-stack.ts # Container build
│   │   │   └── index.ts
│   │   ├── test/
│   │   │   └── cdk.test.ts
│   │   └── types.ts         # TypeScript types
│   ├── package.json
│   └── cdk.json
├── test/
│   ├── __init__.py
│   └── test_main.py         # Unit tests
├── Dockerfile               # Container definition (ARM64)
├── pyproject.toml           # Python dependencies
├── uv.lock                  # Dependency lock file
└── .bedrock_agentcore.yaml  # AgentCore CLI config
```

## Local Development

### Prerequisites
- Python >= 3.12
- uv (Python package manager): `pip install uv`
- AWS CLI configured
- AgentCore CLI: `pip install bedrock-agentcore-cli`

### Setup
```bash
cd backend/agent

# Install dependencies (uv handles virtual env automatically)
uv sync

# Or manually with pip
pip install -e .
```

### Run Locally
```bash
# Start local development server
agentcore dev

# Test locally with prompt
agentcore invoke --dev '{"prompt": "Hello! What can you do?"}'

# Test with user context
agentcore invoke --dev '{"prompt": "Plan a trip to Paris", "user_id": "test-user"}'
```

### Run Tests
```bash
# Run all tests
python -m pytest test/

# Run with coverage
python -m pytest test/ --cov=src --cov-report=html

# Run specific test
python -m pytest test/test_main.py -v
```

## Deployment

### Prerequisites
- Node.js >= 18 (for CDK)
- AWS CLI configured
- Finch or Docker
- CDK bootstrapped in target region

### Deploy
```bash
cd ../../infrastructure

# First-time deployment (bootstrap CDK)
./deploy-agent.sh --bootstrap

# Regular deployment
./deploy-agent.sh

# Deploy and test
./deploy-agent.sh --invoke
```

### What Gets Deployed

**Docker Image Stack:**
- ECR repository
- Container image (ARM64, built and pushed)

**AgentCore Stack:**
- Imports Cognito User Pool from frontend stack
- Adds MCP resource server and OAuth client
- Lambda function for MCP tools
- AgentCore Gateway with JWT authorization
- AgentCore Memory with 4 strategies (30-day retention)
- AgentCore Runtime with container
- Runtime endpoints (PROD, DEV)

## Agent Implementation

### Strands Agent (src/main.py)

```python
from strands import Agent
from bedrock_agentcore import BedrockAgentCoreApp

app = BedrockAgentCoreApp()

@app.entrypoint
async def invoke(payload, context):
    agent = Agent(
        model=load_model(),
        system_prompt="You are a helpful travel assistant..."
    )
    
    # Stream responses token-by-token
    stream = agent.stream_async(payload.get("prompt"))
    
    async for event in stream:
        if "data" in event and isinstance(event["data"], str):
            yield event["data"]
```

### Key Features
- **Streaming Responses**: Token-by-token streaming via async generator
- **Session Management**: Uses AgentCore context for session tracking
- **User Context**: Accepts user_id in payload for personalization
- **Memory Integration**: Automatic memory storage via AgentCore
- **Error Handling**: Graceful error responses

## MCP Tools

MCP tools are Lambda functions behind the AgentCore Gateway.

### Current Tools

**placeholder_tool** - Example tool demonstrating parameter passing
```python
def placeholder_tool(event: Dict[str, Any]):
    return {
        "message": "Placeholder tool executed.",
        "string_param": event.get("string_param"),
        "int_param": event.get("int_param"),
        "float_array_param": event.get("float_array_param"),
    }
```

### Adding New Tools

1. **Implement in Lambda handler** (`mcp/lambda/handler.py`):
```python
def lambda_handler(event, context):
    tool_name = context.client_context.custom.get("bedrockAgentCoreToolName")
    tool_name = tool_name.split("___", 1)[1] if "___" in tool_name else None
    
    if tool_name == "my_new_tool":
        return _response(200, {"result": my_new_tool(event)})

def my_new_tool(event: Dict[str, Any]):
    # Tool implementation
    return {"result": "success"}
```

2. **Update Gateway target schema** (`cdk/lib/stacks/agentcore-stack.ts`):
```typescript
toolSchema: {
    inlinePayload: [
        {
            name: "my_new_tool",
            description: "Description of what the tool does",
            inputSchema: {
                type: "object",
                properties: {
                    param1: { type: 'string', description: 'Parameter description' },
                },
                required: ["param1"]
            }
        }
    ]
}
```

3. **Redeploy**:
```bash
cd ../../infrastructure
./deploy-agent.sh
```

## Authentication

### Frontend to Runtime
- Frontend users authenticate via Cognito OAuth 2.0
- JWT tokens passed in Authorization header
- Runtime validates JWT via Cognito discovery URL

### Runtime to Gateway (MCP Tools)
- OAuth 2.0 Client Credentials flow
- Runtime requests token from Cognito
- Token includes MCP scope: `{app-name}-mcp/mcp-access`
- Gateway validates JWT before invoking Lambda

### Environment Variables (Auto-configured)
```bash
AWS_REGION=us-west-2
GATEWAY_URL=https://gateway-id.execute-api.region.amazonaws.com
BEDROCK_AGENTCORE_MEMORY_ID=memory-id
COGNITO_CLIENT_ID=client-id
COGNITO_CLIENT_SECRET=client-secret
COGNITO_TOKEN_URL=https://domain.auth.region.amazoncognito.com/oauth2/token
COGNITO_SCOPE=agentic_commerce-mcp/mcp-access
```

## Memory Strategies

AgentCore Memory provides 4 built-in strategies:

### 1. Semantic Facts
- **Namespace**: `/facts/{actorId}/`
- **Purpose**: Long-term knowledge about users
- **Example**: User preferences, travel history

### 2. User Preferences
- **Namespace**: `/preferences/{actorId}/`
- **Purpose**: User-specific preferences
- **Example**: Preferred airlines, budget ranges

### 3. Session Summaries
- **Namespace**: `/summaries/{actorId}/{sessionId}/`
- **Purpose**: Conversation summaries
- **Example**: Trip planning progress

### 4. Episodic Memory
- **Namespace**: `/episodes/{actorId}/{sessionId}/`
- **Purpose**: Event tracking with reflection
- **Example**: Conversation turns, decisions made

## Testing

### Unit Tests
```bash
# Run all tests
python -m pytest test/

# Run with verbose output
python -m pytest test/ -v

# Run specific test file
python -m pytest test/test_main.py
```

### Integration Tests
```bash
# Test deployed agent
agentcore invoke '{"prompt": "Plan a trip to Paris"}'

# Test with session context
agentcore invoke '{"prompt": "Continue planning", "user_id": "test-user"}'
```

### AWS Console Testing
1. Navigate to Bedrock AgentCore → Test Console
2. Select your runtime
3. Choose DEFAULT version
4. Input: `{"prompt": "Hello! What can you do?"}`

## Observability

### CloudWatch Logs
- **Runtime logs**: `/aws/bedrock-agentcore/runtimes/{runtime-id}`
- **Lambda logs**: `/aws/lambda/{function-name}`

### Enable X-Ray Tracing
```bash
# In AWS Console: Bedrock AgentCore → Runtime → Observability
# Or via CDK (already configured in agentcore-stack.ts)
```

### CloudWatch Metrics
- Namespace: `bedrock-agentcore`
- Metrics: Invocations, Duration, Errors, Token Usage
- Lambda metrics: Invocations, Duration, Errors, Throttles

### Custom Logging
```python
from bedrock_agentcore import BedrockAgentCoreApp

app = BedrockAgentCoreApp()
log = app.logger

@app.entrypoint
async def invoke(payload, context):
    log.info(f"Processing request for user: {payload.get('user_id')}")
    # ... agent logic
```

## Troubleshooting

### "Frontend stack not found"
Deploy frontend first:
```bash
cd ../../infrastructure
./deploy-frontend.sh --cognito-domain my-unique-domain
```

### "Architecture incompatible"
Ensure Dockerfile builds for ARM64 (AgentCore requirement):
```dockerfile
FROM --platform=linux/arm64 public.ecr.aws/docker/library/python:3.13-slim
```

### "CDK bootstrap required"
Run bootstrap on first deployment:
```bash
cd cdk
npm run cdk bootstrap
# Or use deploy script
cd ../../infrastructure
./deploy-agent.sh --bootstrap
```

### "MCP tool not found"
1. Check Lambda handler tool name matches Gateway schema
2. Verify tool name parsing in handler (splits on "___")
3. Check CloudWatch logs for Lambda errors

### "Streaming not working"
1. Verify `stream_async` is used (not `run`)
2. Check that events are yielded (not returned)
3. Ensure frontend reads SSE format correctly

### "Memory not persisting"
1. Verify BEDROCK_AGENTCORE_MEMORY_ID is set
2. Check IAM permissions for memory access
3. Review memory strategy namespaces

## Development Tips

### Local Testing with Memory
```bash
# Memory is disabled in local dev by default
# To test with memory, deploy to AWS and use:
agentcore invoke '{"prompt": "Remember I like beaches"}'
agentcore invoke '{"prompt": "What do I like?"}'
```

### Debugging Streaming
```python
# Add logging to see what's being streamed
async for event in stream:
    log.info(f"Stream event: {event}")
    if "data" in event:
        yield event["data"]
```

### Testing MCP Tools Locally
MCP tools require Gateway authentication, so test after deployment:
```bash
# Deploy first
cd ../../infrastructure
./deploy-agent.sh

# Then test
cd ../backend/agent
agentcore invoke '{"prompt": "Use the placeholder tool"}'
```

## Production Checklist

- [ ] Enable AgentCore observability (X-Ray, CloudWatch)
- [ ] Move secrets to AWS Secrets Manager
- [ ] Implement comprehensive error handling
- [ ] Write unit tests for all tools
- [ ] Set up CI/CD pipeline
- [ ] Configure access control for endpoints
- [ ] Monitor CloudWatch logs and metrics
- [ ] Test with production workload
- [ ] Set up alerting for errors and latency
- [ ] Document all MCP tools
- [ ] Review IAM permissions (least privilege)
- [ ] Enable CloudTrail for audit logging

## Cost Optimization

- **Container**: ARM64 for better performance/cost ratio
- **Memory**: 30-day retention (adjust based on needs)
- **Lambda**: Pay per invocation (MCP tools)
- **Bedrock**: Pay per token (input + output)
- **AgentCore**: Pay per runtime invocation

Estimated monthly cost: $5-50 (variable based on usage)

## License

MIT
