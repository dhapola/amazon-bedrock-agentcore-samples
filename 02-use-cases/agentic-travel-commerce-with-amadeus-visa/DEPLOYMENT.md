# Agentic Commerce for Travel with Amadeus & Visa - Deployment Guide

Complete deployment guide for the Agentic Commerce for Travel with Amadeus & Visa system with Amplify backend, CDK infrastructure, and web UI.

## Prerequisites

### Required Tools
- **Node.js**: v18+ (v20 recommended)
- **npm**: v9+
- **AWS CLI**: v2+ configured with credentials
- **Docker**: For building agent container images
- **jq**: For JSON parsing - `brew install jq` (macOS) or `apt-get install jq` (Linux)

### AWS Account Requirements
- AWS account with appropriate permissions

### AWS Permissions Required
- Amplify deployment permissions
- CDK deployment permissions (CloudFormation, IAM, etc.)
- Bedrock permissions (AgentCore)
- S3, DynamoDB, Cognito, ECR

### API Keys (Optional)

API keys enable additional features but are not required for basic functionality. The application works out of the box with basic features.

#### Visa API (Payment Integration)

**Default**: Application uses **mock mode** by default - no Visa credentials required!

**For real Visa integration**:
- Follow the [Visa onboarding process](visa-documentation/visa-payment-integration-guide.md#onboarding-process)
- See [Visa Payment Configuration](#visa-payment-configuration) section below for detailed setup

## Quick Start

Deploy all components with automated script (recommended):

```bash
./scripts/deploy-all.sh
```

**Time:** ~11 minutes | **No errors, fully automated**

### Manual Deployment

If you prefer step-by-step deployment:

```bash
# Install dependencies
npm install
cd amplify
npm install
cd ..

# 1. Deploy backend (Cognito, DynamoDB, AppSync)
npm run deploy:amplify

# 2. Deploy unified backend (4 runtimes + gateway + memory)
npm run deploy:backend

# 3. Deploy frontend (S3 + CloudFront)
npm run deploy:frontend:mock
```

### Payment Integration

You have three options for payment integration:

#### Option 1: Mock Mode (No Visa Credentials Required)

Deploy with mock Visa APIs - no real payment processing:

```bash
npm run deploy:frontend --mock
```

No additional setup needed. The application will use mock data for all payment-related features.


#### Option 2: Visa Payment integration

**Important:** Visa credentials must be obtained directly from Visa. To onboard please follow the steps in [Visa Documentation.](visa-documentation/visa-payment-integration-guide.md#onboarding-process)

##### Option 2.1: Visa integration via Proxy

If you have Visa API credentials and want to deploy to production:

1. **Export Visa secrets** to AWS Secrets Manager:
   ```bash
   ./scripts/export-visa-secrets.sh
   ```
   This will prompt you for credentials and store them securely.

2. **Deploy Visa Lambda proxy**:
   ```bash
   npm run deploy:visa-lambda
   ```

3. **Deploy frontend**:
   ```bash
   npm run deploy:frontend
   ```

##### Option 2.2:  Visa integration via Local Backend Server

If you have Visa API credentials and want to develop locally:

1. **Export Visa secrets** to AWS Secrets Manager:
   ```bash
   ./scripts/export-visa-secrets.sh
   ```

2. **Follow the local backend server setup**:
   See [Visa Local Server README](agentic_commerce/local-visa-server/README.md) for complete instructions.

   Quick summary:
   - You'll need 2 terminals, both signed into AWS
   - Terminal 1: Run `npm run dev` and open `https://vcas.local.com:9000`
   - Terminal 2: Run the local Visa backend server and open `http://localhost:5001`


## Deployment Dive Deep

### Step 1: Amplify Backend (~4 min)

Deploys Cognito, DynamoDB tables, and AppSync API.

```bash
npm run deploy:amplify
```

**What this deploys:**
- Cognito User Pool with web client and M2M client
- AppSync GraphQL API
- DynamoDB tables (UserProfile, Wishlist, Feedback)
- CloudFormation exports for cross-stack references

**Expected outputs:**
- `amplify_outputs.json` file created
- CloudFormation exports:
  - `{deploymentId}-Auth-UserPoolId`
  - `{deploymentId}-Auth-ClientId`
  - `{deploymentId}-Auth-MachineClientId`
  - `{deploymentId}-Data-UserProfileTableName`
  - `{deploymentId}-Data-WishlistTableName`
  - `{deploymentId}-Data-FeedbackTableName`

**Verification:**
```bash
# Check if amplify_outputs.json exists
ls amplify_outputs.json

# View CloudFormation exports
DEPLOYMENT_ID=$(node -p "require('./deployment-config.json').deploymentId")
aws cloudformation list-exports --query "Exports[?contains(Name, '${DEPLOYMENT_ID}')]"
```

### Step 2: Unified Backend Stack (~5 min)

Deploys all 4 runtimes (3 MCP + 1 supervisor) + gateway + memory in a single atomic stack.

**Before deploying**, optionally configure API keys:

```bash
chmod +x scripts/set-api-keys.sh
./scripts/set-api-keys.sh
chmod +x scripts/export-visa-secrets.sh
./scripts/export-visa-secrets.sh
```

Deploy unified backend:

```bash
npm run deploy:backend
```

**What this deploys:**
- **4 AgentCore Runtimes:**
  - Supervisor Agent (main orchestrator)
  - Cart MCP Server (cart management with DynamoDB and Visa Secrets)
  - Travel MCP Server (travel search)
  - Itinerary MCP Server (itinerary management with DynamoDB)
- **AgentCore Gateway** - Routes requests to MCP servers
- **Memory** - Conversation persistence
- **OAuth2 Credential Provider** - M2M authentication for gateway
- **IAM Roles** - Permissions for DynamoDB, Bedrock, Memory, Gateway
- **SSM Parameter** - Gateway URL storage

**Expected outputs:**
- `MainRuntimeArn` - Main supervisor agent runtime ARN
- `MainRuntimeId` - Main runtime ID
- `MemoryId` - Conversation memory ID
- `GatewayUrl` - Gateway endpoint URL
- `GatewayId` - Gateway ID
- `OAuthProviderArn` - OAuth provider ARN

**Key Benefits:**
- Single atomic deployment (no cross-stack dependencies)
- Faster deployments (all runtimes deployed in parallel)
- Simplified rollback and disaster recovery

**Verification:**
```bash
# Check unified backend stack outputs
DEPLOYMENT_ID=$(node -p "require('./deployment-config.json').deploymentId")
aws cloudformation describe-stacks \
  --stack-name UnifiedBackendStack-${DEPLOYMENT_ID} \
  --query 'Stacks[0].Outputs'

# Verify all 4 runtimes exist
aws bedrock-agentcore list-runtimes --query "runtimes[?contains(name, '${DEPLOYMENT_ID}')].name"

# Verify gateway targets
GATEWAY_ID=$(aws cloudformation describe-stacks \
  --stack-name UnifiedBackendStack-${DEPLOYMENT_ID} \
  --query 'Stacks[0].Outputs[?OutputKey==`GatewayId`].OutputValue' --output text)
aws bedrock-agentcore-control list-gateway-targets --gateway-identifier $GATEWAY_ID
```

### Step 3: Visa Lambda Proxy (~2 min) - Optional

Deploys Lambda proxy for Visa API integration in production environments.

**Note:** Only deploy this if you have Visa API credentials and want to use real payment processing. Skip this step if using mock mode.

**Before deploying**, ensure you've exported Visa secrets:
```bash
./scripts/export-visa-secrets.sh
```

Deploy the Visa Lambda proxy:
```bash
npm run deploy:visa-lambda
```

**What this deploys:**
- Lambda function with Visa API integration
- API Gateway endpoints for Visa operations
- IAM roles with Secrets Manager access
- CORS configuration for frontend access

**Expected outputs:**
- `VisaLambdaStack-{deploymentId}-ApiUrl` - API Gateway endpoint URL
- Lambda function ARN

**Verification:**
```bash
# Check Visa Lambda stack outputs
aws cloudformation describe-stacks \
  --stack-name VisaLambdaStack-travel \
  --query 'Stacks[0].Outputs'

# Test the API endpoint
curl https://<api-url>/health
```

### Step 4: Frontend (~2 min) - Optional

Deploys web UI to S3 bucket with CloudFront distribution.

**Deployment options:**

**Option A: Deploy with Mock Visa APIs (No Visa credentials required)**
```bash
npm run deploy:frontend --mock
```

**Option B: Deploy with Real Visa Integration (Requires Step 4)**
```bash
npm run deploy:frontend
```

**What this deploys:**
- S3 bucket for static assets (private, CloudFront OAC access only)
- CloudFront distribution with:
  - HTTPS redirect enforcement
  - SPA routing support (404/403 → index.html)
  - Optimized caching (1 year for assets, no-cache for HTML)
  - Gzip/Brotli compression
- Environment variables for agent connection (.env.local)
- Visa API configuration (mock or real based on deployment option)

**Expected outputs:**
- CloudFront distribution URL
- S3 bucket name
- Distribution ID

**Verification:**
```bash
# Check frontend stack outputs
DEPLOYMENT_ID=$(node -p "require('./deployment-config.json').deploymentId")
aws cloudformation describe-stacks \
  --stack-name FrontendStack-${DEPLOYMENT_ID} \
  --query 'Stacks[0].Outputs'

# Visit the CloudFront URL
WEBSITE_URL=$(aws cloudformation describe-stacks \
  --stack-name FrontendStack-${DEPLOYMENT_ID} \
  --query 'Stacks[0].Outputs[?OutputKey==`WebsiteUrl`].OutputValue' --output text)
echo "Visit: $WEBSITE_URL"
```

**Cost Benefits vs Amplify Hosting:**
- S3 + CloudFront: ~30-50% cost reduction for typical usage
- Faster deployments (2 min vs 3-5 min)
- Better caching control

**Note:** The local Visa server only works with local development (`npm run dev`). When deploying to CloudFront, you must either:
- Use mock mode (`--mock` flag), or
- Deploy the Visa Lambda proxy (Step 3) for real payment processing


## Configuration

### Deployment ID

Configure via `deployment-config.json` in project root:

```json
{
  "deploymentId": "travel",
  "description": "Unique identifier for this deployment"
}
```

Change `deploymentId` to deploy multiple independent instances in the same AWS account.

### Environment Variables

**Agent Container** (automatically configured):
```bash
MEMORY_ID=<memory-id>
USER_PROFILE_TABLE_NAME=<table-name>
WISHLIST_TABLE_NAME=<table-name>
FEEDBACK_TABLE_NAME=<table-name>
DEPLOYMENT_ID=<deployment-id>
GATEWAY_CLIENT_ID=<cognito-client-id>
GATEWAY_USER_POOL_ID=<user-pool-id>
GATEWAY_SCOPE=concierge-gateway/invoke
```

**Web UI** (auto-generated in `web-ui/.env.local`):
```env
VITE_AGENT_RUNTIME_ARN=arn:aws:bedrock-agentcore:...
VITE_AGENT_ENDPOINT_NAME=DEFAULT
VITE_AWS_REGION=us-east-1
```

## Deployment Scripts Reference

| Script | Description | Time |
|--------|-------------|------|
| `./scripts/deploy-all.sh` | Deploy everything (automated, recommended) | ~11 min |
| `npm run deploy` | Deploy Amplify + Backend + Visa Lambda | ~11 min |
| `npm run deploy:amplify` | Deploy Amplify backend only | ~4 min |
| `npm run deploy:backend` | Deploy unified backend (4 runtimes + gateway) | ~5 min |
| `npm run deploy:visa-lambda` | Deploy Visa Lambda proxy (optional) | ~2 min |
| `npm run deploy:frontend` | Deploy web UI to S3 + CloudFront | ~2 min |
| `npm run deploy:frontend:mock` | Deploy frontend in mock mode (no Visa) | ~2 min |
| `npm run dev` | Start local development server | - |
| `npm run build` | Build web UI for production | - |
| `npm run clean` | Delete all resources (frontend + backend + Visa + Amplify) | ~5 min |
| `npm run clean:frontend` | Delete frontend only | ~1 min |
| `npm run clean:backend` | Delete unified backend only | ~2 min |
| `npm run clean:visa-lambda` | Delete Visa Lambda proxy only | ~1 min |
| `npm run clean:amplify` | Delete Amplify backend only | ~2 min |

**Note:** `deploy:mcp` and `deploy:agent` are aliases for `deploy:backend` (backward compatibility)

## Troubleshooting

### Amplify Deployment Issues

**Issue:** `amplify_outputs.json` not created
```bash
# Solution: Ensure deployment completed successfully
npm run deploy:amplify

# Check CloudFormation stack status
aws cloudformation describe-stacks --stack-name amplify-*
```

**Issue:** Cognito exports not found
```bash
# Solution: Verify exports exist
DEPLOYMENT_ID=$(node -p "require('./deployment-config.json').deploymentId")
aws cloudformation list-exports --query "Exports[?contains(Name, '${DEPLOYMENT_ID}')]"
```

### Backend Deployment Issues

**Issue:** Unified backend stack deployment fails
```bash
# Solution: Ensure Amplify is deployed first
npm run deploy:amplify

# Verify Docker is running
docker ps

# Check agent code paths exist
ls -la agentic_commerce/supervisor_agent/
ls -la agentic_commerce/mcp_cart_tools/
ls -la agentic_commerce/mcp_travel_tools/
ls -la agentic_commerce/mcp_itinerary_tools/
```

**Issue:** Cannot import Amplify exports
```bash
# Solution: Verify Amplify CloudFormation exports exist
DEPLOYMENT_ID=$(node -p "require('./deployment-config.json').deploymentId")
aws cloudformation list-exports --query "Exports[?contains(Name, '${DEPLOYMENT_ID}')]"
```

**Issue:** Docker build fails
```bash
# Solution: Ensure Docker is running
docker ps

# Test build locally
cd agentic_commerce/supervisor_agent
docker build -t test-build .
```

**Issue:** OAuth provider creation fails
```bash
# Solution: Check Lambda logs
DEPLOYMENT_ID=$(node -p "require('./deployment-config.json').deploymentId")
aws logs tail /aws/lambda/UnifiedBackendStack-${DEPLOYMENT_ID}-*-OAuthProviderLambda* --follow

# Verify IAM permissions for Lambda
```

### Gateway Issues

**Issue:** Gateway returns "An internal error occurred"

**Solution:** Enable debug mode to see detailed errors:

```bash
# Get gateway ID from stack outputs
DEPLOYMENT_ID=$(node -p "require('./deployment-config.json').deploymentId")
GATEWAY_ID=$(aws cloudformation describe-stacks \
  --stack-name UnifiedBackendStack-${DEPLOYMENT_ID} \
  --query 'Stacks[0].Outputs[?OutputKey==`GatewayId`].OutputValue' \
  --output text)

# Enable debugging
aws bedrock-agentcore-control update-gateway \
  --gateway-identifier $GATEWAY_ID \
  --exception-level DEBUG
```

Or update the gateway construct in CDK to include `exceptionLevel: 'DEBUG'`.

### Web UI Issues

**Issue:** `.env.local` not created
```bash
# Solution: Ensure unified backend is deployed
npm run deploy:backend

# Manually configure
./scripts/setup-web-ui-env.sh
```

**Issue:** Authentication fails
```bash
# Check Cognito configuration
cat web-ui/.env.local

# Verify user exists
aws cognito-idp list-users --user-pool-id <pool-id>
```

**Issue:** Agent not responding
```bash
# Check Agent Runtime ARN is correct
cat web-ui/.env.local

# Verify runtime is active
aws bedrock-agentcore list-runtimes
```

### Common Issues
**AWS CLI**: Ensure AWS CLI is configured with credentials and running the latest version

**API Gateway logging**: Ensure API Gateway logs are enabled in CloudWatch

**Error: CloudWatch Logs role ARN must be set in account settings to enable logging (Service: ApiGateway, Status Code: 400**

1. Create the IAM role for API Gateway to push logs to CloudWatch:

   ```aws iam create-role --role-name APIGatewayCloudWatchLogsRole --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"apigateway.amazonaws.com"},"Action":"sts:AssumeRole"}]}'```

2. Attach the managed policy that allows pushing logs:

   ```aws iam attach-role-policy --role-name APIGatewayCloudWatchLogsRole --policy-arn arn:aws:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs```

3. Configure API Gateway account settings to use this role:

   ```aws apigateway update-account --patch-operations op=replace,path=/cloudwatchRoleArn,value=arn:aws:iam::<account_id>:role/APIGatewayCloudWatchLogsRole```

**AgentCore Observability**: Enable CloudWatch Transaction Search and log delivery for debugging


One-time account setup for CloudWatch Transaction Search (enables traces/spans)
1. Open CloudWatch console
2. Navigate to Application Signals (APM) → Transaction search
3. Click "Enable Transaction Search"
4. Check "Ingest spans as structured logs"
5. Click Save

Per-resource log delivery (configure in AgentCore Console)
1. Open AgentCore Console → select Runtime/Memory/Gateway
2. Scroll to "Log delivery" section → Click "Add"
3. Select CloudWatch Logs, choose APPLICATION_LOGS type
4. Save

Enable Runtime tracing (per runtime)
1. Open AgentCore Console → Runtime agents → select runtime
2. Scroll to "Tracing" section → Enable


**Docker build fails**: Ensure Docker is running

**Permission errors**: Check IAM roles have Bedrock and DynamoDB permissions

**Frontend build fails**: Check TypeScript errors in `web-ui/src`

**Runtime connection fails**: Verify runtime ARN in `.env.local`

**CloudFormation export not found**: Ensure deployment order (Amplify → Unified Backend → Frontend)

## Updating the System

### Update Backend Code (Agent or MCP Servers)
```bash
# Make changes to any runtime:
# - agentic_commerce/supervisor_agent/
# - agentic_commerce/mcp_cart_tools/
# - agentic_commerce/mcp_travel_tools/
# - agentic_commerce/mcp_itinerary_tools/

# Touch Dockerfiles to force rebuild
find agentic_commerce/supervisor_agent -name Dockerfile -exec touch {} \;
find agentic_commerce/mcp_* -name Dockerfile -exec touch {} \;

# Redeploy unified backend
npm run deploy:backend
```

### Update Amplify Backend
```bash
# Make changes to amplify/
npm run deploy:amplify
```

### Update Web UI
```bash
# Make changes to web-ui/src/
# For local development
npm run dev

# For deployed frontend
npm run deploy:frontend
```

## Clean Up

### Delete All Resources
```bash
npm run clean
```

This deletes (in order):
1. Frontend (S3 + CloudFront)
2. Unified backend (4 runtimes, Gateway, Memory, OAuth Provider)
3. Visa Lambda proxy (if deployed)
4. Amplify backend (Cognito, AppSync, DynamoDB)

### Partial Cleanup
```bash
# Delete only frontend
npm run clean:frontend

# Delete only unified backend
npm run clean:backend

# Delete only Visa Lambda proxy
npm run clean:visa-lambda

# Delete only Amplify backend
npm run clean:amplify
```

**Note:** Some resources may require manual deletion:
- CloudWatch log groups
- SSM parameters
- Secrets Manager secrets (Visa credentials)

## Cost Considerations

### Amplify Stack
- Cognito: Free tier available
- AppSync: Pay per request
- DynamoDB: On-demand pricing
- Lambda: Free tier available

### Infrastructure Stacks
- **Bedrock AgentCore**: Pay per invocation
- **Memory**: Pay per operation
- **ECR**: Minimal storage costs
- **MCP Runtimes**: Pay per invocation
- **Gateway**: Pay per request

### Optimization Tips
- Delete sandbox environments when not in use
- Use on-demand pricing for DynamoDB
- Monitor Bedrock usage
- Set up billing alerts

## Recommendations

1. **Use Amplify Pipelines** instead of sandbox:
```bash
npx ampx pipeline-deploy --branch main
```

2. **Use CDK Pipelines** for infrastructure stacks

3. **Enable monitoring**:
   - CloudWatch dashboards
   - X-Ray tracing
   - Bedrock usage metrics

4. **Security hardening**:
   - Enable MFA for Cognito
   - Restrict IAM permissions
   - Enable CloudTrail logging
   - Store API keys in AWS Secrets Manager

5. **Backup strategy**:
   - DynamoDB point-in-time recovery
   - Regular configuration backups

### Next Steps

After successful deployment:
1. Create Cognito users (admin only)
2. Test agent with sample queries
3. Monitor agent performance
4. Customize agent prompts as needed
5. Configure production environment
6. Set up monitoring and alerts

## Additional Resources

- [Infrastructure README](infrastructure/README.md) 
- [Main README](README.md)
- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [Bedrock AgentCore Documentation](https://docs.aws.amazon.com/bedrock-agentcore/)
- [Amplify Documentation](https://docs.amplify.aws/)
