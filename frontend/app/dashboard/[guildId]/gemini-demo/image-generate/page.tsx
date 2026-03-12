/**
 * *** DEMO CODE *** - Comprehensive Nano Banana Image Generation Demo
 * 
 * Demonstrates ALL Gemini native image generation capabilities from the official docs:
 * https://ai.google.dev/gemini-api/docs/image-generation
 * 
 * Features:
 * 1. TEXT-TO-IMAGE: Generate images from text descriptions
 * 2. IMAGE EDITING: Modify existing images with text prompts (inpainting, style transfer)
 * 3. MULTI-IMAGE COMPOSITION: Combine up to 14 reference images
 * 4. GOOGLE SEARCH GROUNDING: Generate based on real-time data (Pro model)
 * 5. RESOLUTION OPTIONS: 1K, 2K, 4K output (Pro model)
 * 6. ASPECT RATIOS: 10 different ratios from 1:1 to 21:9
 * 7. THINKING VISUALIZATION: View model's reasoning process (Pro model)
 * 
 * Models:
 * - gemini-3.1-flash-image-preview: Fast image generation, 1K resolution (default)
 * - gemini-3-pro-image-preview (Nano Banana Pro): Professional, up to 4K, with thinking
 */

'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { withPermission } from '@/lib/components/with-permission';
import { PermissionLevel } from '@/lib/permissions';
import { apiClient } from '@/app/api-client';

// ============================================================================
// MODEL DEFINITIONS
// Per https://ai.google.dev/gemini-api/docs/image-generation#model-selection
// ============================================================================

const IMAGE_MODELS = [
    {
        value: 'gemini-3.1-flash-image-preview',
        label: 'Gemini 3.1 Flash Image Preview',
        codename: 'Flash Image Preview',
        description: 'Fast generation, 1K resolution (default)',
        features: ['Speed optimized', 'Up to 3 reference images', '1024px output'],
        resolutions: ['1K'],
        supportsThinking: false,
        supportsGoogleSearch: false,
    },
    { 
        value: 'gemini-3-pro-image-preview', 
        label: 'Gemini 3 Pro Image', 
        codename: 'Nano Banana Pro',
        description: 'Professional quality, up to 4K',
        features: ['High fidelity', 'Up to 14 reference images', 'Google Search grounding', 'Thinking mode', 'Text rendering'],
        resolutions: ['1K', '2K', '4K'],
        supportsThinking: true,
        supportsGoogleSearch: true,
    },
];

// ============================================================================
// ASPECT RATIO OPTIONS
// Per https://ai.google.dev/gemini-api/docs/image-generation#aspect-ratios-and-image-size
// ============================================================================

const ASPECT_RATIOS = [
    { value: '1:1', label: 'Square', icon: '⬜', description: 'Profile pics, icons', size1k: '1024×1024' },
    { value: '2:3', label: 'Portrait 2:3', icon: '📱', description: 'Social media posts', size1k: '832×1248' },
    { value: '3:2', label: 'Landscape 3:2', icon: '🖼️', description: 'Standard photos', size1k: '1248×832' },
    { value: '3:4', label: 'Portrait 3:4', icon: '📷', description: 'Mobile screens', size1k: '864×1184' },
    { value: '4:3', label: 'Landscape 4:3', icon: '🎬', description: 'Classic format', size1k: '1184×864' },
    { value: '4:5', label: 'Portrait 4:5', icon: '📸', description: 'Instagram portrait', size1k: '896×1152' },
    { value: '5:4', label: 'Landscape 5:4', icon: '🖥️', description: 'Display format', size1k: '1152×896' },
    { value: '9:16', label: 'Story 9:16', icon: '📲', description: 'Stories, Reels', size1k: '768×1344' },
    { value: '16:9', label: 'Wide 16:9', icon: '🎥', description: 'Video, banners', size1k: '1344×768' },
    { value: '21:9', label: 'Ultrawide', icon: '🎞️', description: 'Cinematic', size1k: '1536×672' },
];

// ============================================================================
// PROMPT TEMPLATES
// Per https://ai.google.dev/gemini-api/docs/image-generation#prompting-guide-and-strategies
// ============================================================================

