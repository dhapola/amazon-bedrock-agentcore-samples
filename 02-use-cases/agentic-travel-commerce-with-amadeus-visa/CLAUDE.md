# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI-powered agentic travel commerce application built with AWS Bedrock AgentCore, Amplify, and React. Multi-agent system with supervisor pattern coordinating travel search, cart management, and itinerary operations through MCP (Model Context Protocol) servers.

## Architecture

### Multi-Agent System
- **Supervisor Agent** (`agentic_commerce/supervisor_agent/`): Main orchestrator using Strands framework with Claude 4.5 Sonnet
- **Travel Subagent**: Handles destination research, weather, flight/hotel search via MCP tools
- **Cart Subagent**: Manages shopping cart with Visa tokenization support
- **MCP Servers**: Three independent tool servers (Travel, Cart, Itinerary) deployed as separate AgentCore runtimes

### Key Integration Points
1. **AgentCore Gateway**: Connects supervisor to MCP servers with OAuth2 authentication
2. **Memory System**: AgentCore Memory for conversation persistence across sessions
3. **OAuth Flow**: Cognito M2M client → OAuth2 Provider → Gateway → MCP Runtimes
4. **State Management**: DynamoDB tables (UserProfile, Wishlist, Itinerary, Feedback) accessed by all agents

### Infrastructure Stacks
- **Amplify Stack** (deployed first): Cognito, AppSync, DynamoDB tables, exports used by unified backend
- **Unified Backend Stack**: Single atomic stack deploying:
  - 4 AgentCore Runtimes (Supervisor + Cart MCP + Travel MCP + Itinerary MCP)
  - AgentCore Gateway (routes requests to MCP servers)
  - AgentCore Memory (conversation persistence)
  - OAuth2 Provider (M2M authentication)
- **Frontend Stack**: S3 bucket + CloudFront distribution with OAC (optional)
- **Visa Lambda Stack**: Payment proxy for production (optional)

## Prerequisites

Before deploying, store the required API keys in SSM Parameter Store (paths defined in `deployment-config.json`):
- **Amadeus** (`/agentic-commerce-for-travel/travel/amadeus-public`, `amadeus-secret`): Flight/hotel search
- **OpenWeather** (`/agentic-commerce-for-travel/travel/openweather-api-key`): Weather data
- **Tavily** (`/agentic-commerce-for-travel/travel/tavily-api-key`): Travel research search
- **Google Maps** (`/agentic-commerce-for-travel/travel/google-maps-key`): Places/maps data

For real Visa mode, store credentials in Secrets Manager under `visa/` prefix (see `docs/VISA_SECRETS_SETUP.md`).

## deployment-config.json

Central configuration file for all deployment parameters:
- `deploymentId`: Unique identifier for the deployment (default: `voyager-agent`), used in all resource names and CloudFormation exports
- `aws.region`: AWS region (default: `us-east-1`)
- `cognito`: Cognito resource server, OAuth scope, and machine client names
- `ssmParameterPaths`: SSM paths for all API keys
- `secretsManager`: Secrets Manager paths for Visa credentials
- `visa`: Visa iframe URL and client app ID
- `mcpTools`: Tool namespace filters (`carttools___`, `traveltools___`, `itinerarytools___`)

## Common Development Commands

### Build and Deploy
```bash
# Full deployment (automated, ~11 min) - RECOMMENDED
./scripts/deploy-all.sh

# Manual step-by-step deployment (maintains dependency order)
npm run deploy:amplify    # ~4 min - Must run first (creates exports)
npm run deploy:backend    # ~5 min - Unified backend (4 runtimes + gateway + memory)
npm run deploy:visa-lambda  # ~2 min - Optional payment proxy
npm run deploy:frontend:mock  # ~2 min - Optional web UI (mock Visa mode)

# Local development
npm run dev               # Start Vite dev server at https://vcas.local.com:9000/
```

### Cleanup
```bash
npm run clean             # Delete all stacks in correct order
npm run clean:frontend    # Delete only frontend (S3 + CloudFront)
npm run clean:backend     # Delete only unified backend
npm run clean:visa-lambda # Delete only Visa Lambda proxy
npm run clean:amplify     # Delete only Amplify backend
```

