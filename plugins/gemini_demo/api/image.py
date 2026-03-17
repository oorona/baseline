"""
Gemini Image API Module
========================

This module provides all image-related Gemini API endpoints:

**Image Generation (Nano Banana)**
- Generate: Create images from text prompts
- Edit: Modify existing images with text instructions
- Compose: Combine multiple reference images into new images

**Image Understanding (Vision)**
- Understand: Analyze and describe images
- Detect: Object detection with bounding boxes  
- Segment: Object segmentation with contour masks
- Multi-Image: Compare and analyze multiple images

Documentation:
- Image Generation: https://ai.google.dev/gemini-api/docs/image-generation
- Image Understanding: https://ai.google.dev/gemini-api/docs/image-understanding

Models:
- gemini-2.5-flash-image: Fast image generation (Nano Banana)
- gemini-3-pro-image-preview: High-quality generation (Nano Banana Pro, up to 4K)
- gemini-3-flash-preview: Image understanding (fast)
- gemini-3-pro-preview: Image understanding (best quality)
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List

from app.api.deps import get_current_user
from app.core.limiter import limiter
from app.api.gemini._common import (
    UsageStats,
    extract_usage,
    get_gemini_client,
    fetch_url_content,
    calculate_image_cost,
    SUPPORTED_IMAGE_FORMATS,
    IMAGE_ASPECT_RATIOS,
    logger
)

router = APIRouter(tags=["gemini-image"])


# ============================================================================
# Request Schemas
# ============================================================================

class ImageGenerateRequest(BaseModel):
    """
    Image generation request using Gemini's Nano Banana models.
    
    **Models:**
    - `gemini-2.5-flash-image`: Fast generation, 1K resolution max
    - `gemini-3-pro-image-preview`: Pro quality, up to 4K resolution
    
    **Aspect Ratios:** 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 9:21, 21:9, 1:2
    
    **Best Practices:**
    - Be specific about style, lighting, composition
    - Describe what you want TO see, not what to avoid
    - Include artistic references for consistent style
    - Use descriptive adjectives for mood and atmosphere
    
    See: https://ai.google.dev/gemini-api/docs/image-generation
    """
    prompt: str = Field(
        ...,
        description="Image generation prompt. Be specific about style, subject, lighting, and composition.",
        min_length=1,
        max_length=10000
    )
    model: str = Field(
        "gemini-2.5-flash-image",
        description="Model: gemini-2.5-flash-image (fast, 1K max) or gemini-3-pro-image-preview (pro, 4K max)"
    )
    aspect_ratio: str = Field(
        "1:1",
        description="Aspect ratio. Options: 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 9:21, 21:9, 1:2"
    )
    image_size: Optional[str] = Field(
        None,
        description="Resolution for Pro model only: 1K, 2K, 4K. Must be uppercase. Flash model ignores this."
    )
    include_text: bool = Field(
        True,
        description="Include text/caption in response. Set to False for image-only output."
    )
    use_google_search: bool = Field(
        False,
        description="Enable Google Search grounding for real-time data (Pro model only)"
    )
    include_thoughts: bool = Field(
        False,
        description="Include thinking/interim images in response (Pro model only)"
    )


class ImageEditRequest(BaseModel):
    """
    Image editing request (text + image → new image).
    
    Edit an existing image based on text instructions. The model understands
    spatial relationships and can make targeted modifications.
    
    **Examples:**
    - "Add a red hat to the person"
    - "Change the background to a beach sunset"
    - "Remove the text from the image"
    - "Make the lighting warmer and more dramatic"
    
    **Image Limits:**
    - Flash model: Up to 3 reference images
    - Pro model: Up to 14 reference images
    
    See: https://ai.google.dev/gemini-api/docs/image-generation#editing
    """
    prompt: str = Field(
        ...,
        description="Edit instruction describing the desired changes",
        min_length=1
    )
    image_url: str = Field(
        ...,
        description="URL of the base image to edit (PNG, JPEG, WebP, HEIC, HEIF)"
    )
    model: str = Field(
        "gemini-2.5-flash-image",
        description="Model: gemini-2.5-flash-image (up to 3 images) or gemini-3-pro-image-preview (up to 14)"
    )
    aspect_ratio: str = Field(
        "1:1",
        description="Output aspect ratio"
    )
    image_size: Optional[str] = Field(
        None,
        description="Resolution for Pro model: 1K, 2K, 4K"
    )


class ImageComposeRequest(BaseModel):
    """
    Multi-image composition request.
    
    Combine multiple reference images into a new image. The model can extract
    elements, styles, or concepts from each reference image.
    
    **Use Cases:**
    - Style transfer: Apply artistic style from one image to another
    - Character consistency: Maintain character appearance across scenes
    - Scene composition: Combine elements from multiple images
    - Product visualization: Place product in different contexts
    
    **Image Limits:**
    - Flash model: Up to 3 reference images
    - Pro model: Up to 14 reference images
    
    See: https://ai.google.dev/gemini-api/docs/image-generation#multi-image
    """
    prompt: str = Field(
        ...,
        description="Composition instruction describing the final image"
    )
    image_urls: List[str] = Field(
        ...,
        description="Reference image URLs (max 3 for Flash, max 14 for Pro)",
        min_length=1,
        max_length=14
    )
    model: str = Field(
        "gemini-3-pro-image-preview",
        description="Model: gemini-2.5-flash-image (up to 3) or gemini-3-pro-image-preview (up to 14)"
    )
    aspect_ratio: str = Field(
        "1:1",
        description="Output aspect ratio"
    )
    image_size: Optional[str] = Field(
        None,
        description="Resolution for Pro model: 1K, 2K, 4K"
    )


class ImageUnderstandRequest(BaseModel):
    """
    Image understanding/analysis request.
    
    Analyze images for:
    - Captioning and description
    - Visual question answering
    - Image classification
    - Text extraction (OCR)
    - Scene understanding
    
    **Supported Formats:** PNG, JPEG, WebP, HEIC, HEIF
    
    **Media Resolution (Gemini 3):**
    - low: Fastest, least detail
    - medium: Balanced
    - high: More detail, more tokens
    - ultra_high: Maximum detail for fine text/small objects
    
    **Token Calculation:**
    - 258 tokens if both dimensions ≤ 384px
    - Larger images tiled into 768x768 tiles at 258 tokens each
    
    See: https://ai.google.dev/gemini-api/docs/image-understanding
    """
    image_url: str = Field(
        ...,
        description="URL of the image to analyze"
    )
    prompt: str = Field(
        "Describe this image in detail",
        description="Analysis prompt or question about the image"
    )
    model: str = Field(
        "gemini-3-flash-preview",
        description="Model: gemini-3-flash-preview, gemini-3-pro-preview, gemini-2.5-flash, gemini-2.5-pro"
    )
    media_resolution: Optional[str] = Field(
        None,
        description="Resolution: low, medium, high, ultra_high (Gemini 3 only). Higher = more detail but more tokens."
    )


class ImageDetectRequest(BaseModel):
    """
    Object detection request with bounding boxes.
    
    Detect objects in an image and get their locations as bounding boxes.
    Coordinates are normalized to 0-1000 scale.
    
    **Output Format:**
    ```json
    [
        {"label": "cat", "box_2d": [100, 50, 400, 300]},
        {"label": "dog", "box_2d": [500, 100, 800, 450]}
    ]
    ```
    
    **Box Format:** [ymin, xmin, ymax, xmax] normalized to 0-1000
    
    **To convert to pixels:**
    ```python
    abs_x1 = int(box_2d[1] / 1000 * image_width)
    abs_y1 = int(box_2d[0] / 1000 * image_height)
    abs_x2 = int(box_2d[3] / 1000 * image_width)
    abs_y2 = int(box_2d[2] / 1000 * image_height)
    ```
    
    **Custom Prompts:**
    - "Detect all green objects"
    - "Find all faces in this image"
    - "Label items with their allergens"
    
    See: https://ai.google.dev/gemini-api/docs/image-understanding#object-detection
    """
    image_url: str = Field(
        ...,
        description="URL of the image to analyze"
    )
    prompt: str = Field(
        "Detect all prominent objects in the image",
        description="Detection prompt. Can include custom filters like 'Detect all green objects'."
    )
    model: str = Field(
        "gemini-3-flash-preview",
        description="Model: gemini-3-flash-preview, gemini-3-pro-preview, gemini-2.5-flash, gemini-2.5-pro"
    )
    media_resolution: Optional[str] = Field(
        None,
        description="Resolution: low, medium, high, ultra_high"
    )


class ImageSegmentRequest(BaseModel):
    """
    Image segmentation request with contour masks.

    Segment objects in an image and get their precise boundaries as masks.
    **IMPORTANT:** Only Gemini 2.5+ models support segmentation masks.
    Gemini 3 models only support object detection with bounding boxes.

    **Output Format:**
    ```json
    [
        {
            "label": "wooden table",
            "box_2d": [100, 50, 400, 300],
            "mask": "data:image/png;base64,..."
        }
    ]
    ```

    **Mask Processing:**
    1. Decode base64 PNG mask
    2. Resize mask to bounding box dimensions
    3. Threshold at 127 for binary mask (0-255 probability map)
    4. Apply mask to original image coordinates

    **Note:** For best results, thinking is disabled (thinking_budget=0).

    See: https://ai.google.dev/gemini-api/docs/image-understanding#segmentation
    """
    image_url: str = Field(
        ...,
        description="URL of the image to segment"
    )
    prompt: str = Field(
        "Segment all prominent objects in the image",
        description="Segmentation prompt. E.g., 'Segment all wooden and glass items'."
    )
    model: str = Field(
        "gemini-2.5-flash",
        description="Model: gemini-2.5-flash or gemini-2.5-pro (ONLY 2.5+ models support segmentation)"
    )
    media_resolution: Optional[str] = Field(
        None,
        description="Resolution: low, medium, high, ultra_high"
    )


class MultiImageUnderstandRequest(BaseModel):
    """
    Multi-image understanding request.
    
    Analyze multiple images in a single prompt for:
    - Comparing images
    - Finding differences
    - Analyzing image sequences
    - Batch classification
    
    **Limit:** Up to 3600 images per request
    
    **Example Prompts:**
    - "What is different between these images?"
    - "Describe the progression shown in these images"
    - "Which image shows the best composition?"
    
    See: https://ai.google.dev/gemini-api/docs/image-understanding#prompting-with-multiple-images
    """
    image_urls: List[str] = Field(
        ...,
        description="List of image URLs to analyze (max 3600, practical limit 100)",
        min_length=1,
        max_length=100
    )
    prompt: str = Field(
        "What is different between these images?",
        description="Analysis prompt for comparing/analyzing multiple images"
    )
    model: str = Field(
        "gemini-3-flash-preview",
        description="Model: gemini-3-flash-preview, gemini-3-pro-preview, gemini-2.5-flash, gemini-2.5-pro"
    )
    media_resolution: Optional[str] = Field(
        None,
        description="Resolution: low, medium, high, ultra_high"
    )


# ============================================================================
# Image Generation Endpoints
# ============================================================================

@router.post("/image-generate")
@limiter.limit("10/minute")
async def image_generate(
    request: Request,
    body: ImageGenerateRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Generate images from text prompts using Nano Banana models.
    
    **Models:**
    - `gemini-2.5-flash-image`: Fast, 1K resolution, up to 3 reference images
    - `gemini-3-pro-image-preview`: Pro quality, up to 4K, up to 14 references
    
    **Response:** Base64-encoded image with optional text description.
    """
    import os
    import base64
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
    
    # Build configuration
    # For image generation, we need both TEXT and IMAGE modalities to get text back
    config_params = {
        "response_modalities": ["TEXT", "IMAGE"] if body.include_text else ["IMAGE"]
    }
    
    # Add optional features
    if body.use_google_search and "pro" in body.model:
        config_params["tools"] = [types.Tool(google_search=types.GoogleSearch())]
    
    if body.include_thoughts and "pro" in body.model:
        config_params["thinking_config"] = types.ThinkingConfig(
            include_thoughts=True
        )
    
    try:
        # Build prompt with aspect ratio hint if needed
        prompt_text = body.prompt
        if body.aspect_ratio and body.aspect_ratio != "1:1":
            # Include aspect ratio in prompt as a hint
            prompt_text = f"{body.prompt} (aspect ratio: {body.aspect_ratio})"
        
        response = client.models.generate_content(
            model=body.model,
            contents=prompt_text,
            config=types.GenerateContentConfig(**config_params)
        )
        
        # Extract image and text from response
        generated_images = []
        text_parts = []  # Collect all text parts
        thoughts = []
        
        if hasattr(response, 'candidates') and response.candidates:
            for candidate in response.candidates:
                if hasattr(candidate, 'content') and candidate.content:
                    for part in candidate.content.parts:
                        if hasattr(part, 'inline_data') and part.inline_data:
                            img_data = part.inline_data
                            generated_images.append({
                                "data": base64.b64encode(img_data.data).decode('utf-8'),
                                "mime_type": img_data.mime_type
                            })
                        elif hasattr(part, 'text') and part.text:
                            # Check if this is a thought
                            if hasattr(part, 'thought') and part.thought:
                                thoughts.append(part.text)
                            else:
                                text_parts.append(part.text)
        
        # Also check for direct text attribute on response
        if hasattr(response, 'text') and response.text and not text_parts:
            text_parts.append(response.text)
        
        # Join all text parts
        text_content = "\n".join(text_parts) if text_parts else None
        
        usage = extract_usage(response, body.model, start_time)
        
        # Recalculate cost using image-specific pricing
        image_count = len(generated_images)
        usage.estimated_cost = calculate_image_cost(body.model, usage, image_count)
        usage_dict = usage.model_dump()
        
        # Get first image for backwards compatibility
        first_image = generated_images[0]["data"] if generated_images else None
        
        # Log what we found for debugging
        logger.info(
            "image_generate_response", 
            image_count=image_count,
            has_text=text_content is not None,
            text_length=len(text_content) if text_content else 0,
            thought_count=len(thoughts),
            include_text_requested=body.include_text
        )
        
        return {
            "success": True,
            "images": generated_images,
            "image_count": image_count,
            "image_base64": first_image,  # Top-level alias for frontend compatibility
            "text": text_content,
            "text_response": text_content,  # Alias for frontend
            "include_text_requested": body.include_text,  # Debug: what was requested
            "thoughts": thoughts if thoughts else None,
            "model": body.model,
            "aspect_ratio": body.aspect_ratio,
            "image_size": body.image_size,
            "usage": usage_dict,
            "cost": usage_dict.get("estimated_cost", 0.0)  # Top-level for frontend
        }
        
    except Exception as e:
        logger.error("image_generate_error", error=str(e), model=body.model)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/image-edit")
