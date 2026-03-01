#!/bin/bash

# Script to update frontend/.env with Cognito configuration from CloudFormation outputs

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
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

usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Update frontend/.env file with Cognito configuration from CloudFormation stack

OPTIONS:
    -s, --stack-name        CloudFormation stack name (default: travel-with-agentic-commerce)
    -r, --region            AWS region (default: us-west-2)
    -h, --help              Show this help message

EXAMPLES:
    $0                                          # Use defaults
    $0 --stack-name my-stack --region us-east-1
EOF
    exit 1
}

STACK_NAME="travel-with-agentic-commerce"
REGION="us-west-2"

# Parse arguments
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
        -h|--help)
            usage
            ;;
        *)
            print_error "Unknown option: $1"
            usage
            ;;
    esac
done

print_info "Fetching CloudFormation stack outputs..."
print_info "Stack: $STACK_NAME"
print_info "Region: $REGION"
echo ""

# Get stack outputs
OUTPUTS=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query "Stacks[0].Outputs" \
    --output json 2>/dev/null)

if [ $? -ne 0 ] || [ -z "$OUTPUTS" ]; then
    print_error "Failed to fetch stack outputs. Is the stack deployed?"
    exit 1
fi

# Extract values
USER_POOL_ID=$(echo "$OUTPUTS" | jq -r '.[] | select(.OutputKey=="UserPoolId") | .OutputValue')
CLIENT_ID=$(echo "$OUTPUTS" | jq -r '.[] | select(.OutputKey=="UserPoolClientId") | .OutputValue')
COGNITO_DOMAIN=$(echo "$OUTPUTS" | jq -r '.[] | select(.OutputKey=="CognitoDomain") | .OutputValue')
CLOUDFRONT_DOMAIN=$(echo "$OUTPUTS" | jq -r '.[] | select(.OutputKey=="CloudFrontDomainName") | .OutputValue')

# Validate outputs
if [ -z "$USER_POOL_ID" ] || [ -z "$CLIENT_ID" ] || [ -z "$COGNITO_DOMAIN" ] || [ -z "$CLOUDFRONT_DOMAIN" ]; then
    print_error "Failed to extract all required outputs from stack"
    echo "USER_POOL_ID: $USER_POOL_ID"
    echo "CLIENT_ID: $CLIENT_ID"
    echo "COGNITO_DOMAIN: $COGNITO_DOMAIN"
    echo "CLOUDFRONT_DOMAIN: $CLOUDFRONT_DOMAIN"
    exit 1
fi

print_info "Retrieved configuration:"
echo "  User Pool ID: $USER_POOL_ID"
echo "  Client ID: $CLIENT_ID"
echo "  Cognito Domain: $COGNITO_DOMAIN"
echo "  CloudFront Domain: $CLOUDFRONT_DOMAIN"
echo ""

# Path to .env file
ENV_FILE="../frontend/.env"

# Backup existing .env
if [ -f "$ENV_FILE" ]; then
    BACKUP_FILE="${ENV_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
    cp "$ENV_FILE" "$BACKUP_FILE"
    print_info "Backed up existing .env to: $BACKUP_FILE"
fi

# Read existing .env or create new one
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
        # Update existing
        ENV_CONTENT=$(echo "$ENV_CONTENT" | sed "s|^${key}=.*|${key}=${value}|")
    else
        # Add new
        if [ -n "$ENV_CONTENT" ]; then
            ENV_CONTENT="${ENV_CONTENT}\n${key}=${value}"
        else
            ENV_CONTENT="${key}=${value}"
        fi
    fi
}

# Update environment variables
update_env_var "VITE_DEV_MODE" "false"
update_env_var "VITE_COGNITO_DOMAIN" "$COGNITO_DOMAIN"
update_env_var "VITE_COGNITO_USER_POOL_ID" "$USER_POOL_ID"
update_env_var "VITE_COGNITO_CLIENT_ID" "$CLIENT_ID"
update_env_var "VITE_COGNITO_REDIRECT_URI" "https://$CLOUDFRONT_DOMAIN"
update_env_var "VITE_COGNITO_LOGOUT_URI" "https://$CLOUDFRONT_DOMAIN"

# Write updated .env file
echo -e "$ENV_CONTENT" > "$ENV_FILE"

print_info "Updated $ENV_FILE with Cognito configuration"
echo ""

print_info "=========================================="
print_info "Environment variables updated successfully!"
print_info "=========================================="
echo ""

print_info "Updated variables:"
echo "  VITE_DEV_MODE=false"
echo "  VITE_COGNITO_DOMAIN=$COGNITO_DOMAIN"
echo "  VITE_COGNITO_USER_POOL_ID=$USER_POOL_ID"
echo "  VITE_COGNITO_CLIENT_ID=$CLIENT_ID"
echo "  VITE_COGNITO_REDIRECT_URI=https://$CLOUDFRONT_DOMAIN"
echo "  VITE_COGNITO_LOGOUT_URI=https://$CLOUDFRONT_DOMAIN"
echo ""

print_warning "Next steps:"
echo "  1. Review the updated .env file: $ENV_FILE"
echo "  2. Create a test user: ./setup-cognito.sh --user-pool-id $USER_POOL_ID --email your@email.com"
echo "  3. Rebuild and redeploy frontend if needed"
echo ""
