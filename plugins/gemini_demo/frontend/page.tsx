/**
 * *** DEMO CODE *** - Gemini Capabilities Demo Hub
 * Main demo page showcasing Gemini API capabilities with:
 * - All available models with pricing information
 * - Thinking levels (minimal, low, medium, high)
 * - Temperature control
 * - Token usage and cost estimation
 * - Thought summaries
 * - System instructions
 * 
 * Documentation: https://ai.google.dev/gemini-api/docs
 */

'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { withPermission } from '@/lib/components/with-permission';
import { PermissionLevel } from '@/lib/permissions';
import { apiClient } from '@/app/api-client';

// *** DEMO CODE *** - All Gemini Models with Pricing
interface ModelInfo {
    value: string;
    label: string;
    description: string;
    series: string;
    inputPrice: number;
    outputPrice: number;
    contextWindow: string;
    thinkingSupport: string[];
    defaultThinking: string | null;
}

const MODELS: ModelInfo[] = [
    // Gemini 3.1 Series (Latest)
    {
        value: 'gemini-3.1-flash-lite-preview',
        label: 'Gemini 3.1 Flash-Lite Preview',
        description: 'Fast, efficient text generation (default)',
        series: '3.1',
        inputPrice: 0.10,
        outputPrice: 0.40,
        contextWindow: '1M',
        thinkingSupport: [],
        defaultThinking: null
    },
    // Gemini 3 Series
    {
        value: 'gemini-3-flash-preview',
        label: 'Gemini 3 Flash',
        description: 'Fast, efficient, supports thinking',
        series: '3',
        inputPrice: 0.50,
        outputPrice: 3.00,
        contextWindow: '1M',
        thinkingSupport: ['minimal', 'low', 'medium', 'high'],
        defaultThinking: 'high'
    },
    {
        value: 'gemini-3-pro-preview',
        label: 'Gemini 3 Pro',
        description: 'Most capable, deep reasoning',
        series: '3',
        inputPrice: 2.00,
        outputPrice: 12.00,
        contextWindow: '1M',
        thinkingSupport: ['low', 'high'],
        defaultThinking: 'high'
    },
    // Gemini 2.5 Series
    { 
        value: 'gemini-2.5-flash', 
        label: 'Gemini 2.5 Flash', 
        description: 'Budget-friendly, fast',
        series: '2.5',
        inputPrice: 0.15,
        outputPrice: 0.60,
        contextWindow: '1M',
        thinkingSupport: ['budget'],
        defaultThinking: 'dynamic'
    },
    { 
        value: 'gemini-2.5-pro', 
        label: 'Gemini 2.5 Pro', 
        description: 'Powerful reasoning',
        series: '2.5',
        inputPrice: 1.25,
        outputPrice: 10.00,
        contextWindow: '1M',
        thinkingSupport: ['budget'],
        defaultThinking: 'dynamic'
    },
    // Gemini 2.0 Series
    { 
        value: 'gemini-2.0-flash', 
        label: 'Gemini 2.0 Flash', 
        description: 'Legacy, stable',
        series: '2.0',
        inputPrice: 0.10,
        outputPrice: 0.40,
        contextWindow: '1M',
        thinkingSupport: [],
        defaultThinking: null
    },
];

// *** DEMO CODE *** - Thinking Level Options (Gemini 3)
const THINKING_LEVELS = [
    { 
        value: 'minimal', 
        label: 'Minimal', 
        description: 'Near-zero thinking (Flash only)',
        icon: '⚡',
        color: 'text-yellow-400'
    },
    { 
        value: 'low', 
        label: 'Low', 
        description: 'Minimize latency & cost',
        icon: '🏃',
        color: 'text-green-400'
    },
    { 
        value: 'medium', 
        label: 'Medium', 
        description: 'Balanced (Flash only)',
        icon: '⚖️',
        color: 'text-blue-400'
    },
    { 
        value: 'high', 
        label: 'High', 
        description: 'Maximum reasoning depth',
        icon: '🧠',
        color: 'text-purple-400'
    },
];

