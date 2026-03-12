/**
 * *** DEMO CODE *** - URL Context Demo (Enhanced)
 * Supports multiple URLs, Google Search combination, and detailed metadata
 */

'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { withPermission } from '@/lib/components/with-permission';
import { PermissionLevel } from '@/lib/permissions';
import { apiClient } from '@/app/api-client';

const MODELS = [
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash (Preview)' },
    { value: 'gemini-3-pro-preview', label: 'Gemini 3 Pro (Preview)' },
];

function URLContextDemoPage() {
    const params = useParams();
    const guildId = params.guildId as string;

    const [urls, setUrls] = useState<string[]>(['']);
    const [prompt, setPrompt] = useState('Summarize the main points from these pages');
    const [model, setModel] = useState('gemini-2.5-flash');
    const [systemInstruction, setSystemInstruction] = useState('');
    const [combineWithSearch, setCombineWithSearch] = useState(false);
    const [includeCitations, setIncludeCitations] = useState(true);
    const [dynamicThreshold, setDynamicThreshold] = useState<number | null>(null);
    const [useDynamicThreshold, setUseDynamicThreshold] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<any>(null);

    const addUrl = () => {
        if (urls.length < 20) {
            setUrls([...urls, '']);
        }
    };

    const removeUrl = (index: number) => {
        if (urls.length > 1) {
            setUrls(urls.filter((_, i) => i !== index));
        }
    };

    const updateUrl = (index: number, value: string) => {
        const newUrls = [...urls];
        newUrls[index] = value;
        setUrls(newUrls);
    };

    const handleGenerate = async () => {
        const validUrls = urls.filter(u => u.trim());
        if (validUrls.length === 0 || !prompt.trim()) return;
        
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const response = await apiClient.geminiURLContext({
                urls: validUrls,
                prompt,
                model,
                system_instruction: systemInstruction || undefined,
                combine_with_search: combineWithSearch,
                include_citations: includeCitations,
                dynamic_retrieval_threshold: useDynamicThreshold ? dynamicThreshold ?? undefined : undefined,
            });
            setResult(response);
        } catch (e: any) {
            setError(e.response?.data?.detail || e.message || 'Failed to process URLs');
        } finally {
            setLoading(false);
        }
    };

    const validUrlCount = urls.filter(u => u.trim()).length;

    return (
        <div className="p-8 max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-6 flex items-center gap-4">
                <Link 
                    href={`/dashboard/${guildId}/gemini-demo`}
                    className="text-gray-400 hover:text-white"
                >
                    ← Back
                </Link>
                <div className="h-6 w-px bg-gray-700" />
                <h1 className="text-2xl font-bold text-white">🌐 URL Context Demo</h1>
            </div>

            <div className="mb-8 p-4 bg-yellow-900/20 border border-yellow-600/30 rounded-lg">
                <p className="text-yellow-200/70">
                    Analyze 1-20 URLs as context. The model fetches web content and uses it to generate responses.
                    Optionally combine with Google Search for broader context.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Input */}
                <div className="space-y-6">
                    <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                        {/* URLs */}
                        <div className="mb-4">
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-sm font-medium text-gray-300">
                                    URLs ({validUrlCount}/20)
                                </label>
                                <button
                                    onClick={addUrl}
                                    disabled={urls.length >= 20}
                                    className="text-sm text-blue-400 hover:text-blue-300 disabled:text-gray-600"
                                >
                                    + Add URL
                                </button>
                            </div>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {urls.map((url, index) => (
                                    <div key={index} className="flex gap-2">
                                        <input
                                            type="url"
                                            value={url}
                                            onChange={(e) => updateUrl(index, e.target.value)}
                                            placeholder={`https://example.com/page${index + 1}`}
                                            className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                        />
                                        {urls.length > 1 && (
                                            <button
                                                onClick={() => removeUrl(index)}
                                                className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-red-400 hover:text-red-300"
                                            >
                                                ×
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Prompt */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Prompt
                            </label>
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="What would you like to know about these pages?"
                                className="w-full h-24 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {/* Model Selection */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Model
                            </label>
                            <select
                                value={model}
                                onChange={(e) => setModel(e.target.value)}
                                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                {MODELS.map((m) => (
                                    <option key={m.value} value={m.value}>{m.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* System Instruction */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                System Instruction (optional)
                            </label>
                            <input
                                type="text"
                                value={systemInstruction}
                                onChange={(e) => setSystemInstruction(e.target.value)}
                                placeholder="You are a helpful research assistant..."
                                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            />
                        </div>

                        {/* Options */}
                        <div className="mb-6 space-y-3">
                            <label className="flex items-center gap-2 text-gray-300">
                                <input
                                    type="checkbox"
                                    checked={includeCitations}
                                    onChange={(e) => setIncludeCitations(e.target.checked)}
                                    className="rounded bg-gray-800 border-gray-600"
                                />
                                <span>Include source citations</span>
                            </label>
                            <label className="flex items-center gap-2 text-gray-300">
                                <input
                                    type="checkbox"
                                    checked={combineWithSearch}
                                    onChange={(e) => setCombineWithSearch(e.target.checked)}
                                    className="rounded bg-gray-800 border-gray-600"
                                />
                                <span>Combine with Google Search (broader context)</span>
                            </label>
                            <label className="flex items-center gap-2 text-gray-300">
                                <input
                                    type="checkbox"
                                    checked={useDynamicThreshold}
                                    onChange={(e) => {
                                        setUseDynamicThreshold(e.target.checked);
                                        if (e.target.checked && dynamicThreshold === null) {
                                            setDynamicThreshold(0.5);
                                        }
                                    }}
                                    className="rounded bg-gray-800 border-gray-600"
                                />
                                <span>Dynamic retrieval threshold</span>
                            </label>
                            {useDynamicThreshold && (
                                <div className="ml-6 space-y-1">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="range"
                                            min="0"
                                            max="1"
                                            step="0.1"
                                            value={dynamicThreshold ?? 0.5}
                                            onChange={(e) => setDynamicThreshold(parseFloat(e.target.value))}
                                            className="flex-1"
                                        />
                                        <span className="text-sm text-gray-400 w-10">{dynamicThreshold?.toFixed(1)}</span>
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        Lower = more retrieval, Higher = less retrieval (0.0-1.0)
                                    </p>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={handleGenerate}
                            disabled={loading || validUrlCount === 0 || !prompt.trim()}
                            className={`w-full py-3 rounded-lg font-medium transition-colors ${
                                loading || validUrlCount === 0 || !prompt.trim()
                                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                    : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                        >
                            {loading ? 'Processing...' : 'Analyze URLs'}
                        </button>
                    </div>

                    {/* Sample Prompts */}
                    <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                        <h3 className="text-lg font-semibold text-white mb-3">Sample Prompts</h3>
                        <div className="space-y-2">
                            {[
                                'Summarize the main points from these pages',
                                'Compare the information across these sources',
                                'Extract all mentioned dates and events',
                                'What are the key differences between these articles?',
                                'Create a unified summary of all sources',
                            ].map((example) => (
                                <button
                                    key={example}
                                    onClick={() => setPrompt(example)}
                                    className="w-full text-left px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 text-sm"
                                >
                                    {example}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Sample URLs */}
                    <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                        <h3 className="text-lg font-semibold text-white mb-3">🔗 Sample URLs</h3>
                        <p className="text-xs text-gray-500 mb-3">Click to add to URL list</p>
                        <div className="space-y-2">
                            {[
                                { label: 'Wikipedia - Artificial Intelligence', url: 'https://en.wikipedia.org/wiki/Artificial_intelligence' },
                                { label: 'Wikipedia - Machine Learning', url: 'https://en.wikipedia.org/wiki/Machine_learning' },
                                { label: 'Google AI Blog', url: 'https://blog.google/technology/ai/' },
                                { label: 'OpenAI Blog', url: 'https://openai.com/blog' },
                                { label: 'Anthropic Research', url: 'https://www.anthropic.com/research' },
                                { label: 'Hacker News', url: 'https://news.ycombinator.com/' },
                                { label: 'TechCrunch AI', url: 'https://techcrunch.com/category/artificial-intelligence/' },
                            ].map((sample) => (
                                <button
                                    key={sample.url}
                                    onClick={() => {
                                        // Add URL to the first empty slot or append
                                        const emptyIndex = urls.findIndex(u => !u.trim());
                                        if (emptyIndex >= 0) {
                                            updateUrl(emptyIndex, sample.url);
                                        } else if (urls.length < 20) {
                                            setUrls([...urls, sample.url]);
                                        }
                                    }}
                                    className="w-full text-left px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm group"
                                >
                                    <div className="text-gray-300">{sample.label}</div>
                                    <div className="text-xs text-gray-500 truncate group-hover:text-blue-400">{sample.url}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Output */}
                <div className="space-y-6">
                    {error && (
                        <div className="bg-red-900/20 border border-red-600/30 rounded-lg p-4">
                            <p className="text-red-400">{error}</p>
                        </div>
                    )}

                    {result?.success && (
                        <>
                            <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                                <h3 className="text-lg font-semibold text-white mb-4">Response</h3>
                                <div className="prose prose-invert max-w-none">
                                    <p className="text-gray-300 whitespace-pre-wrap">{result.response}</p>
                                </div>
                            </div>

                            {/* Citations */}
                            {result.citations && result.citations.length > 0 && (
                                <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                                    <h3 className="text-lg font-semibold text-white mb-4">📚 Citations</h3>
                                    <div className="space-y-2">
                                        {result.citations.map((citation: any, idx: number) => (
                                            <div key={idx} className="flex items-center gap-2 text-sm">
                                                <span className="text-gray-500">[{idx + 1}]</span>
                                                <a 
                                                    href={citation.url} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer" 
                                                    className="text-blue-400 hover:underline truncate flex-1"
                                                >
                                                    {citation.title || citation.url}
                                                </a>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Google Search Info */}
                            {result.google_search_used && (
                                <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                                    <h3 className="text-lg font-semibold text-white mb-4">🔍 Google Search</h3>
                                    {result.search_suggestions && result.search_suggestions.length > 0 ? (
                                        <div className="space-y-1">
                                            <p className="text-sm text-gray-400 mb-2">Search queries used:</p>
                                            {result.search_suggestions.map((query: string, idx: number) => (
                                                <div key={idx} className="text-sm text-gray-300 bg-gray-800 px-3 py-1 rounded inline-block mr-2 mb-1">
                                                    {query}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-gray-400">Google Search was enabled for broader context</p>
                                    )}
                                </div>
                            )}

                            {/* URLs Analyzed */}
                            {result.urls_analyzed && result.urls_analyzed.length > 0 && (
                                <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                                    <h3 className="text-lg font-semibold text-white mb-4">🌐 URLs Analyzed</h3>
                                    <div className="space-y-1">
                                        {result.urls_analyzed.map((url: string, idx: number) => (
                                            <a 
                                                key={idx}
                                                href={url} 
                                                target="_blank" 
                                                rel="noopener noreferrer" 
                                                className="block text-sm text-blue-400 hover:underline truncate"
                                            >
                                                {url}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* URL Metadata */}
                            {result.url_metadata && result.url_metadata.length > 0 && (
                                <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                                    <h3 className="text-lg font-semibold text-white mb-4">URL Retrieval Status</h3>
                                    <div className="space-y-2">
                                        {result.url_metadata.map((meta: any, idx: number) => (
                                            <div key={idx} className="flex items-center gap-2 text-sm">
                                                <span className={`px-2 py-0.5 rounded ${
                                                    meta.url_retrieval_status?.includes('SUCCESS') 
                                                        ? 'bg-green-900/50 text-green-400'
                                                        : meta.url_retrieval_status?.includes('UNSAFE')
                                                        ? 'bg-red-900/50 text-red-400'
                                                        : 'bg-yellow-900/50 text-yellow-400'
                                                }`}>
                                                    {meta.url_retrieval_status?.replace('URL_RETRIEVAL_STATUS_', '') || 'UNKNOWN'}
                                                </span>
                                                <a href={meta.retrieved_url} target="_blank" rel="noopener noreferrer" 
                                                   className="text-blue-400 hover:underline truncate flex-1">
                                                    {meta.retrieved_url}
                                                </a>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Search Metadata (if combined with search) */}
                            {result.search_metadata && (
                                <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                                    <h3 className="text-lg font-semibold text-white mb-4">Search Results</h3>
                                    {result.search_metadata.web_search_queries?.length > 0 && (
                                        <div className="mb-3">
                                            <span className="text-sm text-gray-400">Queries: </span>
                                            <span className="text-sm text-gray-300">
                                                {result.search_metadata.web_search_queries.join(', ')}
                                            </span>
                                        </div>
                                    )}
                                    {result.search_metadata.grounding_chunks?.map((chunk: any, idx: number) => (
                                        <div key={idx} className="text-sm mb-1">
                                            <a href={chunk.uri} target="_blank" rel="noopener noreferrer"
                                               className="text-blue-400 hover:underline">
                                                {chunk.title || chunk.uri}
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Usage */}
                            {result.usage && (
                                <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                                    <h3 className="text-lg font-semibold text-white mb-4">Usage</h3>
                                    <div className="grid grid-cols-3 gap-4 text-center">
                                        <div className="bg-gray-800 rounded-lg p-3">
                                            <div className="text-xl font-bold text-blue-400">{result.usage.prompt_tokens}</div>
                                            <div className="text-xs text-gray-400">Input Tokens</div>
                                        </div>
                                        <div className="bg-gray-800 rounded-lg p-3">
                                            <div className="text-xl font-bold text-green-400">{result.usage.completion_tokens}</div>
                                            <div className="text-xs text-gray-400">Output Tokens</div>
                                        </div>
                                        <div className="bg-gray-800 rounded-lg p-3">
                                            <div className="text-xl font-bold text-yellow-400">${result.usage.estimated_cost?.toFixed(6)}</div>
                                            <div className="text-xs text-gray-400">Est. Cost</div>
                                        </div>
                                    </div>
                                    {result.tool_use_tokens && (
                                        <div className="mt-3 text-sm text-gray-400">
                                            Tool use tokens: {result.tool_use_tokens.tool_use_prompt_token_count}
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}

                    {loading && (
                        <div className="bg-gray-900 rounded-lg p-12 border border-gray-800 text-center">
                            <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                            <p className="text-gray-300">Fetching and analyzing {validUrlCount} URL{validUrlCount > 1 ? 's' : ''}...</p>
                        </div>
                    )}

                    {!result && !loading && !error && (
                        <div className="bg-gray-900 rounded-lg p-12 border border-gray-800 text-center">
                            <div className="text-6xl mb-4">🌐</div>
                            <h3 className="text-lg font-medium text-gray-300 mb-2">Ready to Analyze</h3>
                            <p className="text-gray-500">Enter up to 20 URLs and a prompt</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default withPermission(URLContextDemoPage, PermissionLevel.USER);
