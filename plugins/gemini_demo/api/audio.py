"""
Gemini Audio API Module
=======================

This module provides comprehensive audio-related Gemini API endpoints.

**Text-to-Speech (TTS)**
========================
- Single Voice: Generate speech with one of 30 prebuilt voices
- Multi-Speaker: Generate dialogue with multiple voices (max 2 speakers)
- Style Control: Natural language prompts control tone, pace, accent

**TTS Models:**
- gemini-2.5-flash-preview-tts: Fast generation, lower cost ($0.50/1M tokens)
- gemini-2.5-pro-preview-tts: High-quality, expressive ($2.00/1M tokens)

**TTS Output:** WAV format, 24kHz, mono, 16-bit

**24 Supported Languages (auto-detected):**
ar-EG (Arabic), bn-BD (Bengali), de-DE (German), en-IN (English India),
en-US (English US), es-US (Spanish), fr-FR (French), hi-IN (Hindi),
id-ID (Indonesian), it-IT (Italian), ja-JP (Japanese), ko-KR (Korean),
mr-IN (Marathi), nl-NL (Dutch), pl-PL (Polish), pt-BR (Portuguese),
ro-RO (Romanian), ru-RU (Russian), ta-IN (Tamil), te-IN (Telugu),
th-TH (Thai), tr-TR (Turkish), uk-UA (Ukrainian), vi-VN (Vietnamese)

**Prompting Structure for TTS:**
1. Audio Profile - Character name and role/archetype
2. Scene - Location, mood, environment description
3. Director's Notes - Style, pacing, accent instructions
4. Transcript - The text to speak

**Audio Understanding**
=======================
- Transcription: Speech to text with speaker diarization
- Translation: Auto-detect language and translate
- Emotion Detection: happy, sad, angry, neutral
- Timestamp Extraction: MM:SS format, range support
- Sound Understanding: Music, birdsong, sirens, etc.

**Audio Understanding Models:**
- gemini-3-flash-preview: Fast processing
- gemini-3-pro-preview: Best quality

**Technical Details:**
- Token Rate: 32 tokens per second of audio
- Max Duration: 9.5 hours per prompt
- Resolution: Downsampled to 16 Kbps
- Channels: Multi-channel combined to mono

**Supported Audio Formats:**
- WAV (audio/wav)
- MP3 (audio/mp3)
- AIFF (audio/aiff)
- AAC (audio/aac)
- OGG Vorbis (audio/ogg)
- FLAC (audio/flac)

Documentation:
- Speech Generation: https://ai.google.dev/gemini-api/docs/speech-generation
- Audio Understanding: https://ai.google.dev/gemini-api/docs/audio

30 TTS Voices (voice_name options):
- Zephyr (Bright), Puck (Upbeat), Charon (Informative)
- Kore (Firm), Fenrir (Excitable), Leda (Youthful)
- Orus (Firm), Aoede (Breezy), Callirrhoe (Easy-going)
- Autonoe (Bright), Enceladus (Breathy), Iapetus (Clear)
- Umbriel (Easy-going), Algieba (Smooth), Despina (Smooth)
- Erinome (Clear), Algenib (Gravelly), Rasalgethi (Informative)
- Laomedeia (Upbeat), Achernar (Soft), Alnilam (Firm)
- Schedar (Even), Gacrux (Mature), Pulcherrima (Forward)
- Achird (Friendly), Zubenelgenubi (Casual), Vindemiatrix (Gentle)
- Sadachbia (Lively), Sadaltager (Knowledgeable), Sulafat (Warm)
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List

from app.api.deps import get_current_user
from app.core.limiter import limiter
from app.api.gemini._common import (
    UsageStats,
    extract_usage,
    TTS_VOICES,
    SUPPORTED_AUDIO_FORMATS,
    logger
)

router = APIRouter(tags=["gemini-audio"])


# ============================================================================
# Request Schemas
# ============================================================================

class TTSRequest(BaseModel):
    """
    Text-to-speech request.
    
    **Prompting Structure (for best results):**
    1. Audio Profile: Character name + role/archetype
    2. Scene: Location, mood, environment
    3. Director's Notes: Style, pacing, accent
    4. Transcript: Text to speak
    
    **Example Director's Notes prompt:**
    ```
    # AUDIO PROFILE: Jaz R.
    ## "The Morning Hype"
    
    ## THE SCENE: The London Studio
    It is 10:00 PM in a glass-walled studio overlooking the moonlit London skyline.
    
    ### DIRECTOR'S NOTES
    Style: Bright, infectious enthusiasm with "Vocal Smile"
    Pacing: Energetic, bouncing cadence, no dead air
    Accent: Brixton, London
    
    ### TRANSCRIPT
    Yes, massive vibes in the studio! You are locked in!
    ```
    
    **Voice Options (30):**
    - Zephyr: Bright, effervescent, clear
    - Puck: Upbeat, jovial, animated
    - Charon: Informative, full-bodied, knowledgeable
    - Kore: Firm, poised, assured
    - Fenrir: Excitable, animated, energetic
    - Leda: Youthful, bright, spirited
    - Orus: Firm, steady, confident
    - Aoede: Breezy, light, airy
    - Callirrhoe: Easy-going, relaxed, approachable
    - Autonoe: Bright, bold, assertive
    - Enceladus: Breathy, gentle, intimate (good for tired/whisper)
    - Iapetus: Clear, articulate, precise
    - Umbriel: Easy-going, relaxed, calm
    - Algieba: Smooth, velvety, rich
    - Despina: Smooth, silky, elegant
    - Erinome: Clear, crisp, bright
    - Algenib: Gravelly, textured, character-rich
    - Rasalgethi: Informative, knowledgeable, measured
    - Laomedeia: Upbeat, lively, cheerful
    - Achernar: Soft, gentle, soothing
    - Alnilam: Firm, strong, resolute
    - Schedar: Even, balanced, neutral
    - Gacrux: Mature, deep, seasoned
    - Pulcherrima: Forward, bold, direct
    - Achird: Friendly, warm, inviting
    - Zubenelgenubi: Casual, relaxed, conversational
    - Vindemiatrix: Gentle, soft, kind
    - Sadachbia: Lively, energetic, dynamic
    - Sadaltager: Knowledgeable, informed, wise
    - Sulafat: Warm, friendly, comforting
    
    **Languages:** 24 supported (auto-detected from text)
    
    **Output:** WAV format, 24kHz, mono, 16-bit
    
    **Context Window:** 32k tokens max
    
    See: https://ai.google.dev/gemini-api/docs/speech-generation
    """
    text: str = Field(
        ...,
        description="Text to convert to speech",
        min_length=1,
        max_length=10000
    )
    voice: str = Field(
        "Kore",
        description="Voice name. See documentation for full list of 30+ voices."
    )
    model: str = Field(
        "gemini-2.5-flash-preview-tts",
        description="Model: gemini-2.5-flash-preview-tts or gemini-2.5-pro-preview-tts"
    )
    style_prompt: Optional[str] = Field(
        None,
        description="Style control prompt prepended to text (e.g., 'Speak slowly and clearly')"
    )


class TTSSpeaker(BaseModel):
    """Speaker configuration for multi-speaker TTS."""
    name: str = Field(..., description="Speaker name (must match name in text, e.g., 'Speaker1')")
    voice: str = Field(..., description="Voice to use for this speaker")


class TTSMultiSpeakerRequest(BaseModel):
    """
    Multi-speaker text-to-speech request.
    
    Generate dialogue between multiple speakers with different voices.
    
    **Text Format:**
    ```
    Speaker1: Hello, how are you?
    Speaker2: I'm doing well, thanks for asking!
    Speaker1: That's great to hear!
    ```
    
    **Important:** Speaker names in text must exactly match the 'name' field in speakers config.
    
    **Limit:** Up to 2 speakers per request.
    
    See: https://ai.google.dev/gemini-api/docs/speech-generation#multi-speaker
    """
    text: str = Field(
        ...,
        description="Multi-speaker dialogue text with 'SpeakerName: text' format"
    )
    speakers: List[TTSSpeaker] = Field(
        ...,
        description="Speaker configurations (max 2)",
        min_length=1,
        max_length=2
    )
    model: str = Field(
        "gemini-2.5-flash-preview-tts",
        description="Model: gemini-2.5-flash-preview-tts or gemini-2.5-pro-preview-tts"
    )


class AudioProcessRequest(BaseModel):
    """
    Audio processing request.
    
    Analyze audio content for general understanding, Q&A, and summarization.
    
    **Supported Formats:** WAV, MP3, AIFF, AAC, OGG, FLAC
    **Max Length:** 9.5 hours
    **Token Rate:** 32 tokens per second
    
    **Use Cases:**
    - Transcription and summarization
    - Audio Q&A
    - Music analysis
    - Sound identification
    
    See: https://ai.google.dev/gemini-api/docs/audio
    """
    audio_url: str = Field(
        ...,
        description="URL to audio file (MP3, WAV, etc.) or YouTube URL"
    )
    prompt: str = Field(
        "Transcribe this audio and summarize the content",
        description="Analysis prompt for the audio"
    )
    model: str = Field(
        "gemini-3-flash-preview",
        description="Model: gemini-3-flash-preview, gemini-3-pro-preview"
    )
    start_time: Optional[str] = Field(
        None,
        description="Start timestamp in MM:SS format for segment extraction"
    )
    end_time: Optional[str] = Field(
        None,
        description="End timestamp in MM:SS format for segment extraction"
    )


class AudioTranscribeRequest(BaseModel):
    """
    Structured audio transcription request.
    
    Get detailed transcription with:
    - Summary of entire audio content
    - Segments with speaker diarization (who is speaking)
    - Timestamps in MM:SS format
    - Language detection per segment
    - English translation for non-English segments
    - Emotion detection (happy, sad, angry, neutral)
    
    **Audio Sources (provide one):**
    - audio_url: Direct URL to audio file
    - audio_base64: Base64-encoded audio data (for microphone recordings)
    - youtube_url: YouTube video URL (extracts audio)
    
    **Structured Output Schema:**
    ```json
    {
        "summary": "Brief summary of the audio",
        "language": "Detected primary language",
        "segments": [
            {
                "speaker": "Speaker 1",
                "start_time": "00:00",
                "end_time": "00:15",
                "text": "Transcribed text",
                "language": "English",
                "language_code": "en",
                "translation": "English translation if non-English",
                "emotion": "happy"
            }
        ]
    }
    ```
    
    **Use Cases:**
    - Transcription and translation (speech to text)
    - Speaker diarization (identify different speakers)
    - Emotion detection in speech and music
    - Timestamp extraction (reference specific segments)
    - Non-speech understanding (birdsong, sirens, music)
    
    **Technical Details:**
    - Token Rate: 32 tokens per second of audio
    - Max Duration: 9.5 hours per prompt
    - Resolution: Downsampled to 16 Kbps
    - Channels: Multi-channel combined to mono
    
    **Supported Formats:** WAV, MP3, AIFF, AAC, OGG, FLAC
    
    **Timestamp Range:** Use start_time/end_time to transcribe specific segments:
    - "Provide a transcript from 02:30 to 03:29"
    
    See: https://ai.google.dev/gemini-api/docs/audio
    """
    audio_url: Optional[str] = Field(
        None,
        description="URL to audio file (MP3, WAV, etc.)"
    )
    audio_base64: Optional[str] = Field(
        None,
        description="Base64-encoded audio data (for microphone recordings)"
    )
    youtube_url: Optional[str] = Field(
        None,
        description="YouTube video URL (extracts and transcribes audio)"
    )
    model: str = Field(
        "gemini-3-flash-preview",
        description="Model: gemini-3-flash-preview, gemini-3-pro-preview"
    )
    include_timestamps: bool = Field(
        True,
        description="Include MM:SS timestamps for each segment"
    )
    include_speaker_labels: bool = Field(
        False,
        description="Enable speaker diarization (identify different speakers)"
    )
    detect_emotion: bool = Field(
        False,
        description="Detect speaker emotion (happy, sad, angry, neutral)"
    )
    detect_language: bool = Field(
        True,
        description="Detect the spoken language"
    )
    translate_to_english: bool = Field(
        False,
        description="Translate non-English segments to English"
    )
    num_speakers: Optional[int] = Field(
        None,
        description="Expected number of speakers (for diarization)"
    )
    language: Optional[str] = Field(
        None,
        description="Language hint (e.g., 'en', 'es', 'ja')"
    )
    start_time: Optional[str] = Field(
        None,
        description="Start timestamp MM:SS for segment extraction"
    )
    end_time: Optional[str] = Field(
        None,
        description="End timestamp MM:SS for segment extraction"
    )
    prompt: Optional[str] = Field(
        None,
        description="Custom prompt for specialized transcription"
    )
    # Legacy aliases for backwards compatibility
    include_translation: bool = Field(
        False,
        description="Alias for translate_to_english"
    )
    include_emotion: bool = Field(
        False,
        description="Alias for detect_emotion"
    )


class MultiAudioRequest(BaseModel):
    """
    Multiple audio files request.
    
    Analyze multiple audio files in a single request for comparison
    or combined analysis.
    """
    audio_urls: List[str] = Field(
        ...,
        description="List of audio URLs to analyze",
        min_length=1,
        max_length=10
    )
    prompt: str = Field(
        "Compare and analyze these audio clips",
        description="Analysis prompt for all audio files"
    )
    model: str = Field(
        "gemini-3-flash-preview",
        description="Model to use"
    )


# ============================================================================
# Text-to-Speech Endpoints
# ============================================================================

@router.post("/tts")
@limiter.limit("5/minute")
async def text_to_speech(
    request: Request,
    body: TTSRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Convert text to natural speech audio.
    
    Returns WAV audio at 24kHz, mono, 16-bit.
    Use style_prompt to control delivery style.
    """
    import os
    import base64
    import wave
    import io
    import time
    
    try:
        from google import genai
        from google.genai import types
    except ImportError:
        raise HTTPException(status_code=501, detail="google-genai SDK required")
    
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY not configured")
    
    start_time = time.time()
    client = genai.Client(api_key=api_key)
    
    # Build text with optional style prompt
    text_content = body.text
    if body.style_prompt:
        text_content = f"{body.style_prompt}\n\n{body.text}"
    
    try:
        response = client.models.generate_content(
            model=body.model,
            contents=text_content,
            config=types.GenerateContentConfig(
                response_modalities=["AUDIO"],
                speech_config=types.SpeechConfig(
                    voice_config=types.VoiceConfig(
                        prebuilt_voice_config=types.PrebuiltVoiceConfig(
                            voice_name=body.voice
                        )
                    )
                )
            )
        )
        
        usage = extract_usage(response, body.model, start_time)
        
        # Extract audio data
        audio_data = None
        if response.candidates:
            for candidate in response.candidates:
                if hasattr(candidate, 'content') and candidate.content:
                    for part in candidate.content.parts:
                        if hasattr(part, 'inline_data') and part.inline_data:
                            audio_data = part.inline_data.data
                            break
        
        if not audio_data:
            raise HTTPException(status_code=500, detail="No audio generated")
        
        # Convert to WAV format
        wav_buffer = io.BytesIO()
        with wave.open(wav_buffer, 'wb') as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(24000)
            wav_file.writeframes(audio_data)
        
        wav_buffer.seek(0)
        audio_b64 = base64.b64encode(wav_buffer.read()).decode()
        
        return {
            "success": True,
            "audio_base64": audio_b64,
            "mime_type": "audio/wav",
            "voice": body.voice,
            "style_prompt": body.style_prompt,
            "text_length": len(body.text),
            "usage": usage.model_dump()
        }
        
    except Exception as e:
        logger.error("tts_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tts-multi")