### Agent Development
```bash
# Update any runtime (supervisor or MCP servers)
# 1. Modify files in:
#    - agentic_commerce/supervisor_agent/
#    - agentic_commerce/mcp_cart_tools/
#    - agentic_commerce/mcp_travel_tools/
#    - agentic_commerce/mcp_itinerary_tools/
# 2. Touch Dockerfiles to force rebuild
find agentic_commerce/supervisor_agent -name Dockerfile -exec touch {} \;
find agentic_commerce/mcp_* -name Dockerfile -exec touch {} \;
# 3. Deploy unified backend (all 4 runtimes rebuild)
npm run deploy:backend
```

### Frontend Development
```bash
# Local dev with hot reload
cd web-ui
npm run dev

# Lint TypeScript/React files
npm run lint

# Build for production
npm run build

# Deploy to S3 + CloudFront
cd ..
npm run deploy:frontend:mock  # Mock Visa mode (default, no credentials required)
npm run deploy:frontend       # Real Visa mode (requires Visa Lambda deployed)
```

## Critical Architecture Details

### Deployment Dependencies (MUST FOLLOW ORDER)
1. **Amplify first**: Creates CloudFormation exports (`${deploymentId}-Auth-*`, `${deploymentId}-Data-*`)
2. **Unified Backend second**: Imports Amplify exports, creates all 4 runtimes + gateway + memory in single atomic stack
3. **Frontend last** (optional): Reads backend outputs, configures `.env.local`, deploys to S3 + CloudFront

**Key Benefit**: No cross-stack dependencies between runtimes. All 4 runtimes reference each other directly via properties, not CloudFormation imports.

### Gateway Architecture
- **Gateway URL sync**: Gateway URL stored in SSM Parameter `/agentic-commerce/${deploymentId}/gateway-url` during unified backend deployment (no separate sync script needed)
- **OAuth Provider**: Custom CloudFormation resource (Lambda) creates OAuth2 provider by fetching Cognito client secret and storing in Secrets Manager
- **MCP Connection**: Gateway routes tool calls to appropriate MCP runtime based on tool name prefix (CartTools, TravelTools, ItineraryTools)
- **Direct ARN References**: Gateway targets configured with direct property access (e.g., `cartRuntime.runtime.agentRuntimeArn`), not CloudFormation imports

### Agent Code Structure
- `agent.py`: Main entrypoint with `BedrockAgentCoreApp`; uses `us.anthropic.claude-sonnet-4-5-20250929-v1:0`; creates supervisor per request with user profile context and AgentCore memory session
- `prompt_manager.py`: System prompts for supervisor and subagents
- `gateway_client.py`: Gateway authentication and tool invocation; `get_gateway_client(namespace_filter)` returns an MCP client filtered by tool name prefix
- `cart_subagent.py`: Cart operations with Visa integration
- `travel_subagent.py`: Travel search and recommendations
- `dynamodb_manager.py`: User profile and state management

### Environment Variables
**Agent Container** (auto-configured in CDK):
- `MEMORY_ID`: AgentCore memory identifier
- `USER_PROFILE_TABLE_NAME`, `WISHLIST_TABLE_NAME`, `ITINERARY_TABLE_NAME`, `FEEDBACK_TABLE_NAME`: DynamoDB tables
- `GATEWAY_CLIENT_ID`, `GATEWAY_USER_POOL_ID`, `GATEWAY_SCOPE`: OAuth config for gateway access
- `DEPLOYMENT_ID`: From `deployment-config.json`, used for resource naming

**Web UI** (auto-generated in `web-ui/.env.local` by `setup-web-ui-env.sh`):
- `VITE_AGENT_RUNTIME_ARN`: Main supervisor runtime ARN
- `VITE_AGENT_ENDPOINT_NAME`: "DEFAULT"
- `VITE_AWS_REGION`: AWS region

### Visa Payment Integration
Two modes controlled by deployment flags:
1. **Mock Mode** (default): Frontend uses mock Visa service, no credentials required
2. **Real Mode**: Requires Visa credentials in Secrets Manager, deployed via:
   - Local dev: `agentic_commerce/local-visa-server/` (proxy running on localhost:5001)
   - Production: `infrastructure/visa-lambda-stack/` (Lambda + API Gateway)

## Testing and Debugging

