import structlog
from openai import AsyncOpenAI

logger = structlog.get_logger()

class LLMService:
    def __init__(self, config):
        self.client = None
        if config.OPENAI_API_KEY and config.OPENAI_API_KEY != "sk-dummy-openai":
             self.client = AsyncOpenAI(api_key=config.OPENAI_API_KEY)
        else:
            logger.warning("OpenAI API Key not found or is dummy. LLM service will be limited.")

    async def generate_response(self, prompt: str, system_prompt: str = "You are a helpful assistant.") -> str:
        if not self.client:
            return "LLM Service is not configured with a valid API key."
            
        try:
            response = await self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ]
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error("LLM generation failed", error=str(e))
            return f"Error generating response: {str(e)}"
