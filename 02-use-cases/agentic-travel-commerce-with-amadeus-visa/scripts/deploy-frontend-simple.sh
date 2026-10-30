#!/bin/bash
# Simple frontend deployment script
# Builds frontend, uploads to S3, and invalidates CloudFront cache
# Usage: ./scripts/deploy-frontend-simple.sh

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}   Frontend Deployment Script${NC}"
echo -e "${BLUE}================================================${NC}\n"

# === STEP 1: Get Configuration ===
echo -e "${BLUE}📋 Step 1: Loading configuration...${NC}"

DEPLOYMENT_ID=$(node -p "require('./deployment-config.json').deploymentId" 2>/dev/null)
if [ -z "$DEPLOYMENT_ID" ]; then
    echo -e "${RED}❌ Error: Could not read deployment-config.json${NC}"
    exit 1
fi

STACK_NAME="FrontendStack-${DEPLOYMENT_ID}"
echo -e "${GREEN}✓${NC} Deployment ID: $DEPLOYMENT_ID"
echo -e "${GREEN}✓${NC} Stack Name: $STACK_NAME\n"

# === STEP 2: Get S3 Bucket and CloudFront Details ===
echo -e "${BLUE}🔍 Step 2: Fetching AWS resources...${NC}"

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

# Validate resources exist
if [ -z "$BUCKET_NAME" ] || [ "$BUCKET_NAME" = "None" ]; then
    echo -e "${RED}❌ Error: Frontend stack not found${NC}"
    echo -e "${YELLOW}💡 Deploy the frontend stack first:${NC}"
    echo -e "   cd infrastructure/frontend-stack && cdk deploy\n"
    exit 1
fi

echo -e "${GREEN}✓${NC} S3 Bucket: $BUCKET_NAME"
echo -e "${GREEN}✓${NC} CloudFront Distribution: $DISTRIBUTION_ID"
echo -e "${GREEN}✓${NC} Website URL: $WEBSITE_URL\n"

# === STEP 3: Build Frontend ===
echo -e "${BLUE}🔨 Step 3: Building frontend...${NC}"

cd web-ui

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️  node_modules not found, installing dependencies...${NC}"
    npm install
fi

# Run build
npm run build

# Verify build output
if [ ! -d "dist" ]; then
    echo -e "${RED}❌ Error: Build directory 'dist' not found${NC}"
    exit 1
fi

# Get build size
BUILD_SIZE=$(du -sh dist | cut -f1)
FILE_COUNT=$(find dist -type f | wc -l | tr -d ' ')

echo -e "${GREEN}✓${NC} Build completed"
echo -e "   Size: $BUILD_SIZE"
echo -e "   Files: $FILE_COUNT\n"

# === STEP 4: Upload to S3 ===
echo -e "${BLUE}☁️  Step 4: Uploading to S3...${NC}"

# Upload assets with long cache (1 year)
echo -e "   Uploading assets with cache headers..."
aws s3 sync dist/ "s3://$BUCKET_NAME/" \
    --delete \
    --cache-control "public, max-age=31536000, immutable" \
    --exclude "index.html" \
    --exclude "*.map" \
    --quiet

# Upload index.html with no-cache
echo -e "   Uploading index.html (no-cache)..."
aws s3 cp dist/index.html "s3://$BUCKET_NAME/index.html" \
    --cache-control "no-cache, no-store, must-revalidate" \
    --metadata-directive REPLACE \
    --quiet

echo -e "${GREEN}✓${NC} Upload completed\n"

# === STEP 5: Invalidate CloudFront Cache ===
echo -e "${BLUE}🔄 Step 5: Invalidating CloudFront cache...${NC}"

INVALIDATION_ID=$(aws cloudfront create-invalidation \
    --distribution-id "$DISTRIBUTION_ID" \
    --paths "/*" \
    --query 'Invalidation.Id' \
    --output text 2>/dev/null)

echo -e "${GREEN}✓${NC} Invalidation created: $INVALIDATION_ID"
echo -e "   Status: In Progress\n"

# Optional: Wait for invalidation to complete
read -p "$(echo -e ${YELLOW}Wait for invalidation to complete? [y/N]:${NC} )" -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}⏳ Waiting for invalidation (this may take 1-2 minutes)...${NC}"
    aws cloudfront wait invalidation-completed \
        --distribution-id "$DISTRIBUTION_ID" \
        --id "$INVALIDATION_ID" 2>/dev/null || true
    echo -e "${GREEN}✓${NC} Invalidation completed\n"
fi

# === STEP 6: Summary ===
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}   ✅ Deployment Successful!${NC}"
echo -e "${GREEN}================================================${NC}\n"

echo -e "${BLUE}📦 Build Info:${NC}"
echo -e "   Size: $BUILD_SIZE"
echo -e "   Files: $FILE_COUNT\n"

echo -e "${BLUE}🌐 Access Your Site:${NC}"
echo -e "   $WEBSITE_URL\n"

echo -e "${BLUE}🔗 AWS Console:${NC}"
echo -e "   S3: https://s3.console.aws.amazon.com/s3/buckets/$BUCKET_NAME"
echo -e "   CloudFront: https://console.aws.amazon.com/cloudfront/v3/home#/distributions/$DISTRIBUTION_ID\n"

echo -e "${YELLOW}💡 Tip:${NC} It may take a few minutes for CloudFront to propagate globally.\n"

# Return to project root
cd ..
