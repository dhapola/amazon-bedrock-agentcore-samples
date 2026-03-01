import os
from strands import Agent
from bedrock_agentcore import BedrockAgentCoreApp
from .model.load import load_model

REGION = os.getenv("AWS_REGION")

# Integrate with Bedrock AgentCore
app = BedrockAgentCoreApp()
log = app.logger

@app.entrypoint
async def invoke(payload, context):
    session_id = getattr(context, 'session_id', 'default')
    user_id = payload.get("user_id") or 'default-user'

    # Create agent without tools - using only model's pretrained knowledge
    agent = Agent(
        model=load_model(),
        system_prompt="""
            You are a helpful travel assistant for Agentic Commerce. 
            Help users plan trips, provide travel recommendations, and answer travel-related questions.
            Be friendly, informative, and concise in your responses.
        """
    )

    # Execute and stream response
    stream = agent.stream_async(payload.get("prompt"))

    async for event in stream:
        # Handle Text parts of the response
        if "data" in event and isinstance(event["data"], str):
            yield event["data"]

if __name__ == "__main__":
    app.run()