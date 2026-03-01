# Infrastructure - Travel with Agentic Commerce

Deployment scripts and CloudFormation templates for frontend and backend infrastructure.

## Quick Start

```bash
# 1. Deploy frontend (creates Cognito)
./deploy-frontend.sh --cognito-domain my-unique-app-auth

# 2. Deploy backend (uses frontend Cognito)
./deploy-agent.sh --bootstrap  # First time only
./deploy-agent.sh              # Subsequent deploys

# 3. Create test user
./setup-cognito.sh --user-pool-id <USER_POOL_ID> --email test@example.com

# 4. Visit CloudFront URL
```

## Deployment Order

**Important**: Deploy frontend first, then backend. The backend imports Cognito configuration from the frontend stack.

```
Frontend → Creates Cognito User Pool
    ↓
Backend → Imports Cognito, adds MCP resources
```

## What Gets Deployed

### Frontend Stack
- **S3 Bucket** - Static website hosting with versioning
- **CloudFront Distribution** - Global CDN with HTTPS
- **Cognito User Pool** - User authentication (shared with backend)
- **Cognito User Pool Client** - OAuth 2.0 for frontend
- **Cognito Domain** - Hosted UI for login/signup

### Backend Stack
- **ECR Repository** - Container image storage
- **Docker Image** - Agent container (ARM64)
- **Lambda Function** - MCP tools
- **AgentCore Gateway** - API with Cognito JWT authorization
- **AgentCore Memory** - Session and context storage (30-day retention)
- **AgentCore Runtime** - Agent execution environment
- **Cognito MCP Client** - Machine-to-machine auth (added to frontend's User Pool)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend Stack                          │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │  S3 Bucket   │  │  CloudFront  │  │  Cognito Pool   │  │
│  │  (React SPA) │◄─┤ Distribution │  │  + Client       │  │
│  └──────────────┘  └──────────────┘  │  + Domain       │  │
│                                       └────────┬────────┘  │
└────────────────────────────────────────────────┼───────────┘
                                                 │
                                                 │ Shared
                                                 │
┌────────────────────────────────────────────────┼───────────┐
│                     Backend Stack              │           │
│  ┌──────────────┐  ┌──────────────┐  ┌────────▼────────┐  │
│  │   ECR Repo   │  │    Lambda    │  │  Cognito Pool   │  │
│  │  (Container) │  │  (MCP Tools) │  │  (Imported)     │  │
│  └──────┬───────┘  └──────┬───────┘  │  + MCP Resource │  │
│         │                 │           │  + MCP Client   │  │
│  ┌──────▼─────────────────▼───────────▼─────────────────┐  │
│  │         AgentCore Runtime + Gateway                  │  │
│  │  - Strands SDK Agent                                 │  │
│  │  - MCP Client                                        │  │
│  │  - Memory Integration                                │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Scripts

### deploy-frontend.sh
Deploys frontend infrastructure and application.

```bash
./deploy-frontend.sh [OPTIONS]

Options:
  -b, --bucket-name       S3 bucket name
  -s, --stack-name        CloudFormation stack name (default: agentic-commerce-frontend)
  -e, --environment       Environment (dev/staging/prod)
  -r, --region            AWS region (default: us-west-2)
  -d, --cognito-domain    Cognito domain prefix (REQUIRED, must be globally unique)
  -h, --help              Show help
```

**What it does:**
1. Deploys CloudFormation stack
2. Retrieves Cognito configuration
3. Updates `frontend/.env` with Cognito values
4. Builds frontend with correct configuration
5. Uploads to S3
6. Invalidates CloudFront cache

### deploy-agent.sh
Deploys backend AgentCore infrastructure.

```bash
./deploy-agent.sh [OPTIONS]

Options:
  --bootstrap              Run CDK bootstrap (first-time only)
  --skip-synth             Skip CDK synth step
  --invoke                 Test agent after deployment
  --frontend-stack-name    Frontend stack name (default: agentic-commerce-frontend)
  --region                 AWS region (default: us-west-2)
  --help                   Show help
```

**What it does:**
1. Retrieves Cognito config from frontend CloudFormation stack
2. Exports config as environment variables for CDK
3. Builds Docker container (ARM64)
4. Pushes container to ECR
5. Deploys CDK stacks (Docker image + AgentCore)

### setup-cognito.sh
Creates test users in Cognito User Pool.

```bash
./setup-cognito.sh [OPTIONS]

Options:
  -u, --user-pool-id      Cognito User Pool ID (REQUIRED)
  -e, --email             User email address (REQUIRED)
  -p, --password          User password (optional, auto-generated if not provided)
  -h, --help              Show help
```

### update-env.sh
Manually updates `frontend/.env` with Cognito configuration.

```bash
./update-env.sh [OPTIONS]

Options:
  -s, --stack-name        CloudFormation stack name (default: agentic-commerce-frontend)
  -r, --region            AWS region (default: us-west-2)
  -h, --help              Show help
```

### destroy-frontend.sh
Removes frontend infrastructure.

```bash
./destroy-frontend.sh [OPTIONS]

Options:
  -s, --stack-name        CloudFormation stack name (default: agentic-commerce-frontend)
  -r, --region            AWS region (default: us-west-2)
  -y, --yes               Skip confirmation prompt
  -h, --help              Show help
```

### destroy-agent.sh
Removes backend infrastructure.

```bash
./destroy-agent.sh
```

## Prerequisites

- AWS CLI configured with credentials
- Node.js >= 18 for CDK
- Finch or Docker for container builds
- Python >= 3.12 for agent development
- Bash shell (macOS/Linux)

## Environment Variables

### Frontend (.env)
Auto-updated by deployment script:

```env
VITE_DEV_MODE=false
VITE_COGNITO_DOMAIN=https://your-domain.auth.region.amazoncognito.com
VITE_COGNITO_USER_POOL_ID=region_PoolId
VITE_COGNITO_CLIENT_ID=ClientId
VITE_COGNITO_REDIRECT_URI=https://your-cloudfront.cloudfront.net
VITE_COGNITO_LOGOUT_URI=https://your-cloudfront.cloudfront.net
```

### Backend (CDK)
Set by deploy-agent.sh:

```bash
export FRONTEND_USER_POOL_ID="region_PoolId"
export FRONTEND_USER_POOL_ARN="arn:aws:cognito-idp:region:account:userpool/region_PoolId"
export FRONTEND_CLOUDFRONT_DOMAIN="d1234567890abc.cloudfront.net"
```

## Troubleshooting

### "Cognito domain already exists"
Choose a different domain prefix:
```bash
./deploy-frontend.sh --cognito-domain my-app-$(date +%s)
```

### "Frontend stack not found"
Deploy frontend first:
```bash
./deploy-frontend.sh --cognito-domain my-domain
```

### "Architecture incompatible"
Ensure Docker builds for ARM64. Check `backend/agent/cdk/lib/stacks/docker-image-stack.ts`:
```typescript
platform: ecr_assets.Platform.LINUX_ARM64
```

### "CDK bootstrap required"
Run bootstrap on first deployment:
```bash
./deploy-agent.sh --bootstrap
```

### Region mismatch
Use same region for both stacks:
```bash
./deploy-frontend.sh --region us-west-2
./deploy-agent.sh --region us-west-2
```

## Security Features

- HTTPS enforced via CloudFront
- Private S3 bucket with OAC
- Cognito authentication with JWT tokens
- IAM roles with least privilege
- Secrets in environment variables
- Token-based auth with automatic refresh
- Security headers via CloudFront

## Cost Estimation

### Frontend (Monthly)
- S3 Storage: ~$0.50
- S3 Requests: ~$0.10
- CloudFront: ~$1-3
- Cognito: Free (< 50K MAU)
- **Total: ~$2-4/month**

### Backend (Monthly)
- ECR Storage: ~$0.10
- Lambda: ~$0.20
- AgentCore Runtime: Pay per invocation
- Bedrock Models: Pay per token
- AgentCore Memory: Pay per event
- **Total: ~$5-50/month (variable)**

## Files

- `deploy-frontend.sh` - Frontend deployment
- `deploy-agent.sh` - Backend deployment
- `setup-cognito.sh` - User creation
- `update-env.sh` - Manual .env updater
- `destroy-frontend.sh` - Frontend cleanup
- `destroy-agent.sh` - Backend cleanup
- `cf-frontend.yaml` - CloudFormation template
- `prebuild-image.sh` - Docker image pre-build (optional)

## License

MIT
