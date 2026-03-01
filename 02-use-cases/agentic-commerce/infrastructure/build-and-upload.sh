#!/bin/bash

# Simple build and upload script for frontend
# Assumes infrastructure is already deployed

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Default values
STACK_NAME="agentic-commerce-frontend"
AGENT_STACK_NAME="agentic-commerce-agentcore"
REGION="us-west-2"
RUNTIME_URL=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -s|--stack-name)
            STACK_NAME="$2"
            shift 2
            ;;
        -a|--agent-stack-name)
            AGENT_STACK_NAME="$2"
            shift 2
            ;;
        -r|--region)
            REGION="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "OPTIONS:"
            echo "  -s, --stack-name         Frontend CloudFormation stack name (default: agentic-commerce-frontend)"
            echo "  -a, --agent-stack-name   Agent CloudFormation stack name (default: agent-AgentCoreStack)"
            echo "  -r, --region             AWS region (default: us-west-2)"
            echo "  -h, --help               Show this help"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

print_info "Configuration:"
echo "  Frontend Stack: $STACK_NAME"
echo "  Agent Stack: $AGENT_STACK_NAME"
echo "  Region: $REGION"
echo ""

# Get bucket name and distribution ID from CloudFormation
print_info "Getting infrastructure details from CloudFormation..."

BUCKET_NAME=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" \
    --output text 2>/dev/null)

DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue" \
    --output text 2>/dev/null)

if [ -z "$BUCKET_NAME" ] || [ -z "$DISTRIBUTION_ID" ]; then
    print_error "Could not retrieve stack outputs. Is the stack deployed?"
    exit 1
fi

print_info "Found bucket: $BUCKET_NAME"
print_info "Found distribution: $DISTRIBUTION_ID"
echo ""

# Get AgentCore Runtime URL
print_info "Getting AgentCore Runtime ARN..."

RUNTIME_ARN=$(aws cloudformation describe-stacks \
    --stack-name "$AGENT_STACK_NAME" \
    --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='RuntimeArn'].OutputValue" \
    --output text 2>/dev/null)

if [ -z "$RUNTIME_ARN" ]; then
    print_warning "Could not retrieve AgentCore Runtime ARN from stack: $AGENT_STACK_NAME"
    print_warning "Skipping .env update. You may need to manually set VITE_AGENTCORE_API_URL"
else
    print_info "Found Runtime ARN: $RUNTIME_ARN"
    
    # Update .env file with the runtime URL
    print_info "Updating frontend/.env with AgentCore Runtime URL..."
    
    ENV_FILE="../frontend/.env"
    if [ -f "$ENV_FILE" ]; then
        # URL encode the runtime ARN (percent-encode special characters)
        ENCODED_ARN=$(printf %s "$RUNTIME_ARN" | jq -sRr @uri)
        RUNTIME_URL="https://bedrock-agentcore.$REGION.amazonaws.com/runtimes/$ENCODED_ARN/invocations"
        
        print_info "Encoded Runtime URL: $RUNTIME_URL"
        
        # Update or add VITE_AGENTCORE_API_URL
        if grep -q "^VITE_AGENTCORE_API_URL=" "$ENV_FILE"; then
            # Update existing line (macOS compatible)
            if [[ "$OSTYPE" == "darwin"* ]]; then
                sed -i '' "s|^VITE_AGENTCORE_API_URL=.*|VITE_AGENTCORE_API_URL=$RUNTIME_URL|" "$ENV_FILE"
            else
                sed -i "s|^VITE_AGENTCORE_API_URL=.*|VITE_AGENTCORE_API_URL=$RUNTIME_URL|" "$ENV_FILE"
            fi
            print_info "Updated VITE_AGENTCORE_API_URL in .env"
        else
            # Add new line
            echo "" >> "$ENV_FILE"
            echo "VITE_AGENTCORE_API_URL=$RUNTIME_URL" >> "$ENV_FILE"
            print_info "Added VITE_AGENTCORE_API_URL to .env"
        fi
    else
        print_warning ".env file not found at $ENV_FILE"
    fi
fi
echo ""

# Build frontend
print_info "Building frontend..."
cd ../frontend

if [ ! -f "package.json" ]; then
    print_error "package.json not found. Are you in the right directory?"
    exit 1
fi

npm install
npm run build

if [ ! -d "dist" ]; then
    print_error "Build failed - dist directory not found"
    exit 1
fi

print_info "Build completed successfully"
cd ../infrastructure

# Upload to S3
print_info "Uploading files to S3..."

# Upload all files except index.html with long cache
aws s3 sync ../frontend/dist "s3://$BUCKET_NAME" \
    --region "$REGION" \
    --delete \
    --cache-control "public, max-age=31536000, immutable" \
    --exclude "index.html"

# Upload index.html with no-cache
aws s3 cp ../frontend/dist/index.html "s3://$BUCKET_NAME/index.html" \
    --region "$REGION" \
    --cache-control "no-cache, no-store, must-revalidate" \
    --content-type "text/html"

print_info "Upload completed"

# Invalidate CloudFront cache
print_info "Invalidating CloudFront cache..."

INVALIDATION_ID=$(aws cloudfront create-invalidation \
    --distribution-id "$DISTRIBUTION_ID" \
    --paths "/*" \
    --query "Invalidation.Id" \
    --output text)

print_info "Invalidation created: $INVALIDATION_ID"

# Get CloudFront URL
CLOUDFRONT_URL=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='WebsiteURL'].OutputValue" \
    --output text)

echo ""
print_info "=========================================="
print_info "Deployment completed!"
print_info "=========================================="
echo ""
echo "  Website: $CLOUDFRONT_URL"
echo "  Bucket: $BUCKET_NAME"
echo "  Distribution: $DISTRIBUTION_ID"
echo ""
print_warning "CloudFront invalidation may take a few minutes"
echo ""
