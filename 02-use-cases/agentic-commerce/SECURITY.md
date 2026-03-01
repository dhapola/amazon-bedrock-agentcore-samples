# Security Guidelines

## Sensitive Files - DO NOT COMMIT

The following files contain sensitive information and should NEVER be committed to version control:

### Environment Files
- `frontend/.env` - Contains Cognito configuration and API endpoints
- `backend/.env` - Backend environment variables
- `backend/agent/.env` - Agent-specific environment variables

### AWS Configuration Files
- `backend/.bedrock_agentcore.yaml` - Contains AWS account IDs, ARNs, and deployment state
- `backend/agent/.bedrock_agentcore.yaml` - Contains agent-specific AWS configuration

### Backup Files
- `*.backup.*` - Automatically created backup files may contain sensitive data

## Template Files - Safe to Commit

Use these template files as starting points:
- `frontend/.env.example` - Template for frontend environment variables
- `backend/.bedrock_agentcore.yaml.example` - Template for backend AgentCore config
- `backend/agent/.bedrock_agentcore.yaml.example` - Template for agent AgentCore config

## Setup Instructions

### 1. Frontend Environment Setup
```bash
cd frontend
cp .env.example .env
# Edit .env with your actual Cognito configuration
```

### 2. Backend Configuration Setup
```bash
cd backend
cp .bedrock_agentcore.yaml.example .bedrock_agentcore.yaml
# Edit with your AWS account ID and region

cd agent
cp .bedrock_agentcore.yaml.example .bedrock_agentcore.yaml
# Edit with your AWS account ID and region
```

### 3. Cognito Setup
Before running `infrastructure/setup-cognito.sh`:
- Edit the script and replace `USERNAME` and `PASSWORD` with your values
- Or pass them as command-line arguments (see script help)

## What's Safe to Share

The following are safe to commit:
- Deployment scripts (they don't contain credentials)
- CloudFormation templates
- Source code
- Documentation
- Example/template files

## AWS Account Information

The following AWS-specific information should be kept private:
- AWS Account IDs
- IAM Role ARNs
- ECR Repository URLs
- Cognito User Pool IDs
- Cognito Client IDs
- CloudFront Distribution IDs
- S3 Bucket Names
- Agent IDs and ARNs
- Session IDs

## Best Practices

1. **Never commit `.env` files** - Use `.env.example` templates instead
2. **Use AWS Secrets Manager** - For production secrets
3. **Rotate credentials regularly** - Especially test passwords
4. **Use IAM roles** - Instead of hardcoded credentials
5. **Review before committing** - Always check `git diff` before pushing
6. **Use `.gitignore`** - Ensure sensitive files are excluded

## If You Accidentally Commit Secrets

1. **Rotate the credentials immediately**
2. **Remove from Git history** using `git filter-branch` or BFG Repo-Cleaner
3. **Force push** to overwrite remote history (coordinate with team)
4. **Update all deployments** with new credentials

## Reporting Security Issues

If you discover a security vulnerability, please email [your-security-email] instead of using the issue tracker.
