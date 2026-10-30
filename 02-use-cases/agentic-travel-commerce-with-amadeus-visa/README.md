# Travel Agent Overview

AI-powered Agentic Commerce for Travel with Amadeus & Visa with travel planning and booking assistance capabilities, built with AWS Bedrock AgentCore, Amplify, and React. 

The travel assistant specializes in all travel-related queries including destination research, weather information, flight and hotel searches, and local recommendations leveraging Online Travel Agency (OTA) MCP tools through the AgentCore Gateway. It compares offers, assembles itineraries, manages modifications, and ensures that all trip components—air, hotel, activities—are aligned with user preferences and constraints. 

### Use case details
| Information         | Details                                                                                                                             |
|---------------------|-------------------------------------------------------------------------------------------------------------------------------------|
| Use case type       | Agentic Payments                                                                                                            |
| Agent type          | Multi-agent                                                                                                                         |
| Use case components | Tools (MCP-based), observability (logs, metrics)                                                |
| Use case vertical   | FSI                                                                                                                         |
| Example complexity  | Advanced                                                                                                          |
| SDK used            | Strands, MCP                                                                                       |



## Features

- **Travel Planning** - Destination recommendations, weather, and local insights
- **Cart & Payment** - Cart management with Visa tokenization support (feature flag enabled)
- **Conversation Memory** - Persistent chat history across sessions
- **Real-time Streaming** - Live agent responses with tool usage indicators
- **Secure Authentication** - AWS Cognito with JWT-based auth


## Quick Start

### 🚀 Automated Deployment (Recommended)

Deploy the entire stack with one command:

```bash
./scripts/deploy-all.sh
```

**Time:** ~11 minutes | **No errors, fully automated**

See **[Quick Deploy Guide](QUICK_DEPLOY.md)** for options and troubleshooting.

### 📝 Manual Deployment

```bash
# Install dependencies
npm install

# Deploy everything (Amplify + unified backend + Visa Lambda)
npm run deploy

# Start local development server
npm run dev
```

Access the application at `https://vcas.local.com:9000/`

For complete deployment instructions, configuration, and troubleshooting, see the **[Deployment Guide](DEPLOYMENT.md)**.

## Project Structure

```
agentic-travel-commerce/
├── amplify/                    # AWS Amplify backend (Cognito, DynamoDB, GraphQL)
├── agentic_commerce/           # Agent and MCP server code (Docker containers)
│   ├── supervisor_agent/      # Main agent runtime
│   ├── mcp_cart_tools/        # Cart MCP server
│   ├── mcp_travel_tools/      # Travel MCP server
│   └── mcp_itinerary_tools/   # Itinerary MCP server
├── infrastructure/            # CDK infrastructure stacks
│   ├── unified-backend-stack/ # Backend (4 runtimes + gateway + memory)
│   ├── frontend-stack/        # S3 + CloudFront
│   └── visa-lambda-stack/     # Visa API proxy (optional)
├── web-ui/                    # React frontend application
└── scripts/                   # Deployment and setup scripts
```

## Documentation

### Deployment
- **[Deployment Guide](DEPLOYMENT.md)** - Complete step-by-step deployment instructions
- **[Infrastructure README](infrastructure/README.md)** - CDK infrastructure details and configuration
- **[Frontend Mock Mode](docs/FRONTEND_MOCK_MODE.md)** - Test UI without backend
- **[Visa Documentation](visa-documentation/README.md)** - Visa APIs documentation s

## Prerequisites

- Node.js 18+ and npm
- AWS CLI configured with credentials
- Docker (for building agent containers)

See the [Deployment Guide](DEPLOYMENT.md#prerequisites) for detailed requirements and AWS permissions.

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run deploy:all` | Deploy everything (automated, recommended) |
| `npm run deploy` | Deploy Amplify + Backend + Visa Lambda |
| `npm run deploy:amplify` | Deploy Amplify backend only |
| `npm run deploy:backend` | Deploy unified backend (4 runtimes + gateway) |
| `npm run deploy:visa-lambda` | Deploy Visa Lambda proxy (optional) |
| `npm run deploy:frontend` | Deploy frontend to S3 + CloudFront |
| `npm run dev` | Start web UI development server |
| `npm run clean` | Delete all AWS resources |

## Data Flow
![travel data flow](docs/traveling_data_flow.png)


## Architecture
![travel arch](docs/Travel_Agent_VISA.png)

## Demo
![Travel Agent Demo](docs/demo.gif)

## Configuration

### API Keys (Optional)

The application works out of the box with basic features. Optional API keys enable additional functionality:

- **Visa API** - Real payment integration (defaults to mock mode)

See the [Deployment Guide - API Keys Configuration](DEPLOYMENT.md#api-keys-optional) for setup instructions.


## Cleanup

To remove all deployed AWS resources:

```bash
npm run clean
```

See the [Deployment Guide - Clean Up](DEPLOYMENT.md#clean-up) for partial cleanup options and manual resource removal.

## Support

For detailed deployment instructions, troubleshooting, and configuration options, see the [Deployment Guide](DEPLOYMENT.md).

> [!NOTE]
> This project is provided as a sample implementation for educational purposes, it is NOT PRODUCTION READY.
>  Please ensure compliance with your organization's policies and AWS service terms.