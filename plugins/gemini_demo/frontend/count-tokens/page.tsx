/**
 * *** DEMO CODE *** - Token Count Demo
 * Count tokens and estimate costs before sending requests.
 * Supports all Gemini models with accurate pricing information.
 * 
 * Features:
 * - Token counting with model-specific tokenization
 * - Cost estimation with input/output pricing
 * - Billable character counting for different content types
 * - Context limit guidance
 * 
 * Documentation: https://ai.google.dev/gemini-api/docs/tokens
 */

'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { withPermission } from '@/lib/components/with-permission';
import { PermissionLevel } from '@/lib/permissions';
import { apiClient } from '@/app/api-client';

// *** DEMO CODE *** - Model definitions with pricing
interface ModelPricing {
    id: string;
    name: string;
    series: string;
    inputPrice: number;   // per 1M tokens
    outputPrice: number;  // per 1M tokens
    contextWindow: string;
    outputLimit: string;
    notes?: string;
}

const MODELS: ModelPricing[] = [
    // Gemini 3 Series
    { 
        id: 'gemini-3-flash-preview', 
        name: 'Gemini 3 Flash', 
        series: '3',
        inputPrice: 0.50, 
        outputPrice: 3.00, 
        contextWindow: '1M',
        outputLimit: '65K',
        notes: 'Supports thinking levels'
    },
    { 
        id: 'gemini-3-pro-preview', 
        name: 'Gemini 3 Pro', 
        series: '3',
        inputPrice: 2.00, 
        outputPrice: 12.00, 
        contextWindow: '1M',
        outputLimit: '65K',
        notes: 'Most capable, deep reasoning'
    },
    // Gemini 2.5 Series
    { 
        id: 'gemini-2.5-flash', 
        name: 'Gemini 2.5 Flash', 
        series: '2.5',
        inputPrice: 0.15, 
        outputPrice: 0.60, 
        contextWindow: '1M',
        outputLimit: '65K',
        notes: 'Budget thinking model'
    },
    { 
        id: 'gemini-2.5-pro', 
        name: 'Gemini 2.5 Pro', 
        series: '2.5',
        inputPrice: 1.25, 
        outputPrice: 10.00, 
        contextWindow: '1M',
        outputLimit: '65K',
        notes: 'Best 2.5 reasoning'
    },
    // Gemini 2.0 Series
    { 
        id: 'gemini-2.0-flash', 
        name: 'Gemini 2.0 Flash', 
        series: '2.0',
        inputPrice: 0.10, 
        outputPrice: 0.40, 
        contextWindow: '1M',
        outputLimit: '8K',
        notes: 'Legacy, stable'
    },
    // Embedding Model
    { 
        id: 'gemini-embedding-001', 
        name: 'Gemini Embedding', 
        series: 'embedding',
        inputPrice: 0.00, // Free tier
        outputPrice: 0.00, 
        contextWindow: '2K',
        outputLimit: 'N/A',
        notes: 'Free, 2048 token limit'
    },
];

// *** DEMO CODE *** - Token pricing tiers (for future dynamic pricing)
const TOKEN_COST_INFO = {
    text: '~4 chars per token for English text',
    code: '~3-4 chars per token for code',
    image: 'Images: 258 tokens (<384px) to 768 tokens (>768px)',
    audio: '32 tokens per second of audio',
    video: '263 tokens/second (video) + 32 tokens/second (audio)',
};

