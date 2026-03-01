# Travel with Agentic Commerce

AI-powered travel planning application with real-time performance monitoring, built on AWS Bedrock AgentCore with Cognito authentication.

## Quick Start

```bash
# 1. Deploy frontend (creates Cognito)
cd infrastructure
./deploy-frontend.sh --cognito-domain my-unique-app-auth

# 2. Deploy backend (uses frontend Cognito)
./deploy-agent.sh --bootstrap  # First time only
./deploy-agent.sh              # Subsequent deploys

# 3. Create test user
./setup-cognito.sh --user-pool-id <from-output> --email your@email.com

# 4. Visit CloudFront URL and sign in
```

## Project Structure

```
.
├── frontend/              # React SPA with Vite
│   ├── src/
│   │   ├── components/   # React components (Chat, Sidebar, Auth)
│   │   ├── hooks/        # Custom React hooks
│   │   └── lib/          # Utilities
│   └── .env              # Environment variables (auto-updated)
│
├── backend/              # Agent backend
│   └── agent/           # AgentCore implementation
│       ├── src/         # Agent code (Strands SDK)
│       ├── mcp/         # MCP Lambda tools
│       └── cdk/         # Infrastructure as Code
│
└── infrastructure/       # Deployment scripts
    ├── deploy-frontend.sh    # Frontend deployment
    ├── deploy-agent.sh       # Backend deployment
    ├── setup-cognito.sh      # User management
    └── cf-frontend.yaml      # CloudFormation template
```

## Features

- **Beautiful Login Screen** - Soft pastel aesthetic with animated floating shapes
- **Cognito Authentication** - Secure OAuth 2.0 with hosted UI and JWT tokens
- **Streaming Responses** - Real-time token-by-token streaming from Claude Sonnet 4.5
- **Real-time Metrics** - Monitor tools, tokens, cost, and latency
- **AI Agent Chat** - Natural conversation interface with travel planning
- **Markdown Support** - Rich text formatting in chat responses
- **AgentCore Memory** - 4 memory strategies (semantic, episodic, preferences, summaries)
- **MCP Tools** - Extensible tool integration via Model Context Protocol
- **Production Ready** - CloudFormation IaC, CDN, HTTPS, shared authentication

## Technology Stack

### Frontend
- React 18.3.1 + Vite 5.1.0
- Framer Motion 11.0.0 (animations)
- AWS Cognito (react-oidc-context)
- Soft pastel design system

### Backend
- AWS Bedrock AgentCore
- Strands SDK (agent orchestration with streaming)
- Python 3.13 + uv
- Claude Sonnet 4.5 (global inference profile)
- MCP (Model Context Protocol)
- AgentCore Memory (4 strategies, 30-day retention)

### Infrastructure
- AWS S3 + CloudFront (frontend hosting)
- AWS Cognito (shared authentication)
- AWS Lambda (MCP tools)
- ECR + Docker (agent container - ARM64)
- AgentCore Runtime, Gateway, Memory
- CloudFormation (IaC)

## Architecture

```
Frontend Stack
├── S3 + CloudFront (React SPA)
└── Cognito User Pool ──────┐
                            │ (shared authentication)
Backend Stack               │
├── ECR + Container         │
├── Lambda (MCP Tools)      │
└── AgentCore ──────────────┘
    ├── Gateway (uses Cognito JWT)
    ├── Memory (session storage)
    └── Runtime (agent execution)
```

## Documentation

- **[Frontend README](./frontend/README.md)** - Frontend development and authentication
- **[Backend README](./backend/README.md)** - Backend overview
- **[Agent README](./backend/agent/README.md)** - Agent development, MCP tools, and testing
- **[Infrastructure README](./infrastructure/README.md)** - Deployment guide and scripts

## Local Development

### Frontend (Dev Mode - No Auth)
```bash
cd frontend
echo "VITE_DEV_MODE=true" > .env
npm install
npm run dev
# Visit http://localhost:8080
```

### Backend (Local Testing)
```bash
cd backend/agent
agentcore dev
# Test with: agentcore invoke --dev "Hello"
```

## Deployment Order

**Important**: Deploy frontend first, then backend. The backend imports Cognito configuration from the frontend stack.

See [infrastructure/README.md](./infrastructure/README.md) for complete deployment instructions.

## Cost Estimation

- **Frontend**: ~$2-4/month (S3, CloudFront, Cognito free tier)
- **Backend**: ~$5-50/month (variable based on usage)
- **Total**: ~$7-54/month for low-traffic development

## Security Features

- HTTPS enforced via CloudFront
- Private S3 bucket with OAC
- Cognito authentication with JWT tokens
- IAM roles with least privilege
- Secrets in environment variables
- Token-based auth with automatic refresh

## License

MIT
