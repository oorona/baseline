import structlog
import json
import asyncio
import time
import aiohttp
from abc import ABC, abstractmethod
from typing import List, Dict, Optional, Any, Union, Callable
from dataclasses import dataclass, asdict, field
from datetime import datetime

# Optional imports - may not be installed
try:
    from openai import AsyncOpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    AsyncOpenAI = None

try:
    import anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False
    anthropic = None

# Import the Gemini service
from .gemini import (
    GeminiService, GeminiModel, ThinkingLevel, CapabilityType,
    UsageMetadata, GenerationResult, create_gemini_service,
    GENAI_AVAILABLE,
)

from sqlalchemy import Column, String, BigInteger, Float, DateTime, select
from sqlalchemy.orm import declarative_base

# Define Base for database models if not imported
Base = declarative_base()

class LLMUsage(Base):
    __tablename__ = "llm_usage"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    guild_id = Column(BigInteger, nullable=True) 
    user_id = Column(BigInteger, nullable=True)
    cost = Column(Float, default=0.0)
    tokens = Column(BigInteger, default=0) 
    prompt_tokens = Column(BigInteger, default=0)
    completion_tokens = Column(BigInteger, default=0)
    thoughts_tokens = Column(BigInteger, default=0)
    cached_tokens = Column(BigInteger, default=0)
    provider = Column(String, nullable=False)
    model = Column(String, nullable=False)
    request_type = Column(String, default="text") 
    capability_type = Column(String, nullable=True)
    latency = Column(Float, default=0.0)
    timestamp = Column(DateTime(timezone=True))
    context_id = Column(String, nullable=True)
    thinking_level = Column(String, nullable=True)
    image_count = Column(BigInteger, default=0)
    audio_duration_seconds = Column(Float, default=0.0)

class LLMModelPricing(Base):
    __tablename__ = "llm_model_pricing"
    id = Column(BigInteger, primary_key=True)
    provider = Column(String)
    model = Column(String)
    input_cost_per_1k = Column(Float)
    output_cost_per_1k = Column(Float)
    cached_cost_per_1k = Column(Float)
    image_cost = Column(Float)
    audio_cost_per_minute = Column(Float)

logger = structlog.get_logger()

@dataclass
class LLMContent:
    type: str # text, image_url, audio_url, file_uri, blob
    data: Any # str, or bytes if needed, but usually url or uri
    mime_type: Optional[str] = None
    blob: Optional[bytes] = None

@dataclass
class LLMMessage:
    role: str
    parts: List[LLMContent] = field(default_factory=list)
    
    def __init__(self, role: str, content: Union[str, List[LLMContent]] = None, parts: List[LLMContent] = None):
        self.role = role
        if parts:
            self.parts = parts
        elif isinstance(content, str):
            self.parts = [LLMContent(type="text", data=content)]
        elif isinstance(content, list):
            self.parts = content
        else:
            self.parts = []
            
    @property
    def content(self) -> str:
        """Returns text content only, for backward compatibility."""
        return " ".join([str(p.data) for p in self.parts if p.type == "text"])

class LLMProvider(ABC):
    @abstractmethod
    async def generate_response(self, messages: List[LLMMessage], system_prompt: str = "You are a helpful assistant.", model: Optional[str] = None, tools: Optional[List[Dict]] = None, config: Optional[Dict] = None) -> Union[str, Dict]:
        pass

    @abstractmethod
    async def generate_structured_response(self, messages: List[LLMMessage], schema: Dict[str, Any], system_prompt: str = "You are a helpful assistant.", model: Optional[str] = None) -> Dict[str, Any]:
        pass

    @abstractmethod
    async def get_available_models(self) -> List[str]:
        return []

    async def count_tokens(self, messages: List[LLMMessage], model: Optional[str] = None) -> int:
        return 0
        
    async def embed_content(self, content: Union[str, List[str]], model: Optional[str] = None) -> List[float]:
        return []

    async def generate_image(self, prompt: str, model: Optional[str] = None, number: int = 1) -> List[str]:
        """Returns list of image URLs or base64 strings."""
        return []

