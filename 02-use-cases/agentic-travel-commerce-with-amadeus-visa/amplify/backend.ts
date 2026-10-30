import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { CfnOutput } from 'aws-cdk-lib';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { loadConfig } from '../infrastructure/shared/config-loader.js';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load deployment config with all defaults
const configPath = path.join(__dirname, '..', 'deployment-config.json');
const config = loadConfig(configPath);
const deploymentId = config.deploymentId;

const backend = defineBackend({
  auth,
  data,
});

// Grant authenticated users access to send emails via SES
backend.auth.resources.authenticatedUserIamRole.addToPrincipalPolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: [
      'ses:SendEmail',
      'ses:SendRawEmail'
    ],
    resources: ['*'] // You can restrict this to specific SES identities
  })
);

// Create resource server for machine-to-machine authentication
import { UserPoolResourceServer, ResourceServerScope, UserPoolClient, OAuthScope } from 'aws-cdk-lib/aws-cognito';

const resourceServer = new UserPoolResourceServer(backend.stack, 'GatewayResourceServer', {
  userPool: backend.auth.resources.userPool,
  identifier: config.cognito?.resourceServer?.identifier || 'concierge-gateway',
  userPoolResourceServerName: config.cognito?.resourceServer?.displayName || 'concierge-gateway-resource-server',
  scopes: [
    new ResourceServerScope({
      scopeName: config.cognito?.oauth?.scopeName || 'invoke',
      scopeDescription: config.cognito?.oauth?.scopeDescription || 'Invoke gateway and targets',
    }),
  ],
});

// Create machine client for gateway OAuth authentication
const machineClient = new UserPoolClient(backend.stack, 'GatewayMachineClient', {
  userPool: backend.auth.resources.userPool,
  userPoolClientName: config.cognito?.machineClient?.name || 'concierge-gateway-machine-client',
  generateSecret: true,
  oAuth: {
    flows: {
      clientCredentials: true,
    },
    scopes: [
      OAuthScope.resourceServer(
        resourceServer,
        new ResourceServerScope({
          scopeName: config.cognito?.oauth?.scopeName || 'invoke',
          scopeDescription: config.cognito?.oauth?.scopeDescription || 'Invoke gateway and targets',
        })
      ),
    ],
  },
});
machineClient.node.addDependency(resourceServer);

// Add Cognito domain for OAuth token endpoint
import { UserPoolDomain } from 'aws-cdk-lib/aws-cognito';

const userPoolDomain = new UserPoolDomain(backend.stack, 'CognitoDomain', {
  userPool: backend.auth.resources.userPool,
  cognitoDomain: {
    domainPrefix: `${config.cognito?.domainPrefix || 'concierge'}-${deploymentId}-${backend.stack.account}`,  // Must be globally unique - includes account ID
  },
});

// Export Cognito configuration for Agent CDK stack to import
new CfnOutput(backend.stack, 'UserPoolIdExport', {
  value: backend.auth.resources.userPool.userPoolId,
  exportName: `${deploymentId}-Auth-UserPoolId`,
  description: 'Cognito User Pool ID (unique per deployment)'
});

new CfnOutput(backend.stack, 'ClientIdExport', {
  value: backend.auth.resources.userPoolClient.userPoolClientId,
  exportName: `${deploymentId}-Auth-ClientId`,
  description: 'Cognito User Pool Client ID (unique per deployment)'
});

new CfnOutput(backend.stack, 'RegionExport', {
  value: backend.stack.region,
  exportName: `${deploymentId}-Auth-Region`,
  description: 'AWS Region (unique per deployment)'
});

new CfnOutput(backend.stack, 'MachineClientIdExport', {
  value: machineClient.userPoolClientId,
  exportName: `${deploymentId}-Auth-MachineClientId`,
  description: 'Machine client ID for gateway OAuth and MCP authentication'
});

// Table exports with deployment ID
new CfnOutput(backend.stack, 'UserProfileTableNameExport', {
  value: backend.data.resources.tables['UserProfile'].tableName,
  exportName: `${deploymentId}-Data-UserProfileTableName`,
  description: 'DynamoDB UserProfile table name (unique per deployment)'
});

new CfnOutput(backend.stack, 'WishlistTableNameExport', {
  value: backend.data.resources.tables['Wishlist'].tableName,
  exportName: `${deploymentId}-Data-WishlistTableName`,
  description: 'DynamoDB Wishlist table name (unique per deployment)'
});

new CfnOutput(backend.stack, 'ItineraryTableNameExport', {
  value: backend.data.resources.tables['Itinerary'].tableName,
  exportName: `${deploymentId}-Data-ItineraryTableName`,
  description: 'DynamoDB Itinerary table name (unique per deployment)'
});

new CfnOutput(backend.stack, 'FeedbackTableNameExport', {
  value: backend.data.resources.tables['Feedback'].tableName,
  exportName: `${deploymentId}-Data-FeedbackTableName`,
  description: 'DynamoDB Feedback table name (unique per deployment)'
});
