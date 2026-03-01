#!/bin/bash

# Destroy script for React SPA deployment on AWS S3 + CloudFront

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
STACK_NAME="agentic-commerce-frontend"
REGION="us-west-2"
SKIP_CONFIRMATION=false

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

Destroy React SPA deployment by emptying S3 bucket and deleting CloudFormation stack

OPTIONS:
    -s, --stack-name        CloudFormation stack name (default: agentic-commerce-frontend)
    -r, --region            AWS region (default: us-west-2)
    -y, --yes               Skip confirmation prompt
    -h, --help              Show this help message

EXAMPLES:
    $0                                      # Destroy with defaults (will prompt for confirmation)
    $0 --stack-name my-stack --yes          # Destroy without confirmation
    $0 -s my-stack -r us-west-2 -y          # Destroy in specific region
EOF
    exit 1
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -s|--stack-name)
            STACK_NAME="$2"
            shift 2
            ;;
        -r|--region)
            REGION="$2"
            shift 2
            ;;
        -y|--yes)
            SKIP_CONFIRMATION=true
            shift
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

print_warning "=========================================="
print_warning "DESTRUCTION PROCESS"
print_warning "=========================================="
echo ""
echo "  Stack Name: $STACK_NAME"
echo "  Region: $REGION"
echo ""

# Check if stack exists
print_info "Checking if stack exists..."
STACK_STATUS=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query "Stacks[0].StackStatus" \
    --output text 2>&1) || STACK_EXISTS=false

if [[ "$STACK_STATUS" == *"does not exist"* ]] || [[ -z "$STACK_STATUS" ]]; then
    print_error "Stack '$STACK_NAME' does not exist in region '$REGION'"
    exit 1
fi

print_info "Stack found with status: $STACK_STATUS"

# Get bucket name from stack outputs
print_info "Retrieving S3 bucket name from stack..."
BUCKET_NAME=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" \
    --output text 2>&1)

if [ -z "$BUCKET_NAME" ]; then
    print_error "Could not retrieve bucket name from stack outputs"
    exit 1
fi

print_info "Found S3 bucket: $BUCKET_NAME"

# Get CloudFront distribution ID
DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue" \
    --output text 2>&1)

if [ -n "$DISTRIBUTION_ID" ]; then
    print_info "Found CloudFront distribution: $DISTRIBUTION_ID"
fi

# Confirmation prompt
if [ "$SKIP_CONFIRMATION" = false ]; then
    echo ""
    print_warning "This will permanently delete:"
    echo "  - All files in S3 bucket: $BUCKET_NAME"
    echo "  - CloudFront distribution: $DISTRIBUTION_ID"
    echo "  - CloudFormation stack: $STACK_NAME"
    echo ""
    read -p "Are you sure you want to continue? (yes/no): " CONFIRM
    
    if [ "$CONFIRM" != "yes" ]; then
        print_info "Destruction cancelled"
        exit 0
    fi
fi

echo ""
print_info "Starting destruction process..."

# Step 1: Empty S3 bucket
print_info "Emptying S3 bucket: $BUCKET_NAME..."

# Check if bucket exists
aws s3 ls "s3://$BUCKET_NAME" --region "$REGION" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    # Delete all objects including versions
    aws s3 rm "s3://$BUCKET_NAME" --recursive --region "$REGION"
    
    # Delete all object versions (if versioning is enabled)
    print_info "Removing all object versions..."
    aws s3api list-object-versions \
        --bucket "$BUCKET_NAME" \
        --region "$REGION" \
        --output json \
        --query 'Versions[].{Key:Key,VersionId:VersionId}' 2>/dev/null | \
    jq -r '.[] | "--key \"\(.Key)\" --version-id \"\(.VersionId)\""' | \
    while read -r args; do
        eval aws s3api delete-object --bucket "$BUCKET_NAME" --region "$REGION" $args 2>/dev/null || true
    done
    
    # Delete all delete markers
    print_info "Removing delete markers..."
    aws s3api list-object-versions \
        --bucket "$BUCKET_NAME" \
        --region "$REGION" \
        --output json \
        --query 'DeleteMarkers[].{Key:Key,VersionId:VersionId}' 2>/dev/null | \
    jq -r '.[] | "--key \"\(.Key)\" --version-id \"\(.VersionId)\""' | \
    while read -r args; do
        eval aws s3api delete-object --bucket "$BUCKET_NAME" --region "$REGION" $args 2>/dev/null || true
    done
    
    print_info "S3 bucket emptied successfully"
else
    print_warning "S3 bucket does not exist or is already empty"
fi

# Step 2: Disable CloudFront distribution (if exists)
if [ -n "$DISTRIBUTION_ID" ]; then
    print_info "Checking CloudFront distribution status..."
    
    DIST_STATUS=$(aws cloudfront get-distribution \
        --id "$DISTRIBUTION_ID" \
        --query "Distribution.Status" \
        --output text 2>&1) || DIST_EXISTS=false
    
    if [[ "$DIST_STATUS" != *"NoSuchDistribution"* ]] && [ -n "$DIST_STATUS" ]; then
        print_info "CloudFront distribution will be deleted by CloudFormation"
    fi
fi

# Step 3: Delete CloudFormation stack
print_info "Deleting CloudFormation stack: $STACK_NAME..."

aws cloudformation delete-stack \
    --stack-name "$STACK_NAME" \
    --region "$REGION"

if [ $? -eq 0 ]; then
    print_info "Stack deletion initiated"
    print_info "Waiting for stack deletion to complete..."
    
    aws cloudformation wait stack-delete-complete \
        --stack-name "$STACK_NAME" \
        --region "$REGION" 2>&1
    
    if [ $? -eq 0 ]; then
        echo ""
        print_info "=========================================="
        print_info "Destruction completed successfully!"
        print_info "=========================================="
        echo ""
        echo "  Stack '$STACK_NAME' has been deleted"
        echo "  S3 bucket '$BUCKET_NAME' has been emptied and deleted"
        if [ -n "$DISTRIBUTION_ID" ]; then
            echo "  CloudFront distribution '$DISTRIBUTION_ID' has been deleted"
        fi
        echo ""
    else
        print_error "Stack deletion failed or timed out"
        print_info "Check AWS Console for details"
        exit 1
    fi
else
    print_error "Failed to initiate stack deletion"
    exit 1
fi