// Capability cards for navigation
const CAPABILITIES = [
    { icon: '🧠', name: 'Text Generation', desc: 'Text with thinking', slug: '', current: true },
    { icon: '🎨', name: 'Image Generation', desc: 'Create images from text', slug: 'image-generate' },
    { icon: '👁️', name: 'Vision', desc: 'Image understanding', slug: 'image-understand' },
    { icon: '🔊', name: 'Text-to-Speech', desc: '30 voices, emotions', slug: 'tts' },
    { icon: '🎤', name: 'Audio Transcribe', desc: 'Mic, YouTube, files', slug: 'audio-transcribe' },
    { icon: '📊', name: 'Embeddings', desc: 'Vector embeddings', slug: 'embeddings' },
    { icon: '📋', name: 'Structured', desc: 'JSON schema output', slug: 'structured' },
    { icon: '🔧', name: 'Functions', desc: 'Tool/function calling', slug: 'function-calling' },
    { icon: '🌐', name: 'URL Context', desc: 'Web grounding + search', slug: 'url-context' },
    { icon: '🔢', name: 'Token Counter', desc: 'Count tokens & cost', slug: 'count-tokens' },
    { icon: '💾', name: 'Context Caching', desc: 'Cache large contexts', slug: 'caching' },
    { icon: '🔍', name: 'File Search', desc: 'Semantic file search', slug: 'file-search' },
];

