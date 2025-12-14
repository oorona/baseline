import structlog
import json
import asyncio
from abc import ABC, abstractmethod
from typing import List, Dict, Optional, Any
from dataclasses import dataclass, asdict
from sqlalchemy.orm import Session
from sqlalchemy import select
from redis.asyncio import Redis 

from app.core.config import settings
from app.models import LLMUsage, LLMModelPricing

from openai import AsyncOpenAI
import anthropic
import google.generativeai as genai

logger = structlog.get_logger()

@dataclass
class LLMMessage:
    role: str
    content: str
    name: Optional[str] = None

@dataclass
class LLMResponse:
    content: str
    usage: Dict[str, int]
    cost: float = 0.0

class LLMProvider(ABC):
    @abstractmethod
    async def generate_response(self, messages: List[LLMMessage], system_prompt: str = "You are a helpful assistant.", model: Optional[str] = None) -> LLMResponse:
        pass

    @abstractmethod
    async def get_available_models(self) -> List[str]:
        return []

class OpenAIProvider(LLMProvider):
    def __init__(self, api_key: str, model: str = "gpt-3.5-turbo-0125"):
        self.client = AsyncOpenAI(api_key=api_key)
        self.model = model

    async def get_available_models(self) -> List[str]:
        try:
            models_page = await self.client.models.list()
            return [m.id for m in models_page.data if m.id.startswith("gpt")]
        except Exception as e:
            logger.error("openai_list_models_failed", error=str(e))
            return ["gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo-0125"]

    async def generate_response(self, messages: List[LLMMessage], system_prompt: str = "You are a helpful assistant.", model: Optional[str] = None) -> LLMResponse:
        formatted_messages = [{"role": "system", "content": system_prompt}]
        for msg in messages:
            m = {"role": msg.role, "content": msg.content}
            if msg.name:
                m["name"] = msg.name
            formatted_messages.append(m)
        
        target_model = model or self.model
        try:
            response = await self.client.chat.completions.create(
                model=target_model,
                messages=formatted_messages
            )
            content = response.choices[0].message.content
            usage = {
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
                "total_tokens": response.usage.total_tokens
            }
            return LLMResponse(content=content, usage=usage)
        except Exception as e:
            logger.error("openai_generation_failed", error=str(e), model=target_model)
            raise e

class XAIProvider(LLMProvider):
    def __init__(self, api_key: str, model: str = "grok-2-1212"):
        self.client = AsyncOpenAI(api_key=api_key, base_url="https://api.x.ai/v1")
        self.model = model

    async def get_available_models(self) -> List[str]:
        return ["grok-2-1212", "grok-2-vision-1212", "grok-beta"]

    async def generate_response(self, messages: List[LLMMessage], system_prompt: str = "You are a helpful assistant.", model: Optional[str] = None) -> LLMResponse:
        formatted_messages = [{"role": "system", "content": system_prompt}]
        for msg in messages:
            m = {"role": msg.role, "content": msg.content}
            if msg.name:
                m["name"] = msg.name
            formatted_messages.append(m)
        
        target_model = model or self.model
        try:
            response = await self.client.chat.completions.create(
                model=target_model,
                messages=formatted_messages
            )
            content = response.choices[0].message.content
            usage = {
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
                "total_tokens": response.usage.total_tokens
            }
            return LLMResponse(content=content, usage=usage)
        except Exception as e:
            logger.error("xai_generation_failed", error=str(e), model=target_model)
            raise e