const PROMPT_TEMPLATES = [
    {
        category: 'Photorealistic Scenes',
        template: 'A photorealistic [shot type] of [subject], [action], set in [environment]. Illuminated by [lighting], creating a [mood] atmosphere. Captured with a [camera/lens], emphasizing [textures].',
        example: 'A photorealistic close-up portrait of an elderly Japanese ceramicist, carefully glazing a delicate tea bowl, set in a traditional workshop. The scene is illuminated by soft natural light from a large window, creating a peaceful atmosphere. Captured with a 85mm f/1.4 lens, emphasizing the texture of weathered hands and ceramic.',
    },
    {
        category: 'Stylized Illustrations',
        template: 'A [style] sticker of a [subject], featuring [key characteristics] and a [color palette]. The design should have [line style] and [shading style]. The background must be transparent.',
        example: 'A kawaii-style sticker of a happy red panda, featuring big sparkly eyes and rosy cheeks with a pastel pink and cream color palette. The design should have clean bold outlines and soft cel shading. The background must be transparent.',
    },
    {
        category: 'Text in Images',
        template: 'Create a [image type] for [brand/concept] with the text "[text to render]" in a [font style]. The design should be [style description], with a [color scheme].',
        example: 'Create a modern minimalist logo for a coffee shop with the text "The Daily Grind" in a bold sans-serif font. The design should be clean and sophisticated, with warm brown and cream color scheme.',
    },
    {
        category: 'Product Mockups',
        template: 'A high-resolution, studio-lit product photograph of a [product] on a [background]. The lighting is [setup] to [purpose]. Camera angle is [angle] to showcase [feature]. Ultra-realistic.',
        example: 'A high-resolution, studio-lit product photograph of a minimalist ceramic coffee mug on a marble surface. The lighting is a three-point softbox setup to create soft shadows. Camera angle is 45-degree to showcase the handle design. Ultra-realistic.',
    },
    {
        category: 'Minimalist Design',
        template: 'A minimalist composition featuring a single [subject] positioned in the [position] of the frame. The background is a vast, empty [color] canvas, creating significant negative space.',
        example: 'A minimalist composition featuring a single delicate red maple leaf positioned in the bottom-right of the frame. The background is a vast, empty soft cream canvas, creating significant negative space.',
    },
    {
        category: 'Sequential Art',
        template: 'Make a [count] panel comic in a [style] style. Put the character in a [scene type]. The panels should show [action sequence].',
        example: 'Make a 3 panel comic in a manga style. Put the character in a coffee shop scene. The panels should show them ordering, waiting, and enjoying their drink with exaggerated expressions.',
    },
];

// ============================================================================
// SAMPLE IMAGE URLs for Testing
// ============================================================================

