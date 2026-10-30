# Local Development Guide

Complete guide for running the Agentic Commerce for Travel application on your local laptop.

## 📋 Table of Contents
- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Detailed Setup](#detailed-setup)
- [Local Development Workflow](#local-development-workflow)
- [Troubleshooting](#troubleshooting)

---

## 🏗️ Architecture Overview

**Important:** This is a **hybrid deployment model**:
- **Backend (AWS)**: Agent runtimes, MCP servers, Gateway, Memory - all run on AWS Bedrock AgentCore
- **Frontend (Local)**: React app runs on your laptop at `https://vcas.local.com:9000/`
- **Visa Server (Optional)**: Local proxy for Visa payment integration

```
┌─────────────────────────────────────────────┐
│           Your Laptop (Local)               │
│                                             │
│  ┌─────────────────────────────────┐       │
│  │   React Frontend                 │       │
│  │   https://vcas.local.com:9000/   │       │
│  │   (Vite Dev Server)              │       │
│  └──────────────┬──────────────────┘       │
│                 │                            │
│  ┌──────────────▼──────────────────┐       │
│  │   Optional: Visa Local Server    │       │
│  │   http://localhost:5001          │       │
│  └─────────────────────────────────┘       │
└──────────────────┬──────────────────────────┘
                   │
                   │ HTTPS/AWS SDK
                   │
┌──────────────────▼──────────────────────────┐
│              AWS Cloud                      │
│                                             │
│  ┌─────────────────────────────────┐       │
│  │  Bedrock AgentCore              │       │
│  │  - Supervisor Agent Runtime     │       │
│  │  - Travel MCP Server            │       │
│  │  - Cart MCP Server              │       │
│  │  - Itinerary MCP Server         │       │
│  │  - Gateway                      │       │
│  │  - Memory                       │       │
│  └─────────────────────────────────┘       │
│                                             │
│  ┌─────────────────────────────────┐       │
│  │  Amplify Backend                │       │
│  │  - Cognito (Auth)               │       │
│  │  - DynamoDB (Data)              │       │
│  │  - AppSync (GraphQL)            │       │
│  └─────────────────────────────────┘       │
└─────────────────────────────────────────────┘
```

**Why this architecture?**
- AgentCore only runs on AWS (no local emulator available)
- Frontend dev server provides hot reload for rapid development
- All agent logic, tools, and memory persist in AWS

---

## ✅ Prerequisites

### Required Software
| Software | Version | Installation |
|----------|---------|--------------|
| **Node.js** | 18+ | https://nodejs.org/ |
| **npm** | 9+ | Comes with Node.js |
| **AWS CLI** | 2+ | https://aws.amazon.com/cli/ |

### Required AWS Resources
You must have the backend deployed before running locally:

```bash
# Check if backend is deployed
DEPLOYMENT_ID=$(node -p "require('./deployment-config.json').deploymentId")
aws cloudformation describe-stacks --stack-name "UnifiedBackendStack-${DEPLOYMENT_ID}"
```

**If not deployed:**
```bash
# Deploy backend first (~11 min)
./scripts/deploy-all.sh --skip-frontend
```

### AWS Configuration
```bash
# Configure AWS credentials
aws configure

# Or use environment variables
export AWS_PROFILE=your-profile
export AWS_REGION=us-west-2
```

### System Requirements
- **Memory:** 4GB RAM minimum (8GB recommended)
- **Disk Space:** 2GB free space
- **OS:** macOS, Linux, or Windows with WSL2

---

## 🚀 Quick Start

### 1. Add Hosts Entry (One-Time Setup)

**REQUIRED:** Add this entry to your `/etc/hosts` file:

```bash
# Add vcas.local.com to hosts file
echo "127.0.0.1 vcas.local.com" | sudo tee -a /etc/hosts
```

**Why?** Visa's payment iframe only allows specific whitelisted domains. Using `vcas.local.com` instead of `localhost` ensures the Visa integration works properly.

**Verify it worked:**
```bash
ping vcas.local.com
# Should respond from 127.0.0.1
```

### 2. Install Dependencies
```bash
# From project root
npm install

# Install frontend dependencies
cd web-ui
npm install
cd ..
```

### 3. Start Local Development Server
```bash
# From project root
npm run dev
```

This will:
- Auto-configure environment variables from AWS backend
- Start Vite dev server on `https://vcas.local.com:9000/`
- Enable hot module replacement (HMR)

### 3. Open Browser
```bash
# macOS
open https://vcas.local.com:9000/

# Linux
xdg-open https://vcas.local.com:9000/

# Windows
start https://vcas.local.com:9000/
```

**Note:** You'll see a certificate warning (self-signed cert). Click "Advanced" → "Proceed" to continue.

---

## 🔧 Detailed Setup

### Step 1: Environment Configuration

The frontend needs to know how to connect to your AWS backend.

**Automatic Setup (Recommended):**
```bash
# This runs automatically when you use `npm run dev`
./scripts/setup-web-ui-env.sh --force --mock
```

**Manual Setup:**
If you need to manually configure, create `web-ui/.env.local`:

```env
# Get these values from AWS CloudFormation
VITE_AGENT_RUNTIME_ARN=arn:aws:bedrock-agentcore:us-west-2:123456789012:runtime/abc123...
VITE_AGENT_ENDPOINT_NAME=DEFAULT
VITE_AWS_REGION=us-west-2

# Optional: Visa integration
VITE_VISA_MOCK_MODE=true
```

**Where to find these values:**
```bash
DEPLOYMENT_ID=$(node -p "require('./deployment-config.json').deploymentId")

# Get Runtime ARN
aws cloudformation describe-stacks \
  --stack-name "UnifiedBackendStack-${DEPLOYMENT_ID}" \
  --query "Stacks[0].Outputs[?OutputKey=='MainRuntimeArn'].OutputValue" \
  --output text

# Get Region
node -p "require('./deployment-config.json').aws.region"
```

### Step 2: Start Development Server

```bash
# From project root
npm run dev

# Or directly from web-ui folder
cd web-ui
npm run dev
```

**What happens:**
1. Vite starts on `https://vcas.local.com:9000/` with HTTPS (required for Visa)
2. Hot Module Replacement (HMR) enabled
3. TypeScript compilation in watch mode
4. CSS changes reflect instantly

**Dev Server Configuration:**
- **URL:** `https://vcas.local.com:9000/`
- **Port:** 9000
- **HTTPS:** Yes (self-signed certificate)
- **Hot Reload:** Enabled

### Step 3: Verify Connection

Open browser DevTools and check console:

```javascript
// Should see:
✅ AWS Amplify configured
✅ Connected to Cognito
✅ Agent Runtime ARN loaded

// Should NOT see:
❌ Failed to configure Amplify
❌ Runtime ARN not found
```

---

## 🛠️ Local Development Workflow

### Making Frontend Changes

**Code Changes (Instant):**
```bash
# Edit any file in web-ui/src/
# Changes auto-reload in browser
```

**Files you'll commonly edit:**
- `web-ui/src/components/` - React components
- `web-ui/src/styles/` - CSS/theme files
- `web-ui/src/services/` - API integrations
- `web-ui/src/hooks/` - Custom React hooks

**Style Changes:**
```bash
# Edit web-ui/src/styles/modern-ai-theme.css
# Save → See changes instantly in browser
```

### Making Backend Changes

Backend changes require redeployment:

```bash
# 1. Edit agent code
vim agentic_commerce/supervisor_agent/agent.py

# 2. Touch Dockerfile to force rebuild
touch agentic_commerce/supervisor_agent/Dockerfile

# 3. Deploy backend (~5 min)
npm run deploy:backend

# 4. Refresh frontend - changes will be reflected
```

### Testing Changes

**Local Testing:**
```bash
# Terminal 1: Frontend dev server
npm run dev

# Terminal 2: Watch TypeScript
cd web-ui
npm run build -- --watch

# Terminal 3: Run tests (if available)
npm test
```

**Build for Production:**
```bash
# Test production build locally
cd web-ui
npm run build
npm run preview
```

---

## 💳 Visa Integration (Optional)

For local Visa payment testing, you need a local proxy server.

### Setup Visa Local Server

**Prerequisites:**
- Python 3.11+
- `uv` package manager: https://docs.astral.sh/uv/
- Visa API credentials in AWS Secrets Manager

**Step 1: Add hosts entry (one-time)**
```bash
# Required because Visa iframe only allows whitelisted domains
sudo sh -c 'echo "127.0.0.1 vcas.local.com" >> /etc/hosts'
```

**Step 2: Setup and run**
```bash
# From project root
./scripts/setup-visa-local.sh

# Start Visa server (Terminal 2)
cd agentic_commerce/local-visa-server
source .venv/bin/activate
python server.py
```

**Step 3: Configure frontend**
```bash
# Edit web-ui/.env.local
VITE_VISA_MOCK_MODE=false
VITE_VISA_PROXY_URL=http://localhost:5001
```

**Step 4: Restart frontend**
```bash
# Terminal 1
npm run dev
```

**Testing Visa Flow:**
1. Add items to cart
2. Click "Confirm Purchase"
3. Click "Add Visa Card" button
4. Visa iframe should load (from `https://sbx.vts.auth.visa.com`)
5. Complete payment flow

---

## 🐛 Troubleshooting

### Issue: "Cannot connect to AWS"

**Symptoms:**
- Frontend loads but shows "Failed to load data"
- Console shows "Unauthorized" errors

**Solution:**
```bash
# 1. Check AWS credentials
aws sts get-caller-identity

# 2. Verify backend is deployed
DEPLOYMENT_ID=$(node -p "require('./deployment-config.json').deploymentId")
aws cloudformation describe-stacks --stack-name "UnifiedBackendStack-${DEPLOYMENT_ID}"

# 3. Reconfigure environment
./scripts/setup-web-ui-env.sh --force --mock

# 4. Restart dev server
npm run dev
```

---

### Issue: "Certificate Error" in browser

**Symptoms:**
- Browser shows "Your connection is not private"
- Cannot access `https://vcas.local.com:9000/`

**Solution:**
This is expected behavior (self-signed certificate). Click "Advanced" → "Proceed to vcas.local.com (unsafe)".

**Alternative: Trust certificate (macOS)**
```bash
# Generate cert
cd web-ui
npx vite --https

# Find cert location in console output, then:
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain path/to/cert.pem
```

---

### Issue: "Port 9000 already in use"

**Symptoms:**
```
Error: listen EADDRINUSE: address already in use :::9000
```

**Solution:**
```bash
# Find and kill process using port 9000
lsof -ti:9000 | xargs kill -9

# Or use different port
cd web-ui
PORT=9001 npm run dev
```

---

### Issue: "Hot reload not working"

**Symptoms:**
- Save files but browser doesn't update
- Have to manually refresh

**Solution:**
```bash
# 1. Check if Vite is running in watch mode
# Look for "watching for file changes..." in console

# 2. Clear Vite cache
cd web-ui
rm -rf node_modules/.vite
npm run dev

# 3. Restart dev server with clean state
npm run dev -- --force
```

---

### Issue: "Visa iframe not loading"

**Symptoms:**
- Visa iframe shows blank or error
- Console shows "Refused to display in a frame"

**Solution:**
```bash
# 1. Verify hosts entry
cat /etc/hosts | grep vcas.local.com
# Should show: 127.0.0.1 vcas.local.com

# 2. Check you're accessing via https://vcas.local.com:9000/
# NOT http://localhost:9000/

# 3. Verify Visa local server is running
curl http://localhost:5001/
# Should return: "Visa Local Server Running"

# 4. Check iframe domain in browser DevTools
# Should be: https://sbx.vts.auth.visa.com
```

---

### Issue: "TypeScript errors"

**Symptoms:**
```
error TS2339: Property 'x' does not exist on type 'Y'
```

**Solution:**
```bash
# 1. Clear TypeScript cache
cd web-ui
rm -rf node_modules/.cache

# 2. Reinstall dependencies
npm install

# 3. Restart dev server
npm run dev

# 4. Check TypeScript version
npm list typescript
# Should be 5.x
```

---

### Issue: "Changes not reflecting in browser"

**Symptoms:**
- Edit code but see old version in browser
- Hard refresh doesn't help

**Solution:**
```bash
# 1. Clear browser cache
# Chrome: Cmd+Shift+Delete → Clear browsing data

# 2. Force Vite to rebuild
cd web-ui
npm run build -- --force

# 3. Disable browser extensions
# Ad blockers can interfere with HMR

# 4. Check if build succeeded
ls -la dist/
# Should see recent timestamps
```

---

## 📊 Performance Tips

### Faster Rebuilds
```bash
# Use Vite's optimized build
cd web-ui
npm run build -- --mode development
```

### Reduce Bundle Size
```javascript
// Use dynamic imports for large components
const HeavyComponent = lazy(() => import('./HeavyComponent'))
```

### Speed up TypeScript
```json
// web-ui/tsconfig.json
{
  "compilerOptions": {
    "incremental": true,
    "skipLibCheck": true
  }
}
```

---

## 🔗 Useful Commands

```bash
# Start dev server
npm run dev

# Build for production
cd web-ui && npm run build

# Preview production build
cd web-ui && npm run preview

# Lint code
cd web-ui && npm run lint

# Check TypeScript
cd web-ui && npx tsc --noEmit

# Clear all caches
rm -rf web-ui/node_modules/.vite web-ui/node_modules/.cache web-ui/dist

# Reinstall dependencies
cd web-ui && rm -rf node_modules package-lock.json && npm install

# Check environment
cat web-ui/.env.local

# View backend outputs
DEPLOYMENT_ID=$(node -p "require('./deployment-config.json').deploymentId")
aws cloudformation describe-stacks --stack-name "UnifiedBackendStack-${DEPLOYMENT_ID}" --query 'Stacks[0].Outputs'
```

---

## 🔍 Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `VITE_AGENT_RUNTIME_ARN` | ✅ | ARN of main agent runtime | `arn:aws:bedrock-agentcore:...` |
| `VITE_AGENT_ENDPOINT_NAME` | ✅ | Agent endpoint name | `DEFAULT` |
| `VITE_AWS_REGION` | ✅ | AWS region | `us-west-2` |
| `VITE_VISA_MOCK_MODE` | ❌ | Use mock Visa API | `true` or `false` |
| `VITE_VISA_PROXY_URL` | ❌ | Local Visa proxy URL | `http://localhost:5001` |

---

## 🎯 Next Steps

1. **Start developing:** Make changes to components in `web-ui/src/`
2. **Test features:** Open cart, chat with AI, try dark mode
3. **Deploy changes:** When ready, run `./scripts/deploy-frontend-simple.sh`
4. **Learn more:** Check [CLAUDE.md](CLAUDE.md) for architecture details

---

## 📚 Additional Resources

- **Main Deployment Guide:** [DEPLOYMENT.md](DEPLOYMENT.md)
- **Architecture Details:** [CLAUDE.md](CLAUDE.md)
- **Quick Deploy:** [QUICK_DEPLOY.md](QUICK_DEPLOY.md)
- **Visa Documentation:** [visa-documentation/README.md](visa-documentation/README.md)

---

## 💡 Pro Tips

1. **Use browser DevTools:** Network tab shows all AWS API calls
2. **Check CloudWatch Logs:** View agent execution in AWS Console
3. **Enable debug mode:** Set `localStorage.debug = '*'` in browser console
4. **Use React DevTools:** Install extension for component debugging
5. **Monitor build size:** Keep an eye on bundle size warnings

---

## 🆘 Getting Help

**Still stuck?**
1. Check [DEPLOYMENT.md](DEPLOYMENT.md) troubleshooting section
2. Review CloudWatch logs for agent errors
3. Verify all AWS resources are deployed correctly
4. Ensure AWS credentials are valid and have correct permissions

**Common Issues Checklist:**
- ✅ Backend deployed to AWS?
- ✅ AWS credentials configured?
- ✅ Environment variables set in `web-ui/.env.local`?
- ✅ Node.js 18+ installed?
- ✅ Dependencies installed (`npm install`)?
- ✅ Dev server running on correct URL?
- ✅ Browser certificate warning accepted?

---

**Happy Coding! 🚀**

For questions or issues, see [DEPLOYMENT.md](DEPLOYMENT.md#support) or check the project's issue tracker.