class OpenAIProvider(LLMProvider):
    def __init__(self, api_key: str, model: str = "gpt-3.5-turbo-0125"):
        self.client = AsyncOpenAI(api_key=api_key)
        self.model = model

    async def get_available_models(self) -> List[str]:
        return ["gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo-0125"]

    async def generate_response(self, messages: List[LLMMessage], system_prompt: str = "You are a helpful assistant.", model: Optional[str] = None, tools: Optional[List[Dict]] = None, config: Optional[Dict] = None) -> str:
        formatted_messages = [{"role": "system", "content": system_prompt}]
        for msg in messages:
            formatted_messages.append({"role": msg.role, "content": msg.content})
        
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
        for msg in messages:
            formatted_messages.append({"role": msg.role, "content": msg.content})
        
        try:
            response = await self.client.chat.completions.create(
                model=model or self.model,
                messages=formatted_messages,
                response_format={"type": "json_object"}
            )
            return json.loads(response.choices[0].message.content)
        except Exception as e:
            logger.error("openai_structured_generation_failed", error=str(e), model=self.model)
            raise e

    async def generate_image(self, prompt: str, model: Optional[str] = "dall-e-3", number: int = 1) -> List[str]:
        try:
            response = await self.client.images.generate(
                model=model,
                prompt=prompt,
                n=number,
                size="1024x1024"
            )
            return [img.url for img in response.data]
        except Exception as e:
            logger.error("openai_image_generation_failed", error=str(e))
            raise e

