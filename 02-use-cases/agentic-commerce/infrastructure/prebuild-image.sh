#!/bin/bash

# Pre-build Docker image script
# Use this if CDK has trouble building with Finch

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Get AWS account and region
AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=${AWS_REGION:-us-west-2}

print_info "Building image for account: $AWS_ACCOUNT, region: $AWS_REGION"

# Create ECR repository if it doesn't exist
REPO_NAME="agent"
print_info "Checking ECR repository..."
if ! aws ecr describe-repositories --repository-names "$REPO_NAME" --region "$AWS_REGION" &> /dev/null; then
    print_info "Creating ECR repository: $REPO_NAME"
    aws ecr create-repository --repository-name "$REPO_NAME" --region "$AWS_REGION"
    print_success "Repository created"
else
    print_success "Repository exists"
fi

# Login to ECR
print_info "Logging into ECR..."
aws ecr get-login-password --region "$AWS_REGION" | finch login --username AWS --password-stdin "$AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com"
print_success "Logged in to ECR"

# Build image
print_info "Building Docker image..."
cd ../backend/agent
finch build --platform linux/amd64 -t "$REPO_NAME:latest" .
print_success "Image built successfully"

# Tag for ECR
ECR_URI="$AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/$REPO_NAME:latest"
print_info "Tagging image: $ECR_URI"
finch tag "$REPO_NAME:latest" "$ECR_URI"
print_success "Image tagged"

# Push to ECR
print_info "Pushing image to ECR..."
finch push "$ECR_URI"
print_success "Image pushed successfully"

echo ""
print_success "=========================================="
print_success "Image built and pushed!"
print_success "=========================================="
echo ""
echo "  Image URI: $ECR_URI"
echo ""
print_info "You can now use this image URI in your CDK stack"
print_info "Or set it as an environment variable:"
echo "  export PREBUILT_IMAGE_URI=$ECR_URI"
echo ""