const SAMPLE_IMAGE_URLS = [
    { label: 'Landscape', url: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800' },
    { label: 'City', url: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=800' },
    { label: 'Portrait', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800' },
    { label: 'Food', url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800' },
    { label: 'Architecture', url: 'https://images.unsplash.com/photo-1431576901776-e539bd916ba2?w=800' },
    { label: 'Animal', url: 'https://images.unsplash.com/photo-1474511320723-9a56873571b7?w=800' },
    { label: 'Product', url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800' },
    { label: 'Interior', url: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=800' },
];

// ============================================================================
// EDIT OPERATION TYPES
// Per https://ai.google.dev/gemini-api/docs/image-generation#prompts-for-editing-images
// ============================================================================

const EDIT_OPERATIONS = [
    { 
        value: 'add-remove', 
        label: 'Add/Remove Elements', 
        template: 'Using the provided image, please [add/remove] [element] to/from the scene. Ensure the change integrates naturally with the existing lighting and style.',
        example: 'Using the provided image, please add a small tabby cat sitting on the windowsill. Ensure the change integrates naturally with the existing lighting and style.',
    },
    { 
        value: 'inpainting', 
        label: 'Inpainting (Semantic Masking)', 
        template: 'Using the provided image, change only the [specific element] to [new element/description]. Keep everything else in the image exactly the same.',
        example: 'Using the provided image, change only the blue car to a red sports car. Keep everything else in the image exactly the same.',
    },
    { 
        value: 'style-transfer', 
        label: 'Style Transfer', 
        template: 'Transform the provided photograph into the artistic style of [artist/art style]. Preserve the original composition but render it with [stylistic elements].',
        example: 'Transform the provided photograph into the artistic style of Van Gogh\'s Starry Night. Preserve the original composition but render it with swirling brushstrokes and vibrant colors.',
    },
    { 
        value: 'sketch-to-image', 
        label: 'Bring Sketch to Life', 
        template: 'Turn this rough sketch of a [subject] into a [style description] photo. Keep the [features] from the sketch but add [details].',
        example: 'Turn this rough sketch of a dragon into a detailed fantasy illustration. Keep the pose and wing shape from the sketch but add scales, fire breath, and dramatic lighting.',
    },
];

// ============================================================================
// GENERATION MODES (TABS)
// ============================================================================

type GenerationMode = 'text-to-image' | 'image-editing' | 'multi-image-compose';

function ImageGenerateDemoPage() {
    const params = useParams();
    const guildId = params.guildId as string;

    // Mode selection
    const [mode, setMode] = useState<GenerationMode>('text-to-image');

    // Common state
    const [prompt, setPrompt] = useState('');
    const [model, setModel] = useState('gemini-3.1-flash-image-preview');
    const [aspectRatio, setAspectRatio] = useState('1:1');
    const [imageSize, setImageSize] = useState('1K');
    const [useGoogleSearch, setUseGoogleSearch] = useState(false);
    const [includeThoughts, setIncludeThoughts] = useState(false);
    const [includeText, setIncludeText] = useState(true);

    // Image editing state
    const [editImageUrl, setEditImageUrl] = useState('');
    const [editImageFile, setEditImageFile] = useState<File | null>(null);
    const [editImagePreview, setEditImagePreview] = useState('');
    const [editOperation, setEditOperation] = useState('add-remove');

    // Multi-image compose state
    const [composeImageUrls, setComposeImageUrls] = useState<string[]>(['']);

    // UI state
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<any>(null);
    const [showPromptGuide, setShowPromptGuide] = useState(false);

    // Get current model info
    const currentModel = IMAGE_MODELS.find(m => m.value === model) || IMAGE_MODELS[0];
    const currentAspectRatio = ASPECT_RATIOS.find(ar => ar.value === aspectRatio) || ASPECT_RATIOS[0];

    // Handle file upload for image editing
    const handleEditImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setEditImageFile(file);
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result as string;
            setEditImagePreview(base64String);
            setEditImageUrl(base64String);
        };
        reader.readAsDataURL(file);
    };

    // *** DEMO CODE *** - Handle text-to-image generation
    const handleTextToImage = async () => {
        if (!prompt.trim()) return;
        
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const requestParams: any = {
                prompt,
                model,
                aspect_ratio: aspectRatio,
                include_text: includeText,
            };

            // Add Pro model features
            if (model === 'gemini-3-pro-image-preview') {
                requestParams.image_size = imageSize;
                requestParams.use_google_search = useGoogleSearch;
                requestParams.include_thoughts = includeThoughts;
            }

            const response = await apiClient.geminiImageGenerate(requestParams);
            setResult(response);
        } catch (e: unknown) {
            const errorMessage = e instanceof Error ? e.message : 'Failed to generate image';
            const axiosError = e as { response?: { data?: { detail?: string } } };
            setError(axiosError.response?.data?.detail || errorMessage);
        } finally {
            setLoading(false);
        }
    };

    // *** DEMO CODE *** - Handle image editing
    const handleImageEdit = async () => {
        if (!prompt.trim() || !editImageUrl.trim()) return;
        
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const response = await apiClient.geminiImageEdit({
                prompt,
                image_url: editImageUrl,
                model,
                aspect_ratio: aspectRatio,
                image_size: model === 'gemini-3-pro-image-preview' ? imageSize : undefined,
            });
            setResult(response);
        } catch (e: unknown) {
            const errorMessage = e instanceof Error ? e.message : 'Failed to edit image';
            const axiosError = e as { response?: { data?: { detail?: string } } };
            setError(axiosError.response?.data?.detail || errorMessage);
        } finally {
            setLoading(false);
        }
    };

    // *** DEMO CODE *** - Handle multi-image composition
    const handleImageCompose = async () => {
        const validUrls = composeImageUrls.filter(url => url.trim());
        if (!prompt.trim() || validUrls.length === 0) return;
        
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const response = await apiClient.geminiImageCompose({
                prompt,
                image_urls: validUrls,
                model,
                aspect_ratio: aspectRatio,
                image_size: model === 'gemini-3-pro-image-preview' ? imageSize : undefined,
            });
            setResult(response);
        } catch (e: unknown) {
            const errorMessage = e instanceof Error ? e.message : 'Failed to compose images';
            const axiosError = e as { response?: { data?: { detail?: string } } };
            setError(axiosError.response?.data?.detail || errorMessage);
        } finally {
            setLoading(false);
        }
    };

    // Add/remove compose image URLs
    const addComposeUrl = () => {
        const maxUrls = model === 'gemini-3-pro-image-preview' ? 14 : 3;
        if (composeImageUrls.length < maxUrls) {
            setComposeImageUrls([...composeImageUrls, '']);
        }
    };

    const removeComposeUrl = (index: number) => {
        if (composeImageUrls.length > 1) {
            setComposeImageUrls(composeImageUrls.filter((_, i) => i !== index));
        }
    };

    const updateComposeUrl = (index: number, value: string) => {
        const updated = [...composeImageUrls];
        updated[index] = value;
        setComposeImageUrls(updated);
    };

    // Handle generation based on mode
    const handleGenerate = () => {
        switch (mode) {
            case 'text-to-image':
                handleTextToImage();
                break;
            case 'image-editing':
                handleImageEdit();
                break;
            case 'multi-image-compose':
                handleImageCompose();
                break;
        }
    };

    // Download generated image
    const handleDownload = () => {
        if (!result?.image_base64) return;
        const link = document.createElement('a');
        link.href = `data:image/png;base64,${result.image_base64}`;
        link.download = `gemini-image-${Date.now()}.png`;
        link.click();
    };

    // Apply prompt template
    const applyTemplate = (template: string) => {
        setPrompt(template);
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white p-6">
            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center gap-4 mb-4">
                    <Link
                        href={`/dashboard/${guildId}/gemini-demo`}
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        ← Back to Gemini Demo
                    </Link>
                </div>
                <h1 className="text-3xl font-bold mb-2">🎨 Nano Banana Image Generation</h1>
                <p className="text-gray-400">
                    Gemini&apos;s native image generation with text-to-image, editing, and multi-image composition
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Panel - Input */}
                <div className="space-y-4">
                    {/* Mode Tabs */}
                    <div className="bg-gray-800 rounded-lg p-1 flex">
                        <button
                            onClick={() => setMode('text-to-image')}
                            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                                mode === 'text-to-image'
                                    ? 'bg-blue-600 text-white'
                                    : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            📝 Text → Image
                        </button>
                        <button
                            onClick={() => setMode('image-editing')}
                            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                                mode === 'image-editing'
                                    ? 'bg-blue-600 text-white'
                                    : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            ✏️ Edit Image
                        </button>
                        <button
                            onClick={() => setMode('multi-image-compose')}
                            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                                mode === 'multi-image-compose'
                                    ? 'bg-blue-600 text-white'
                                    : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            🖼️ Multi-Image
                        </button>
                    </div>

                    {/* Model Selection */}
                    <div className="bg-gray-800 rounded-lg p-4">
                        <label className="block text-sm font-medium text-gray-300 mb-2">Model</label>
                        <div className="space-y-2">
                            {IMAGE_MODELS.map((m) => (
                                <label
                                    key={m.value}
                                    className={`flex items-start p-3 rounded-lg border cursor-pointer transition-colors ${
                                        model === m.value
                                            ? 'border-blue-500 bg-blue-500/10'
                                            : 'border-gray-700 hover:border-gray-600'
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="model"
                                        value={m.value}
                                        checked={model === m.value}
                                        onChange={(e) => setModel(e.target.value)}
                                        className="mt-1 mr-3"
                                    />
                                    <div>
                                        <div className="font-medium">{m.label}</div>
                                        <div className="text-xs text-gray-400">{m.codename} • {m.description}</div>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {m.features.map((f, i) => (
                                                <span key={i} className="text-xs bg-gray-700 px-2 py-0.5 rounded">
                                                    {f}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Image Input for Editing Mode */}
                    {mode === 'image-editing' && (
                        <div className="bg-gray-800 rounded-lg p-4">
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Source Image
                            </label>

                            {/* File Upload */}
                            <div className="mb-3">
                                <label className="block w-full cursor-pointer">
                                    <div className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-center hover:bg-gray-600 transition-colors">
                                        <span className="text-white">📁 Upload Image</span>
                                        {editImageFile && <span className="text-gray-400 ml-2">({editImageFile.name})</span>}
                                    </div>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleEditImageFileChange}
                                        className="hidden"
                                    />
                                </label>
                            </div>

                            {/* URL Input */}
                            <div className="mb-2">
                                <div className="text-xs text-gray-500 mb-1">Or paste URL:</div>
                                <input
                                    type="url"
                                    value={editImageFile ? '' : editImageUrl}
                                    onChange={(e) => {
                                        setEditImageUrl(e.target.value);
                                        setEditImageFile(null);
                                        setEditImagePreview('');
                                    }}
                                    disabled={!!editImageFile}
                                    placeholder="https://example.com/image.jpg"
                                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                                />
                            </div>

                            <div className="mt-2 flex flex-wrap gap-1">
                                <span className="text-xs text-gray-500">Try:</span>
                                {SAMPLE_IMAGE_URLS.slice(0, 6).map((sample) => (
                                    <button
                                        key={sample.url}
                                        onClick={() => {
                                            setEditImageUrl(sample.url);
                                            setEditImageFile(null);
                                            setEditImagePreview('');
                                        }}
                                        className="text-xs text-blue-400 hover:text-blue-300 px-2 py-0.5 bg-gray-700 rounded"
                                    >
                                        {sample.label}
                                    </button>
                                ))}
                            </div>

                            {/* Edit Operation Type */}
                            <label className="block text-sm font-medium text-gray-300 mt-4 mb-2">
                                Edit Type
                            </label>
                            <select
                                value={editOperation}
                                onChange={(e) => {
                                    setEditOperation(e.target.value);
                                    const op = EDIT_OPERATIONS.find(o => o.value === e.target.value);
                                    if (op) setPrompt(op.template);
                                }}
                                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                            >
                                {EDIT_OPERATIONS.map((op) => (
                                    <option key={op.value} value={op.value}>{op.label}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Multiple Image URLs for Compose Mode */}
                    {mode === 'multi-image-compose' && (
                        <div className="bg-gray-800 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-sm font-medium text-gray-300">
                                    Reference Images ({composeImageUrls.filter(u => u.trim()).length}/{model === 'gemini-3-pro-image-preview' ? 14 : 3})
                                </label>
                                <button
                                    onClick={addComposeUrl}
                                    disabled={composeImageUrls.length >= (model === 'gemini-3-pro-image-preview' ? 14 : 3)}
                                    className="text-xs text-blue-400 hover:text-blue-300 disabled:text-gray-600"
                                >
                                    + Add Image
                                </button>
                            </div>
                            <div className="space-y-2">
                                {composeImageUrls.map((url, index) => (
                                    <div key={index} className="flex gap-2">
                                        <input
                                            type="url"
                                            value={url}
                                            onChange={(e) => updateComposeUrl(index, e.target.value)}
                                            placeholder={`Image ${index + 1} URL`}
                                            className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-500"
                                        />
                                        {composeImageUrls.length > 1 && (
                                            <button
                                                onClick={() => removeComposeUrl(index)}
                                                className="px-2 text-red-400 hover:text-red-300"
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1">
                                <span className="text-xs text-gray-500">Samples:</span>
                                {SAMPLE_IMAGE_URLS.slice(0, 5).map((sample, idx) => (
                                    <button
                                        key={sample.url}
                                        onClick={() => {
                                            const newUrls = [...composeImageUrls];
                                            const emptyIndex = newUrls.findIndex(u => !u.trim());
                                            if (emptyIndex >= 0) {
                                                newUrls[emptyIndex] = sample.url;
                                            } else if (newUrls.length < (model === 'gemini-3-pro-image-preview' ? 14 : 3)) {
                                                newUrls.push(sample.url);
                                            }
                                            setComposeImageUrls(newUrls);
                                        }}
                                        className="text-xs text-blue-400 hover:text-blue-300 px-2 py-0.5 bg-gray-700 rounded"
                                    >
                                        {sample.label}
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                                💡 Pro model: Up to 5 humans (character consistency) + 6 objects (high fidelity) + 3 extras
                            </p>
                        </div>
                    )}

                    {/* Prompt Input */}
                    <div className="bg-gray-800 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-medium text-gray-300">Prompt</label>
                            <button
                                onClick={() => setShowPromptGuide(!showPromptGuide)}
                                className="text-xs text-blue-400 hover:text-blue-300"
                            >
                                {showPromptGuide ? 'Hide' : 'Show'} Templates
                            </button>
                        </div>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder={
                                mode === 'text-to-image'
                                    ? 'Describe the image you want to create in detail...'
                                    : mode === 'image-editing'
                                    ? 'Describe how to modify the image...'
                                    : 'Describe how to combine the reference images...'
                            }
                            className="w-full h-32 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        />
                        
                        {/* Prompt Templates */}
                        {showPromptGuide && (
                            <div className="mt-3 p-3 bg-gray-700/50 rounded-lg max-h-60 overflow-y-auto">
                                <p className="text-xs text-gray-400 mb-2">Click a template to use it:</p>
                                {PROMPT_TEMPLATES.map((t, i) => (
                                    <div key={i} className="mb-3">
                                        <button
                                            onClick={() => applyTemplate(t.example)}
                                            className="text-left w-full hover:bg-gray-600/50 p-2 rounded transition-colors"
                                        >
                                            <div className="text-xs font-medium text-blue-400">{t.category}</div>
                                            <div className="text-xs text-gray-400 truncate">{t.template}</div>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Aspect Ratio Selection */}
                    <div className="bg-gray-800 rounded-lg p-4">
                        <label className="block text-sm font-medium text-gray-300 mb-2">Aspect Ratio</label>
                        <div className="grid grid-cols-5 gap-2">
                            {ASPECT_RATIOS.map((ar) => (
                                <button
                                    key={ar.value}
                                    onClick={() => setAspectRatio(ar.value)}
                                    className={`p-2 rounded-lg border text-center transition-colors ${
                                        aspectRatio === ar.value
                                            ? 'border-blue-500 bg-blue-500/10'
                                            : 'border-gray-700 hover:border-gray-600'
                                    }`}
                                    title={`${ar.label} - ${ar.description} (${ar.size1k})`}
                                >
                                    <div className="text-lg">{ar.icon}</div>
                                    <div className="text-xs text-gray-400">{ar.value}</div>
                                </button>
                            ))}
                        </div>
                        <div className="text-xs text-gray-500 mt-2">
                            Selected: {currentAspectRatio.label} ({currentAspectRatio.size1k} at 1K)
                        </div>
                    </div>

                    {/* Pro Model Options */}
                    {model === 'gemini-3-pro-image-preview' && (
                        <div className="bg-gray-800 rounded-lg p-4 space-y-4">
                            <div className="text-sm font-medium text-gray-300 mb-2">Pro Model Options</div>
                            
                            {/* Resolution */}
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Output Resolution</label>
                                <div className="flex gap-2">
                                    {['1K', '2K', '4K'].map((res) => (
                                        <button
                                            key={res}
                                            onClick={() => setImageSize(res)}
                                            className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                                                imageSize === res
                                                    ? 'border-purple-500 bg-purple-500/10 text-purple-300'
                                                    : 'border-gray-700 hover:border-gray-600 text-gray-400'
                                            }`}
                                        >
                                            {res}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Google Search Grounding (text-to-image only) */}
                            {mode === 'text-to-image' && (
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={useGoogleSearch}
                                        onChange={(e) => setUseGoogleSearch(e.target.checked)}
                                        className="w-4 h-4 rounded"
                                    />
                                    <div>
                                        <div className="text-sm">🔍 Google Search Grounding</div>
                                        <div className="text-xs text-gray-500">Generate based on real-time data (weather, events, etc.)</div>
                                    </div>
                                </label>
                            )}

                            {/* Include Thoughts */}
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={includeThoughts}
                                    onChange={(e) => setIncludeThoughts(e.target.checked)}
                                    className="w-4 h-4 rounded"
                                />
                                <div>
                                    <div className="text-sm">💭 Show Thinking Process</div>
                                    <div className="text-xs text-gray-500">View interim images the model generates while reasoning</div>
                                </div>
                            </label>

                            {/* Include Text Response */}
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={includeText}
                                    onChange={(e) => setIncludeText(e.target.checked)}
                                    className="w-4 h-4 rounded"
                                />
                                <div>
                                    <div className="text-sm">📝 Include Text Response</div>
                                    <div className="text-xs text-gray-500">Get text description with the image</div>
                                </div>
                            </label>
                        </div>
                    )}

                    {/* Generate Button */}
                    <button
                        onClick={handleGenerate}
                        disabled={loading || !prompt.trim() || (mode === 'image-editing' && !editImageUrl.trim())}
                        className={`w-full py-3 rounded-lg font-medium transition-colors ${
                            loading || !prompt.trim()
                                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                : 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700'
                        }`}
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span>
                                {mode === 'text-to-image' ? 'Generating...' : mode === 'image-editing' ? 'Editing...' : 'Composing...'}
                            </span>
                        ) : (
                            <span>🎨 {mode === 'text-to-image' ? 'Generate Image' : mode === 'image-editing' ? 'Edit Image' : 'Compose Images'}</span>
                        )}
                    </button>

                    {/* Prompting Best Practices */}
                    <div className="bg-gray-800/50 rounded-lg p-4 text-sm">
                        <div className="font-medium text-gray-300 mb-2">💡 Prompting Best Practices</div>
                        <ul className="text-xs text-gray-500 space-y-1">
                            <li>• <strong>Describe</strong> scenes narratively, don&apos;t just list keywords</li>
                            <li>• Use <strong>photography terms</strong>: &quot;wide-angle shot&quot;, &quot;macro&quot;, &quot;low-angle&quot;</li>
                            <li>• Be <strong>hyper-specific</strong> about lighting, textures, and mood</li>
                            <li>• For <strong>text in images</strong>: Specify exact text, font style, and placement</li>
                            <li>• <strong>Semantic negatives</strong>: Say what you want, not what to avoid</li>
                        </ul>
                    </div>
                </div>

                {/* Right Panel - Output */}
                <div className="space-y-4">
                    {/* Error Display */}
                    {error && (
                        <div className="bg-red-900/50 border border-red-500 rounded-lg p-4">
                            <div className="text-red-400 font-medium">Error</div>
                            <div className="text-red-300 text-sm mt-1">{error}</div>
                        </div>
                    )}

                    {/* Loading State */}
                    {loading && (
                        <div className="bg-gray-800 rounded-lg p-8 flex flex-col items-center justify-center">
                            <div className="animate-spin h-12 w-12 border-4 border-purple-500 border-t-transparent rounded-full mb-4"></div>
                            <div className="text-gray-400">
                                {model === 'gemini-3-pro-image-preview' 
                                    ? 'Thinking and generating (may take 30-60s)...'
                                    : 'Generating image...'}
                            </div>
                        </div>
                    )}

                    {/* Image Preview (show immediately when image is selected in editing mode) */}
                    {mode === 'image-editing' && (editImagePreview || editImageUrl) && !result && !loading && (
                        <div className="bg-gray-800 rounded-lg p-4">
                            <div className="text-sm font-medium text-gray-300 mb-2">📸 Source Image Preview</div>
                            <div className="relative bg-gray-700 rounded-lg overflow-hidden">
                                <img
                                    src={editImagePreview || editImageUrl}
                                    alt="Source image preview"
                                    className="w-full"
                                />
                            </div>
                            <div className="text-xs text-gray-500 mt-2 text-center">
                                Ready to edit. Add your prompt and click Edit Image.
                            </div>
                        </div>
                    )}

                    {/* Result Display */}
                    {result && result.success && (
                        <div className="bg-gray-800 rounded-lg overflow-hidden">
                            {/* For Image Editing: Show Before/After */}
                            {mode === 'image-editing' && (editImagePreview || editImageUrl) ? (
                                <div className="space-y-4 p-4">
                                    {/* Original Image */}
                                    <div>
                                        <div className="text-sm font-medium text-gray-300 mb-2">📸 Original Image</div>
                                        <div className="relative bg-gray-700 rounded-lg overflow-hidden">
                                            <img
                                                src={editImagePreview || editImageUrl}
                                                alt="Original image"
                                                className="w-full"
                                            />
                                        </div>
                                    </div>

                                    {/* Arrow/Divider */}
                                    <div className="flex items-center justify-center">
                                        <div className="text-2xl text-gray-500">↓</div>
                                    </div>

                                    {/* Edited Image */}
                                    <div>
                                        <div className="text-sm font-medium text-gray-300 mb-2">✨ Edited Result</div>
                                        <div className="relative bg-gray-700 rounded-lg overflow-hidden">
                                            <img
                                                src={`data:image/png;base64,${result.image_base64}`}
                                                alt="Edited image"
                                                className="w-full"
                                            />
                                            <button
                                                onClick={handleDownload}
                                                className="absolute top-4 right-4 bg-gray-900/80 hover:bg-gray-800 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-2"
                                            >
                                                ⬇️ Download
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* Generated Image (text-to-image and multi-image modes) */
                                <div className="relative">
                                    <img
                                        src={`data:image/png;base64,${result.image_base64}`}
                                        alt="Generated image"
                                        className="w-full"
                                    />
                                    <button
                                        onClick={handleDownload}
                                        className="absolute top-4 right-4 bg-gray-900/80 hover:bg-gray-800 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-2"
                                    >
                                        ⬇️ Download
                                    </button>
                                </div>
                            )}

                            {/* Text Response */}
                            {result.text_response && (
                                <div className="p-4 border-t border-gray-700">
                                    <div className="text-sm font-medium text-gray-300 mb-2">Model Response</div>
                                    <div className="text-sm text-gray-400">{result.text_response}</div>
                                </div>
                            )}

                            {/* Thought Images */}
                            {result.thought_images && result.thought_images.length > 0 && (
                                <div className="p-4 border-t border-gray-700">
                                    <div className="text-sm font-medium text-gray-300 mb-2">
                                        💭 Thinking Process ({result.thought_count} interim images)
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        {result.thought_images.map((img: string, i: number) => (
                                            <img
                                                key={i}
                                                src={`data:image/png;base64,${img}`}
                                                alt={`Thought ${i + 1}`}
                                                className="rounded-lg opacity-70"
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Usage Stats */}
                            {result.usage && (
                                <div className="p-4 border-t border-gray-700">
                                    <div className="text-sm font-medium text-gray-300 mb-2">Usage</div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                        <div>
                                            <div className="text-gray-500">Model</div>
                                            <div className="text-gray-300">{result.model}</div>
                                        </div>
                                        <div>
                                            <div className="text-gray-500">Aspect Ratio</div>
                                            <div className="text-gray-300">{result.aspect_ratio}</div>
                                        </div>
                                        {result.image_size && (
                                            <div>
                                                <div className="text-gray-500">Resolution</div>
                                                <div className="text-gray-300">{result.image_size}</div>
                                            </div>
                                        )}
                                        <div>
                                            <div className="text-gray-500">Latency</div>
                                            <div className="text-gray-300">{result.usage.latency_ms?.toFixed(0) || '-'}ms</div>
                                        </div>
                                        <div>
                                            <div className="text-gray-500">Total Tokens</div>
                                            <div className="text-gray-300">{result.usage.total_tokens || '-'}</div>
                                        </div>
                                        <div>
                                            <div className="text-gray-500">Est. Cost</div>
                                            <div className="text-green-400">${result.usage.estimated_cost?.toFixed(4) || '-'}</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Grounding Metadata */}
                            {result.grounding_metadata && (
                                <div className="p-4 border-t border-gray-700">
                                    <div className="text-sm font-medium text-gray-300 mb-2">🔍 Google Search Grounding</div>
                                    <div className="text-xs text-gray-500 break-all">{result.grounding_metadata}</div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Empty State */}
                    {!loading && !result && !error && (
                        <div className="bg-gray-800 rounded-lg p-8 text-center">
                            <div className="text-6xl mb-4">🎨</div>
                            <div className="text-gray-400 mb-2">No image generated yet</div>
                            <div className="text-sm text-gray-500">
                                {mode === 'text-to-image' && 'Enter a prompt and click Generate to create an image'}
                                {mode === 'image-editing' && 'Provide an image URL and edit instructions'}
                                {mode === 'multi-image-compose' && 'Add reference images and describe the composition'}
                            </div>
                        </div>
                    )}

                    {/* API Documentation Reference */}
                    <div className="bg-gray-800/50 rounded-lg p-4">
                        <div className="text-sm font-medium text-gray-300 mb-2">📚 Documentation</div>
                        <div className="text-xs text-gray-500 space-y-1">
                            <p>This demo implements the Gemini Image Generation API (Nano Banana).</p>
                            <p>
                                <a href="https://ai.google.dev/gemini-api/docs/image-generation" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                                    → Official Documentation
                                </a>
                            </p>
                            <p className="mt-2"><strong>API Endpoints Used:</strong></p>
                            <ul className="list-disc list-inside pl-2">
                                <li>POST /gemini/image-generate</li>
                                <li>POST /gemini/image-edit</li>
                                <li>POST /gemini/image-compose</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default withPermission(ImageGenerateDemoPage, PermissionLevel.AUTHORIZED);