@limiter.limit("5/minute")
async def text_to_speech_multi(
    request: Request,
    body: TTSMultiSpeakerRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Convert multi-speaker dialogue to speech audio.
    
    Speaker names in text must match the 'name' field in speakers config.
    Maximum 2 speakers per request.
    """
    import os
    import base64
    import wave
    import io
    import time
    
    try:
        from google import genai
        from google.genai import types
    except ImportError:
        raise HTTPException(status_code=501, detail="google-genai SDK required")
    
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY not configured")
    
    start_time = time.time()
    client = genai.Client(api_key=api_key)
    
    # Build speaker configs
    speaker_voice_configs = []
    for speaker in body.speakers:
        speaker_voice_configs.append(
            types.SpeakerVoiceConfig(
                speaker=speaker.name,
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name=speaker.voice
                    )
                )
            )
        )
    
    try:
        response = client.models.generate_content(
            model=body.model,
            contents=body.text,
            config=types.GenerateContentConfig(
                response_modalities=["AUDIO"],
                speech_config=types.SpeechConfig(
                    multi_speaker_voice_config=types.MultiSpeakerVoiceConfig(
                        speaker_voice_configs=speaker_voice_configs
                    )
                )
            )
        )
        
        usage = extract_usage(response, body.model, start_time)
        
        # Extract audio data
        audio_data = None
        if response.candidates:
            for candidate in response.candidates:
                if hasattr(candidate, 'content') and candidate.content:
                    for part in candidate.content.parts:
                        if hasattr(part, 'inline_data') and part.inline_data:
                            audio_data = part.inline_data.data
                            break
        
        if not audio_data:
            raise HTTPException(status_code=500, detail="No audio generated")
        
        # Convert to WAV
        wav_buffer = io.BytesIO()
        with wave.open(wav_buffer, 'wb') as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(24000)
            wav_file.writeframes(audio_data)
        
        wav_buffer.seek(0)
        audio_b64 = base64.b64encode(wav_buffer.read()).decode()
        
        return {
            "success": True,
            "audio_base64": audio_b64,
            "mime_type": "audio/wav",
            "speakers": [{"name": s.name, "voice": s.voice} for s in body.speakers],
            "usage": usage.model_dump()
        }
        
    except Exception as e:
        logger.error("tts_multi_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Audio Understanding Endpoints
# ============================================================================

@router.post("/audio-process")
@limiter.limit("5/minute")
async def audio_process(
    request: Request,
    body: AudioProcessRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Process and analyze audio content.
    
    Supports general audio analysis, Q&A, transcription, and summarization.
    Token rate: 32 tokens per second of audio.
    """
    import os
    import time
    import httpx
    
    try:
        from google import genai
        from google.genai import types
    except ImportError:
        raise HTTPException(status_code=501, detail="google-genai SDK required")
    
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY not configured")
    
    # Fetch audio
    async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as http_client:
        resp = await http_client.get(body.audio_url)
        if resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Could not fetch audio")
        audio_bytes = resp.content
        content_type = resp.headers.get("content-type", "audio/mpeg").split(';')[0]
    
    start_time = time.time()
    client = genai.Client(api_key=api_key)
    
    # Build prompt with optional timestamp handling
    prompt = body.prompt
    if body.start_time or body.end_time:
        time_range = f"Focus on the segment from {body.start_time or '00:00'} to {body.end_time or 'end'}. "
        prompt = time_range + prompt
    
    try:
        response = client.models.generate_content(
            model=body.model,
            contents=[
                types.Part.from_bytes(data=audio_bytes, mime_type=content_type),
                prompt
            ]
        )
        
        usage = extract_usage(response, body.model, start_time)
        
        return {
            "success": True,
            "analysis": response.text,
            "audio_url": body.audio_url,
            "model": body.model,
            "usage": usage.model_dump()
        }
        
    except Exception as e:
        logger.error("audio_process_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/audio-transcribe")
@limiter.limit("5/minute")
async def audio_transcribe(
    request: Request,
    body: AudioTranscribeRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Transcribe audio with structured output.
    
    Supports multiple audio sources:
    - audio_url: Direct URL to audio file
    - audio_base64: Base64-encoded audio data (e.g., microphone recording)
    - youtube_url: YouTube video URL (extracts audio)
    
    Returns:
    - Summary of entire audio
    - Segments with speaker labels
    - Timestamps (MM:SS format)
    - Optional translation and emotion detection
    """
    import os
    import time
    import json
    import base64
    import httpx
    
    try:
        from google import genai
        from google.genai import types
    except ImportError:
        raise HTTPException(status_code=501, detail="google-genai SDK required")
    
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY not configured")
    
    # Determine audio source and get bytes
    audio_bytes = None
    content_type = "audio/mpeg"
    source_info = None
    is_youtube = False
    youtube_url = None
    
    if body.audio_base64:
        # Base64 encoded audio (microphone recording)
        try:
            audio_bytes = base64.b64decode(body.audio_base64)
            content_type = "audio/webm"  # Common format for browser recordings
            source_info = "base64"
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid base64 audio: {str(e)}")
    
    elif body.youtube_url:
        # YouTube URL - use Gemini's native file_data support
        is_youtube = True
        youtube_url = body.youtube_url
        source_info = body.youtube_url
    
    elif body.audio_url:
        # Check if audio_url is actually a YouTube URL
        if "youtube.com" in body.audio_url or "youtu.be" in body.audio_url:
            is_youtube = True
            youtube_url = body.audio_url
            source_info = body.audio_url
        else:
            # Direct URL to audio file
            async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as http_client:
                resp = await http_client.get(body.audio_url)
                if resp.status_code != 200:
                    raise HTTPException(status_code=400, detail="Could not fetch audio from URL")
                audio_bytes = resp.content
                content_type = resp.headers.get("content-type", "audio/mpeg").split(';')[0]
                source_info = body.audio_url
    
    else:
        raise HTTPException(
            status_code=400, 
            detail="Must provide one of: audio_url, audio_base64, or youtube_url"
        )
    
    start_time = time.time()
    client = genai.Client(api_key=api_key)
    
    # Handle legacy field aliases
    include_translation = body.translate_to_english or body.include_translation
    include_emotion = body.detect_emotion or body.include_emotion
    
    # Build structured transcription prompt
    prompt_parts = []
    
    # Add custom prompt if provided
    if body.prompt:
        prompt_parts.append(body.prompt)
    
    # Add timestamp range if specified
    if body.start_time or body.end_time:
        time_range = f"Focus on the segment from {body.start_time or '00:00'} to {body.end_time or 'end'}."
        prompt_parts.append(time_range)
    
    # Main transcription instructions
    prompt_parts.append("""Transcribe this audio and provide structured output as JSON:
{
    "summary": "Brief summary of the entire audio",
    "language": "Detected primary language",
    "transcription": "Full transcription text",
    "segments": [
        {""")
    
    if body.include_speaker_labels:
        prompt_parts.append('            "speaker": "Speaker name or Speaker 1/2/etc",')
    if body.include_timestamps:
        prompt_parts.append('            "start_time": "MM:SS",')
        prompt_parts.append('            "end_time": "MM:SS",')
    prompt_parts.append('            "text": "Transcribed text for this segment",')
    if body.detect_language:
        prompt_parts.append('            "language": "Language of this segment",')
        prompt_parts.append('            "language_code": "ISO language code (e.g., en, es, ja)",')
    if include_translation:
        prompt_parts.append('            "translation": "English translation if not English",')
    if include_emotion:
        prompt_parts.append('            "emotion": "happy/sad/angry/neutral/excited/calm",')
    
    prompt_parts.append("""        }
    ]
}""")
    
    # Add speaker hint if provided
    if body.num_speakers:
        prompt_parts.append(f"\nNote: Expect approximately {body.num_speakers} different speakers.")
    
    # Add language hint if provided
    if body.language:
        prompt_parts.append(f"\nHint: The primary language is likely {body.language}.")
    
    full_prompt = "\n".join(prompt_parts)
    
    try:
        # Build contents based on audio source
        if is_youtube:
            # Use Gemini's native YouTube support via file_data
            contents = [
                types.Content(
                    parts=[
                        types.Part(
                            file_data=types.FileData(
                                file_uri=youtube_url
                            )
                        ),
                        types.Part(text=full_prompt)
                    ]
                )
            ]
        else:
            # Regular audio bytes
            contents = [
                types.Part.from_bytes(data=audio_bytes, mime_type=content_type),
                full_prompt
            ]
        
        response = client.models.generate_content(
            model=body.model,
            contents=contents,
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            )
        )
        
        usage = extract_usage(response, body.model, start_time)
        usage_dict = usage.model_dump()
        
        # Parse JSON response
        try:
            result = json.loads(response.text)
        except json.JSONDecodeError:
            result = {"raw_text": response.text, "transcription": response.text}
        
        # Flatten the response for frontend compatibility
        return {
            "success": True,
            "transcription": result.get("transcription", result.get("raw_text", "")),
            "summary": result.get("summary"),
            "language": result.get("language"),
            "segments": result.get("segments", []),
            "text": result.get("transcription", result.get("raw_text", "")),  # Alias
            "source": source_info,
            "is_youtube": is_youtube,
            "model": body.model,
            "usage": usage_dict,
            "cost": usage_dict.get("estimated_cost", 0.0)  # Top-level for frontend
        }
        
    except Exception as e:
        logger.error("audio_transcribe_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/audio-multi")
@limiter.limit("3/minute")
async def audio_multi(
    request: Request,
    body: MultiAudioRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Analyze multiple audio files in a single request.
    
    Useful for comparing audio clips or combined analysis.
    """
    import os
    import time
    import httpx
    
    try:
        from google import genai
        from google.genai import types
    except ImportError:
        raise HTTPException(status_code=501, detail="google-genai SDK required")
    
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY not configured")
    
    # Fetch all audio files
    audio_parts = []
    async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as http_client:
        for url in body.audio_urls:
            resp = await http_client.get(url)
            if resp.status_code != 200:
                raise HTTPException(status_code=400, detail=f"Could not fetch audio: {url}")
            content_type = resp.headers.get("content-type", "audio/mpeg").split(';')[0]
            audio_parts.append(types.Part.from_bytes(data=resp.content, mime_type=content_type))
    
    start_time = time.time()
    client = genai.Client(api_key=api_key)
    
    try:
        contents = audio_parts + [body.prompt]
        
        response = client.models.generate_content(
            model=body.model,
            contents=contents
        )
        
        usage = extract_usage(response, body.model, start_time)
        
        return {
            "success": True,
            "analysis": response.text,
            "audio_count": len(body.audio_urls),
            "model": body.model,
            "usage": usage.model_dump()
        }
        
    except Exception as e:
        logger.error("audio_multi_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))
