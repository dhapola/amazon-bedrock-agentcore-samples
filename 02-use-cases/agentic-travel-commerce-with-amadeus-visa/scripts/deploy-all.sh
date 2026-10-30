#!/bin/bash

##############################################################################
# Complete Stack Deployment Script
# Deploys entire agentic travel commerce application to AWS
##############################################################################

set -e  # Exit on error
set -o pipefail  # Exit on pipe failures

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_section() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Error handler
error_exit() {
    log_error "$1"
    log_error "Deployment failed. Check the output above for details."
    exit 1
}

# Parse arguments
DEPLOY_VISA_LAMBDA=false
FRONTEND_MODE="mock"
SKIP_FRONTEND=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --with-visa-lambda)
            DEPLOY_VISA_LAMBDA=true
            shift
            ;;
        --frontend-real)
            FRONTEND_MODE="real"
            shift
            ;;
        --skip-frontend)
            SKIP_FRONTEND=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --with-visa-lambda    Deploy Visa Lambda proxy (requires credentials)"
            echo "  --frontend-real       Deploy frontend with real Visa integration"
            echo "  --skip-frontend       Skip frontend deployment"
            echo "  --help, -h           Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                           # Deploy with mock Visa"
            echo "  $0 --with-visa-lambda        # Deploy with Visa Lambda"
            echo "  $0 --skip-frontend           # Deploy backend only"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

##############################################################################
# Pre-flight checks
##############################################################################

log_section "🔍 Pre-flight Checks"

cd "$PROJECT_ROOT"

# Check if deployment-config.json exists
if [ ! -f "deployment-config.json" ]; then
    error_exit "deployment-config.json not found. Please create it first."
fi

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    error_exit "AWS CLI not found. Please install it first."
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    error_exit "AWS credentials not configured. Run 'aws configure' first."
fi

# Check Node.js
if ! command -v node &> /dev/null; then
    error_exit "Node.js not found. Please install Node.js 18+ first."
fi

# Check npm
if ! command -v npm &> /dev/null; then
    error_exit "npm not found. Please install npm first."
fi

# Check Docker or Finch
CONTAINER_RUNTIME=""
if command -v docker &> /dev/null; then
    CONTAINER_RUNTIME="docker"
elif command -v finch &> /dev/null; then
    CONTAINER_RUNTIME="finch"
else
    error_exit "Container runtime not found. Please install Docker or Finch first."
fi

log_info "Using container runtime: $CONTAINER_RUNTIME"

if ! $CONTAINER_RUNTIME ps &> /dev/null; then
    error_exit "$CONTAINER_RUNTIME daemon not running. Please start $CONTAINER_RUNTIME first."
fi

log_success "All prerequisites satisfied"

# Load deployment config
DEPLOYMENT_ID=$(node -p "require('./deployment-config.json').deploymentId")
AWS_REGION=$(node -p "require('./deployment-config.json').aws.region")

log_info "Deployment ID: $DEPLOYMENT_ID"
log_info "AWS Region: $AWS_REGION"

##############################################################################
# Step 1: Install Dependencies
##############################################################################

log_section "📦 Step 1: Installing Dependencies"

log_info "Installing root dependencies..."
npm install || error_exit "Failed to install root dependencies"

log_info "Installing Amplify dependencies..."
cd amplify
npm install || error_exit "Failed to install Amplify dependencies"
cd ..

log_success "Dependencies installed"

##############################################################################
# Step 2: Deploy Amplify Backend
##############################################################################

log_section "🚀 Step 2: Deploying Amplify Backend (Cognito, DynamoDB, AppSync)"
log_info "Expected time: ~4 minutes"

npx ampx sandbox delete --identifier "${DEPLOYMENT_ID}" --yes || true  # Clean up if exists
npx ampx sandbox --once --identifier "${DEPLOYMENT_ID}" || error_exit "Failed to deploy Amplify backend"

log_success "Amplify backend deployed"

##############################################################################
# Step 3: Deploy Unified Backend Stack (MCP + Agent + Gateway)
##############################################################################

log_section "🚀 Step 3: Deploying Unified Backend Stack"
log_info "Expected time: ~5 minutes"
log_info "Creating all 4 runtimes (3 MCP + 1 supervisor) + gateway in single stack"

# Touch Dockerfiles to force rebuild
log_info "Preparing Docker images..."
find agentic_commerce/mcp_* -name Dockerfile -exec touch {} \;
find agentic_commerce/supervisor_agent -name Dockerfile -exec touch {} \; 2>/dev/null || true

cd infrastructure/unified-backend-stack
log_info "Installing unified backend dependencies..."
npm install || error_exit "Failed to install unified backend dependencies"

log_info "Deploying unified backend stack..."
npx cdk deploy --require-approval never || error_exit "Failed to deploy unified backend"
cd ../..

log_success "Unified backend deployed (4 runtimes + gateway + memory)"

##############################################################################
# Step 4: Deploy Visa Lambda (Optional)
##############################################################################

