import structlog
import json
import asyncio
from abc import ABC, abstractmethod
from typing import List, Dict, Optional, Any
from dataclasses import dataclass, asdict

from openai import AsyncOpenAI
import anthropic
import google.generativeai as genai

logger = structlog.get_logger()

@dataclass
class LLMMessage:
    role: str
    content: str

class LLMProvider(ABC):
    """Abstract base class for LLM providers."""
    
    @abstractmethod
    async def generate_response(self, messages: List[LLMMessage], system_prompt: str = "You are a helpful assistant.", model: Optional[str] = None) -> str:
        pass

    @abstractmethod
    async def generate_structured_response(self, messages: List[LLMMessage], schema: Dict[str, Any], system_prompt: str = "You are a helpful assistant.", model: Optional[str] = None) -> Dict[str, Any]:
        """Generate a structured JSON response matching the given schema."""
        pass

    @abstractmethod
    async def get_available_models(self) -> List[str]:
        """Return a list of models supported by this provider."""
        return []

class OpenAIProvider(LLMProvider):
    def __init__(self, api_key: str, model: str = "gpt-3.5-turbo-0125"):
        self.client = AsyncOpenAI(api_key=api_key)
        self.model = model

    async def get_available_models(self) -> List[str]:
        try:
            models_page = await self.client.models.list()
            # Filter for chat models (gpt-*) to keep list relevant
            return [m.id for m in models_page.data if m.id.startswith("gpt")]
        except Exception as e:
            logger.error("openai_list_models_failed", error=str(e))
            return ["gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo-0125"]

    async def generate_response(self, messages: List[LLMMessage], system_prompt: str = "You are a helpful assistant.", model: Optional[str] = None) -> str:
        formatted_messages = [{"role": "system", "content": system_prompt}]
        formatted_messages.extend([asdict(msg) for msg in messages])
        
        try:
            response = await self.client.chat.completions.create(
                model=model or self.model,
                messages=formatted_messages
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error("openai_generation_failed", error=str(e), model=self.model)
            raise e

    async def generate_structured_response(self, messages: List[LLMMessage], schema: Dict[str, Any], system_prompt: str = "You are a helpful assistant.", model: Optional[str] = None) -> Dict[str, Any]:
        formatted_messages = [{"role": "system", "content": system_prompt + "\nOutput strictly in JSON."}]
        formatted_messages.extend([asdict(msg) for msg in messages])
        
        try:
            response = await self.client.chat.completions.create(
                model=model or self.model,
                messages=formatted_messages,
                response_format={"type": "json_object"}
            )
            content = response.choices[0].message.content
            return json.loads(content)
        except Exception as e:
            logger.error("openai_structured_generation_failed", error=str(e), model=self.model)
            raise e

class XAIProvider(LLMProvider):
    """xAI (Grok) provider using OpenAI client compatibility."""
    def __init__(self, api_key: str, model: str = "grok-2-1212"):
        self.client = AsyncOpenAI(
            api_key=api_key,
            base_url="https://api.x.ai/v1"
        )
        self.model = model

    async def get_available_models(self) -> List[str]:
        try:
            models_page = await self.client.models.list()
            return [m.id for m in models_page.data]
        except Exception as e:
            logger.error("xai_list_models_failed", error=str(e))
            return ["grok-2-1212", "grok-2-vision-1212", "grok-beta"]

    async def generate_response(self, messages: List[LLMMessage], system_prompt: str = "You are a helpful assistant.", model: Optional[str] = None) -> str:
        formatted_messages = [{"role": "system", "content": system_prompt}]
        formatted_messages.extend([asdict(msg) for msg in messages])
        
        try:
            response = await self.client.chat.completions.create(
                model=model or self.model,
                messages=formatted_messages
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error("xai_generation_failed", error=str(e), model=self.model)
            raise e

    async def generate_structured_response(self, messages: List[LLMMessage], schema: Dict[str, Any], system_prompt: str = "You are a helpful assistant.", model: Optional[str] = None) -> Dict[str, Any]:
        # xAI might not support json_object mode yet, so we prompt engineer it
        formatted_messages = [{"role": "system", "content": system_prompt + "\nOutput strictly in JSON."}]
        formatted_messages.extend([asdict(msg) for msg in messages])
        
        try:
            response = await self.client.chat.completions.create(
                model=model or self.model,
                messages=formatted_messages
            )
            content = response.choices[0].message.content
            # Attempt to parse JSON from content (might need cleanup if markdown blocks are used)
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
            return json.loads(content)
        except Exception as e:
            logger.error("xai_structured_generation_failed", error=str(e), model=self.model)
            raise e

class AnthropicProvider(LLMProvider):
    def __init__(self, api_key: str, model: str = "claude-3-opus-20240229"):
        self.client = anthropic.AsyncAnthropic(api_key=api_key)
        self.model = model

    async def get_available_models(self) -> List[str]:
        # Anthropic API does not currently support listing models programmatically
        # We must maintain a curated list of active models
        return [
            "claude-3-5-sonnet-20240620",
            "claude-3-opus-20240229",
            "claude-3-sonnet-20240229",
            "claude-3-haiku-20240307"
        ]

    async def generate_response(self, messages: List[LLMMessage], system_prompt: str = "You are a helpful assistant.", model: Optional[str] = None) -> str:
        formatted_messages = []
        for msg in messages:
            role = msg.role
            if role == "system": continue
            formatted_messages.append({"role": role, "content": msg.content})
            
        try:
            response = await self.client.messages.create(
                model=model or self.model,
                max_tokens=1024,
                system=system_prompt,
                messages=formatted_messages
            )
            return response.content[0].text
        except Exception as e:
            logger.error("anthropic_generation_failed", error=str(e), model=self.model)
            raise e

    async def generate_structured_response(self, messages: List[LLMMessage], schema: Dict[str, Any], system_prompt: str = "You are a helpful assistant.", model: Optional[str] = None) -> Dict[str, Any]:
        formatted_messages = []
        for msg in messages:
            role = msg.role
            if role == "system": continue
            formatted_messages.append({"role": role, "content": msg.content})
            
        system_prompt += "\nOutput strictly in JSON."
        
        try:
            response = await self.client.messages.create(
                model=model or self.model,
                max_tokens=1024,
                system=system_prompt,
                messages=formatted_messages
            )
            content = response.content[0].text
            # Cleanup potential markdown
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
            return json.loads(content)
        except Exception as e:
            logger.error("anthropic_structured_generation_failed", error=str(e), model=self.model)
            raise e

class GoogleProvider(LLMProvider):
    def __init__(self, api_key: str, model: str = "gemini-1.5-flash"):
        genai.configure(api_key=api_key)
        self.model_name = model
        self.model = genai.GenerativeModel(model)

    async def get_available_models(self) -> List[str]:
        try:
            loop = asyncio.get_running_loop()
            def _list():
                models = []
                for m in genai.list_models():
                    if 'generateContent' in m.supported_generation_methods:
                        models.append(m.name.replace("models/", ""))
                return models
            return await loop.run_in_executor(None, _list)
        except Exception as e:
            logger.error("google_list_models_failed", error=str(e))
            return ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-1.0-pro"]

    async def generate_response(self, messages: List[LLMMessage], system_prompt: str = "You are a helpful assistant.", model: Optional[str] = None) -> str:
        history = []
        for msg in messages[:-1]:
            role = "user" if msg.role == "user" else "model"
            history.append({"role": role, "parts": [msg.content]})
            
        last_message = messages[-1].content
        
        try:
            loop = asyncio.get_running_loop()
            def _generate():
                # Create new model instance if model override is provided
                target_model = self.model
                if model and model != self.model_name:
                    target_model = genai.GenerativeModel(model)
                
                chat = target_model.start_chat(history=history)
                prompt = f"System Instruction: {system_prompt}\n\nUser: {last_message}"
                response = chat.send_message(prompt)
                return response.text

            return await loop.run_in_executor(None, _generate)
        except Exception as e:
            logger.error("google_generation_failed", error=str(e), model=self.model_name)
            raise e

    async def generate_structured_response(self, messages: List[LLMMessage], schema: Dict[str, Any], system_prompt: str = "You are a helpful assistant.", model: Optional[str] = None) -> Dict[str, Any]:
        # Gemini supports JSON mode in newer models, but for safety we prompt engineer
        history = []
        for msg in messages[:-1]:
            role = "user" if msg.role == "user" else "model"
            history.append({"role": role, "parts": [msg.content]})
            
        last_message = messages[-1].content
        
        try:
            loop = asyncio.get_running_loop()
            def _generate():
                # Create new model instance if model override is provided
                target_model = self.model
                if model and model != self.model_name:
                    target_model = genai.GenerativeModel(model)

                chat = target_model.start_chat(history=history)
                prompt = f"System Instruction: {system_prompt}\nOutput strictly in JSON.\n\nUser: {last_message}"
                response = chat.send_message(prompt)
                return response.text

            content = await loop.run_in_executor(None, _generate)
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
            return json.loads(content)
        except Exception as e:
            logger.error("google_structured_generation_failed", error=str(e), model=self.model_name)
            raise e

class LLMService:
    def __init__(self, config):
        self.config = config
        self.providers: Dict[str, LLMProvider] = {}
        self.redis = None 
        self._initialize_providers()

    def set_redis(self, redis_client):
        """Set Redis client after initialization."""
        self.redis = redis_client

    def _initialize_providers(self):
        if self.config.OPENAI_API_KEY:
            self.providers["openai"] = OpenAIProvider(self.config.OPENAI_API_KEY)
            
        if self.config.ANTHROPIC_API_KEY:
            self.providers["anthropic"] = AnthropicProvider(self.config.ANTHROPIC_API_KEY)
            
        if self.config.GOOGLE_API_KEY:
            self.providers["google"] = GoogleProvider(self.config.GOOGLE_API_KEY)
            
        if self.config.XAI_API_KEY:
            self.providers["xai"] = XAIProvider(self.config.XAI_API_KEY)
            
        logger.info("llm_providers_initialized", providers=list(self.providers.keys()))

    async def get_history(self, user_id: int) -> List[LLMMessage]:
        if not self.redis:
            return []
        
        key = f"chat:history:{user_id}"
        try:
            data = await self.redis.lrange(key, 0, -1)
            messages = []
            for item in data:
                msg_dict = json.loads(item)
                messages.append(LLMMessage(**msg_dict))
            return messages
        except Exception as e:
            logger.error("failed_to_get_history", error=str(e))
            return []

    async def add_to_history(self, user_id: int, message: LLMMessage):
        if not self.redis:
            return
            
        key = f"chat:history:{user_id}"
        try:
            await self.redis.rpush(key, json.dumps(asdict(message)))
            # Trim history to last 20 messages
            await self.redis.ltrim(key, -20, -1)
            # Set TTL
            await self.redis.expire(key, 86400) # 24 hours
        except Exception as e:
            logger.error("failed_to_add_history", error=str(e))

    async def inject_context(self, user_id: int, context_message: str):
        """Inject a system or context message into the history without triggering a response."""
        msg = LLMMessage(role="system", content=f"Context Injection: {context_message}")
        await self.add_to_history(user_id, msg)
        logger.info("context_injected", user_id=user_id)

    async def chat(self, user_id: int, message: str, provider_name: str = "openai", model: Optional[str] = None) -> str:
        if provider_name not in self.providers:
            if "openai" in self.providers:
                provider_name = "openai"
            elif self.providers:
                provider_name = list(self.providers.keys())[0]
            else:
                return "No LLM providers configured."

        provider = self.providers[provider_name]
        
        # Get history
        history = await self.get_history(user_id)
        
        # Add user message
        user_msg = LLMMessage(role="user", content=message)
        history.append(user_msg)
        await self.add_to_history(user_id, user_msg)
        
        # Generate response
        try:
            response_text = await provider.generate_response(history, model=model)
            
            # Add assistant message
            assistant_msg = LLMMessage(role="assistant", content=response_text)
            await self.add_to_history(user_id, assistant_msg)
            
            return response_text
        except Exception as e:
            return f"Error from {provider_name}: {str(e)}"

    async def generate_structured(self, prompt: str, schema: Dict[str, Any], provider_name: str = "openai", system_prompt: str = "You are a helpful assistant.") -> Dict[str, Any]:
        """Generate a structured response for internal analysis tools."""
        if provider_name not in self.providers:
             if "openai" in self.providers:
                provider_name = "openai"
             elif self.providers:
                provider_name = list(self.providers.keys())[0]
             else:
                raise Exception("No LLM providers configured")
        
        provider = self.providers[provider_name]
        messages = [LLMMessage(role="user", content=prompt)]
        
        return await provider.generate_structured_response(messages, schema, system_prompt)

    async def get_available_models(self) -> Dict[str, List[str]]:
        """Get available models grouped by provider."""
        models = {}
        for name, provider in self.providers.items():
            models[name] = await provider.get_available_models()
        return models
