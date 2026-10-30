#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { readAgentCoreProject, resolveTargetStacks, transformAgentCoreJson } from '@aws/agentcore-cdk';
import { AgentCoreStack } from '../lib/cdk-stack';

try {
  // The AgentCore CLI runs this app from agentcore/cdk/; readAgentCoreProject walks up to agentcore/.
  const project = readAgentCoreProject();
  const app = new App();
  for (const stack of resolveTargetStacks({
    projectName: project.projectName,
    targets: project.targets,
    deployedState: project.deployedState,
  })) {
    // agentcore.json refers to the account as ${AWS_ACCOUNT_ID} (e.g. in the refund Lambda ARN) to keep it out of git
    const accountId = process.env.AWS_ACCOUNT_ID ?? stack.env?.account;
    if (!accountId) {
      throw new Error(`Set AWS_ACCOUNT_ID or an account for target '${stack.stackName}' in aws-targets.json`);
    }
    const agentCoreJson = JSON.parse(
      JSON.stringify(project.agentCoreJson).replaceAll('${AWS_ACCOUNT_ID}', accountId),
    ) as typeof project.agentCoreJson;
    new AgentCoreStack(app, stack.stackName, {
      env: stack.env,
      tags: stack.tags,
      description: stack.description,
      application: transformAgentCoreJson(agentCoreJson, {
        projectRoot: project.projectRoot,
        credentials: stack.credentials,
        target: stack.target,
      }),
    });
  }
  app.synth();
} catch (error) {
  console.error('AgentCore CDK synthesis failed:', error instanceof Error ? error.message : error);
  process.exit(1);
}
