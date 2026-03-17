/**
 * *** DEMO CODE *** - Comprehensive Image Understanding Demo
 * 
 * Demonstrates all Gemini image understanding capabilities:
 * - Basic Understanding: Captioning, VQA, OCR, classification
 * - Object Detection: Bounding boxes with normalized coordinates
 * - Segmentation: Contour masks as base64 PNG
 * - Multi-Image: Compare and analyze multiple images
 * 
 * @see https://ai.google.dev/gemini-api/docs/image-understanding
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { withPermission } from '@/lib/components/with-permission';
import { PermissionLevel } from '@/lib/permissions';
import { apiClient } from '@/app/api-client';

type AnalysisMode = 'understand' | 'detect' | 'segment' | 'multi';

interface DetectedObject {
    label: string;
    box_2d: [number, number, number, number]; // [ymin, xmin, ymax, xmax] normalized 0-1000
}

interface SegmentedObject {
    label: string;
    box_2d: [number, number, number, number];
    absolute_box?: [number, number, number, number]; // [x0, y0, x1, y1] in pixels
    box_dimensions?: { width: number; height: number };
    has_mask: boolean;
    mask?: string; // base64 PNG (without data URL prefix)
    mask_invalid?: boolean; // true if mask was present but not a valid PNG
}

interface AnalysisResult {
    success: boolean;
    analysis?: string;
    objects?: DetectedObject[];
    segments?: SegmentedObject[];
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
    cost?: number;
    model?: string;
}

/**
 * SegmentationMask component - renders a Gemini segmentation mask on a canvas.
 * 
 * Gemini returns grayscale probability maps (0-255) where:
 * - 255 (white) = definitely part of the object
 * - 0 (black) = definitely NOT part of the object
 * - 127 = threshold for binary segmentation
 * 
 * This component:
 * 1. Loads the base64 PNG mask image
 * 2. Resizes it to match the bounding box dimensions
 * 3. Applies the probability values as alpha channel to a colored overlay
 */
function SegmentationMask({
    mask,
    box,
    color,
    label
}: {
    mask: string;
    box: { left: number; top: number; width: number; height: number };
    color: string;
    label: string;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !mask) {
            console.log('[SegmentationMask] Early return:', { hasCanvas: !!canvas, hasMask: !!mask });
            return;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            console.error('[SegmentationMask] Failed to get 2d context');
            return;
        }

        // Set canvas size to match bounding box
        const width = Math.round(box.width);
        const height = Math.round(box.height);
        canvas.width = width;
        canvas.height = height;

        console.log('[SegmentationMask] Rendering mask for', label, {
            box: { width, height, left: box.left, top: box.top },
            maskLength: mask.length,
            maskHeader: mask.substring(0, 50)
        });

        // Load the mask image
        const img = new Image();
        img.onload = () => {
            console.log('[SegmentationMask] Mask image loaded successfully for', label);
            // Draw mask to canvas, resizing to fit bounding box
            ctx.drawImage(img, 0, 0, width, height);

            // Get the pixel data
            const imageData = ctx.getImageData(0, 0, width, height);
            const data = imageData.data;

            // Parse the color (rgba format like 'rgba(255,107,107,0.5)')
            const colorMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
            const r = colorMatch ? parseInt(colorMatch[1]) : 255;
            const g = colorMatch ? parseInt(colorMatch[2]) : 0;
            const b = colorMatch ? parseInt(colorMatch[3]) : 0;

            // Convert grayscale mask to colored overlay with alpha
            // In the mask: white (255) = object, black (0) = background
            for (let i = 0; i < data.length; i += 4) {
                // Get the mask value (grayscale, so R=G=B)
                const maskValue = data[i]; // Use red channel as the value

                // Threshold at 127 for binary mask, but use gradual alpha for smooth edges
                const alpha = maskValue > 127 ? Math.min(200, maskValue * 0.8) : 0;

                // Set color with alpha based on mask
                data[i] = r;       // R
                data[i + 1] = g;   // G
                data[i + 2] = b;   // B
                data[i + 3] = alpha; // A
            }

            ctx.putImageData(imageData, 0, 0);
        };
        img.onerror = (e) => {
            console.error('Failed to load segmentation mask for', label, e);
            console.error('Mask data preview:', mask?.substring(0, 100));
        };

        // Handle both prefixed and non-prefixed masks
        // Backend should strip prefix, but handle both cases for robustness
        let maskSrc = mask;
        if (mask.startsWith('data:image/png;base64,')) {
            maskSrc = mask; // Already has prefix
        } else {
            maskSrc = `data:image/png;base64,${mask}`; // Add prefix
        }

        img.src = maskSrc;
    }, [mask, box.width, box.height, color, label]);

    return (
        <div
            className="absolute pointer-events-none"
            style={{
                left: box.left,
                top: box.top,
                width: box.width,
                height: box.height,
            }}
        >
            <canvas 
                ref={canvasRef}
                className="absolute inset-0 w-full h-full"
                style={{ imageRendering: 'auto' }}
            />
            {/* Border outline */}
            <div 
                className="absolute inset-0 border-2"
                style={{ borderColor: color.replace('0.5', '1') }}
            />
            <span 
                className="absolute -top-5 left-0 text-xs px-1 rounded font-medium"
                style={{ backgroundColor: color.replace('0.5', '0.9'), color: '#000' }}
            >
                {label}
            </span>
        </div>
    );
}

