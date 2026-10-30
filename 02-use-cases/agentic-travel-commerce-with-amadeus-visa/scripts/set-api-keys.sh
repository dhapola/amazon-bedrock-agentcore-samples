#!/bin/bash

# Script to set API keys in AWS Systems Manager Parameter Store
# Usage: ./scripts/set-api-keys.sh

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Load config helper
source "$SCRIPT_DIR/lib/config-helper.sh"

# Get configuration values
REGION=$(get_aws_region)
SSM_PREFIX=$(get_ssm_prefix)

echo "🔑 Setting API keys in AWS Systems Manager Parameter Store..."
echo "   Region: $REGION"
echo "   SSM Prefix: $SSM_PREFIX"
echo ""

# OpenWeather API Key
read -p "Enter OpenWeather API Key (or press Enter to skip): " OPENWEATHER_KEY
if [ ! -z "$OPENWEATHER_KEY" ]; then
  aws ssm put-parameter \
    --name "${SSM_PREFIX}/travel/openweather-api-key" \
    --value "$OPENWEATHER_KEY" \
    --type "SecureString" \
    --overwrite \
    --region $REGION
  echo "✅ OpenWeather API key set"
fi

# Google Maps API Key
read -p "Enter Google Maps API Key (or press Enter to skip): " GOOGLE_KEY
if [ ! -z "$GOOGLE_KEY" ]; then
  aws ssm put-parameter \
    --name "${SSM_PREFIX}/travel/google-maps-key" \
    --value "$GOOGLE_KEY" \
    --type "SecureString" \
    --overwrite \
    --region $REGION
  echo "✅ Google Maps API key set"
fi

# Amadeus API Key (public)
read -p "Enter Amadeus API Key (or press Enter to skip): " AMADEUS_KEY
if [ ! -z "$AMADEUS_KEY" ]; then
  aws ssm put-parameter \
    --name "${SSM_PREFIX}/travel/amadeus-public" \
    --value "$AMADEUS_KEY" \
    --type "SecureString" \
    --overwrite \
    --region $REGION
  echo "✅ Amadeus API key set"
fi

# Amadeus API Secret
read -p "Enter Amadeus API Secret (or press Enter to skip): " AMADEUS_SECRET
if [ ! -z "$AMADEUS_SECRET" ]; then
  aws ssm put-parameter \
    --name "${SSM_PREFIX}/travel/amadeus-secret" \
    --value "$AMADEUS_SECRET" \
    --type "SecureString" \
    --overwrite \
    --region $REGION
  echo "✅ Amadeus API secret set"
fi

echo ""
echo "🎉 API keys configuration complete!"
echo ""
echo "Note: After setting keys, you need to redeploy the MCP servers:"
echo "  cd infrastructure/mcp-servers && cdk deploy TravelStack"
