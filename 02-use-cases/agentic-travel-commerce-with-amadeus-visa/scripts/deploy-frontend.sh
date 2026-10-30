#!/bin/bash
set -e

# Frontend deployment script for Vite app to S3 + CloudFront
# Usage: ./scripts/deploy-frontend.sh [--mock|--no-mock]
#   --mock    : Use Visa mock mode (no real API calls)
#   --no-mock : Use real Visa API via Lambda proxy

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🚀 Deploying Frontend to S3 + CloudFront${NC}\n"

# Parse flags
MOCK_FLAG=""
for arg in "$@"; do
    case $arg in
        --mock) MOCK_FLAG="--mock" ;;
        --no-mock) MOCK_FLAG="--no-mock" ;;
    esac
done

# Get deployment ID from config
DEPLOYMENT_ID=$(node -p "require('./deployment-config.json').deploymentId")
STACK_NAME="FrontendStack-${DEPLOYMENT_ID}"

# Set default region if not set
export AWS_REGION=${AWS_REGION:-us-east-1}

# Get configuration from CDK stack
echo -e "${BLUE}Fetching CloudFront configuration...${NC}"
BUCKET_NAME=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='WebsiteBucketName'].OutputValue" \
    --output text 2>/dev/null)

DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" \
    --output text 2>/dev/null)

WEBSITE_URL=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='WebsiteUrl'].OutputValue" \
    --output text 2>/dev/null)

if [ -z "$BUCKET_NAME" ] || [ "$BUCKET_NAME" = "None" ]; then
    echo -e "${RED}❌ Error: Could not find S3 bucket name${NC}"
    echo -e "${YELLOW}💡 Deploy the frontend stack first:${NC}"
    echo -e "   cd infrastructure/frontend-stack && npm install && cdk deploy"
    exit 1
fi

echo -e "${GREEN}✓${NC} Bucket: $BUCKET_NAME"
echo -e "${GREEN}✓${NC} Distribution ID: $DISTRIBUTION_ID"
echo -e "${GREEN}✓${NC} Website URL: $WEBSITE_URL"
echo ""

# Update environment configuration
echo -e "${BLUE}Updating environment configuration...${NC}"
./scripts/setup-web-ui-env.sh --force $MOCK_FLAG
echo ""

# Build the frontend
echo -e "${BLUE}Building frontend...${NC}"
cd web-ui
npm run build

if [ ! -d "dist" ]; then
    echo -e "${RED}❌ Error: Build directory 'dist' not found${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Build completed"
echo ""

# Upload to S3 with cache headers
echo -e "${BLUE}Uploading to S3...${NC}"
# Upload all files except index.html with long cache
aws s3 sync dist/ "s3://$BUCKET_NAME/" \
    --delete \
    --cache-control "public, max-age=31536000, immutable" \
    --exclude "index.html" \
    --no-progress

# Upload index.html separately with no-cache
aws s3 cp dist/index.html "s3://$BUCKET_NAME/index.html" \
    --cache-control "no-cache, no-store, must-revalidate" \
    --metadata-directive REPLACE

echo -e "${GREEN}✓${NC} Upload completed"
echo ""

# Invalidate CloudFront cache
echo -e "${BLUE}Invalidating CloudFront cache...${NC}"
INVALIDATION_ID=$(aws cloudfront create-invalidation \
    --distribution-id "$DISTRIBUTION_ID" \
    --paths "/*" \
    --query 'Invalidation.Id' \
    --output text)

echo -e "${GREEN}✓${NC} Invalidation created: $INVALIDATION_ID"
echo ""

# Wait for invalidation (optional - can comment out for faster deployments)
echo -e "${BLUE}Waiting for invalidation to complete...${NC}"
aws cloudfront wait invalidation-completed \
    --distribution-id "$DISTRIBUTION_ID" \
    --id "$INVALIDATION_ID" 2>/dev/null || true

echo ""
echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo ""
echo -e "${BLUE}Website URL:${NC} $WEBSITE_URL"
echo -e "${BLUE}Console:${NC} https://console.aws.amazon.com/cloudfront/v3/home#/distributions/$DISTRIBUTION_ID"
echo ""

# Return to project root
cd ..
