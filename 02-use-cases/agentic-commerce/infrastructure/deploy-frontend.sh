#!/bin/bash

# Deployment script for React SPA to AWS S3 + CloudFront

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
STACK_NAME="agentic-commerce-frontend"
BUCKET_NAME="agentic-commerce-frontend"
ENVIRONMENT="dev"
REGION="us-west-2"
COGNITO_DOMAIN_PREFIX="agentic-commerce-frontend"


# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Function to show usage
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Deploy React SPA to AWS S3 with CloudFront distribution and Cognito authentication

OPTIONS:
    -b, --bucket-name       S3 bucket name (default: agentic-commerce-frontend)
    -s, --stack-name        CloudFormation stack name (default: agentic-commerce-frontend)
    -e, --environment       Environment (dev/staging/prod, default: dev)
    -r, --region            AWS region (default: us-west-2)
    -d, --cognito-domain    Cognito domain prefix (required, must be globally unique)
    -h, --help              Show this help message

EXAMPLES:
    $0 --cognito-domain my-app-auth-123                    # Deploy with Cognito
    $0 -d my-app -b my-bucket -e prod -r us-west-2         # Production deployment
EOF
    exit 1
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -b|--bucket-name)
            BUCKET_NAME="$2"
            shift 2
            ;;
        -s|--stack-name)
            STACK_NAME="$2"
            shift 2
            ;;
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -r|--region)
            REGION="$2"
            shift 2
            ;;
        -d|--cognito-domain)
            COGNITO_DOMAIN_PREFIX="$2"
            shift 2
            ;;
        -h|--help)
            usage
            ;;
        *)
            print_error "Unknown option: $1"
            usage
            ;;
    esac
done

# Validate required parameters
if [ -z "$COGNITO_DOMAIN_PREFIX" ]; then
    print_error "Cognito domain prefix is required. Use -d or --cognito-domain"
    usage
fi

print_info "Starting deployment with the following configuration:"
echo "  Stack Name: $STACK_NAME"
echo "  Bucket Name: $BUCKET_NAME"
echo "  Environment: $ENVIRONMENT"
echo "  Region: $REGION"
echo "  Cognito Domain: $COGNITO_DOMAIN_PREFIX"
echo ""

# Step 1: Deploy CloudFormation stack
print_info "Deploying CloudFormation stack..."

aws cloudformation deploy \
    --template-file cf-frontend.yaml \
    --stack-name "$STACK_NAME" \
    --parameter-overrides \
        BucketName="$BUCKET_NAME" \
        Environment="$ENVIRONMENT" \
        CognitoDomainPrefix="$COGNITO_DOMAIN_PREFIX" \
    --region "$REGION" \
    --capabilities CAPABILITY_IAM \
    --no-fail-on-empty-changeset

if [ $? -eq 0 ]; then
    print_info "CloudFormation stack deployed successfully"
else
    print_error "CloudFormation stack deployment failed"
    exit 1
fi

# Step 2: Get stack outputs
print_info "Retrieving stack outputs..."

DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue" \
    --output text)

CLOUDFRONT_DOMAIN=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDomainName'].OutputValue" \
    --output text)

USER_POOL_ID=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" \
    --output text)

USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" \
    --output text)

COGNITO_DOMAIN=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='CognitoDomain'].OutputValue" \
    --output text)

# Step 3: Update frontend .env file
print_info "Updating frontend/.env file with Cognito configuration..."

ENV_FILE="../frontend/.env"

# Backup existing .env
if [ -f "$ENV_FILE" ]; then
    BACKUP_FILE="${ENV_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
    cp "$ENV_FILE" "$BACKUP_FILE"
    print_info "Backed up existing .env to: $(basename $BACKUP_FILE)"
fi

# Read existing .env content
if [ -f "$ENV_FILE" ]; then
    ENV_CONTENT=$(cat "$ENV_FILE")
else
    ENV_CONTENT=""
fi

# Function to update or add env variable
update_env_var() {
    local key=$1
    local value=$2
    
    if echo "$ENV_CONTENT" | grep -q "^${key}="; then
        ENV_CONTENT=$(echo "$ENV_CONTENT" | sed "s|^${key}=.*|${key}=${value}|")
    else
        if [ -n "$ENV_CONTENT" ]; then
            ENV_CONTENT="${ENV_CONTENT}
${key}=${value}"
        else
            ENV_CONTENT="${key}=${value}"
        fi
    fi
}

# Update Cognito configuration
update_env_var "VITE_DEV_MODE" "false"
update_env_var "VITE_COGNITO_DOMAIN" "$COGNITO_DOMAIN"
update_env_var "VITE_COGNITO_USER_POOL_ID" "$USER_POOL_ID"
update_env_var "VITE_COGNITO_CLIENT_ID" "$USER_POOL_CLIENT_ID"
update_env_var "VITE_COGNITO_REDIRECT_URI" "https://$CLOUDFRONT_DOMAIN"
update_env_var "VITE_COGNITO_LOGOUT_URI" "https://$CLOUDFRONT_DOMAIN"

# Write updated .env file
echo "$ENV_CONTENT" > "$ENV_FILE"

print_info "Frontend .env file updated successfully"

# Step 4: Build the frontend with updated .env
print_info "Building frontend application with updated configuration..."
cd ../frontend
npm install
npm run build

if [ ! -d "dist" ]; then
    print_error "Build failed - dist directory not found"
    exit 1
fi

print_info "Frontend build completed successfully"
cd ../infrastructure

# Step 5: Upload files to S3
print_info "Uploading files to S3 bucket: $BUCKET_NAME..."

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

print_info "Files uploaded successfully"

# Step 6: Invalidate CloudFront cache
print_info "Creating CloudFront invalidation..."

INVALIDATION_ID=$(aws cloudfront create-invalidation \
    --distribution-id "$DISTRIBUTION_ID" \
    --paths "/*" \
    --query "Invalidation.Id" \
    --output text)

print_info "CloudFront invalidation created: $INVALIDATION_ID"

# Print success message
echo ""
print_info "=========================================="
print_info "Deployment completed successfully!"
print_info "=========================================="
echo ""
echo "  Website URL: https://$CLOUDFRONT_DOMAIN"
echo "  Distribution ID: $DISTRIBUTION_ID"
echo "  S3 Bucket: $BUCKET_NAME"
echo ""
print_info "Cognito Configuration:"
echo "  User Pool ID: $USER_POOL_ID"
echo "  Client ID: $USER_POOL_CLIENT_ID"
echo "  Cognito Domain: $COGNITO_DOMAIN"
echo ""
print_info "Frontend .env has been automatically updated with:"
echo "  VITE_DEV_MODE=false"
echo "  VITE_COGNITO_DOMAIN=$COGNITO_DOMAIN"
echo "  VITE_COGNITO_USER_POOL_ID=$USER_POOL_ID"
echo "  VITE_COGNITO_CLIENT_ID=$USER_POOL_CLIENT_ID"
echo "  VITE_COGNITO_REDIRECT_URI=https://$CLOUDFRONT_DOMAIN"
echo "  VITE_COGNITO_LOGOUT_URI=https://$CLOUDFRONT_DOMAIN"
echo ""
print_warning "Note: CloudFront invalidation may take a few minutes to complete"
print_info "To create a test user, run: ./setup-cognito.sh --user-pool-id $USER_POOL_ID --email your@email.com"
echo ""