if [ "$DEPLOY_VISA_LAMBDA" = true ]; then
    log_section "🚀 Step 4: Deploying Visa Lambda Proxy"
    log_info "Expected time: ~2 minutes"

    cd infrastructure/visa-lambda-stack
    log_info "Installing Visa Lambda dependencies..."
    npm install || error_exit "Failed to install Visa Lambda dependencies"

    log_info "Deploying Visa Lambda stack..."
    npx cdk deploy --require-approval never || error_exit "Failed to deploy Visa Lambda"
    cd ../..

    log_success "Visa Lambda deployed"
else
    log_warning "Skipping Visa Lambda deployment (use --with-visa-lambda to enable)"
fi

##############################################################################
# Step 5: Deploy Frontend to S3 + CloudFront (Optional)
##############################################################################

if [ "$SKIP_FRONTEND" = false ]; then
    log_section "🚀 Step 5: Deploying Frontend to S3 + CloudFront"
    log_info "Expected time: ~2 minutes"
    log_info "Frontend mode: $FRONTEND_MODE"

    cd infrastructure/frontend-stack
    log_info "Installing frontend stack dependencies..."
    npm install || error_exit "Failed to install frontend stack dependencies"

    log_info "Deploying frontend infrastructure..."
    npx cdk deploy --require-approval never || error_exit "Failed to deploy frontend stack"
    cd ../..

    log_info "Building and uploading frontend..."
    if [ "$FRONTEND_MODE" = "mock" ]; then
        ./scripts/deploy-frontend.sh --mock || error_exit "Failed to deploy frontend"
    else
        ./scripts/deploy-frontend.sh || error_exit "Failed to deploy frontend"
    fi

    log_success "Frontend deployed to CloudFront"
else
    log_warning "Skipping frontend deployment (use without --skip-frontend to enable)"
fi

##############################################################################
# Deployment Complete
##############################################################################

log_section "🎉 Deployment Complete!"

# Get stack outputs from unified backend stack
AGENT_RUNTIME_ARN=$(aws cloudformation describe-stacks \
    --stack-name "UnifiedBackendStack-${DEPLOYMENT_ID}" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`MainRuntimeArn`].OutputValue' \
    --output text 2>/dev/null || echo "N/A")

MEMORY_ID=$(aws cloudformation describe-stacks \
    --stack-name "UnifiedBackendStack-${DEPLOYMENT_ID}" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`MemoryId`].OutputValue' \
    --output text 2>/dev/null || echo "N/A")

GATEWAY_URL=$(aws cloudformation describe-stacks \
    --stack-name "UnifiedBackendStack-${DEPLOYMENT_ID}" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`GatewayUrl`].OutputValue' \
    --output text 2>/dev/null || echo "N/A")

if [ "$SKIP_FRONTEND" = false ]; then
    DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
        --stack-name "FrontendStack-${DEPLOYMENT_ID}" \
        --region "$AWS_REGION" \
        --query 'Stacks[0].Outputs[?OutputKey==`DistributionId`].OutputValue' \
        --output text 2>/dev/null || echo "N/A")

    WEBSITE_URL=$(aws cloudformation describe-stacks \
        --stack-name "FrontendStack-${DEPLOYMENT_ID}" \
        --region "$AWS_REGION" \
        --query 'Stacks[0].Outputs[?OutputKey==`WebsiteUrl`].OutputValue' \
        --output text 2>/dev/null || echo "N/A")
fi

echo ""
log_success "All components deployed successfully!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Deployment Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🆔 Deployment ID: $DEPLOYMENT_ID"
echo "🌍 Region: $AWS_REGION"
echo ""
echo "🤖 Agent Runtime ARN:"
echo "   $AGENT_RUNTIME_ARN"
echo ""
echo "💾 Memory ID:"
echo "   $MEMORY_ID"
echo ""
echo "🌐 Gateway URL:"
echo "   $GATEWAY_URL"
echo ""

if [ "$SKIP_FRONTEND" = false ]; then
    echo "🎨 Frontend URL:"
    echo "   $WEBSITE_URL"
    echo ""
    echo "☁️  CloudFront Console:"
    echo "   https://console.aws.amazon.com/cloudfront/v3/home#/distributions/$DISTRIBUTION_ID"
    echo ""
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ "$SKIP_FRONTEND" = false ]; then
    log_info "Next Steps:"
    echo "  1. Visit the CloudFront URL to access your application"
    echo "  2. Sign up for a new account"
    echo "  3. Start chatting with the travel agent"
    echo ""
fi

log_info "Optional Enhancements:"
echo "  • Add Google Maps API key:"
echo "    aws ssm put-parameter \\"
echo "      --name \"/agentic-commerce-for-travel/travel/google-maps-key\" \\"
echo "      --value \"YOUR_API_KEY\" \\"
echo "      --type SecureString \\"
echo "      --region $AWS_REGION"
echo ""

if [ "$DEPLOY_VISA_LAMBDA" = false ]; then
    echo "  • Deploy Visa Lambda for real payments:"
    echo "    ./scripts/set-api-keys.sh  # Configure Visa credentials"
    echo "    $0 --with-visa-lambda"
    echo ""
fi

log_info "Cleanup:"
echo "  • To remove all resources: npm run clean"
echo ""

log_success "Deployment script completed successfully! 🚀"