class AnthropicProvider(LLMProvider):
    def __init__(self, api_key: str, model: str = "claude-3-opus-20240229"):
        self.client = anthropic.AsyncAnthropic(api_key=api_key)
        self.model = model

    async def get_available_models(self) -> List[str]:
        return ["claude-3-5-sonnet-20240620", "claude-3-opus-20240229", "claude-3-sonnet-20240229"]

    async def generate_response(self, messages: List[LLMMessage], system_prompt: str = "You are a helpful assistant.", model: Optional[str] = None) -> LLMResponse:
        formatted_messages = []
        for msg in messages:
            if msg.role == "system": continue
            # Claude doesn't strictly allow 'name' in messages API usually, but we can prefix content
            content = msg.content
            if msg.name:
                content = f"{msg.name}: {content}"
            formatted_messages.append({"role": msg.role, "content": content})
            
        target_model = model or self.model
        try:
            response = await self.client.messages.create(
                model=target_model,
                max_tokens=1024,
                system=system_prompt,
                messages=formatted_messages
            )
            content = response.content[0].text
            usage = {
                "prompt_tokens": response.usage.input_tokens,
                "completion_tokens": response.usage.output_tokens,
                "total_tokens": response.usage.input_tokens + response.usage.output_tokens
            }
            return LLMResponse(content=content, usage=usage)
        except Exception as e:
            logger.error("anthropic_generation_failed", error=str(e), model=target_model)
            raise e

class GoogleProvider(LLMProvider):
    def __init__(self, api_key: str, model: str = "gemini-1.5-flash"):
        genai.configure(api_key=api_key)
        self.model_name = model
        self.model = genai.GenerativeModel(model)

    async def get_available_models(self) -> List[str]:
        return ["gemini-1.5-flash", "gemini-1.5-pro"]

    async def generate_response(self, messages: List[LLMMessage], system_prompt: str = "You are a helpful assistant.", model: Optional[str] = None) -> LLMResponse:
        history = []
        for msg in messages[:-1]:
            role = "user" if msg.role == "user" else "model"
            content = msg.content
            if msg.name:
                content = f"[{msg.name}] {content}"
            history.append({"role": role, "parts": [content]})
            
        last_msg = messages[-1]
        last_content = last_msg.content
        if last_msg.name:
             last_content = f"[{last_msg.name}] {last_content}"

        target_model_name = model or self.model_name
        
        try:
            loop = asyncio.get_running_loop()
            def _generate():
                target_model = self.model
                if model and model != self.model_name:
                    target_model = genai.GenerativeModel(model)
                
                chat = target_model.start_chat(history=history)
                prompt = f"System Instruction: {system_prompt}\n\nUser: {last_content}"
                response = chat.send_message(prompt)
                return response

            response = await loop.run_in_executor(None, _generate)
            content = response.text
            
            # Gemini usage metadata might detailed in newer versions, assuming standard access
            usage = {
                "prompt_tokens": response.usage_metadata.prompt_token_count,
                "completion_tokens": response.usage_metadata.candidates_token_count,
                "total_tokens": response.usage_metadata.total_token_count
            }
            return LLMResponse(content=content, usage=usage)
        except Exception as e:
            logger.error("google_generation_failed", error=str(e), model=target_model_name)
            raise e