function TokenCountDemoPage() {
    const params = useParams();
    const guildId = params.guildId as string;

    // State
    const [text, setText] = useState('');
    const [model, setModel] = useState('gemini-2.5-flash');
    const [estimatedOutputTokens, setEstimatedOutputTokens] = useState(500);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<any>(null);

    // Get current model info
    const currentModel = MODELS.find(m => m.id === model) || MODELS[0];

    // Calculate estimated cost
    const calculateCost = (inputTokens: number, outputTokens: number): number => {
        const inputCost = (inputTokens / 1_000_000) * currentModel.inputPrice;
        const outputCost = (outputTokens / 1_000_000) * currentModel.outputPrice;
        return inputCost + outputCost;
    };

    // Format cost display
    const formatCost = (cost: number): string => {
        if (cost < 0.0001) return '< $0.0001';
        if (cost < 0.01) return `$${cost.toFixed(6)}`;
        return `$${cost.toFixed(4)}`;
    };

    // *** DEMO CODE *** - Count tokens
    const handleCount = async () => {
        if (!text.trim()) return;
        
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const response = await apiClient.geminiCountTokens({
                content: text,
                model: model
            });
            setResult(response);
        } catch (e: any) {
            setError(e.response?.data?.detail || e.message || 'Failed to count tokens');
        } finally {
            setLoading(false);
        }
    };

    // *** DEMO CODE *** - Estimate tokens without API call
    const estimateTokens = (text: string): number => {
        // Rough estimate: ~4 characters per token for English
        return Math.ceil(text.length / 4);
    };

    const estimatedInputTokens = estimateTokens(text);
    const estimatedCost = calculateCost(
        result?.token_count || estimatedInputTokens, 
        estimatedOutputTokens
    );

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
                <h1 className="text-2xl font-bold text-white">🔢 Token Count &amp; Cost Estimator</h1>
            </div>

            {/* Info Banner */}
            <div className="mb-8 p-4 bg-yellow-900/20 border border-yellow-600/30 rounded-lg">
                <p className="text-yellow-200/70">
                    Count tokens and estimate costs before sending requests. Different content types 
                    (text, images, audio) have different tokenization rates.
                    <a 
                        href="https://ai.google.dev/gemini-api/docs/tokens" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="ml-2 text-yellow-400 hover:text-yellow-300 underline"
                    >
                        View Documentation →
                    </a>
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Input Panel */}
                <div className="space-y-6">
                    <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                        {/* Model Selection */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Model
                            </label>
                            <select
                                value={model}
                                onChange={(e) => setModel(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <optgroup label="Gemini 3 Series (Latest)">
                                    {MODELS.filter(m => m.series === '3').map((m) => (
                                        <option key={m.id} value={m.id}>
                                            {m.name} - ${m.inputPrice}/${m.outputPrice} per 1M
                                        </option>
                                    ))}
                                </optgroup>
                                <optgroup label="Gemini 2.5 Series">
                                    {MODELS.filter(m => m.series === '2.5').map((m) => (
                                        <option key={m.id} value={m.id}>
                                            {m.name} - ${m.inputPrice}/${m.outputPrice} per 1M
                                        </option>
                                    ))}
                                </optgroup>
                                <optgroup label="Gemini 2.0 Series (Legacy)">
                                    {MODELS.filter(m => m.series === '2.0').map((m) => (
                                        <option key={m.id} value={m.id}>
                                            {m.name} - ${m.inputPrice}/${m.outputPrice} per 1M
                                        </option>
                                    ))}
                                </optgroup>
                                <optgroup label="Embeddings">
                                    {MODELS.filter(m => m.series === 'embedding').map((m) => (
                                        <option key={m.id} value={m.id}>
                                            {m.name} - Free
                                        </option>
                                    ))}
                                </optgroup>
                            </select>
                            <div className="mt-2 flex gap-4 text-xs text-gray-500">
                                <span>Context: {currentModel.contextWindow}</span>
                                <span>|</span>
                                <span>Output: {currentModel.outputLimit}</span>
                                {currentModel.notes && (
                                    <>
                                        <span>|</span>
                                        <span>{currentModel.notes}</span>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Text Input */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Text to Count
                            </label>
                            <textarea
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                placeholder="Enter text to count tokens..."
                                className="w-full h-48 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                            />
                            <div className="mt-2 flex justify-between text-xs text-gray-500">
                                <span>{text.length.toLocaleString()} characters</span>
                                <span>~{estimateTokens(text).toLocaleString()} estimated tokens</span>
                            </div>
                        </div>

                        {/* Expected Output Slider */}
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Expected Output Tokens: {estimatedOutputTokens.toLocaleString()}
                            </label>
                            <input
                                type="range"
                                min="100"
                                max="8000"
                                step="100"
                                value={estimatedOutputTokens}
                                onChange={(e) => setEstimatedOutputTokens(parseInt(e.target.value))}
                                className="w-full"
                            />
                            <div className="flex justify-between text-xs text-gray-500 mt-1">
                                <span>Short (100)</span>
                                <span>Medium (2K)</span>
                                <span>Long (8K)</span>
                            </div>
                        </div>

                        {/* Count Button */}
                        <button
                            onClick={handleCount}
                            disabled={loading || !text.trim()}
                            className={`w-full py-3 rounded-lg font-medium transition-colors ${
                                loading || !text.trim()
                                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                    : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span>
                                    Counting...
                                </span>
                            ) : (
                                'Count Tokens (Accurate)'
                            )}
                        </button>
                    </div>

                    {/* Sample Texts */}
                    <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                        <h3 className="text-lg font-semibold text-white mb-3">Sample Texts</h3>
                        <div className="space-y-2">
                            {[
                                { label: 'Short sentence', text: 'Hello, how are you today?', tokens: '~6' },
                                { label: 'Longer paragraph', text: 'The quick brown fox jumps over the lazy dog. This pangram contains every letter of the English alphabet at least once. Pangrams are often used to display fonts and test keyboards.', tokens: '~45' },
                                { label: 'Code snippet (Python)', text: 'def fibonacci(n):\n    if n <= 1:\n        return n\n    return fibonacci(n - 1) + fibonacci(n - 2)', tokens: '~40' },
                                { label: 'JSON example', text: '{"name": "John Doe", "age": 30, "email": "john@example.com", "roles": ["admin", "user"]}', tokens: '~35' },
                                { label: 'Large prompt (~500 tokens)', text: 'You are an expert software architect with deep experience in designing large-scale distributed systems. Your task is to analyze the following system requirements and provide a comprehensive architectural proposal.\n\nRequirements:\n1. The system must handle 10 million daily active users\n2. Response latency must be under 100ms for 99th percentile\n3. Data must be replicated across 3 geographic regions\n4. The system must support real-time notifications\n5. All data must be encrypted at rest and in transit\n6. The system must be cost-effective and auto-scale based on demand\n7. Support for both REST and GraphQL APIs\n8. Integration with third-party authentication providers\n\nPlease provide:\n- High-level architecture diagram description\n- Technology stack recommendations\n- Database design considerations\n- Caching strategy\n- Message queue design\n- Deployment strategy\n- Monitoring and observability approach\n- Cost estimation methodology', tokens: '~200' },
                            ].map((example) => (
                                <button
                                    key={example.label}
                                    onClick={() => setText(example.text)}
                                    className="w-full text-left px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 text-sm flex justify-between items-center"
                                >
                                    <span>{example.label}</span>
                                    <span className="text-gray-500 text-xs">{example.tokens}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Output Panel */}
                <div className="space-y-6">
                    {/* Error */}
                    {error && (
                        <div className="bg-red-900/20 border border-red-600/30 rounded-lg p-4">
                            <p className="text-red-400">{error}</p>
                        </div>
                    )}

                    {/* Token Count Result */}
                    {result?.success && (
                        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                            <h3 className="text-lg font-semibold text-white mb-6">Token Count Result</h3>
                            
                            {/* Main Token Count */}
                            <div className="text-center mb-8">
                                <div className="text-6xl font-bold text-blue-400 mb-2">
                                    {result.token_count?.toLocaleString() || 0}
                                </div>
                                <p className="text-gray-400">input tokens (accurate)</p>
                            </div>

                            {/* Stats Grid */}
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="bg-gray-800 rounded-lg p-4 text-center">
                                    <div className="text-2xl font-bold text-green-400">
                                        {text.length.toLocaleString()}
                                    </div>
                                    <div className="text-xs text-gray-400">Characters</div>
                                </div>
                                <div className="bg-gray-800 rounded-lg p-4 text-center">
                                    <div className="text-2xl font-bold text-purple-400">
                                        {result.token_count > 0 
                                            ? (text.length / result.token_count).toFixed(2)
                                            : '-'
                                        }
                                    </div>
                                    <div className="text-xs text-gray-400">Chars/Token</div>
                                </div>
                            </div>

                            {/* Model Info */}
                            <div className="space-y-2 text-sm border-t border-gray-800 pt-4">
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Model</span>
                                    <span className="text-white font-mono">{result.model || model}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Billable Characters</span>
                                    <span className="text-white">{result.billable_characters?.toLocaleString() || text.length.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Cost Estimation */}
                    <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                        <h3 className="text-lg font-semibold text-white mb-4">💰 Cost Estimation</h3>
                        
                        <div className="space-y-4">
                            {/* Input Cost */}
                            <div className="flex justify-between items-center">
                                <div>
                                    <span className="text-gray-300">Input Cost</span>
                                    <span className="text-gray-500 text-xs ml-2">
                                        ({(result?.token_count || estimatedInputTokens).toLocaleString()} tokens × ${currentModel.inputPrice}/1M)
                                    </span>
                                </div>
                                <span className="text-blue-400 font-mono">
                                    {formatCost(((result?.token_count || estimatedInputTokens) / 1_000_000) * currentModel.inputPrice)}
                                </span>
                            </div>

                            {/* Output Cost */}
                            <div className="flex justify-between items-center">
                                <div>
                                    <span className="text-gray-300">Output Cost</span>
                                    <span className="text-gray-500 text-xs ml-2">
                                        (~{estimatedOutputTokens.toLocaleString()} tokens × ${currentModel.outputPrice}/1M)
                                    </span>
                                </div>
                                <span className="text-green-400 font-mono">
                                    {formatCost((estimatedOutputTokens / 1_000_000) * currentModel.outputPrice)}
                                </span>
                            </div>

                            {/* Divider */}
                            <div className="border-t border-gray-700 pt-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-white font-medium">Total Estimated Cost</span>
                                    <span className="text-yellow-400 font-bold text-xl">
                                        {formatCost(estimatedCost)}
                                    </span>
                                </div>
                            </div>

                            {/* Per-request scale */}
                            <div className="bg-gray-800 rounded-lg p-4 mt-4">
                                <h4 className="text-sm font-medium text-gray-300 mb-3">Cost at Scale</h4>
                                <div className="grid grid-cols-3 gap-3 text-center text-sm">
                                    <div>
                                        <div className="text-lg font-bold text-gray-200">
                                            {formatCost(estimatedCost * 100)}
                                        </div>
                                        <div className="text-xs text-gray-500">100 requests</div>
                                    </div>
                                    <div>
                                        <div className="text-lg font-bold text-gray-200">
                                            {formatCost(estimatedCost * 1000)}
                                        </div>
                                        <div className="text-xs text-gray-500">1K requests</div>
                                    </div>
                                    <div>
                                        <div className="text-lg font-bold text-gray-200">
                                            {formatCost(estimatedCost * 10000)}
                                        </div>
                                        <div className="text-xs text-gray-500">10K requests</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tokenization Info */}
                    <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                        <h3 className="text-lg font-semibold text-white mb-3">📊 Token Rates by Content Type</h3>
                        <div className="space-y-3 text-sm">
                            {Object.entries(TOKEN_COST_INFO).map(([key, value]) => (
                                <div key={key} className="flex items-start gap-3">
                                    <span className="text-gray-500 capitalize font-medium w-16">{key}:</span>
                                    <span className="text-gray-300">{value}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Model Pricing Reference */}
                    <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                        <h3 className="text-lg font-semibold text-white mb-3">📋 Model Pricing Reference</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-700">
                                        <th className="text-left py-2 text-gray-400">Model</th>
                                        <th className="text-right py-2 text-gray-400">Input</th>
                                        <th className="text-right py-2 text-gray-400">Output</th>
                                        <th className="text-right py-2 text-gray-400">Context</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {MODELS.filter(m => m.series !== 'embedding').map((m) => (
                                        <tr 
                                            key={m.id} 
                                            className={`border-b border-gray-800 ${m.id === model ? 'bg-blue-900/20' : ''}`}
                                        >
                                            <td className="py-2 text-gray-300">{m.name}</td>
                                            <td className="text-right py-2 text-gray-300">${m.inputPrice}</td>
                                            <td className="text-right py-2 text-gray-300">${m.outputPrice}</td>
                                            <td className="text-right py-2 text-gray-300">{m.contextWindow}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <p className="mt-3 text-xs text-gray-500">
                            Prices per 1 million tokens. Thinking tokens billed at output rate.
                        </p>
                    </div>

                    {/* Loading State */}
                    {loading && (
                        <div className="bg-gray-900 rounded-lg p-12 border border-gray-800 text-center">
                            <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                            <p className="text-gray-300">Counting tokens...</p>
                        </div>
                    )}

                    {/* Empty State */}
                    {!result && !loading && !error && (
                        <div className="bg-gray-900 rounded-lg p-12 border border-gray-800 text-center">
                            <div className="text-6xl mb-4">🔢</div>
                            <h3 className="text-lg font-medium text-gray-300 mb-2">Ready to Count</h3>
                            <p className="text-gray-500">
                                Enter text and click &quot;Count Tokens&quot; for accurate token count
                            </p>
                            <p className="text-gray-600 text-sm mt-2">
                                Cost estimation updates in real-time
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="mt-8 p-4 bg-gray-900 rounded-lg border border-gray-800 text-center">
                <p className="text-gray-400 text-sm">
                    *** DEMO CODE *** - Token counting uses the Gemini API&apos;s <code className="text-blue-400">countTokens</code> method
                </p>
            </div>
        </div>
    );
}

export default withPermission(TokenCountDemoPage, PermissionLevel.USER);