@limiter.limit("10/minute")
async def image_edit(
    request: Request,
    body: ImageEditRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Edit an existing image based on text instructions.
    
    The model understands spatial relationships and can make targeted modifications
    like adding objects, changing backgrounds, or adjusting lighting.
    """
    import os
    import base64
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
    
    # Fetch source image
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as http_client:
        resp = await http_client.get(body.image_url)
        if resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Could not fetch image")
        image_bytes = resp.content
        content_type = resp.headers.get("content-type", "image/jpeg").split(';')[0]
    
    start_time = time.time()
    client = genai.Client(api_key=api_key)
    
    # Build configuration
    config_params = {"response_modalities": ["IMAGE"]}
    
    image_gen_config = {}
    if body.image_size and "pro" in body.model.lower():
        image_gen_config["image_size"] = body.image_size
    if body.aspect_ratio:
        image_gen_config["aspect_ratio"] = body.aspect_ratio
    if image_gen_config:
        try:
            config_params["image_generation_config"] = types.ImageGenerationConfig(**image_gen_config)
        except Exception:
            pass  # Skip config if it fails
    
    try:
        response = client.models.generate_content(
            model=body.model,
            contents=[
                types.Part.from_bytes(data=image_bytes, mime_type=content_type),
                body.prompt
            ],
            config=types.GenerateContentConfig(**config_params)
        )
        
        generated_images = []
        if hasattr(response, 'candidates') and response.candidates:
            for candidate in response.candidates:
                if hasattr(candidate, 'content') and candidate.content:
                    for part in candidate.content.parts:
                        if hasattr(part, 'inline_data') and part.inline_data:
                            img_data = part.inline_data
                            generated_images.append({
                                "data": base64.b64encode(img_data.data).decode('utf-8'),
                                "mime_type": img_data.mime_type
                            })
        
        usage = extract_usage(response, body.model, start_time)
        
        # Recalculate cost using image-specific pricing
        image_count = len(generated_images)
        usage.estimated_cost = calculate_image_cost(body.model, usage, image_count)
        usage_dict = usage.model_dump()
        
        # Get first image for backwards compatibility
        first_image = generated_images[0]["data"] if generated_images else None
        
        return {
            "success": True,
            "images": generated_images,
            "image_count": image_count,
            "image_base64": first_image,  # Top-level alias for frontend compatibility
            "source_url": body.image_url,
            "prompt": body.prompt,
            "model": body.model,
            "usage": usage_dict,
            "cost": usage_dict.get("estimated_cost", 0.0)  # Top-level for frontend
        }
        
    except Exception as e:
        logger.error("image_edit_error", error=str(e), model=body.model)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/image-compose")
@limiter.limit("5/minute")
async def image_compose(
    request: Request,
    body: ImageComposeRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Compose a new image from multiple reference images.
    
    Extract elements, styles, or concepts from each reference image and
    combine them according to the prompt.
    """
    import os
    import base64
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
    
    # Validate image count
    max_images = 14 if "pro" in body.model else 3
    if len(body.image_urls) > max_images:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum {max_images} images for {body.model}"
        )
    
    # Fetch all source images
    image_parts = []
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as http_client:
        for url in body.image_urls:
            resp = await http_client.get(url)
            if resp.status_code != 200:
                raise HTTPException(status_code=400, detail=f"Could not fetch image: {url}")
            content_type = resp.headers.get("content-type", "image/jpeg").split(';')[0]
            image_parts.append(types.Part.from_bytes(data=resp.content, mime_type=content_type))
    
    start_time = time.time()
    client = genai.Client(api_key=api_key)
    
    # Build configuration
    config_params = {"response_modalities": ["IMAGE"]}
    
    image_gen_config = {}
    if body.image_size and "pro" in body.model.lower():
        image_gen_config["image_size"] = body.image_size
    if body.aspect_ratio:
        image_gen_config["aspect_ratio"] = body.aspect_ratio
    if image_gen_config:
        try:
            config_params["image_generation_config"] = types.ImageGenerationConfig(**image_gen_config)
        except Exception:
            pass  # Skip config if it fails
    
    try:
        # Compose with images and prompt
        contents = image_parts + [body.prompt]
        
        response = client.models.generate_content(
            model=body.model,
            contents=contents,
            config=types.GenerateContentConfig(**config_params)
        )
        
        generated_images = []
        if hasattr(response, 'candidates') and response.candidates:
            for candidate in response.candidates:
                if hasattr(candidate, 'content') and candidate.content:
                    for part in candidate.content.parts:
                        if hasattr(part, 'inline_data') and part.inline_data:
                            img_data = part.inline_data
                            generated_images.append({
                                "data": base64.b64encode(img_data.data).decode('utf-8'),
                                "mime_type": img_data.mime_type
                            })
        
        usage = extract_usage(response, body.model, start_time)
        
        # Recalculate cost using image-specific pricing
        image_count = len(generated_images)
        usage.estimated_cost = calculate_image_cost(body.model, usage, image_count)
        usage_dict = usage.model_dump()
        
        # Get first image for backwards compatibility
        first_image = generated_images[0]["data"] if generated_images else None
        
        return {
            "success": True,
            "images": generated_images,
            "image_count": image_count,
            "image_base64": first_image,  # Top-level alias for frontend compatibility
            "source_count": len(body.image_urls),
            "prompt": body.prompt,
            "model": body.model,
            "usage": usage_dict,
            "cost": usage_dict.get("estimated_cost", 0.0)  # Top-level for frontend
        }
        
    except Exception as e:
        logger.error("image_compose_error", error=str(e), model=body.model)
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Image Understanding Endpoints
# ============================================================================