class LLMService:
    def __init__(self):
        self.providers: Dict[str, LLMProvider] = {}
        self._initialize_providers()

    def _initialize_providers(self):
        if settings.OPENAI_API_KEY:
            self.providers["openai"] = OpenAIProvider(settings.OPENAI_API_KEY)
        if settings.ANTHROPIC_API_KEY:
            self.providers["anthropic"] = AnthropicProvider(settings.ANTHROPIC_API_KEY)
        if settings.GOOGLE_API_KEY:
            self.providers["google"] = GoogleProvider(settings.GOOGLE_API_KEY)
        if settings.XAI_API_KEY:
            self.providers["xai"] = XAIProvider(settings.XAI_API_KEY)
        logger.info("llm_providers_initialized", providers=list(self.providers.keys()))

    async def _track_usage(self, db: Session, user_id: int, guild_id: Optional[int], provider: str, model: str, usage: Dict[str, int], context_id: str = None):
        """Track LLM usage in the database."""
        try:
            # 1. Calculate Cost
            pricing_stmt = select(LLMModelPricing).where(
                LLMModelPricing.provider == provider, 
                LLMModelPricing.model == model
            )
            result = await db.execute(pricing_stmt)
            pricing = result.scalar_one_or_none()
            
            cost = 0.0
            if pricing:
                input_cost = (usage["prompt_tokens"] / 1000) * pricing.input_cost_per_1k
                output_cost = (usage["completion_tokens"] / 1000) * pricing.output_cost_per_1k
                cost = input_cost + output_cost

            # 2. Insert Record
            record = LLMUsage(
                user_id=user_id,
                guild_id=guild_id,
                context_id=context_id,
                provider=provider,
                model=model,
                tokens=usage["total_tokens"],
                prompt_tokens=usage["prompt_tokens"],
                completion_tokens=usage["completion_tokens"],
                cost=cost,
                request_type="chat" if context_id else "text"
            )
            db.add(record)
            await db.commit()
        except Exception as e:
            logger.error("track_usage_failed", error=str(e))

    async def get_history(self, redis: Redis, context_id: str) -> List[LLMMessage]:
        if not redis: return []
        key = f"chat:context:{context_id}"
        try:
            data = await redis.lrange(key, 0, -1)
            return [LLMMessage(**json.loads(item)) for item in data]
        except Exception:
            return []

    async def add_to_history(self, redis: Redis, context_id: str, message: LLMMessage, max_messages: int = 20):
        if not redis: return
        key = f"chat:context:{context_id}"
        try:
            await redis.rpush(key, json.dumps(asdict(message)))
            if max_messages > 0:
                await redis.ltrim(key, -max_messages, -1)
            await redis.expire(key, 86400 * 7) # 7 days retention
        except Exception as e:
            logger.error("add_history_failed", error=str(e))

    async def chat(self, db: Session, redis: Redis, user_id: int, message: str, context_id: str, name: Optional[str] = None, provider_name: str = "openai", model: Optional[str] = None, guild_id: Optional[int] = None) -> str:
        """
        Multi-turn chat with context and usage tracking.
        """
        if provider_name not in self.providers:
             if self.providers: provider_name = list(self.providers.keys())[0]
             else: return "No LLM providers configured."

        provider = self.providers[provider_name]
        
        # history
        history = await self.get_history(redis, context_id)
        
        # User message
        user_msg = LLMMessage(role="user", content=message, name=name)
        history.append(user_msg)
        await self.add_to_history(redis, context_id, user_msg)
        
        # Generate
        try:
            response = await provider.generate_response(history, model=model)
            
            # Assistant message
            assistant_msg = LLMMessage(role="assistant", content=response.content)
            await self.add_to_history(redis, context_id, assistant_msg)
            
            # Track Usage
            await self._track_usage(db, user_id, guild_id, provider_name, model or provider.model, response.usage, context_id)
            
            return response.content
        except Exception as e:
            logger.error("chat_failed", error=str(e))
            return f"Error: {str(e)}"

    async def generate_text(self, db: Session, user_id: int, prompt: str, system_prompt: str = "You are a helpful assistant.", provider_name: str = "openai", model: Optional[str] = None, guild_id: Optional[int] = None) -> str:
        """Single turn text generation."""
        if provider_name not in self.providers:
             if self.providers: provider_name = list(self.providers.keys())[0]
             else: return "No LLM providers configured."

        provider = self.providers[provider_name]
        msg = LLMMessage(role="user", content=prompt)
        
        try:
            response = await provider.generate_response([msg], system_prompt, model=model)
            
            await self._track_usage(db, user_id, guild_id, provider_name, model or provider.model, response.usage, context_id=None)
            
            return response.content
        except Exception as e:
            logger.error("generate_text_failed", error=str(e))
            return f"Error: {str(e)}"

    async def get_available_models(self) -> Dict[str, List[str]]:
        models = {}
        for name, provider in self.providers.items():
            models[name] = await provider.get_available_models()
        return models
