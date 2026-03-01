# Backend - Travel with Agentic Commerce

AWS Bedrock AgentCore agent with Strands SDK, MCP tools, and Cognito authentication.

## Architecture

```
AgentCore Runtime (Container)
├── Strands SDK Agent (src/main.py)
├── MCP Client (src/mcp_client/client.py)
└── Memory Integration

AgentCore Gateway
├── MCP Protocol
├── Cognito JWT Authorization
└── Lambda Target (MCP Tools)

AgentCore Memory
├── Semantic Facts
├── User Preferences
├── Session Summaries
└── Episodic Memory
```

## Tech Stack

- Python 3.13 + uv
- Strands SDK (agent orchestration)
- AWS Bedrock AgentCore
- MCP (Model Context Protocol)
- AWS Lambda (MCP tools)
- AWS CDK (TypeScript)
- Docker + Finch

## Project Structure

```
agent/
├── src/
│   ├── main.py              # Agent entrypoint (Strands)
│   ├── mcp_client/
│   │   └── client.py        # MCP HTTP client
│   └── model/
│       └── load.py          # Model loading utilities
├── mcp/
│   └── lambda/
│       ├── handler.py       # MCP tool implementations
│       └── requirements.txt
├── cdk/
│   ├── lib/
│   │   └── stacks/
│   │       ├── agentcore-stack.ts    # AgentCore resources
│   │       ├── docker-image-stack.ts # Container build
│   │       └── index.ts
│   ├── bin/
│   │   └── cdk.ts           # CDK app entry
│   └── package.json
├── test/
│   └── test_main.py         # Unit tests
├── Dockerfile               # Container definition
├── pyproject.toml           # Python dependencies
└── .bedrock_agentcore.yaml  # AgentCore config
```

## Local Development

### Prerequisites
- Python >= 3.12
- uv (Python package manager)
- AWS CLI configured
- AgentCore CLI: `pip install bedrock-agentcore-cli`

### Run Locally
```bash
cd agent

# Start local development server
agentcore dev

# Test locally
agentcore invoke --dev '{"prompt": "Hello! What can you do?"}'
```

## Deployment

### Prerequisites
- Node.js >= 18
- AWS CLI configured
- Finch or Docker
- CDK bootstrapped: `cd cdk && npm run cdk bootstrap`

### Deploy
```bash
cd ../infrastructure

# First-time deployment
./deploy-agent.sh --bootstrap

# Regular deployment
./deploy-agent.sh

# Deploy and test
./deploy-agent.sh --invoke
```

### What Gets Deployed
1. **Docker Image Stack**
   - ECR repository
   - Container image (built and pushed)

2. **AgentCore Stack**
   - Imports Cognito User Pool from frontend
   - Adds MCP resource server and client
   - Lambda function (MCP tools)
   - AgentCore Gateway (with Cognito JWT auth)
   - AgentCore Memory (30-day retention)
   - AgentCore Runtime (with container)
   - Runtime endpoints (PROD, DEV)

## Authentication

The backend uses OAuth 2.0 Client Credentials flow for MCP tool access:

1. Runtime requests token from Cognito
2. Cognito validates client credentials
3. Returns access token (JWT)
4. Runtime calls Gateway with token
5. Gateway validates JWT and invokes Lambda
6. Lambda executes tool and returns result

## MCP Tools

MCP tools are implemented as Lambda functions behind the AgentCore Gateway.

### Example Tool
```python
# mcp/lambda/handler.py
def lambda_handler(event, context):
    tool_name = event.get('tool_name')
    tool_input = event.get('tool_input', {})
    
    if tool_name == 'placeholder_tool':
        return {
            'statusCode': 200,
            'body': json.dumps({
                'result': f"Processed: {tool_input}"
            })
        }
```

### Adding New Tools
1. Implement in `mcp/lambda/handler.py`
2. Update Lambda target schema in `cdk/lib/stacks/agentcore-stack.ts`
3. Redeploy: `cd ../infrastructure && ./deploy-agent.sh`

## Agent Code

The agent is defined using Strands SDK:

```python
# src/main.py
from strands import Agent

agent = Agent(
    name="travel-agent",
    model="anthropic.claude-3-5-sonnet-20241022-v2:0",
    instructions="You are a helpful travel planning assistant...",
    tools=[mcp_client]  # MCP tools via client
)

@app.entrypoint
def invoke(payload):
    prompt = payload.get("prompt", "")
    response = agent.run(prompt)
    return {"response": response}
```

## Testing

### Unit Tests
```bash
cd agent
python -m pytest test/
```

### Integration Tests
```bash
# Test deployed agent
agentcore invoke '{"prompt": "Plan a trip to Paris"}'

# Test via AWS Console
# Navigate to Bedrock AgentCore → Test Console
# Select runtime and DEFAULT version
# Input: {"prompt": "Plan a trip to Paris"}
```

## Environment Variables

Runtime environment variables (auto-configured by CDK):

```
AWS_REGION=us-west-2
GATEWAY_URL=https://gateway-id.execute-api.region.amazonaws.com
BEDROCK_AGENTCORE_MEMORY_ID=memory-id
COGNITO_CLIENT_ID=client-id
COGNITO_CLIENT_SECRET=client-secret
COGNITO_TOKEN_URL=https://domain.auth.region.amazoncognito.com/oauth2/token
COGNITO_SCOPE=agent-mcp/mcp-access
```

## Observability

### CloudWatch Logs
- Runtime logs: `/aws/bedrock-agentcore/runtimes/{runtime-id}`
- Lambda logs: `/aws/lambda/{function-name}`

### X-Ray Tracing
Enable in AWS Console: Bedrock AgentCore → Runtime → Observability

### Metrics
- bedrock-agentcore namespace
- Lambda invocations, duration, errors
- Custom metrics via CloudWatch

## Troubleshooting

### "Frontend stack not found"
Deploy frontend first: `cd ../infrastructure && ./deploy-frontend.sh`

### "Architecture incompatible"
Ensure Dockerfile builds for ARM64 (AgentCore requirement)

### "CDK bootstrap required"
Run: `cd cdk && npm run cdk bootstrap`

### "MCP tool not found"
Check Lambda handler and Gateway target schema match

## Production Checklist

- [ ] Enable AgentCore observability
- [ ] Move secrets to AWS Secrets Manager
- [ ] Implement error handling in agent code
- [ ] Write comprehensive unit tests
- [ ] Set up CI/CD pipeline
- [ ] Configure access control for endpoints
- [ ] Monitor CloudWatch logs and metrics
- [ ] Test with production workload

## License

MIT
