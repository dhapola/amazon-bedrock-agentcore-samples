import os
from typing import Optional

import boto3
import httpx
from botocore.auth import SigV4Auth
from botocore.awsrequest import AWSRequest
from strands.tools.mcp import MCPClient

# Set by the deploy for the `refunds` gateway in agentcore.json
REFUNDS_GATEWAY_URL = os.getenv("AGENTCORE_GATEWAY_REFUNDS_URL")
REGION = os.getenv("AWS_REGION")


class SigV4HttpxAuth(httpx.Auth):
    """Sign each request with the runtime's IAM credentials (gateway authorizerType AWS_IAM)."""

    requires_request_body = True

    def __init__(self, service: str = "bedrock-agentcore", region: Optional[str] = REGION):
        session = boto3.Session()
        self._credentials = session.get_credentials()
        self._service = service
        self._region = region or session.region_name

    def auth_flow(self, request: httpx.Request):
        headers = dict(request.headers)
        headers.pop("connection", None)  # hop-by-hop; may be altered in transit
        aws_request = AWSRequest(method=request.method, url=str(request.url), data=request.content, headers=headers)
        SigV4Auth(self._credentials.get_frozen_credentials(), self._service, self._region).add_auth(aws_request)
        request.headers.update(dict(aws_request.headers))
        yield request


def get_refunds_gateway_client() -> Optional[MCPClient]:
    """MCP client for the refunds gateway, or None when the gateway URL isn't configured."""
    if not REFUNDS_GATEWAY_URL:
        return None
    return MCPClient(url=REFUNDS_GATEWAY_URL, auth_provider=SigV4HttpxAuth())