interface AnalysisResult {
    success: boolean;
    analysis?: string;
    objects?: DetectedObject[];
    segments?: SegmentedObject[];
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
    cost?: number;
    model?: string;
}

const MODES: { id: AnalysisMode; label: string; icon: string; description: string }[] = [
    { 
        id: 'understand', 
        label: 'Understanding', 
        icon: '🔍',
        description: 'Describe images, answer questions, extract text (OCR)'
    },
    { 
        id: 'detect', 
        label: 'Detection', 
        icon: '📦',
        description: 'Locate objects with bounding boxes'
    },
    {
        id: 'segment',
        label: 'Segmentation',
        icon: '✂️',
        description: 'Extract object masks for precise boundaries (Gemini 2.5+ only)'
    },
    { 
        id: 'multi', 
        label: 'Multi-Image', 
        icon: '🖼️',
        description: 'Compare and analyze multiple images'
    }
];

const MODELS = [
    { id: 'gemini-3.1-flash-image-preview', label: 'Gemini 3.1 Flash Image Preview (default)', supportsSegmentation: false },
    { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash', supportsSegmentation: false },
    { id: 'gemini-3-pro-preview', label: 'Gemini 3 Pro (best)', supportsSegmentation: false },
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', supportsSegmentation: true },
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', supportsSegmentation: true }
];

const MEDIA_RESOLUTIONS = [
    { id: 'auto', label: 'Auto (default)' },
    { id: 'low', label: 'Low (fastest, lowest cost)' },
    { id: 'medium', label: 'Medium' },
    { id: 'high', label: 'High' },
    { id: 'ultra_high', label: 'Ultra High (best quality)' }
];

const SAMPLE_PROMPTS: Record<AnalysisMode, string[]> = {
    understand: [
        'Describe this image in detail',
        'What objects can you identify in this image?',
        'What is the mood or emotion of this image?',
        'Extract all text visible in this image (OCR)',
        'What is happening in this scene?',
        'What colors are prominent in this image?'
    ],
    detect: [
        'Detect all objects in the image',
        'Detect all people and their positions',
        'Find all text regions in this image',
        'Locate all vehicles',
        'Detect all green colored objects',
        'Find the main subject of the image'
    ],
    segment: [
        'Segment all objects in this image',
        'Segment the main subject from the background',
        'Segment all people in the image',
        'Segment all wooden and glass items',
        'Segment the foreground elements',
        'Segment any text or signage'
    ],
    multi: [
        'Compare these images and describe the differences',
        'What do these images have in common?',
        'Describe the progression or story across these images',
        'Which image has the best composition?',
        'Are these images of the same subject?',
        'Summarize the content of all images'
    ]
};

const SAMPLE_IMAGES = [
    { label: 'Cat', url: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400' },
    { label: 'Dog', url: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400' },
    { label: 'City Skyline', url: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=400' },
    { label: 'Nature', url: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=400' },
    { label: 'Food', url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400' },
    { label: 'Architecture', url: 'https://images.unsplash.com/photo-1431576901776-e539bd916ba2?w=400' },
    { label: 'Document', url: 'https://images.unsplash.com/photo-1568667256549-094345857637?w=400' },
    { label: 'Chart', url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400' },
];

// Predefined image sets for multi-image comparison demos
const SAMPLE_IMAGE_SETS = [
    {
        label: '🐱 Cats vs Dogs',
        prompt: 'Compare these animals. What are the key differences?',
        urls: [
            'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400',
            'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400',
        ]
    },
    {
        label: '🌆 Day vs Night',
        prompt: 'Compare these cityscapes. How does the time of day affect the mood?',
        urls: [
            'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=400',
            'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=400',
        ]
    },
    {
        label: '🍕 Food Comparison',
        prompt: 'Compare these dishes. Which looks more appetizing and why?',
        urls: [
            'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400',
            'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400',
            'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400',
        ]
    },
    {
        label: '🏛️ Architecture Styles',
        prompt: 'Compare these buildings. What architectural styles are represented?',
        urls: [
            'https://images.unsplash.com/photo-1431576901776-e539bd916ba2?w=400',
            'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400',
            'https://images.unsplash.com/photo-1486718448742-163732cd1544?w=400',
        ]
    },
    {
        label: '🌸 Seasons',
        prompt: 'Describe how these images represent different seasons or times of year.',
        urls: [
            'https://images.unsplash.com/photo-1462275646964-a0e3386b89fa?w=400',
            'https://images.unsplash.com/photo-1508193638397-1c4234db14d8?w=400',
            'https://images.unsplash.com/photo-1516912481808-3406841bd33c?w=400',
        ]
    },
    {
        label: '📊 Charts & Data',
        prompt: 'Analyze these visualizations. What data stories are they telling?',
        urls: [
            'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400',
            'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400',
        ]
    },
];

function ImageUnderstandDemoPage() {
    const params = useParams();
    const guildId = params.guildId as string;

    const [mode, setMode] = useState<AnalysisMode>('understand');
    const [imageUrl, setImageUrl] = useState('');
    const [imageUrls, setImageUrls] = useState<string[]>(['', '', '']);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState('');
    const [prompt, setPrompt] = useState('Describe this image in detail');
    const [model, setModel] = useState('gemini-3.1-flash-image-preview');
    const [mediaResolution, setMediaResolution] = useState('auto');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<AnalysisResult | null>(null);
    const [showMaskOverlay, setShowMaskOverlay] = useState(true);

    const imageRef = useRef<HTMLImageElement>(null);
    const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });

    // Update default prompt when mode changes
    useEffect(() => {
        setPrompt(SAMPLE_PROMPTS[mode][0]);
        setResult(null);
        setError(null);

        // Switch to Gemini 2.5 model for segmentation (only 2.5 models support it)
        if (mode === 'segment' && !model.includes('2.5')) {
            setModel('gemini-2.5-flash');
        }
    }, [mode, model]);

    const handleImageLoad = useCallback(() => {
        if (imageRef.current) {
            setImageDimensions({
                width: imageRef.current.naturalWidth,
                height: imageRef.current.naturalHeight
            });
        }
    }, []);

    // Handle file upload
    const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImageFile(file);
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result as string;
            setImagePreview(base64String);
            setImageUrl(base64String);
        };
        reader.readAsDataURL(file);
    };

    const handleAnalyze = async () => {
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            let response: AnalysisResult;
            const baseParams = {
                model,
                media_resolution: mediaResolution === 'auto' ? undefined : mediaResolution
            };

            switch (mode) {
                case 'understand':
                    if (!imageUrl.trim()) throw new Error('Please enter an image URL');
                    response = await apiClient.geminiImageUnderstand({
                        image_url: imageUrl,
                        prompt,
                        ...baseParams
                    });
                    break;
                
                case 'detect':
                    if (!imageUrl.trim()) throw new Error('Please enter an image URL');
                    response = await apiClient.geminiImageDetect({
                        image_url: imageUrl,
                        prompt,
                        ...baseParams
                    });
                    break;
                
                case 'segment':
                    if (!imageUrl.trim()) throw new Error('Please enter an image URL');
                    response = await apiClient.geminiImageSegment({
                        image_url: imageUrl,
                        prompt,
                        ...baseParams
                    });
                    break;
                
                case 'multi':
                    const validUrls = imageUrls.filter(url => url.trim());
                    if (validUrls.length < 2) throw new Error('Please enter at least 2 image URLs');
                    response = await apiClient.geminiImageUnderstandMulti({
                        image_urls: validUrls,
                        prompt,
                        ...baseParams
                    });
                    break;
                
                default:
                    throw new Error('Unknown mode');
            }

            setResult(response);
        } catch (e: any) {
            setError(e.response?.data?.detail || e.message || 'Failed to analyze image');
        } finally {
            setLoading(false);
        }
    };

    // Convert normalized coordinates (0-1000) to pixels
    const boxToPixels = (box: [number, number, number, number]) => {
        const [ymin, xmin, ymax, xmax] = box;
        const displayWidth = imageRef.current?.clientWidth || imageDimensions.width;
        const displayHeight = imageRef.current?.clientHeight || imageDimensions.height;
        
        return {
            left: (xmin / 1000) * displayWidth,
            top: (ymin / 1000) * displayHeight,
            width: ((xmax - xmin) / 1000) * displayWidth,
            height: ((ymax - ymin) / 1000) * displayHeight
        };
    };

    const updateMultiImageUrl = (index: number, url: string) => {
        const newUrls = [...imageUrls];
        newUrls[index] = url;
        setImageUrls(newUrls);
    };

    const addImageSlot = () => {
        if (imageUrls.length < 10) {
            setImageUrls([...imageUrls, '']);
        }
    };

    const removeImageSlot = (index: number) => {
        if (imageUrls.length > 2) {
            setImageUrls(imageUrls.filter((_, i) => i !== index));
        }
    };

    // Load a predefined image set for multi-image comparison
    const loadImageSet = (set: typeof SAMPLE_IMAGE_SETS[0]) => {
        setImageUrls(set.urls);
        setPrompt(set.prompt);
        setResult(null);
        setError(null);
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-6 flex items-center gap-4">
                <Link 
                    href={`/dashboard/${guildId}/gemini-demo`}
                    className="text-gray-400 hover:text-white"
                >
                    ← Back
                </Link>
                <div className="h-6 w-px bg-gray-700" />
                <h1 className="text-2xl font-bold text-white">👁️ Image Understanding Demo</h1>
            </div>

            {/* Mode Tabs */}
            <div className="mb-6 flex flex-wrap gap-2">
                {MODES.map((m) => (
                    <button
                        key={m.id}
                        onClick={() => setMode(m.id)}
                        className={`px-4 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                            mode === m.id
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                        }`}
                    >
                        <span className="text-lg">{m.icon}</span>
                        <span>{m.label}</span>
                    </button>
                ))}
            </div>

            {/* Mode Description */}
            <div className="mb-8 p-4 bg-blue-900/20 border border-blue-600/30 rounded-lg">
                <p className="text-blue-200/70">
                    <strong>{MODES.find(m => m.id === mode)?.icon} {MODES.find(m => m.id === mode)?.label}:</strong>{' '}
                    {MODES.find(m => m.id === mode)?.description}
                </p>
                <p className="text-blue-200/50 text-sm mt-2">
                    📚 <a 
                        href="https://ai.google.dev/gemini-api/docs/image-understanding" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="underline hover:text-blue-300"
                    >
                        View Gemini Image Understanding Documentation
                    </a>
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Input Panel */}
                <div className="space-y-6">
                    {/* Model & Resolution Settings */}
                    <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                        <h3 className="text-lg font-semibold text-white mb-4">⚙️ Settings</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Model
                                </label>
                                <select
                                    value={model}
                                    onChange={(e) => setModel(e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    {MODELS.filter(m => mode !== 'segment' || m.supportsSegmentation).map((m) => (
                                        <option key={m.id} value={m.id}>{m.label}</option>
                                    ))}
                                </select>
                                {mode === 'segment' && (
                                    <p className="text-xs text-yellow-500 mt-1">
                                        ⚠️ Only Gemini 2.5 models support segmentation masks
                                    </p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Media Resolution
                                </label>
                                <select
                                    value={mediaResolution}
                                    onChange={(e) => setMediaResolution(e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    {MEDIA_RESOLUTIONS.map((r) => (
                                        <option key={r.id} value={r.id}>{r.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <p className="text-gray-500 text-xs mt-3">
                            💡 Higher resolution = better quality, more tokens. Token calculation: 258 tokens if ≤384px, else 258 per 768×768 tile.
                        </p>
                    </div>

                    {/* Image Input */}
                    <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                        <h3 className="text-lg font-semibold text-white mb-4">
                            {mode === 'multi' ? '🖼️ Image URLs' : '🖼️ Image URL'}
                        </h3>
                        
                        {mode === 'multi' ? (
                            <div className="space-y-3">
                                {imageUrls.map((url, index) => (
                                    <div key={index} className="flex gap-2">
                                        <input
                                            type="url"
                                            value={url}
                                            onChange={(e) => updateMultiImageUrl(index, e.target.value)}
                                            placeholder={`Image ${index + 1} URL`}
                                            className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                        {imageUrls.length > 2 && (
                                            <button
                                                onClick={() => removeImageSlot(index)}
                                                className="px-3 py-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30"
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>
                                ))}
                                {imageUrls.length < 10 && (
                                    <button
                                        onClick={addImageSlot}
                                        className="w-full py-2 border-2 border-dashed border-gray-700 rounded-lg text-gray-500 hover:text-gray-400 hover:border-gray-600"
                                    >
                                        + Add Another Image
                                    </button>
                                )}
                                <p className="text-gray-500 text-xs">
                                    💡 Multi-image mode supports up to 3,600 images per request
                                </p>
                                
                                {/* Sample Image Sets */}
                                <div className="mt-4 pt-4 border-t border-gray-800">
                                    <span className="text-gray-400 text-sm font-medium block mb-2">📦 Try a sample set:</span>
                                    <div className="flex flex-wrap gap-2">
                                        {SAMPLE_IMAGE_SETS.map((set, i) => (
                                            <button
                                                key={i}
                                                onClick={() => loadImageSet(set)}
                                                className="text-xs text-blue-400 hover:text-blue-300 px-3 py-1.5 bg-gray-800 rounded-lg border border-gray-700 hover:border-blue-500/50 transition-colors"
                                            >
                                                {set.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div>
                                {/* File Upload */}
                                <div className="mb-3">
                                    <label className="block w-full cursor-pointer">
                                        <div className="px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-center hover:bg-gray-700 transition-colors">
                                            <span className="text-white">📁 Upload Image</span>
                                            {imageFile && <span className="text-gray-400 ml-2">({imageFile.name})</span>}
                                        </div>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageFileChange}
                                            className="hidden"
                                        />
                                    </label>
                                </div>

                                {/* URL Input */}
                                <div className="mb-2">
                                    <div className="text-xs text-gray-500 mb-1">Or paste URL:</div>
                                    <input
                                        type="url"
                                        value={imageFile ? '' : imageUrl}
                                        onChange={(e) => {
                                            setImageUrl(e.target.value);
                                            setImageFile(null);
                                            setImagePreview('');
                                        }}
                                        disabled={!!imageFile}
                                        placeholder="https://example.com/image.jpg"
                                        className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                                    />
                                </div>

                                <div className="mt-3 flex flex-wrap gap-2">
                                    <span className="text-gray-500 text-xs">Try:</span>
                                    {SAMPLE_IMAGES.map((sample, i) => (
                                        <button
                                            key={i}
                                            onClick={() => {
                                                setImageUrl(sample.url);
                                                setImageFile(null);
                                                setImagePreview('');
                                            }}
                                            className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 bg-gray-800 rounded"
                                        >
                                            {sample.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Prompt Input */}
                    <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            💬 Prompt / Question
                        </label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="What would you like to know?"
                            className="w-full h-24 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        
                        <div className="mt-3 flex flex-wrap gap-2">
                            {SAMPLE_PROMPTS[mode].slice(0, 4).map((example) => (
                                <button
                                    key={example}
                                    onClick={() => setPrompt(example)}
                                    className="text-xs px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-gray-400 hover:text-gray-300"
                                >
                                    {example}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Analyze Button */}
                    <button
                        onClick={handleAnalyze}
                        disabled={loading || (mode === 'multi' ? imageUrls.filter(u => u.trim()).length < 2 : !imageUrl.trim())}
                        className={`w-full py-4 rounded-lg font-medium text-lg transition-colors ${
                            loading
                                ? 'bg-gray-700 text-gray-500 cursor-wait'
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span>
                                Analyzing...
                            </span>
                        ) : (
                            `${MODES.find(m => m.id === mode)?.icon} Analyze Image${mode === 'multi' ? 's' : ''}`
                        )}
                    </button>
                </div>

                {/* Output Panel */}
                <div className="space-y-6">
                    {error && (
                        <div className="bg-red-900/20 border border-red-600/30 rounded-lg p-4">
                            <p className="text-red-400">{error}</p>
                        </div>
                    )}

                    {/* Image Preview with Overlays */}
                    {mode !== 'multi' && (imagePreview || imageUrl) && (
                        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-lg font-semibold text-white">
                                    {result ? 'Analysis Result' : 'Image Preview'}
                                    {result?.objects && ` (${result.objects.length} objects detected)`}
                                    {result?.segments && ` (${result.segments.length} segments)`}
                                </h3>
                                {result?.segments && result.segments.length > 0 && (
                                    <button
                                        onClick={() => setShowMaskOverlay(!showMaskOverlay)}
                                        className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                                            showMaskOverlay
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-gray-700 text-gray-400'
                                        }`}
                                    >
                                        {showMaskOverlay ? '✂️ Masks On' : '✂️ Masks Off'}
                                    </button>
                                )}
                            </div>
                            {!result && !loading && (
                                <div className="text-xs text-gray-500 mb-2 text-center">
                                    Image loaded. Add your prompt and click Analyze.
                                </div>
                            )}
                            <div className="relative inline-block w-full">
                                <img
                                    ref={imageRef}
                                    src={imagePreview || imageUrl}
                                    alt="Preview"
                                    className="w-full rounded-lg"
                                    onLoad={handleImageLoad}
                                    onError={(e) => (e.currentTarget.style.display = 'none')}
                                />
                                
                                {/* Detection Bounding Boxes Overlay */}
                                {result?.objects && result.objects.map((obj, i) => {
                                    const box = boxToPixels(obj.box_2d);
                                    const colors = ['#ff6b6b', '#4ecdc4', '#ffe66d', '#95e1d3', '#f38181', '#aa96da', '#fcbad3'];
                                    const color = colors[i % colors.length];
                                    
                                    return (
                                        <div
                                            key={i}
                                            className="absolute border-2 pointer-events-none"
                                            style={{
                                                left: box.left,
                                                top: box.top,
                                                width: box.width,
                                                height: box.height,
                                                borderColor: color
                                            }}
                                        >
                                            <span 
                                                className="absolute -top-6 left-0 text-xs px-1 rounded"
                                                style={{ backgroundColor: color, color: '#000' }}
                                            >
                                                {obj.label}
                                            </span>
                                        </div>
                                    );
                                })}
                                
                                {/* Segmentation Mask Overlays */}
                                {showMaskOverlay && result?.segments && result.segments.map((seg, i) => {
                                    const colors = ['rgba(255,107,107,0.5)', 'rgba(78,205,196,0.5)', 'rgba(255,230,109,0.5)',
                                                    'rgba(149,225,211,0.5)', 'rgba(243,129,129,0.5)', 'rgba(170,150,218,0.5)'];
                                    const color = colors[i % colors.length];

                                    console.log('[Mask Overlay] Segment', i, {
                                        label: seg.label,
                                        has_mask: seg.has_mask,
                                        mask_length: seg.mask?.length || 0,
                                        has_box_2d: !!seg.box_2d,
                                        showMaskOverlay
                                    });

                                    // If we have box_2d and a valid mask, use canvas-based rendering
                                    if (seg.has_mask && seg.mask && seg.box_2d) {
                                        const box = boxToPixels(seg.box_2d);
                                        console.log('[Mask Overlay] Rendering SegmentationMask for', seg.label, box);
                                        return (
                                            <SegmentationMask
                                                key={`mask-${i}`}
                                                mask={seg.mask}
                                                box={box}
                                                color={color}
                                                label={seg.label}
                                            />
                                        );
                                    } else if (seg.box_2d) {
                                        // Fallback: show bounding box only if no mask
                                        const box = boxToPixels(seg.box_2d);
                                        return (
                                            <div
                                                key={`box-${i}`}
                                                className="absolute border-2 pointer-events-none"
                                                style={{
                                                    left: box.left,
                                                    top: box.top,
                                                    width: box.width,
                                                    height: box.height,
                                                    borderColor: color.replace('0.5', '0.8'),
                                                    backgroundColor: color.replace('0.5', '0.2'),
                                                }}
                                            >
                                                <span 
                                                    className="absolute -top-5 left-0 text-xs px-1 rounded font-medium"
                                                    style={{ backgroundColor: color.replace('0.5', '0.9'), color: '#000' }}
                                                >
                                                    {seg.label} (no mask)
                                                </span>
                                            </div>
                                        );
                                    }
                                    return null;
                                })}
                            </div>
                        </div>
                    )}

                    {/* Multi-Image Preview */}
                    {mode === 'multi' && imageUrls.some(u => u.trim()) && (
                        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                            <h3 className="text-lg font-semibold text-white mb-3">Preview</h3>
                            <div className="grid grid-cols-2 gap-2">
                                {imageUrls.filter(u => u.trim()).map((url, i) => (
                                    <img
                                        key={i}
                                        src={url}
                                        alt={`Image ${i + 1}`}
                                        className="w-full rounded-lg"
                                        onError={(e) => (e.currentTarget.style.opacity = '0.3')}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Analysis Result */}
                    {result?.success && (
                        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                            <h3 className="text-lg font-semibold text-white mb-4">
                                {mode === 'detect' ? '📦 Detection Results' : 
                                 mode === 'segment' ? '✂️ Segmentation Results' : 
                                 '📝 Analysis'}
                            </h3>
                            
                            {/* Text Analysis */}
                            {result.analysis && (
                                <div className="prose prose-invert max-w-none mb-4">
                                    <p className="text-gray-300 whitespace-pre-wrap">{result.analysis}</p>
                                </div>
                            )}

                            {/* Detection Objects List */}
                            {result.objects && (
                                <div className="space-y-2 mb-4">
                                    <p className="text-sm text-gray-400 mb-2">
                                        Detected {result.objects.length} object{result.objects.length !== 1 ? 's' : ''}:
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {result.objects.map((obj, i) => (
                                            <span 
                                                key={i}
                                                className="px-2 py-1 bg-gray-800 rounded text-sm text-gray-300"
                                            >
                                                {obj.label}
                                            </span>
                                        ))}
                                    </div>
                                    
                                    {/* Raw coordinates for developers */}
                                    <details className="mt-3">
                                        <summary className="text-sm text-gray-500 cursor-pointer">
                                            View raw coordinates (for developers)
                                        </summary>
                                        <pre className="mt-2 p-3 bg-gray-800 rounded text-xs text-gray-400 overflow-auto">
{JSON.stringify(result.objects, null, 2)}
                                        </pre>
                                        <p className="text-xs text-gray-500 mt-2">
                                            Coordinates are [ymin, xmin, ymax, xmax] normalized to 0-1000.
                                            <br/>
                                            Convert: abs_x = (x / 1000) × image_width
                                        </p>
                                    </details>
                                </div>
                            )}

                            {/* Segmentation Masks */}
                            {result.segments && (
                                <div className="space-y-4">
                                    <p className="text-sm text-gray-400">
                                        Segmented {result.segments.length} region{result.segments.length !== 1 ? 's' : ''}
                                        ({result.segments.filter(s => s.has_mask).length} with masks)
                                        {result.segments.some(s => !s.has_mask && s.mask_invalid) &&
                                            <span className="text-yellow-500 ml-2">⚠️ Some masks invalid</span>
                                        }:
                                    </p>
                                    <div className="grid grid-cols-2 gap-3">
                                        {result.segments.map((seg, i) => (
                                            <div key={i} className="bg-gray-800 rounded-lg p-3">
                                                <p className="text-sm font-medium text-white mb-2">
                                                    {seg.label}
                                                    {!seg.has_mask && <span className="text-yellow-500 ml-2">(no mask)</span>}
                                                </p>
                                                {seg.has_mask && seg.mask && (
                                                    <div className="relative">
                                                        <img 
                                                            src={`data:image/png;base64,${seg.mask}`}
                                                            alt={`Mask for ${seg.label}`}
                                                            className="w-full rounded bg-gray-900"
                                                        />
                                                        <p className="text-xs text-gray-500 mt-1">
                                                            Box: [{seg.box_2d.join(', ')}]
                                                            {seg.box_dimensions && ` (${seg.box_dimensions.width}×${seg.box_dimensions.height}px)`}
                                                        </p>
                                                    </div>
                                                )}
                                                {!seg.has_mask && seg.box_2d && (
                                                    <p className="text-xs text-gray-500">
                                                        Box only: [{seg.box_2d.join(', ')}]
                                                    </p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        💡 Masks are probability maps (0-255). Threshold at 127 for binary segmentation.
                                    </p>
                                </div>
                            )}

                            {/* Usage Stats */}
                            {result.usage && (
                                <div className="mt-4 pt-4 border-t border-gray-800 flex flex-wrap gap-4 text-sm text-gray-500">
                                    <span>Model: {result.model}</span>
                                    <span>Tokens: {result.usage.total_tokens?.toLocaleString()}</span>
                                    {result.cost !== undefined && (
                                        <span>Cost: ${result.cost.toFixed(6)}</span>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Loading State */}
                    {loading && (
                        <div className="bg-gray-900 rounded-lg p-12 border border-gray-800 text-center">
                            <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                            <p className="text-gray-300">
                                {mode === 'detect' ? 'Detecting objects...' :
                                 mode === 'segment' ? 'Generating segmentation masks...' :
                                 'Analyzing image...'}
                            </p>
                        </div>
                    )}

                    {/* Empty State */}
                    {!result && !loading && !error && (
                        <div className="bg-gray-900 rounded-lg p-12 border border-gray-800 text-center">
                            <div className="text-6xl mb-4">{MODES.find(m => m.id === mode)?.icon}</div>
                            <h3 className="text-lg font-medium text-gray-300 mb-2">
                                Ready for {MODES.find(m => m.id === mode)?.label}
                            </h3>
                            <p className="text-gray-500">
                                {mode === 'multi' 
                                    ? 'Enter at least 2 image URLs to compare'
                                    : 'Enter an image URL and click Analyze'}
                            </p>
                        </div>
                    )}

                    {/* Documentation Panel */}
                    <div className="bg-gray-900/50 rounded-lg p-6 border border-gray-800">
                        <h3 className="text-sm font-semibold text-gray-400 mb-3">📚 Mode Documentation</h3>
                        {mode === 'understand' && (
                            <div className="text-xs text-gray-500 space-y-2">
                                <p><strong>Understanding</strong> uses vision capabilities for:</p>
                                <ul className="list-disc list-inside space-y-1">
                                    <li>Image captioning and description</li>
                                    <li>Visual question answering (VQA)</li>
                                    <li>OCR (optical character recognition)</li>
                                    <li>Scene classification</li>
                                </ul>
                                <p className="mt-2">Supports: PNG, JPEG, WebP, HEIC, HEIF</p>
                            </div>
                        )}
                        {mode === 'detect' && (
                            <div className="text-xs text-gray-500 space-y-2">
                                <p><strong>Detection</strong> returns bounding boxes:</p>
                                <ul className="list-disc list-inside space-y-1">
                                    <li>Format: [ymin, xmin, ymax, xmax]</li>
                                    <li>Normalized to 0-1000 scale</li>
                                    <li>Works with counting prompts too</li>
                                </ul>
                                <p className="mt-2">
                                    Convert to pixels:<br/>
                                    <code className="bg-gray-800 px-1 rounded">x_px = (x / 1000) × width</code>
                                </p>
                            </div>
                        )}
                        {mode === 'segment' && (
                            <div className="text-xs text-gray-500 space-y-2">
                                <p><strong>Segmentation</strong> returns contour masks:</p>
                                <ul className="list-disc list-inside space-y-1">
                                    <li>Base64-encoded PNG masks</li>
                                    <li>Probability maps (0-255)</li>
                                    <li>Threshold at 127 for binary</li>
                                    <li>Includes bounding boxes too</li>
                                    <li className="text-yellow-500">⚠️ Requires Gemini 2.5+ models</li>
                                </ul>
                            </div>
                        )}
                        {mode === 'multi' && (
                            <div className="text-xs text-gray-500 space-y-2">
                                <p><strong>Multi-Image</strong> analyzes up to 3,600 images:</p>
                                <ul className="list-disc list-inside space-y-1">
                                    <li>Compare and find differences</li>
                                    <li>Analyze image sequences</li>
                                    <li>Batch classification</li>
                                    <li>Story/progression analysis</li>
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default withPermission(ImageUnderstandDemoPage, PermissionLevel.USER);