### Enable AgentCore Debug Logs
```bash
# Get gateway ID from stack outputs
DEPLOYMENT_ID=$(node -p "require('./deployment-config.json').deploymentId")
GATEWAY_ID=$(aws cloudformation describe-stacks \
  --stack-name UnifiedBackendStack-${DEPLOYMENT_ID} \
  --query 'Stacks[0].Outputs[?OutputKey==`GatewayId`].OutputValue' \
  --output text)

# Enable DEBUG exception level
aws bedrock-agentcore-control update-gateway \
  --gateway-identifier $GATEWAY_ID \
  --exception-level DEBUG
```

### Check Deployment Status
```bash
# Verify Amplify exports exist
DEPLOYMENT_ID=$(node -p "require('./deployment-config.json').deploymentId")
aws cloudformation list-exports --query "Exports[?contains(Name, '${DEPLOYMENT_ID}')]"

# Check unified backend stack outputs
aws cloudformation describe-stacks \
  --stack-name UnifiedBackendStack-${DEPLOYMENT_ID} \
  --query 'Stacks[0].Outputs'

# Verify all 4 runtimes exist
aws bedrock-agentcore list-runtimes --query "runtimes[?contains(name, '${DEPLOYMENT_ID}')].name"

# View gateway URL from SSM
aws ssm get-parameter --name /agentic-commerce/${DEPLOYMENT_ID}/gateway-url
```

### CloudWatch Logs
- Supervisor agent runtime: `/aws/bedrock-agentcore/runtime/<supervisor-runtime-id>`
- MCP server runtimes: `/aws/bedrock-agentcore/runtime/<mcp-runtime-id>` (3 separate log groups)
- OAuth provider Lambda: `/aws/lambda/UnifiedBackendStack-*-OAuthProviderLambda*`
- Gateway logs: Enable via AgentCore console (Application Logs type)

## Important Patterns

### Resource Naming Convention
All AgentCore resources use sanitized names (alphanumeric + underscores only):
```typescript
const sanitizeName = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
```

### CloudFormation Export Pattern
Amplify stack creates exports with format: `${DEPLOYMENT_ID}-{Category}-{ResourceName}`
- Auth exports: `travel-Auth-UserPoolId`, `travel-Auth-ClientId`, `travel-Auth-MachineClientId`
- Data exports: `travel-Data-UserProfileTableName`, `travel-Data-WishlistTableName`, etc.
- Unified backend exports: `UnifiedBackendStack-travel-MainRuntimeArn`, `UnifiedBackendStack-travel-GatewayUrl`, etc.

### Multi-Deployment Support
Change `deploymentId` in `deployment-config.json` to deploy multiple independent instances in same AWS account. All resource names and exports include the deployment ID.

### Docker Build Caching
Unified backend deployment touches all Dockerfiles before CDK deploy to force rebuilds:
```bash
find agentic_commerce/supervisor_agent -name Dockerfile -exec touch {} \;
find agentic_commerce/mcp_* -name Dockerfile -exec touch {} \;
```
Without touching Dockerfiles, CDK may skip rebuild even if source code changed.

## Common Issues

### "Cannot import value" CloudFormation error
- **Cause**: Amplify stack not deployed before unified backend
- **Fix**: Deploy in order: Amplify → Unified Backend → Frontend

### Gateway returns "An internal error occurred"
- **Cause**: Default exception level hides error details
- **Fix**: Set gateway `exceptionLevel: 'DEBUG'` in CDK or via CLI (see Testing section)

### Agent not connecting to MCP servers
- **Cause**: OAuth provider creation failed or gateway targets not configured
- **Fix**: Check Lambda logs for OAuth provider (`/aws/lambda/UnifiedBackendStack-*-OAuthProviderLambda*`) or verify gateway targets via CLI

### Docker build fails during deployment
- **Cause**: Docker daemon not running or insufficient disk space
- **Fix**: Start Docker Desktop, clean up unused images with `docker system prune`

### API Gateway CloudWatch logging error
- **Cause**: Account-level CloudWatch role not configured
- **Fix**: See DEPLOYMENT.md "Common Issues" section for one-time account setup

## Security Considerations

- API keys stored in SSM Parameter Store (Amadeus, OpenWeather, Tavily, Google Maps) or Secrets Manager (Visa credentials)
- OAuth2 M2M authentication between supervisor and gateway
- JWT authentication from frontend to agent runtime
- Cognito provides user authentication with owner-based access control in AppSync
- IAM roles follow least privilege (DynamoDB access scoped to specific tables/indexes)
