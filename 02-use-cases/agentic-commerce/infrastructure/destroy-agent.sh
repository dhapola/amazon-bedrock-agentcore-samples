#!/bin/bash

# AgentCore Runtime Destroy Script
# Removes the Bedrock AgentCore agent and all CDK infrastructure

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
CDK_DIR="../backend/agent/cdk"
FORCE=false
YES=false

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

Destroy the AgentCore runtime and all associated AWS resources.

OPTIONS:
    --yes               Skip confirmation prompt
    --force             Force destroy even if resources are in use
    --help              Display this help message

EXAMPLES:
    # Interactive destroy (with confirmation)
    $0

    # Non-interactive destroy
    $0 --yes

    # Force destroy
    $0 --yes --force

WARNING:
    This will permanently delete:
    - AgentCore runtime and all versions
    - Lambda functions (MCP tools)
    - API Gateway and Cognito resources
    - ECR repositories and Docker images
    - CloudWatch logs
    - All associated IAM roles and policies

EOF
    exit 0
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --yes)
            YES=true
            shift
            ;;
        --force)
            FORCE=true
            shift
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

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI is not installed"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    print_error "AWS credentials not configured or invalid"
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=$(aws configure get region || echo "us-east-1")
print_success "AWS Account: $ACCOUNT_ID"
print_success "Region: $REGION"

# List stacks to be destroyed
print_info "Scanning for AgentCore stacks..."
STACKS=$(aws cloudformation describe-stacks --query "Stacks[?contains(StackName, 'Agentcore') || contains(StackName, 'DockerImage')].StackName" --output text 2>/dev/null || echo "")

if [ -z "$STACKS" ]; then
    print_warning "No AgentCore stacks found"
    echo ""
    print_info "Nothing to destroy"
    exit 0
fi

echo ""
print_warning "The following stacks will be destroyed:"
for stack in $STACKS; do
    echo "  - $stack"
done
echo ""

# Show what will be deleted
print_warning "This will permanently delete:"
echo "  • AgentCore runtime and all versions"
echo "  • Lambda functions (MCP tools)"
echo "  • API Gateway and Cognito resources"
echo "  • ECR repositories and Docker images"
echo "  • CloudWatch logs"
echo "  • IAM roles and policies"
echo ""

# Confirmation prompt
if [ "$YES" = false ]; then
    read -p "$(echo -e ${RED}Are you sure you want to destroy these resources? ${NC}[y/N]: )" -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Destroy cancelled"
        exit 0
    fi
fi

# Navigate to CDK directory
print_info "Navigating to CDK directory..."
cd "$CDK_DIR" || {
    print_error "Failed to navigate to $CDK_DIR"
    exit 1
}

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    print_info "Installing CDK dependencies..."
    npm install || {
        print_error "Failed to install dependencies"
        exit 1
    }
fi

# Destroy stacks
print_info "Destroying AgentCore stacks..."
print_warning "This may take several minutes..."

if [ "$FORCE" = true ]; then
    print_warning "Force mode enabled"
    if npm run cdk destroy -- --force; then
        print_success "Stacks destroyed successfully"
    else
        print_error "Destroy failed"
        exit 1
    fi
else
    if npm run cdk destroy -- --all; then
        print_success "Stacks destroyed successfully"
    else
        print_error "Destroy failed"
        print_info "Try running with --force flag if resources are stuck"
        exit 1
    fi
fi

# Clean up any remaining ECR images
print_info "Checking for remaining ECR repositories..."
ECR_REPOS=$(aws ecr describe-repositories --query "repositories[?contains(repositoryName, 'agentcore')].repositoryName" --output text 2>/dev/null || echo "")

if [ -n "$ECR_REPOS" ]; then
    print_warning "Found ECR repositories to clean up"
    for repo in $ECR_REPOS; do
        print_info "Deleting ECR repository: $repo"
        aws ecr delete-repository --repository-name "$repo" --force 2>/dev/null || print_warning "Could not delete $repo"
    done
fi

# Clean up CloudWatch log groups
print_info "Checking for remaining CloudWatch log groups..."
LOG_GROUPS=$(aws logs describe-log-groups --query "logGroups[?contains(logGroupName, 'agentcore') || contains(logGroupName, 'AgentCore')].logGroupName" --output text 2>/dev/null || echo "")

if [ -n "$LOG_GROUPS" ]; then
    print_warning "Found CloudWatch log groups to clean up"
    for log_group in $LOG_GROUPS; do
        print_info "Deleting log group: $log_group"
        aws logs delete-log-group --log-group-name "$log_group" 2>/dev/null || print_warning "Could not delete $log_group"
    done
fi

# Verify destruction
print_info "Verifying destruction..."
REMAINING_STACKS=$(aws cloudformation describe-stacks --query "Stacks[?contains(StackName, 'Agentcore') || contains(StackName, 'DockerImage')].StackName" --output text 2>/dev/null || echo "")

if [ -z "$REMAINING_STACKS" ]; then
    print_success "All AgentCore stacks destroyed successfully!"
else
    print_warning "Some stacks may still be deleting:"
    for stack in $REMAINING_STACKS; do
        STATUS=$(aws cloudformation describe-stacks --stack-name "$stack" --query "Stacks[0].StackStatus" --output text 2>/dev/null || echo "UNKNOWN")
        echo "  - $stack: $STATUS"
    done
fi

echo ""
print_success "Destroy complete!"
echo ""
print_info "Note: Some resources may take a few minutes to fully delete"
print_info "Check AWS Console to verify all resources are removed"
echo ""