class GoogleProvider(LLMProvider):
    """
    Google/Gemini LLM Provider.

    Uses the google-genai SDK via GeminiService for full Gemini capabilities:
    - Text generation with configurable thinking levels & budgets
    - Image generation
    - Speech generation (TTS)
    - Audio understanding
    - File search (RAG)
    - URL context
    - Content caching

    See: docs/GEMINI_CAPABILITIES.md for full documentation.
    """

    def __init__(self, api_key: str, model: str = "gemini-2.5-flash"):
        self.api_key = api_key
        self.model_name = model
        self._usage_callback: Optional[Callable[[UsageMetadata], None]] = None

        self.gemini_service = create_gemini_service(
            api_key=api_key,
            default_model=model
        )
        self.gemini_service.set_usage_callback(self._handle_usage)
        self.model = None
    
    def _handle_usage(self, usage: UsageMetadata):
        """Handle usage reports from GeminiService."""
        if self._usage_callback:
            self._usage_callback(usage)
    
    def set_usage_callback(self, callback: Callable[[UsageMetadata], None]):
        """Set callback for usage tracking."""
        self._usage_callback = callback
        self.gemini_service.set_usage_callback(callback)

    async def get_available_models(self) -> List[str]:
        """List available Gemini models."""
        return [
            GeminiModel.GEMINI_3_FLASH.value,
            GeminiModel.GEMINI_3_PRO.value,
            GeminiModel.GEMINI_3_PRO_IMAGE.value,
            GeminiModel.GEMINI_25_FLASH.value,
            GeminiModel.GEMINI_25_PRO.value,
        ]

    async def generate_response(
        self,
        messages: List[LLMMessage],
        system_prompt: str = "You are a helpful assistant.",
        model: Optional[str] = None,
        tools: Optional[List[Dict]] = None,
        config: Optional[Dict] = None
    ) -> str:
        """Generate a text response."""
        target_model = model or self.model_name

        prompt_parts = []
        for msg in messages:
            for part in msg.parts:
                if part.type == "text":
                    prompt_parts.append(part.data)
                elif part.type == "blob" and part.blob:
                    from .gemini import GeminiContent
                    prompt_parts.append(GeminiContent(
                        type="image",
                        data=part.blob,
                        mime_type=part.mime_type
                    ))

        thinking_level = None
        if config and "thinking_level" in config:
            thinking_level = ThinkingLevel(config["thinking_level"])

        result = await self.gemini_service.generate_text(
            prompt=prompt_parts if len(prompt_parts) > 1 else prompt_parts[0] if prompt_parts else "",
            model=target_model,
            system_instruction=system_prompt,
            thinking_level=thinking_level,
            tools=tools
        )
        return result.text or ""

    async def generate_structured_response(
        self,
        messages: List[LLMMessage],
        schema: Dict[str, Any],
        system_prompt: str = "You are a helpful assistant.",
        model: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate structured JSON output."""
        target_model = model or self.model_name
        prompt = " ".join(msg.content for msg in messages)
        return await self.gemini_service.generate_structured(
            prompt=prompt,
            schema=schema,
            model=target_model,
            system_instruction=system_prompt
        )

    async def count_tokens(self, messages: List[LLMMessage], model: Optional[str] = None) -> int:
        """Count tokens in messages."""
        target_model = model or self.model_name
        text = " ".join(msg.content for msg in messages)
        return await self.gemini_service.count_tokens(text, model=target_model)

    async def embed_content(
        self,
        content: Union[str, List[str]],
        model: Optional[str] = None
    ) -> Union[List[float], List[List[float]]]:
        """Generate embeddings."""
        return await self.gemini_service.generate_embeddings(content)

    async def generate_image(
        self,
        prompt: str,
        model: Optional[str] = None,
        number: int = 1
    ) -> List[str]:
        """Generate images using Gemini image models."""
        from .gemini import ImageAspectRatio
        result = await self.gemini_service.generate_image(
            prompt=prompt,
            model=model or GeminiModel.GEMINI_25_FLASH_IMAGE.value
        )
        import base64
        return [base64.b64encode(img).decode() for img in result.images]

    # =========================================================================
    # GEMINI ENHANCED CAPABILITIES
    # =========================================================================
    
    async def generate_with_thinking(
        self,
        prompt: str,
        thinking_level: ThinkingLevel = ThinkingLevel.HIGH,
        include_thoughts: bool = False,
        model: Optional[str] = None
    ) -> GenerationResult:
        """
        Generate text with Gemini 3 thinking/reasoning.
        
        Args:
            prompt: The prompt text
            thinking_level: Depth of reasoning (MINIMAL, LOW, MEDIUM, HIGH)
            include_thoughts: Include thought summaries in response
            model: Model to use
            
        Returns:
            GenerationResult with text and optional thoughts
        """
        return await self.gemini_service.generate_text(
            prompt=prompt,
            model=model or GeminiModel.GEMINI_3_FLASH.value,
            thinking_level=thinking_level,
            include_thoughts=include_thoughts
        )
    
    async def understand_image(
        self,
        image: Union[bytes, str],
        prompt: str = "Describe this image in detail.",
        detect_objects: bool = False,
        model: Optional[str] = None
    ) -> GenerationResult:
        """
        Analyze and understand images.
        
        Args:
            image: Image bytes or URL
            prompt: Question about the image
            detect_objects: Return bounding boxes
            model: Model to use
        """
        return await self.gemini_service.understand_image(
            image=image,
            prompt=prompt,
            model=model,
            detect_objects=detect_objects
        )
    
    async def generate_speech(
        self,
        text: str,
        voice: str = "Kore",
        model: Optional[str] = None
    ) -> bytes:
        """
        Generate speech audio from text.
        
        Args:
            text: Text to speak
            voice: Voice name (Kore, Puck, Zephyr, etc.)
            model: TTS model
            
        Returns:
            WAV audio bytes
        """
        return await self.gemini_service.generate_speech(
            text=text,
            voice=voice,
            model=model or GeminiModel.GEMINI_TTS_FLASH.value
        )
    
    async def understand_audio(
        self,
        audio: Union[bytes, str],
        prompt: str = "Transcribe this audio.",
        model: Optional[str] = None
    ) -> GenerationResult:
        """
        Analyze and transcribe audio.
        
        Args:
            audio: Audio bytes or file path
            prompt: Instructions for analysis
            model: Model to use
        """
        return await self.gemini_service.understand_audio(
            audio=audio,
            prompt=prompt,
            model=model
        )
    
    async def generate_with_urls(
        self,
        prompt: str,
        urls: Optional[List[str]] = None,
        model: Optional[str] = None
    ) -> GenerationResult:
        """
        Generate with URL context grounding.
        
        Args:
            prompt: Prompt that may reference URLs
            urls: URLs to analyze
            model: Model to use
        """
        return await self.gemini_service.generate_with_urls(
            prompt=prompt,
            urls=urls,
            model=model
        )

class LLMService:
    def __init__(self, config):
        self.config = config
        self.providers: Dict[str, LLMProvider] = {}
        self.redis = None 
        self.db_session_factory = None
        self.http_session = None
        self._initialize_providers()

    def set_redis(self, redis_client):
        self.redis = redis_client
        
    def set_db_session_factory(self, session_factory):
        self.db_session_factory = session_factory

    def set_http_session(self, session):
        self.http_session = session

    def _initialize_providers(self):
        # Only initialize providers that are both configured AND installed
        if self.config.OPENAI_API_KEY and OPENAI_AVAILABLE:
            self.providers["openai"] = OpenAIProvider(self.config.OPENAI_API_KEY)
        if self.config.GOOGLE_API_KEY and GENAI_AVAILABLE:
            self.providers["google"] = GoogleProvider(self.config.GOOGLE_API_KEY)
        logger.info("llm_providers_initialized", providers=list(self.providers.keys()))

    async def _record_usage(self, provider: str, model: str, prompt_tokens: int, completion_tokens: int, guild_id: int = None, user_id: int = None, request_type: str = "text", duration: float = 0.0):
        if not self.db_session_factory: return
        try:
            async with self.db_session_factory() as session:
                usage = LLMUsage(
                    guild_id=guild_id, user_id=user_id, provider=provider, model=model,
                    prompt_tokens=prompt_tokens, completion_tokens=completion_tokens,
                    tokens=prompt_tokens + completion_tokens, cost=0.0,
                    request_type=request_type, latency=duration, timestamp=datetime.now()
                )
                session.add(usage)
                await session.commit()
        except Exception as e:
            logger.error("failed_to_record_llm_usage", error=str(e))

    async def get_history(self, user_id: int) -> List[LLMMessage]:
        if not self.redis: return []
        key = f"chat:history:{user_id}"
        try:
            data = await self.redis.lrange(key, 0, -1)
            messages = []
            for item in data:
                msg_dict = json.loads(item)
                # Handle conversion from old history if needed
                if "parts" not in msg_dict:
                     msg_dict["parts"] = [LLMContent(type="text", data=msg_dict.get("content", ""))]
                else:
                     # Reconstruct LLMContent objects
                     msg_dict["parts"] = [LLMContent(**p) for p in msg_dict["parts"]]
                messages.append(LLMMessage(role=msg_dict["role"], parts=msg_dict["parts"]))
            return messages
        except Exception:
            return []

    async def add_to_history(self, user_id: int, message: LLMMessage):
        if not self.redis: return
        key = f"chat:history:{user_id}"
        safe_parts = []
        for p in message.parts:
            if p.type == "blob":
                safe_parts.append(LLMContent(type="text", data="[Image Blob]"))
            else:
                safe_parts.append(p)
        
        safe_msg = LLMMessage(role=message.role, parts=safe_parts)
        
        try:
            msg_dict = asdict(safe_msg)
            await self.redis.rpush(key, json.dumps(msg_dict))
            await self.redis.ltrim(key, -20, -1)
            await self.redis.expire(key, 86400)
        except Exception as e:
            logger.error("failed_to_add_history", error=str(e))

    async def _resolve_content(self, message: Union[str, List[LLMContent]]) -> List[LLMContent]:
        if isinstance(message, str):
            return [LLMContent(type="text", data=message)]
            
        resolved_parts = []
        for part in message:
            if part.type == "image_url" and isinstance(part.data, str) and part.data.startswith("http") and not part.blob and self.http_session:
                try:
                    async with self.http_session.get(part.data) as resp:
                        if resp.status == 200:
                            data = await resp.read()
                            part.blob = data
                            part.mime_type = resp.headers.get("Content-Type", "image/jpeg")
                except Exception as e:
                    logger.error("failed_to_download_image", url=part.data, error=str(e))
            resolved_parts.append(part)
        return resolved_parts

    async def chat(self, user_id: int, message: Union[str, List[LLMContent]], provider_name: str = "google", model: Optional[str] = None, guild_id: int = None) -> str:
        if provider_name not in self.providers:
            if "google" in self.providers: provider_name = "google"
            elif self.providers: provider_name = list(self.providers.keys())[0]
            else: return "No LLM providers configured."

        provider = self.providers[provider_name]
        resolved_parts = await self._resolve_content(message)
        
        history = await self.get_history(user_id)
        
        user_msg = LLMMessage(role="user", parts=resolved_parts)
        history.append(user_msg)
        await self.add_to_history(user_id, user_msg)
        
        start_time = time.time()
        try:
            response_text = await provider.generate_response(history, model=model)
            duration = time.time() - start_time
            
            await self._record_usage(provider_name, model or "default", 0, 0, guild_id, user_id, "chat", duration)
            
            assistant_msg = LLMMessage(role="assistant", content=response_text)
            await self.add_to_history(user_id, assistant_msg)
            return response_text
        except Exception as e:
            return f"Error from {provider_name}: {str(e)}"

    def load_prompt(self, plugin_name: str, context: str, file_name: str) -> str:
        """Load a plugin prompt file from the shared data volume.

        Files are stored at:
          /data/prompts/{plugin_name}/{context}/{file_name}.txt

        The context is a purpose folder declared by the plugin (e.g. "ticket_intake",
        "faq_answers"). file_name is one of the files within that context, typically
        "system_prompt" or "user_prompt".

        Returns the file contents, or an empty string if the file is missing.
        Missing files are not errors — always supply a hardcoded fallback:

            system = self.llm.load_prompt("my_plugin", "ticket_intake", "system_prompt")
            user_tmpl = self.llm.load_prompt("my_plugin", "ticket_intake", "user_prompt")

            provider = self.llm.providers.get("google") or next(iter(self.llm.providers.values()))
            from bot.services.llm import LLMMessage
            response = await provider.generate_response(
                [LLMMessage(role="user", content=(user_tmpl or "{message}").format(message=query))],
                system_prompt=system or "You are a helpful assistant.",
            )
        """
        from pathlib import Path
        path = Path(f"/data/prompts/{plugin_name}/{context}/{file_name}.txt")
        if path.exists():
            return path.read_text()
        return ""

    async def generate_structured(self, prompt: str, schema: Dict[str, Any], provider_name: str = "google", system_prompt: str = "You are a helpful assistant.") -> Dict[str, Any]:
        if provider_name not in self.providers:
             if "google" in self.providers: provider_name = "google"
             else: raise Exception("No LLM providers configured")
        
        provider = self.providers[provider_name]
        messages = [LLMMessage(role="user", content=prompt)]
        
        return await provider.generate_structured_response(messages, schema, system_prompt=system_prompt)

    async def count_tokens(self, message: Union[str, List[LLMContent]], provider_name: str = "google", model: Optional[str] = None) -> int:
        if provider_name not in self.providers:
             if "google" in self.providers: provider_name = "google"
             else: return 0
        
        provider = self.providers[provider_name]
        resolved_parts = await self._resolve_content(message)
        msg = LLMMessage(role="user", parts=resolved_parts)
        return await provider.count_tokens([msg], model=model)

    async def get_available_models(self) -> Dict[str, List[str]]:
        models = {}
        for name, provider in self.providers.items():
            models[name] = await provider.get_available_models()
        return models

    async def generate_image(self, prompt: str, provider_name: str = "google", model: Optional[str] = None) -> List[str]:
         """Generate images. Prefers Google/Gemini for native image generation."""
         if provider_name not in self.providers:
             if "google" in self.providers: provider_name = "google"
             elif "openai" in self.providers: provider_name = "openai"
             else: return []
         return await self.providers[provider_name].generate_image(prompt, model)

    # =========================================================================
    # GEMINI 3 ENHANCED CAPABILITIES
    # These convenience methods expose Gemini-specific features directly
    # =========================================================================
    
    def _get_google_provider(self) -> GoogleProvider:
        """Get the Google provider, raising if not available."""
        if "google" not in self.providers:
            raise RuntimeError("Google provider not configured. Set GOOGLE_API_KEY.")
        return self.providers["google"]
    
    async def gemini_generate_with_thinking(
        self,
        prompt: str,
        thinking_level: ThinkingLevel = ThinkingLevel.HIGH,
        include_thoughts: bool = False,
        model: Optional[str] = None,
        guild_id: Optional[int] = None,
        user_id: Optional[int] = None
    ) -> GenerationResult:
        """
        Generate text with Gemini 3 thinking/reasoning.
        
        Args:
            prompt: The prompt text
            thinking_level: Depth of reasoning (MINIMAL, LOW, MEDIUM, HIGH)
            include_thoughts: Include thought summaries in response
            model: Model to use (defaults to gemini-3-flash-preview)
            guild_id: For usage tracking
            user_id: For usage tracking
            
        Returns:
            GenerationResult with text, thoughts, and usage metadata
            
        Example:
            ```python
            result = await llm_service.gemini_generate_with_thinking(
                "Solve this complex logic puzzle...",
                thinking_level=ThinkingLevel.HIGH,
                include_thoughts=True
            )
            print(result.text)
            print(f"Thinking: {result.thoughts_summary}")
            ```
        """
        provider = self._get_google_provider()
        result = await provider.generate_with_thinking(
            prompt=prompt,
            thinking_level=thinking_level,
            include_thoughts=include_thoughts,
            model=model
        )
        
        # Record enhanced usage
        if result.usage and self.db_session_factory:
            await self._record_enhanced_usage(
                result.usage, guild_id, user_id, thinking_level.value
            )
        
        return result
    
    async def gemini_generate_image(
        self,
        prompt: str,
        aspect_ratio: str = "1:1",
        model: Optional[str] = None,
        guild_id: Optional[int] = None,
        user_id: Optional[int] = None
    ) -> GenerationResult:
        """
        Generate images using Gemini (Nano Banana).
        
        Args:
            prompt: Description of the image
            aspect_ratio: Image aspect ratio (e.g., "16:9", "1:1")
            model: Image model to use
            
        Returns:
            GenerationResult with images as bytes
        """
        provider = self._get_google_provider()
        from .gemini import ImageAspectRatio
        ar = ImageAspectRatio(aspect_ratio) if aspect_ratio else ImageAspectRatio.SQUARE
        
        result = await provider.gemini_service.generate_image(
            prompt=prompt,
            aspect_ratio=ar,
            model=model or GeminiModel.GEMINI_25_FLASH_IMAGE.value
        )
        
        if result.usage and self.db_session_factory:
            await self._record_enhanced_usage(result.usage, guild_id, user_id)
        
        return result
    
    async def gemini_understand_image(
        self,
        image: Union[bytes, str],
        prompt: str = "Describe this image in detail.",
        detect_objects: bool = False,
        model: Optional[str] = None,
        guild_id: Optional[int] = None,
        user_id: Optional[int] = None
    ) -> GenerationResult:
        """
        Analyze images with Gemini vision capabilities.
        
        Args:
            image: Image bytes or URL
            prompt: Question or instruction about the image
            detect_objects: Return bounding boxes for detected objects
            
        Returns:
            GenerationResult with analysis
        """
        provider = self._get_google_provider()
        result = await provider.understand_image(
            image=image,
            prompt=prompt,
            detect_objects=detect_objects,
            model=model
        )
        
        if result.usage and self.db_session_factory:
            await self._record_enhanced_usage(result.usage, guild_id, user_id)
        
        return result
    
    async def gemini_generate_speech(
        self,
        text: str,
        voice: str = "Kore",
        model: Optional[str] = None,
        guild_id: Optional[int] = None,
        user_id: Optional[int] = None
    ) -> bytes:
        """
        Generate speech audio from text.
        
        Args:
            text: Text to speak (can include style directions)
            voice: Voice name (Kore, Puck, Zephyr, etc.)
            
        Returns:
            WAV audio bytes
        """
        provider = self._get_google_provider()
        audio = await provider.generate_speech(text=text, voice=voice, model=model)
        
        # Record usage estimate
        if self.db_session_factory:
            usage = UsageMetadata(
                capability_type=CapabilityType.SPEECH_GENERATION,
                model=model or GeminiModel.GEMINI_TTS_FLASH.value,
                prompt_tokens=len(text.split()) * 2
            )
            await self._record_enhanced_usage(usage, guild_id, user_id)
        
        return audio
    
    async def gemini_understand_audio(
        self,
        audio: Union[bytes, str],
        prompt: str = "Transcribe this audio.",
        detect_speakers: bool = False,
        model: Optional[str] = None,
        guild_id: Optional[int] = None,
        user_id: Optional[int] = None
    ) -> GenerationResult:
        """
        Analyze and transcribe audio.
        
        Args:
            audio: Audio bytes or file path
            prompt: Instructions for analysis
            detect_speakers: Identify different speakers
            
        Returns:
            GenerationResult with transcript
        """
        provider = self._get_google_provider()
        result = await provider.gemini_service.understand_audio(
            audio=audio,
            prompt=prompt,
            model=model,
            detect_speakers=detect_speakers
        )
        
        if result.usage and self.db_session_factory:
            await self._record_enhanced_usage(result.usage, guild_id, user_id)
        
        return result
    
    async def gemini_generate_embeddings(
        self,
        content: Union[str, List[str]],
        task_type: str = "RETRIEVAL_DOCUMENT",
        guild_id: Optional[int] = None,
        user_id: Optional[int] = None
    ) -> Union[List[float], List[List[float]]]:
        """
        Generate embeddings for text content.
        
        Args:
            content: Text or list of texts
            task_type: Embedding task type for optimization
            
        Returns:
            Embedding vector(s)
        """
        provider = self._get_google_provider()
        from .gemini import EmbeddingTaskType
        try:
            tt = EmbeddingTaskType(task_type)
        except ValueError:
            tt = EmbeddingTaskType.RETRIEVAL_DOCUMENT
        
        return await provider.gemini_service.generate_embeddings(
            content=content,
            task_type=tt
        )
    
    async def gemini_generate_with_urls(
        self,
        prompt: str,
        urls: Optional[List[str]] = None,
        model: Optional[str] = None,
        guild_id: Optional[int] = None,
        user_id: Optional[int] = None
    ) -> GenerationResult:
        """
        Generate with URL context grounding.
        
        Args:
            prompt: Prompt that references URLs
            urls: Optional explicit list of URLs
            
        Returns:
            GenerationResult with grounding metadata
        """
        provider = self._get_google_provider()
        result = await provider.generate_with_urls(
            prompt=prompt,
            urls=urls,
            model=model
        )
        
        if result.usage and self.db_session_factory:
            await self._record_enhanced_usage(result.usage, guild_id, user_id)
        
        return result
    
    async def _record_enhanced_usage(
        self,
        usage: UsageMetadata,
        guild_id: Optional[int] = None,
        user_id: Optional[int] = None,
        thinking_level: Optional[str] = None
    ):
        """Record enhanced usage metrics from Gemini operations."""
        if not self.db_session_factory:
            return
        
        try:
            async with self.db_session_factory() as session:
                usage_record = LLMUsage(
                    guild_id=guild_id,
                    user_id=user_id,
                    provider="google",
                    model=usage.model,
                    prompt_tokens=usage.prompt_tokens,
                    completion_tokens=usage.completion_tokens,
                    thoughts_tokens=usage.thoughts_tokens,
                    cached_tokens=usage.cached_tokens,
                    tokens=usage.total_tokens,
                    cost=usage.estimated_cost,
                    capability_type=usage.capability_type.value if usage.capability_type else None,
                    request_type=usage.capability_type.value if usage.capability_type else "text",
                    latency=usage.latency_ms / 1000,
                    timestamp=usage.timestamp,
                    thinking_level=thinking_level
                )
                session.add(usage_record)
                await session.commit()
        except Exception as e:
            logger.error("failed_to_record_enhanced_usage", error=str(e))