@router.post("/image-understand")
@limiter.limit("10/minute")
async def image_understand(
    request: Request,
    body: ImageUnderstandRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Analyze and understand an image from URL.
    
    Use for captioning, visual Q&A, classification, and text extraction.
    Place the prompt after the image for best results.
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
    
    # Fetch image
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as http_client:
        resp = await http_client.get(body.image_url)
        if resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Could not fetch image")
        image_bytes = resp.content
        content_type = resp.headers.get("content-type", "image/jpeg").split(';')[0]
    
    start_time = time.time()
    client = genai.Client(api_key=api_key)
    
    # Build config with optional media_resolution
    config_params = {}
    if body.media_resolution:
        config_params["media_resolution"] = body.media_resolution
    
    config = types.GenerateContentConfig(**config_params) if config_params else None
    
    try:
        # Image first, then prompt (per docs recommendation)
        response = client.models.generate_content(
            model=body.model,
            contents=[
                types.Part.from_bytes(data=image_bytes, mime_type=content_type),
                body.prompt
            ],
            config=config
        )
        
        usage = extract_usage(response, body.model, start_time)
        usage_dict = usage.model_dump()
        
        return {
            "success": True,
            "analysis": response.text,
            "image_url": body.image_url,
            "model": body.model,
            "media_resolution": body.media_resolution,
            "usage": usage_dict,
            "cost": usage_dict.get("estimated_cost", 0.0)  # Top-level for frontend
        }
        
    except Exception as e:
        logger.error("image_understand_error", error=str(e), model=body.model)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/image-understand-multi")
@limiter.limit("5/minute")
async def image_understand_multi(
    request: Request,
    body: MultiImageUnderstandRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Analyze multiple images in a single prompt.
    
    Use for comparing images, finding differences, or analyzing sequences.
    Images can be a mix of inline data and File API references.
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
    
    # Fetch all images
    image_parts = []
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as http_client:
        for url in body.image_urls:
            resp = await http_client.get(url)
            if resp.status_code != 200:
                raise HTTPException(status_code=400, detail=f"Could not fetch image: {url}")
            content_type = resp.headers.get("content-type", "image/jpeg").split(';')[0]
            image_parts.append(types.Part.from_bytes(data=resp.content, mime_type=content_type))
    
    start_time = time.time()
    client = genai.Client(api_key=api_key)
    
    # Build config
    config_params = {}
    if body.media_resolution:
        config_params["media_resolution"] = body.media_resolution
    config = types.GenerateContentConfig(**config_params) if config_params else None
    
    try:
        # Prompt first, then images
        contents = [body.prompt] + image_parts
        
        response = client.models.generate_content(
            model=body.model,
            contents=contents,
            config=config
        )
        
        usage = extract_usage(response, body.model, start_time)
        usage_dict = usage.model_dump()
        
        return {
            "success": True,
            "analysis": response.text,
            "image_count": len(body.image_urls),
            "model": body.model,
            "usage": usage_dict,
            "cost": usage_dict.get("estimated_cost", 0.0)  # Top-level for frontend
        }
        
    except Exception as e:
        logger.error("image_understand_multi_error", error=str(e), model=body.model)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/image-detect")
@limiter.limit("10/minute")
async def image_detect(
    request: Request,
    body: ImageDetectRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Detect objects in an image and get bounding box coordinates.
    
    Returns bounding boxes in [ymin, xmin, ymax, xmax] format normalized to 0-1000.
    You must descale these based on your original image dimensions.
    
    Supports custom detection prompts like "Detect all green objects" or
    "Label items with allergens".
    """
    import os
    import time
    import json
    import httpx
    
    try:
        from google import genai
        from google.genai import types
    except ImportError:
        raise HTTPException(status_code=501, detail="google-genai SDK required")
    
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY not configured")
    
    # Fetch image
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as http_client:
        resp = await http_client.get(body.image_url)
        if resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Could not fetch image")
        image_bytes = resp.content
        content_type = resp.headers.get("content-type", "image/jpeg").split(';')[0]
    
    start_time = time.time()
    client = genai.Client(api_key=api_key)
    
    # Build detection prompt per docs
    detection_prompt = f"""{body.prompt}. 
Output a JSON array where each object has:
- "label": string describing the object
- "box_2d": array [ymin, xmin, ymax, xmax] normalized to 0-1000"""
    
    # Config for JSON response
    config_params = {"response_mime_type": "application/json"}
    if body.media_resolution:
        config_params["media_resolution"] = body.media_resolution
    
    try:
        response = client.models.generate_content(
            model=body.model,
            contents=[
                types.Part.from_bytes(data=image_bytes, mime_type=content_type),
                detection_prompt
            ],
            config=types.GenerateContentConfig(**config_params)
        )
        
        usage = extract_usage(response, body.model, start_time)
        
        # Parse JSON response
        try:
            detections = json.loads(response.text)
        except json.JSONDecodeError:
            # Try to extract from markdown fencing
            text = response.text
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0]
            elif "```" in text:
                text = text.split("```")[1].split("```")[0]
            try:
                detections = json.loads(text.strip())
            except:
                detections = []
        
        usage_dict = usage.model_dump()
        return {
            "success": True,
            "detections": detections,
            "objects": detections,  # Alias for frontend compatibility
            "detection_count": len(detections) if isinstance(detections, list) else 0,
            "image_url": body.image_url,
            "model": body.model,
            "note": "box_2d is [ymin, xmin, ymax, xmax] normalized to 0-1000. Descale: abs_x = int(box[1]/1000 * width)",
            "usage": usage_dict,
            "cost": usage_dict.get("estimated_cost", 0.0)  # Top-level for frontend
        }
        
    except Exception as e:
        logger.error("image_detect_error", error=str(e), model=body.model)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/image-segment")
@limiter.limit("5/minute")
async def image_segment(
    request: Request,
    body: ImageSegmentRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Segment objects in an image and get contour masks.

    Returns segmentation masks as base64-encoded PNGs. The masks are probability
    maps (0-255) that should be thresholded at 127 for binary masks.

    For better results, thinking is disabled (thinking_budget=0).
    """
    import os
    import time
    import json
    import httpx
    import asyncio
    from concurrent.futures import ThreadPoolExecutor

    logger.info("image_segment_start", model=body.model, prompt=body.prompt[:50])

    try:
        from google import genai
        from google.genai import types
    except ImportError:
        logger.error("google_genai_import_failed")
        raise HTTPException(status_code=501, detail="google-genai SDK required")

    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        logger.error("google_api_key_missing")
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY not configured")

    # Fetch image
    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as http_client:
            resp = await http_client.get(body.image_url)
            if resp.status_code != 200:
                logger.error("image_fetch_failed", status=resp.status_code, url=body.image_url[:100])
                raise HTTPException(status_code=400, detail="Could not fetch image")
            image_bytes = resp.content
            content_type = resp.headers.get("content-type", "image/jpeg").split(';')[0]
            logger.info("image_fetched", size=len(image_bytes), content_type=content_type)
    except asyncio.TimeoutError:
        logger.error("image_fetch_timeout", url=body.image_url[:100])
        raise HTTPException(status_code=504, detail="Image fetch timeout")
    except Exception as e:
        logger.error("image_fetch_error", error=str(e), url=body.image_url[:100])
        raise

    start_time = time.time()

    # Build segmentation prompt EXACTLY as shown in sample code
    # Note: Sample does NOT use response_mime_type, just parses markdown-fenced JSON
    segmentation_prompt = f"""Give the segmentation masks for {body.prompt}.
Output a JSON list of segmentation masks where each entry contains the 2D bounding box in the key "box_2d", the segmentation mask in key "mask", and the text label in the key "label". Use descriptive labels."""

    # Config with thinking disabled for better detection per docs
    # NOTE: Do NOT set response_mime_type - sample code doesn't use it
    config_params = {
        "thinking_config": types.ThinkingConfig(thinking_budget=0)
    }
    if body.media_resolution:
        config_params["media_resolution"] = body.media_resolution
        logger.info("using_media_resolution", resolution=body.media_resolution)

    config = types.GenerateContentConfig(**config_params)
    
    # Call Gemini API directly (blocking is OK for segmentation)
    try:
        logger.info("image_segment_api_start", model=body.model)
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model=body.model,
            contents=[
                segmentation_prompt,  # Prompt first per docs
                types.Part.from_bytes(data=image_bytes, mime_type=content_type),
            ],
            config=config
        )
        logger.info("image_segment_api_complete", duration=time.time() - start_time)
    except Exception as e:
        logger.error("image_segment_api_error", error=str(e), error_type=type(e).__name__)
        raise HTTPException(status_code=500, detail=f"Gemini API error: {str(e)}")

    usage = extract_usage(response, body.model, start_time)

    # Parse JSON response - use sample code's parsing logic for markdown-fenced JSON
    try:
        # First try direct JSON parse
        segments = json.loads(response.text)
    except json.JSONDecodeError:
        # Parse markdown-fenced JSON as per sample code
        text = response.text
        lines = text.splitlines()
        for i, line in enumerate(lines):
            if line.strip() == "```json":
                text = "\n".join(lines[i+1:])  # Remove everything before "```json"
                text = text.split("```")[0]  # Remove everything after closing "```"
                break
        try:
            segments = json.loads(text.strip())
        except json.JSONDecodeError as e:
            logger.warning("segmentation_parse_failed", error=str(e), raw_text=response.text[:1000])
            segments = []

    # Process segments - include FULL mask for display, not truncated preview
    processed_segments = []
    for seg in (segments if isinstance(segments, list) else []):
        # Extract mask - can be string or sometimes list
        raw_mask = seg.get("mask", "")

        # Handle case where mask is a list (take first element)
        if isinstance(raw_mask, list):
            raw_mask = raw_mask[0] if raw_mask else ""

        # Ensure it's a string
        if not isinstance(raw_mask, str):
            raw_mask = ""

        # Strip data URL prefix if present (handle variations)
        # Gemini may return: "data:image/png;base64,..." or just base64 string
        if raw_mask:
            # Remove any data URL prefix variations
            for prefix in ["data:image/png;base64,", "data:image/png;base64;", "data:image/png,"]:
                if raw_mask.startswith(prefix):
                    raw_mask = raw_mask[len(prefix):]
                    break
            # Strip any leading/trailing whitespace
            raw_mask = raw_mask.strip()

        # Validate that it's a PNG by checking base64 header
        # Valid PNG in base64 starts with "iVBORw0KGgo" (PNG signature)
        has_valid_mask = bool(raw_mask and raw_mask.startswith("iVBORw0KGgo"))

        processed = {
            "label": seg.get("label", "unknown"),
            "box_2d": seg.get("box_2d", []),
            "has_mask": has_valid_mask,
            "mask": raw_mask if has_valid_mask else None,
            "mask_invalid": bool(raw_mask and not has_valid_mask)
        }

        processed_segments.append(processed)

    usage_dict = usage.model_dump()

    return {
        "success": True,
        "segments": processed_segments,
        "segment_count": len(processed_segments),
        "raw_segments": segments,
        "image_url": body.image_url,
        "model": body.model,
        "note": "Masks are base64 PNG probability maps (0-255). Threshold at 127. Resize to box dimensions.",
        "usage": usage_dict,
        "cost": usage_dict.get("estimated_cost", 0.0)
    }
