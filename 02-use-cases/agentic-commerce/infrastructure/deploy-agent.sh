#!/bin/bash

# AgentCore Runtime Deployment Script
# Deploys the Bedrock AgentCore agent with CDK infrastructure

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
AGENT_DIR="../backend/agent"
CDK_DIR="../backend/agent/cdk"
SKIP_BOOTSTRAP=false
SKIP_SYNTH=false
INVOKE_AFTER_DEPLOY=false
FRONTEND_STACK_NAME="agentic-commerce-frontend"
REGION="us-west-2"

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ ${NC}$1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Function to display usage
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Deploy the AgentCore runtime to AWS.

OPTIONS:
    --bootstrap              Run CDK bootstrap (required for first-time deployment)
    --skip-synth             Skip CDK synth step
    --invoke                 Invoke the agent after deployment to test
    --frontend-stack-name    Frontend CloudFormation stack name (default: agentic-commerce-frontend)
    --region                 AWS region (default: us-west-2)
    --help                   Display this help message

EXAMPLES:
    # First-time deployment
    $0 --bootstrap

    # Regular deployment
    $0

    # Deploy with custom frontend stack name
    $0 --frontend-stack-name my-frontend-stack

    # Deploy and test
    $0 --invoke

    # Quick redeploy (skip synth)
    $0 --skip-synth

EOF
    exit 0
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --bootstrap)
            SKIP_BOOTSTRAP=false
            BOOTSTRAP=true
            shift
            ;;
        --skip-synth)
            SKIP_SYNTH=true
            shift
            ;;
        --invoke)
            INVOKE_AFTER_DEPLOY=true
            shift
            ;;
        --frontend-stack-name)
            FRONTEND_STACK_NAME="$2"
            shift 2
            ;;
        --region)
            REGION="$2"
            shift 2
            ;;
        --help)
            usage
            ;;
        *)
            print_error "Unknown option: $1"
            usage
            ;;
    esac
done

# Check prerequisites
print_info "Checking prerequisites..."

# Check Node.js version
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js >= 18"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version must be >= 18 (current: $(node -v))"
    exit 1
fi
print_success "Node.js version: $(node -v)"

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI is not installed"
    exit 1
fi
print_success "AWS CLI installed"

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    print_error "AWS credentials not configured or invalid"
    print_info "Run 'aws configure' or set AWS environment variables"
    exit 1
fi
print_success "AWS credentials configured"

# Get AWS account and region for ECR
AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
print_info "Using AWS Account: $AWS_ACCOUNT, Region: $REGION"

# Retrieve frontend stack outputs
print_info "Retrieving frontend stack outputs from: $FRONTEND_STACK_NAME..."

# Check if frontend stack exists
if ! aws cloudformation describe-stacks --stack-name "$FRONTEND_STACK_NAME" --region "$REGION" &> /dev/null; then
    print_error "Frontend stack '$FRONTEND_STACK_NAME' not found in region '$REGION'"
    print_info "Please deploy the frontend first using: ./deploy-frontend.sh"
    exit 1
fi