// *** DEMO CODE *** - Main Demo Page Component
function GeminiDemoPage() {
    const params = useParams();
    const guildId = params.guildId as string;

    // State for text generation demo
    const [prompt, setPrompt] = useState('');
    const [systemInstruction, setSystemInstruction] = useState('');
    const [model, setModel] = useState('gemini-3.1-flash-lite-preview');
    const [thinkingLevel, setThinkingLevel] = useState('high');
    const [temperature, setTemperature] = useState(1.0);
    const [showThoughts, setShowThoughts] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);
    
    const [response, setResponse] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Get current model info
    const currentModel = MODELS.find(m => m.value === model) || MODELS[0];
    const supportsThinking = currentModel.thinkingSupport.length > 0;
    const isGemini3 = currentModel.series === '3' || currentModel.series === '3.1';

    // Calculate estimated cost
    const calculateCost = (inputTokens: number, outputTokens: number, thoughtsTokens: number = 0) => {
        const inputCost = (inputTokens / 1000000) * currentModel.inputPrice;
        const outputCost = ((outputTokens + thoughtsTokens) / 1000000) * currentModel.outputPrice;
        return inputCost + outputCost;
    };

    // *** DEMO CODE *** - Handle text generation
    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        
        setLoading(true);
        setError(null);
        setResponse(null);

        try {
            const requestParams: any = {
                prompt,
                model,
                include_thoughts: showThoughts,
                guild_id: guildId,
                temperature,
            };

            // Add thinking level for Gemini 3 models
            if (isGemini3 && supportsThinking) {
                requestParams.thinking_level = thinkingLevel;
            }

            // Add system instruction if provided
            if (systemInstruction.trim()) {
                requestParams.system_instruction = systemInstruction;
            }

            const result = await apiClient.geminiGenerate(requestParams);
            setResponse(result);
        } catch (e: any) {
            setError(e.response?.data?.detail || e.message || 'Failed to generate response');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* *** DEMO HEADER *** */}
            <div className="mb-8 p-4 bg-yellow-900/20 border border-yellow-600/30 rounded-lg">
                <h1 className="text-2xl font-bold text-yellow-400 mb-2">
                    ⚠️ DEMO: Gemini Capabilities Test
                </h1>
                <p className="text-yellow-200/70">
                    This page demonstrates Gemini API capabilities. It is demonstration code
                    and should be removed or secured before production deployment.
                    <a 
                        href="https://ai.google.dev/gemini-api/docs" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="ml-2 text-yellow-400 hover:text-yellow-300 underline"
                    >
                        View Documentation →
                    </a>
                </p>
            </div>

            {/* *** DEMO CODE *** - Text Generation Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Input Panel */}
                <div className="space-y-6">
                    <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                        <h2 className="text-xl font-semibold text-white mb-4">
                            🧠 Text Generation with Thinking
                        </h2>

                        {/* Prompt Input */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Prompt
                            </label>
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="Enter your prompt... (e.g., 'Explain quantum entanglement')"
                                className="w-full h-32 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {/* Model Selection with Pricing */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Model
                            </label>
                            <select
                                value={model}
                                onChange={(e) => {
                                    setModel(e.target.value);
                                    const newModel = MODELS.find(m => m.value === e.target.value);
                                    if (newModel?.defaultThinking) {
                                        setThinkingLevel(newModel.defaultThinking);
                                    }
                                }}
                                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <optgroup label="Gemini 3.1 Series (Latest)">
                                    {MODELS.filter(m => m.series === '3.1').map((m) => (
                                        <option key={m.value} value={m.value}>
                                            {m.label} - ${m.inputPrice}/${m.outputPrice} per 1M tokens
                                        </option>
                                    ))}
                                </optgroup>
                                <optgroup label="Gemini 3 Series">
                                    {MODELS.filter(m => m.series === '3').map((m) => (
                                        <option key={m.value} value={m.value}>
                                            {m.label} - ${m.inputPrice}/${m.outputPrice} per 1M tokens
                                        </option>
                                    ))}
                                </optgroup>
                                <optgroup label="Gemini 2.5 Series">
                                    {MODELS.filter(m => m.series === '2.5').map((m) => (
                                        <option key={m.value} value={m.value}>
                                            {m.label} - ${m.inputPrice}/${m.outputPrice} per 1M tokens
                                        </option>
                                    ))}
                                </optgroup>
                                <optgroup label="Gemini 2.0 Series (Legacy)">
                                    {MODELS.filter(m => m.series === '2.0').map((m) => (
                                        <option key={m.value} value={m.value}>
                                            {m.label} - ${m.inputPrice}/${m.outputPrice} per 1M tokens
                                        </option>
                                    ))}
                                </optgroup>
                            </select>
                            <div className="mt-2 flex gap-4 text-xs text-gray-500">
                                <span>Context: {currentModel.contextWindow}</span>
                                <span>|</span>
                                <span className="text-gray-400">{currentModel.description}</span>
                            </div>
                        </div>

                        {/* Thinking Level Selection (Gemini 3 only) */}
                        {isGemini3 && supportsThinking && (
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Thinking Level
                                </label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {THINKING_LEVELS.filter(level => 
                                        currentModel.thinkingSupport.includes(level.value)
                                    ).map((level) => (
                                        <button
                                            key={level.value}
                                            onClick={() => setThinkingLevel(level.value)}
                                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                                thinkingLevel === level.value
                                                    ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                                                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                                            }`}
                                            title={level.description}
                                        >
                                            <span className="mr-1">{level.icon}</span>
                                            {level.label}
                                        </button>
                                    ))}
                                </div>
                                <p className="mt-2 text-xs text-gray-500">
                                    {THINKING_LEVELS.find(l => l.value === thinkingLevel)?.description}
                                </p>
                            </div>
                        )}

                        {/* Options */}
                        <div className="mb-4 space-y-2">
                            <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={showThoughts}
                                    onChange={(e) => setShowThoughts(e.target.checked)}
                                    className="rounded bg-gray-800 border-gray-600 text-blue-600 focus:ring-blue-500"
                                />
                                <span>Show model&apos;s thinking summary</span>
                            </label>
                        </div>

                        {/* Advanced Options Toggle */}
                        <div className="mb-4">
                            <button
                                onClick={() => setShowAdvanced(!showAdvanced)}
                                className="text-sm text-blue-400 hover:text-blue-300"
                            >
                                {showAdvanced ? '▼ Hide' : '▶ Show'} Advanced Options
                            </button>
                        </div>

                        {showAdvanced && (
                            <div className="mb-4 p-4 bg-gray-800/50 rounded-lg space-y-4">
                                {/* Temperature */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Temperature: {temperature.toFixed(1)}
                                    </label>
                                    <input
                                        type="range"
                                        min="0"
                                        max="2"
                                        step="0.1"
                                        value={temperature}
                                        onChange={(e) => setTemperature(parseFloat(e.target.value))}
                                        className="w-full"
                                    />
                                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                                        <span>Deterministic (0)</span>
                                        <span>Default (1.0)</span>
                                        <span>Creative (2)</span>
                                    </div>
                                    {isGemini3 && (
                                        <p className="mt-2 text-xs text-yellow-500">
                                            ⚠️ Gemini 3 recommends keeping temperature at 1.0
                                        </p>
                                    )}
                                </div>

                                {/* System Instruction */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        System Instruction (optional)
                                    </label>
                                    <textarea
                                        value={systemInstruction}
                                        onChange={(e) => setSystemInstruction(e.target.value)}
                                        placeholder="You are a helpful assistant..."
                                        className="w-full h-20 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Generate Button */}
                        <button
                            onClick={handleGenerate}
                            disabled={loading || !prompt.trim()}
                            className={`w-full py-3 rounded-lg font-medium transition-colors ${
                                loading || !prompt.trim()
                                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                    : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span>
                                    Generating...
                                </span>
                            ) : (
                                'Generate Response'
                            )}
                        </button>
                    </div>

                    {/* *** DEMO CODE *** - Quick Examples */}
                    <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                        <h3 className="text-lg font-semibold text-white mb-3">
                            Quick Examples
                        </h3>
                        <div className="space-y-2">
                            {[
                                { text: 'Explain how a neural network learns', thinking: 'high' },
                                { text: 'Write a haiku about programming', thinking: 'low' },
                                { text: 'Solve: If x + 3 = 7, what is x?', thinking: 'medium' },
                                { text: 'Compare REST and GraphQL APIs', thinking: 'high' },
                                { text: 'What is the capital of France?', thinking: 'minimal' },
                            ].map((example) => (
                                <button
                                    key={example.text}
                                    onClick={() => {
                                        setPrompt(example.text);
                                        if (isGemini3 && currentModel.thinkingSupport.includes(example.thinking)) {
                                            setThinkingLevel(example.thinking);
                                        }
                                    }}
                                    className="w-full text-left px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 text-sm transition-colors"
                                >
                                    <span className="text-xs text-gray-500 mr-2">
                                        {THINKING_LEVELS.find(l => l.value === example.thinking)?.icon}
                                    </span>
                                    {example.text}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Output Panel */}
                <div className="space-y-6">
                    {/* Error Display */}
                    {error && (
                        <div className="bg-red-900/20 border border-red-600/30 rounded-lg p-4">
                            <p className="text-red-400">{error}</p>
                        </div>
                    )}

                    {/* Response Display */}
                    {response && (
                        <>
                            {/* Main Response */}
                            <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                                <h3 className="text-lg font-semibold text-white mb-3">
                                    Response
                                </h3>
                                <div className="prose prose-invert max-w-none">
                                    <p className="text-gray-300 whitespace-pre-wrap">
                                        {response.text}
                                    </p>
                                </div>
                            </div>

                            {/* Thinking Summary */}
                            {response.thoughts_summary && (
                                <div className="bg-purple-900/20 rounded-lg p-6 border border-purple-600/30">
                                    <h3 className="text-lg font-semibold text-purple-300 mb-3">
                                        💭 Model&apos;s Thinking Summary
                                    </h3>
                                    <p className="text-purple-200/80 text-sm whitespace-pre-wrap">
                                        {response.thoughts_summary}
                                    </p>
                                </div>
                            )}

                            {/* Usage Stats */}
                            {response.usage && (
                                <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                                    <h3 className="text-lg font-semibold text-white mb-3">
                                        📊 Usage Statistics
                                    </h3>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                        <div className="bg-gray-800 rounded-lg p-3 text-center">
                                            <div className="text-2xl font-bold text-blue-400">
                                                {response.usage.prompt_tokens?.toLocaleString() || 0}
                                            </div>
                                            <div className="text-xs text-gray-400">Input Tokens</div>
                                        </div>
                                        <div className="bg-gray-800 rounded-lg p-3 text-center">
                                            <div className="text-2xl font-bold text-green-400">
                                                {response.usage.completion_tokens?.toLocaleString() || 0}
                                            </div>
                                            <div className="text-xs text-gray-400">Output Tokens</div>
                                        </div>
                                        <div className="bg-gray-800 rounded-lg p-3 text-center">
                                            <div className="text-2xl font-bold text-purple-400">
                                                {response.usage.thoughts_tokens?.toLocaleString() || 0}
                                            </div>
                                            <div className="text-xs text-gray-400">Thinking Tokens</div>
                                        </div>
                                        <div className="bg-gray-800 rounded-lg p-3 text-center">
                                            <div className="text-2xl font-bold text-yellow-400">
                                                ${response.usage.estimated_cost?.toFixed(6) || calculateCost(
                                                    response.usage.prompt_tokens || 0,
                                                    response.usage.completion_tokens || 0,
                                                    response.usage.thoughts_tokens || 0
                                                ).toFixed(6)}
                                            </div>
                                            <div className="text-xs text-gray-400">Est. Cost</div>
                                        </div>
                                    </div>
                                    <div className="mt-4 grid grid-cols-2 gap-4 text-sm text-gray-400">
                                        <div>
                                            <span className="font-medium">Latency:</span>{' '}
                                            {response.usage.latency_ms?.toFixed(0) || 0}ms
                                        </div>
                                        <div>
                                            <span className="font-medium">Model:</span>{' '}
                                            {currentModel.label}
                                        </div>
                                    </div>
                                    {response.usage.cached_tokens > 0 && (
                                        <div className="mt-2 text-sm text-green-400">
                                            ✓ {response.usage.cached_tokens.toLocaleString()} tokens from cache (reduced cost)
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}

                    {/* Loading State */}
                    {loading && (
                        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                            <div className="flex items-center gap-3">
                                <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                                <span className="text-gray-300">Generating response...</span>
                            </div>
                            {isGemini3 && thinkingLevel === 'high' && (
                                <p className="mt-2 text-xs text-gray-500">
                                    High thinking level may take longer for complex reasoning
                                </p>
                            )}
                        </div>
                    )}

                    {/* Empty State */}
                    {!response && !loading && !error && (
                        <div className="bg-gray-900 rounded-lg p-12 border border-gray-800 text-center">
                            <div className="text-6xl mb-4">🤖</div>
                            <h3 className="text-lg font-medium text-gray-300 mb-2">
                                Ready to Generate
                            </h3>
                            <p className="text-gray-500">
                                Enter a prompt and click Generate to test Gemini capabilities
                            </p>
                        </div>
                    )}

                    {/* Model Pricing Info */}
                    <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                        <h3 className="text-lg font-semibold text-white mb-3">
                            💰 Pricing Reference
                        </h3>
                        <div className="space-y-2 text-sm">
                            {MODELS.slice(0, 4).map((m) => (
                                <div key={m.value} className="flex justify-between text-gray-400">
                                    <span>{m.label}</span>
                                    <span>${m.inputPrice} / ${m.outputPrice} per 1M tokens</span>
                                </div>
                            ))}
                        </div>
                        <p className="mt-3 text-xs text-gray-500">
                            Input/Output pricing. Thinking tokens billed at output rate.
                        </p>
                    </div>
                </div>
            </div>

            {/* *** DEMO CODE *** - Capability Cards */}
            <div className="mt-12">
                <h2 className="text-xl font-semibold text-white mb-6">
                    Available Capabilities - Click to Demo
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {CAPABILITIES.map((cap) => (
                        <a
                            key={cap.name}
                            href={cap.current ? '#' : `/dashboard/${guildId}/gemini-demo/${cap.slug}`}
                            className={`block bg-gray-900 rounded-lg p-4 border transition-all duration-200 ${
                                cap.current 
                                    ? 'border-blue-500 bg-blue-900/20 shadow-lg shadow-blue-500/10' 
                                    : 'border-gray-800 hover:border-blue-500 hover:bg-gray-800 hover:shadow-lg hover:shadow-blue-500/5'
                            }`}
                        >
                            <div className="text-2xl mb-2">{cap.icon}</div>
                            <h3 className="font-medium text-white">{cap.name}</h3>
                            <p className="text-sm text-gray-400">{cap.desc}</p>
                            {cap.current && (
                                <span className="inline-block mt-2 text-xs bg-blue-600 text-white px-2 py-0.5 rounded">
                                    Current
                                </span>
                            )}
                        </a>
                    ))}
                </div>
            </div>

            {/* *** DEMO CODE *** - Footer */}
            <div className="mt-8 p-4 bg-gray-900 rounded-lg border border-gray-800 text-center">
                <p className="text-gray-400 text-sm">
                    *** DEMO CODE *** - See{' '}
                    <code className="text-blue-400">docs/GEMINI_CAPABILITIES.md</code>{' '}
                    for implementation details
                </p>
            </div>
        </div>
    );
}

// *** DEMO CODE *** - Export with permission wrapper
export default withPermission(GeminiDemoPage, PermissionLevel.USER);
