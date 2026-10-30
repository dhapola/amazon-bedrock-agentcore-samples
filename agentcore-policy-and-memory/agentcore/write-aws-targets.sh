#!/usr/bin/env sh
# Writes agentcore/aws-targets.json (gitignored) from aws-targets.template.json, filling in
# AWS_ACCOUNT_ID so the account number stays out of git. Run before `agentcore deploy`.
set -eu
: "${AWS_ACCOUNT_ID:?set AWS_ACCOUNT_ID to the 12-digit deployment account}"
case "$AWS_ACCOUNT_ID" in
  [0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]) ;;
  *) echo "AWS_ACCOUNT_ID must be 12 digits, got '$AWS_ACCOUNT_ID'" >&2; exit 1 ;;
esac
cd "$(dirname "$0")"
sed "s/\${AWS_ACCOUNT_ID}/$AWS_ACCOUNT_ID/" aws-targets.template.json > aws-targets.json
echo "wrote agentcore/aws-targets.json for account $AWS_ACCOUNT_ID"