# Get Cognito outputs from frontend stack
USER_POOL_ID=$(aws cloudformation describe-stacks \
    --stack-name "$FRONTEND_STACK_NAME" \
    --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" \
    --output text)

USER_POOL_ARN=$(aws cloudformation describe-stacks \
    --stack-name "$FRONTEND_STACK_NAME" \
    --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='UserPoolArn'].OutputValue" \
    --output text)

APP_CLIENT_ID=$(aws cloudformation describe-stacks \
    --stack-name "$FRONTEND_STACK_NAME" \
    --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" \
    --output text)

CLOUDFRONT_DOMAIN=$(aws cloudformation describe-stacks \
    --stack-name "$FRONTEND_STACK_NAME" \
    --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDomainName'].OutputValue" \
    --output text)

if [ -z "$USER_POOL_ID" ] || [ -z "$USER_POOL_ARN" ] || [ -z "$APP_CLIENT_ID" ]; then
    print_error "Failed to retrieve Cognito outputs from frontend stack"
    print_info "Ensure the frontend stack has UserPoolId, UserPoolArn, and UserPoolClientId outputs"
    exit 1
fi

print_success "Retrieved frontend Cognito configuration:"
echo "  User Pool ID: $USER_POOL_ID"
echo "  User Pool ARN: $USER_POOL_ARN"
echo "  App Client ID: $APP_CLIENT_ID"
echo "  CloudFront Domain: $CLOUDFRONT_DOMAIN"
echo ""

# Check if agentcore CLI is available
if ! command -v agentcore &> /dev/null; then
    print_warning "AgentCore CLI not found. Install with: pip install bedrock-agentcore-cli"
fi

# Configure Finch for ECR
print_info "Configuring Finch for ECR..."

# Configure Finch to not use credential helpers (workaround for macOS)
FINCH_CONFIG_DIR="$HOME/.finch"
mkdir -p "$FINCH_CONFIG_DIR"
cat > "$FINCH_CONFIG_DIR/config.json" << 'EOF'
{
  "credsStore": ""
}
EOF
print_info "Configured Finch to store credentials in config file"

# Get ECR password
ECR_PASSWORD=$(aws ecr get-login-password --region "$REGION")
if [ -z "$ECR_PASSWORD" ]; then
    print_error "Failed to get ECR password"
    exit 1
fi

# Login to ECR using Finch
print_info "Logging into ECR..."
if echo "$ECR_PASSWORD" | finch login --username AWS --password-stdin "$AWS_ACCOUNT.dkr.ecr.$REGION.amazonaws.com" 2>&1 | grep -q "Login Succeeded"; then
    print_success "Successfully logged into ECR"
else
    # Even if credential storage fails, the login might work for the session
    print_warning "ECR login completed (credential storage warning ignored)"
fi

# Configure CDK to use Finch by creating a docker symlink in /tmp
print_info "Configuring CDK to use Finch as Docker..."
DOCKER_SHIM_DIR="/tmp/cdk-docker-shim"
mkdir -p "$DOCKER_SHIM_DIR"
ln -sf "$(which finch)" "$DOCKER_SHIM_DIR/docker"
export PATH="$DOCKER_SHIM_DIR:$PATH"

print_info "Docker shim created: $DOCKER_SHIM_DIR/docker -> $(which finch)"
print_info "Verifying docker command resolves to finch..."
if command -v docker &> /dev/null; then
    DOCKER_PATH=$(which docker)
    print_success "docker command found at: $DOCKER_PATH"
    if [ -L "$DOCKER_PATH" ]; then
        DOCKER_TARGET=$(readlink "$DOCKER_PATH")
        print_info "docker is a symlink to: $DOCKER_TARGET"
    fi
else
    print_warning "docker command not found in PATH"
fi

# Export frontend outputs as environment variables for CDK
export FRONTEND_USER_POOL_ID="$USER_POOL_ID"
export FRONTEND_USER_POOL_ARN="$USER_POOL_ARN"
export FRONTEND_APP_CLIENT_ID="$APP_CLIENT_ID"
export FRONTEND_CLOUDFRONT_DOMAIN="$CLOUDFRONT_DOMAIN"

# Navigate to CDK directory
print_info "Navigating to CDK directory..."
cd "$CDK_DIR" || {
    print_error "Failed to navigate to $CDK_DIR"
    exit 1
}
print_success "In directory: $(pwd)"

# Install dependencies
print_info "Installing CDK dependencies..."
if npm install; then
    print_success "Dependencies installed"
else
    print_error "Failed to install dependencies"
    exit 1
fi

# Bootstrap CDK (if requested)
if [ "$BOOTSTRAP" = true ]; then
    print_info "Bootstrapping CDK environment..."
    if npm run cdk bootstrap; then
        print_success "CDK environment bootstrapped"
    else
        print_error "CDK bootstrap failed"
        exit 1
    fi
fi

# Synth CDK project
if [ "$SKIP_SYNTH" = false ]; then
    print_info "Synthesizing CDK project..."
    
    if npm run cdk synth; then
        print_success "CDK project synthesized"
    else
        print_error "CDK synth failed"
        exit 1
    fi
else
    print_warning "Skipping CDK synth"
fi

# Deploy all stacks
print_info "Deploying AgentCore stacks..."
print_warning "This may take several minutes..."

if npm run cdk:deploy; then
    print_success "AgentCore runtime deployed successfully!"
else
    print_error "Deployment failed"
    exit 1
fi

# Get deployment outputs
print_info "Retrieving deployment information..."
STACK_NAME=$(aws cloudformation describe-stacks --query "Stacks[?contains(StackName, 'AgentcoreStack')].StackName" --output text 2>/dev/null | head -n 1)

if [ -n "$STACK_NAME" ]; then
    print_success "Stack deployed: $STACK_NAME"
    
    # Display outputs
    print_info "Stack outputs:"
    aws cloudformation describe-stacks --stack-name "$STACK_NAME" --query "Stacks[0].Outputs" --output table 2>/dev/null || true
fi

# Invoke agent if requested
if [ "$INVOKE_AFTER_DEPLOY" = true ]; then
    if command -v agentcore &> /dev/null; then
        print_info "Testing deployed agent..."
        cd "$AGENT_DIR" || exit 1
        
        if agentcore invoke '{"prompt": "Hello! What can you do?"}'; then
            print_success "Agent invocation successful"
        else
            print_warning "Agent invocation failed. You can test manually with: agentcore invoke"
        fi
    else
        print_warning "AgentCore CLI not available. Install to test: pip install bedrock-agentcore-cli"
    fi
fi

# Print next steps
echo ""
print_success "Deployment complete!"
echo ""
print_info "Next steps:"
echo "  1. Test your agent:"
echo "     cd $AGENT_DIR"
echo "     agentcore invoke '{\"prompt\": \"what can you do?\"}'"
echo ""
echo "  2. Or use the AWS Console:"
echo "     Navigate to Bedrock AgentCore → Test Console"
echo "     Select your runtime and DEFAULT version"
echo ""
echo "  3. Monitor your agent:"
echo "     Enable observability in the AWS Console"
echo "     View logs in CloudWatch"
echo ""
print_info "For local development:"
echo "  cd $AGENT_DIR"
echo "  agentcore dev"
echo ""
