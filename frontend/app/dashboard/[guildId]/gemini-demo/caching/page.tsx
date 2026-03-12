'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '../../../../api-client';

type TabType = 'info' | 'create' | 'query' | 'manage';

interface CacheEntry {
    cache_name: string;
    name?: string;
    display_name?: string;
    model: string;
    expire_time?: string;
    expires_at?: string;
    token_count?: number;
    time_remaining_seconds?: number;
    content_type?: string;
}

interface CachingInfo {
    caching_types: {
        implicit: {
            description: string;
            enabled_by_default: boolean;
            guaranteed_savings: boolean;
            how_it_works: string;
            setup_required: string;
            use_case: string;
        };
        explicit: {
            description: string;
            guaranteed_savings: boolean;
            cost_reduction: string;
            storage_cost: string;
            setup_required: string;
            use_case: string;
        };
    };
    model_requirements: Record<string, { min_tokens: number; min_chars_approx: number; note: string }>;
    what_to_cache: string[];
    ttl_options: Record<string, string>;
    usage_metadata: { field: string; description: string; indicates: string };
}

interface QueryResultType {
    response: string;
    cache_info?: {
        cached_tokens_in_context: number;
        cached_tokens_used: number;
        cache_hit: boolean;
        estimated_savings: string;
    };
    usage?: Record<string, unknown>;
}

export default function CachingDemoPage() {
    const params = useParams();
    const guildId = params?.guildId as string;

    // Tab state
    const [activeTab, setActiveTab] = useState<TabType>('info');

    // Info state
    const [cachingInfo, setCachingInfo] = useState<CachingInfo | null>(null);
    const [infoLoading, setInfoLoading] = useState(false);

    // Create cache state
    const [cacheContent, setCacheContent] = useState('');
    const [cacheDisplayName, setCacheDisplayName] = useState('');
    const [cacheSystemInstruction, setCacheSystemInstruction] = useState('');
    const [cacheTtlType, setCacheTtlType] = useState<'ttl' | 'expire_time'>('ttl');
    const [cacheTtl, setCacheTtl] = useState(3600);
    const [cacheExpireTime, setCacheExpireTime] = useState('');
    const [cacheModel, setCacheModel] = useState('gemini-2.5-flash-001');
    const [cacheFileUri, setCacheFileUri] = useState('');
    const [cacheFileMimeType, setCacheFileMimeType] = useState('');
    const [useFileContent, setUseFileContent] = useState(false);
    const [createdCache, setCreatedCache] = useState<CacheEntry | null>(null);
    const [createLoading, setCreateLoading] = useState(false);

    // Query cache state
    const [queryCacheName, setQueryCacheName] = useState('');
    const [queryPrompt, setQueryPrompt] = useState('');
    const [queryTemperature, setQueryTemperature] = useState(1.0);
    const [queryResult, setQueryResult] = useState<QueryResultType | null>(null);
    const [queryLoading, setQueryLoading] = useState(false);

    // Manage caches state
    const [caches, setCaches] = useState<CacheEntry[]>([]);
    const [selectedCache, setSelectedCache] = useState<CacheEntry | null>(null);
    const [manageLoading, setManageLoading] = useState(false);
    const [updateTtlType, setUpdateTtlType] = useState<'ttl' | 'expire_time'>('ttl');
    const [updateTtlValue, setUpdateTtlValue] = useState(3600);
    const [updateExpireTime, setUpdateExpireTime] = useState('');

    const [error, setError] = useState('');

    const ttlOptions = [
        { label: '5 minutes', seconds: 300 },
        { label: '15 minutes', seconds: 900 },
        { label: '1 hour', seconds: 3600 },
        { label: '6 hours', seconds: 21600 },
        { label: '24 hours', seconds: 86400 },
        { label: '7 days', seconds: 604800 },
    ];

    const modelOptions = [
        { label: 'Gemini 2.5 Flash (min: 1,024 tokens)', value: 'gemini-2.5-flash-001', minTokens: 1024 },
        { label: 'Gemini 2.5 Pro (min: 4,096 tokens)', value: 'gemini-2.5-pro-001', minTokens: 4096 },
    ];

    // Sample content for caching demo - this is long enough to meet the minimum token requirements
    const SAMPLE_CACHE_CONTENT = `# Advanced AI Systems: A Comprehensive Technical Reference

## Chapter 1: Introduction to Neural Networks

Neural networks are computing systems inspired by biological neural networks. They are designed to recognize patterns and interpret sensory data through machine perception, labeling, and clustering of raw input.

### 1.1 Historical Background

The concept of artificial neural networks began in the 1940s when Warren McCulloch and Walter Pitts created a computational model for neural networks. Since then, the field has evolved significantly through multiple periods of innovation and occasional skepticism.

### 1.2 Key Components

A typical neural network consists of:
- Input layer: Receives external data
- Hidden layers: Processes data through weighted connections
- Output layer: Produces the final result
- Activation functions: Determine neuron output
- Weights and biases: Parameters adjusted during training

## Chapter 2: Deep Learning Architectures

### 2.1 Convolutional Neural Networks (CNNs)

CNNs are specialized for processing structured grid data like images. Key components include:
- Convolutional layers for feature extraction
- Pooling layers for spatial reduction
- Fully connected layers for classification

### 2.2 Recurrent Neural Networks (RNNs)

RNNs are designed for sequential data processing. They maintain internal state (memory) which allows them to exhibit temporal dynamic behavior. Variants include:
- Long Short-Term Memory (LSTM)
- Gated Recurrent Units (GRU)

### 2.3 Transformer Architecture

Transformers revolutionized NLP through self-attention mechanisms. Key innovations:
- Multi-head attention for parallel processing
- Positional encoding for sequence order
- Layer normalization for training stability

## Chapter 3: Training Methodologies

### 3.1 Backpropagation

Backpropagation calculates gradients of the loss function with respect to network weights. The algorithm:
1. Forward pass: Compute outputs
2. Calculate loss
3. Backward pass: Compute gradients
4. Update weights using optimizer

### 3.2 Optimization Algorithms

Common optimizers include:
- Stochastic Gradient Descent (SGD)
- Adam (Adaptive Moment Estimation)
- RMSprop
- AdaGrad

### 3.3 Regularization Techniques

To prevent overfitting:
- Dropout: Randomly deactivate neurons
- L1/L2 regularization: Penalize large weights
- Data augmentation: Increase training variety
- Early stopping: Halt training when validation loss increases

## Chapter 4: Large Language Models

### 4.1 Scaling Laws

Research has shown that model performance improves predictably with:
- Model size (parameters)
- Dataset size
- Compute budget

### 4.2 Pre-training and Fine-tuning

Modern LLMs follow a two-stage approach:
1. Pre-training on massive text corpora
2. Fine-tuning on specific tasks or through RLHF

### 4.3 Prompt Engineering

Effective prompting strategies include:
- Zero-shot prompting
- Few-shot learning
- Chain-of-thought reasoning
- System instructions

## Chapter 5: Ethical Considerations

### 5.1 Bias and Fairness

AI systems can perpetuate or amplify societal biases. Mitigation strategies:
- Diverse training data
- Fairness constraints during training
- Regular auditing and testing

### 5.2 Safety and Alignment

Ensuring AI systems act in accordance with human values requires:
- Constitutional AI approaches
- Red teaming and adversarial testing
- Interpretability research

This concludes our technical reference guide. The field of AI continues to evolve rapidly, with new architectures and techniques emerging regularly.`;

    useEffect(() => {
        loadCachingInfo();
    }, []);

    const loadCachingInfo = async () => {
        setInfoLoading(true);
        try {
            const result = await apiClient.geminiCacheInfo();
            setCachingInfo(result);
        } catch (err) {
            console.error('Failed to load caching info:', err);
        } finally {
            setInfoLoading(false);
        }
    };

    const getMinTokensForModel = () => {
        const model = modelOptions.find(m => m.value === cacheModel);
        return model?.minTokens || 1024;
    };

    const getEstimatedTokens = () => Math.ceil(cacheContent.length / 4);

    const handleCreateCache = async () => {
        if (!useFileContent && !cacheContent.trim()) {
            setError('Please enter content to cache');
            return;
        }
        if (useFileContent && !cacheFileUri.trim()) {
            setError('Please enter a file URI');
            return;
        }

        const minTokens = getMinTokensForModel();
        const estTokens = getEstimatedTokens();
        if (!useFileContent && estTokens < minTokens) {
            setError(`Content too small. Minimum ${minTokens} tokens required for ${cacheModel}. Current estimate: ${estTokens} tokens.`);
            return;
        }

        setCreateLoading(true);
        setError('');
        setCreatedCache(null);

        try {
            const requestBody: Record<string, unknown> = {
                name: cacheDisplayName || `cache-${Date.now()}`,
                model: cacheModel,
            };

            if (useFileContent) {
                requestBody.file_uri = cacheFileUri;
                requestBody.file_mime_type = cacheFileMimeType || undefined;
            } else {
                requestBody.content = cacheContent;
            }

            if (cacheSystemInstruction) {
                requestBody.system_instruction = cacheSystemInstruction;
            }

            if (cacheDisplayName) {
                requestBody.display_name = cacheDisplayName;
            }

            if (cacheTtlType === 'ttl') {
                requestBody.ttl_seconds = cacheTtl;
            } else if (cacheExpireTime) {
                requestBody.expire_time = cacheExpireTime;
            }

            const result = await apiClient.geminiCacheCreate(requestBody);

            setCreatedCache({
                cache_name: result.cache_name || result.name || 'unknown',
                display_name: cacheDisplayName || result.display_name,
                model: cacheModel,
                expire_time: result.expires_at,
                token_count: result.token_count,
                content_type: result.content_type,
            });
            setCacheContent('');
            setCacheDisplayName('');
            setCacheSystemInstruction('');
            setCacheFileUri('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create cache');
        } finally {
            setCreateLoading(false);
        }
    };

    const handleQueryCache = async () => {
        if (!queryCacheName.trim()) {
            setError('Please enter a cache name');
            return;
        }
        if (!queryPrompt.trim()) {
            setError('Please enter a prompt');
            return;
        }

        setQueryLoading(true);
        setError('');
        setQueryResult(null);

        try {
            const result = await apiClient.geminiCacheQuery({
                cache_name: queryCacheName,
                prompt: queryPrompt,
                temperature: queryTemperature,
            });

            setQueryResult({
                response: result.response || result.text || JSON.stringify(result, null, 2),
                cache_info: result.cache_info,
                usage: result.usage,
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to query cache');
        } finally {
            setQueryLoading(false);
        }
    };

    const handleListCaches = async () => {
        setManageLoading(true);
        setError('');

        try {
            const result = await apiClient.geminiCacheList();
            setCaches(result.caches || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to list caches');
        } finally {
            setManageLoading(false);
        }
    };

    const handleGetCache = async (cacheName: string) => {
        setManageLoading(true);
        setError('');

        try {
            const result = await apiClient.geminiCacheGet(cacheName);
            setSelectedCache(result.cache || result);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to get cache details');
        } finally {
            setManageLoading(false);
        }
    };

    const handleUpdateCache = async (cacheName: string) => {
        setManageLoading(true);
        setError('');

        try {
            const requestBody: {
                cache_name: string;
                ttl_seconds?: number;
                expire_time?: string;
            } = {
                cache_name: cacheName,
            };

            if (updateTtlType === 'ttl') {
                requestBody.ttl_seconds = updateTtlValue;
            } else if (updateExpireTime) {
                requestBody.expire_time = updateExpireTime;
            }

            await apiClient.geminiCacheUpdate(requestBody);
            handleListCaches(); // Refresh list
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update cache');
        } finally {
            setManageLoading(false);
        }
    };

    const handleDeleteCache = async (cacheName: string) => {
        if (!confirm(`Delete cache "${cacheName}"?`)) return;

        setManageLoading(true);
        setError('');

        try {
            await apiClient.geminiCacheDelete(cacheName);
            setCaches(caches.filter(c => (c.cache_name || c.name) !== cacheName));
            if ((selectedCache?.cache_name || selectedCache?.name) === cacheName) {
                setSelectedCache(null);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete cache');
        } finally {
            setManageLoading(false);
        }
    };

    const formatTimeRemaining = (seconds: number) => {
        if (seconds < 60) return `${seconds}s`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
        return `${Math.floor(seconds / 86400)}d`;
    };

    const tabs: { id: TabType; label: string; icon: string }[] = [
        { id: 'info', label: 'About Caching', icon: 'ℹ️' },
        { id: 'create', label: 'Create', icon: '➕' },
        { id: 'query', label: 'Query', icon: '💬' },
        { id: 'manage', label: 'Manage', icon: '⚙️' },
    ];

    return (
        <div className="min-h-screen bg-gray-950 text-white p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <Link 
                            href={`/dashboard/${guildId}/gemini-demo`}
                            className="text-blue-400 hover:text-blue-300 text-sm mb-2 inline-block"
                        >
                            ← Back to Gemini Demo
                        </Link>
                        <h1 className="text-3xl font-bold flex items-center gap-3">
                            <span className="text-4xl">💾</span>
                            Context Caching Demo
                        </h1>
                        <p className="text-gray-400 mt-2">
                            75% cost savings on cached tokens with guaranteed reuse
                        </p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-800 mb-6 overflow-x-auto">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-5 py-3 font-medium transition-colors whitespace-nowrap ${
                                activeTab === tab.id
                                    ? 'border-b-2 border-blue-500 text-blue-400'
                                    : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            <span className="mr-2">{tab.icon}</span>
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Error Display */}
                {error && (
                    <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg mb-6">
                        {error}
                    </div>
                )}

                {/* Two-column layout */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left Column - Input */}
                    <div className="space-y-6">
                        {/* Info Tab */}
                        {activeTab === 'info' && (
                            <div className="space-y-6">
                                {/* Implicit vs Explicit */}
                                <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                                    <h2 className="text-xl font-semibold mb-4">Caching Types</h2>
                                    
                                    <div className="space-y-4">
                                        <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
                                            <h3 className="font-medium text-blue-400 flex items-center gap-2">
                                                <span>🔄</span> Implicit Caching
                                            </h3>
                                            <ul className="mt-2 text-sm text-gray-300 space-y-1">
                                                <li>• Automatic - enabled by default</li>
                                                <li>• No code changes needed</li>
                                                <li>• Best-effort (no guarantee)</li>
                                                <li>• Good for repeated identical prompts</li>
                                            </ul>
                                        </div>
                                        
                                        <div className="bg-green-900/20 border border-green-800 rounded-lg p-4">
                                            <h3 className="font-medium text-green-400 flex items-center gap-2">
                                                <span>📌</span> Explicit Caching
                                            </h3>
                                            <ul className="mt-2 text-sm text-gray-300 space-y-1">
                                                <li>• Manual - create via this API</li>
                                                <li>• Guaranteed 75% savings</li>
                                                <li>• Storage: $1/million tokens/hour</li>
                                                <li>• Good for large repeated contexts</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>

                                {/* Model Requirements */}
                                <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                                    <h2 className="text-xl font-semibold mb-4">Minimum Token Requirements</h2>
                                    <div className="space-y-3">
                                        {modelOptions.map(m => (
                                            <div key={m.value} className="flex justify-between items-center bg-gray-800 rounded-lg p-3">
                                                <span className="text-gray-300">{m.label.split(' (')[0]}</span>
                                                <span className="text-blue-400 font-mono">{m.minTokens.toLocaleString()} tokens</span>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-3">
                                        Approximately 4 characters = 1 token
                                    </p>
                                </div>

                                {/* What to Cache */}
                                <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                                    <h2 className="text-xl font-semibold mb-4">What to Cache</h2>
                                    <ul className="space-y-2 text-sm text-gray-300">
                                        <li className="flex items-center gap-2"><span>📚</span> Large system instructions</li>
                                        <li className="flex items-center gap-2"><span>📄</span> Reference documents (PDF, code)</li>
                                        <li className="flex items-center gap-2"><span>🎯</span> Few-shot examples (10+)</li>
                                        <li className="flex items-center gap-2"><span>🎬</span> Video/audio for analysis</li>
                                        <li className="flex items-center gap-2"><span>💻</span> Code repositories</li>
                                    </ul>
                                </div>
                            </div>
                        )}

                        {/* Create Cache Tab */}
                        {activeTab === 'create' && (
                            <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                                <h2 className="text-xl font-semibold mb-4">Create Cached Content</h2>
                                <p className="text-gray-400 mb-6 text-sm">
                                    Cache large content for guaranteed 75% cost savings on input tokens.
                                </p>

                                <div className="space-y-4">
                                    {/* Content Type Toggle */}
                                    <div className="flex items-center gap-4 p-3 bg-gray-800 rounded-lg">
                                        <label className="flex items-center gap-2">
                                            <input
                                                type="radio"
                                                checked={!useFileContent}
                                                onChange={() => setUseFileContent(false)}
                                                className="text-blue-600"
                                            />
                                            <span className="text-sm text-gray-300">Text Content</span>
                                        </label>
                                        <label className="flex items-center gap-2">
                                            <input
                                                type="radio"
                                                checked={useFileContent}
                                                onChange={() => setUseFileContent(true)}
                                                className="text-blue-600"
                                            />
                                            <span className="text-sm text-gray-300">File URI (video/PDF)</span>
                                        </label>
                                    </div>

                                    {!useFileContent ? (
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <label className="block text-sm font-medium text-gray-300">
                                                    Content to Cache *
                                                </label>
                                                <button
                                                    onClick={() => setCacheContent(SAMPLE_CACHE_CONTENT)}
                                                    className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 bg-gray-800 rounded border border-gray-700"
                                                >
                                                    📝 Load Sample Content
                                                </button>
                                            </div>
                                            <textarea
                                                value={cacheContent}
                                                onChange={(e) => setCacheContent(e.target.value)}
                                                placeholder="Paste your large document, code, or context here..."
                                                rows={8}
                                                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                                            />
                                            <div className="flex justify-between text-xs text-gray-500 mt-1">
                                                <span>Characters: {cacheContent.length.toLocaleString()}</span>
                                                <span className={getEstimatedTokens() < getMinTokensForModel() ? 'text-red-400' : 'text-green-400'}>
                                                    Est. tokens: ~{getEstimatedTokens().toLocaleString()} (min: {getMinTokensForModel().toLocaleString()})
                                                </span>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                                    File URI * (from File API upload)
                                                </label>
                                                <input
                                                    type="text"
                                                    value={cacheFileUri}
                                                    onChange={(e) => setCacheFileUri(e.target.value)}
                                                    placeholder="https://generativelanguage.googleapis.com/v1beta/files/..."
                                                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                                    MIME Type (optional)
                                                </label>
                                                <select
                                                    value={cacheFileMimeType}
                                                    onChange={(e) => setCacheFileMimeType(e.target.value)}
                                                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                                                >
                                                    <option value="">Auto-detect</option>
                                                    <option value="video/mp4">video/mp4</option>
                                                    <option value="application/pdf">application/pdf</option>
                                                    <option value="audio/mpeg">audio/mpeg</option>
                                                </select>
                                            </div>
                                        </>
                                    )}

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                Display Name
                                            </label>
                                            <input
                                                type="text"
                                                value={cacheDisplayName}
                                                onChange={(e) => setCacheDisplayName(e.target.value)}
                                                placeholder="my-cache"
                                                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                Model
                                            </label>
                                            <select
                                                value={cacheModel}
                                                onChange={(e) => setCacheModel(e.target.value)}
                                                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                                            >
                                                {modelOptions.map((opt) => (
                                                    <option key={opt.value} value={opt.value}>
                                                        {opt.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            System Instruction (optional)
                                        </label>
                                        <textarea
                                            value={cacheSystemInstruction}
                                            onChange={(e) => setCacheSystemInstruction(e.target.value)}
                                            placeholder="You are an expert assistant..."
                                            rows={2}
                                            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>

                                    {/* TTL Options */}
                                    <div className="border border-gray-700 rounded-lg p-4">
                                        <div className="flex items-center gap-4 mb-3">
                                            <label className="flex items-center gap-2">
                                                <input
                                                    type="radio"
                                                    checked={cacheTtlType === 'ttl'}
                                                    onChange={() => setCacheTtlType('ttl')}
                                                    className="text-blue-600"
                                                />
                                                <span className="text-sm text-gray-300">TTL (duration)</span>
                                            </label>
                                            <label className="flex items-center gap-2">
                                                <input
                                                    type="radio"
                                                    checked={cacheTtlType === 'expire_time'}
                                                    onChange={() => setCacheTtlType('expire_time')}
                                                    className="text-blue-600"
                                                />
                                                <span className="text-sm text-gray-300">Expire Time (datetime)</span>
                                            </label>
                                        </div>

                                        {cacheTtlType === 'ttl' ? (
                                            <div className="flex flex-wrap gap-2">
                                                {ttlOptions.map((opt) => (
                                                    <button
                                                        key={opt.seconds}
                                                        type="button"
                                                        onClick={() => setCacheTtl(opt.seconds)}
                                                        className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                                                            cacheTtl === opt.seconds
                                                                ? 'bg-blue-600 text-white'
                                                                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                                        }`}
                                                    >
                                                        {opt.label}
                                                    </button>
                                                ))}
                                            </div>
                                        ) : (
                                            <input
                                                type="datetime-local"
                                                value={cacheExpireTime}
                                                onChange={(e) => setCacheExpireTime(e.target.value)}
                                                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                                            />
                                        )}
                                    </div>

                                    <button
                                        onClick={handleCreateCache}
                                        disabled={createLoading}
                                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                                    >
                                        {createLoading ? 'Creating Cache...' : 'Create Cache'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Query Cache Tab */}
                        {activeTab === 'query' && (
                            <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                                <h2 className="text-xl font-semibold mb-4">Query Cached Content</h2>
                                <p className="text-gray-400 mb-6 text-sm">
                                    Query with cached context. Response shows cached_content_token_count for cache hits.
                                </p>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Cache Name *
                                        </label>
                                        <input
                                            type="text"
                                            value={queryCacheName}
                                            onChange={(e) => setQueryCacheName(e.target.value)}
                                            placeholder="my-cache"
                                            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Prompt *
                                        </label>
                                        <textarea
                                            value={queryPrompt}
                                            onChange={(e) => setQueryPrompt(e.target.value)}
                                            placeholder="Ask a question about the cached content..."
                                            rows={4}
                                            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Temperature: {queryTemperature}
                                        </label>
                                        <input
                                            type="range"
                                            min="0"
                                            max="2"
                                            step="0.1"
                                            value={queryTemperature}
                                            onChange={(e) => setQueryTemperature(parseFloat(e.target.value))}
                                            className="w-full"
                                        />
                                    </div>

                                    <button
                                        onClick={handleQueryCache}
                                        disabled={queryLoading}
                                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                                    >
                                        {queryLoading ? 'Querying...' : 'Query Cache'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Manage Caches Tab */}
                        {activeTab === 'manage' && (
                            <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-xl font-semibold">Your Caches</h2>
                                    <button
                                        onClick={handleListCaches}
                                        disabled={manageLoading}
                                        className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                                    >
                                        {manageLoading ? 'Loading...' : '🔄 Refresh'}
                                    </button>
                                </div>

                                {caches.length === 0 ? (
                                    <div className="text-center py-8 text-gray-500">
                                        <div className="text-4xl mb-2">💾</div>
                                        <p>No caches found. Click Refresh to load.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {caches.map((cache) => (
                                            <div 
                                                key={cache.cache_name || cache.name}
                                                className="bg-gray-800 rounded-lg p-4"
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium text-white">
                                                            {cache.display_name || cache.cache_name || cache.name}
                                                        </p>
                                                        <p className="text-xs text-gray-500 font-mono mt-1">
                                                            {cache.cache_name || cache.name}
                                                        </p>
                                                        <div className="flex flex-wrap items-center gap-3 mt-2 text-xs">
                                                            <span className="text-gray-400">Model: {cache.model}</span>
                                                            {cache.token_count && (
                                                                <span className="text-blue-400">{cache.token_count.toLocaleString()} tokens</span>
                                                            )}
                                                            {cache.time_remaining_seconds !== undefined && (
                                                                <span className={cache.time_remaining_seconds < 300 ? 'text-red-400' : 'text-green-400'}>
                                                                    ⏱️ {formatTimeRemaining(cache.time_remaining_seconds)}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 ml-4">
                                                        <button
                                                            onClick={() => handleGetCache(cache.cache_name || cache.name || '')}
                                                            className="text-blue-400 hover:text-blue-300 px-2 py-1 text-sm"
                                                        >
                                                            Details
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteCache(cache.cache_name || cache.name || '')}
                                                            className="text-red-400 hover:text-red-300 px-2 py-1 text-sm"
                                                        >
                                                            🗑️
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Update TTL/Expire Time */}
                                                <div className="mt-3 pt-3 border-t border-gray-700">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <select
                                                            value={updateTtlType}
                                                            onChange={(e) => setUpdateTtlType(e.target.value as 'ttl' | 'expire_time')}
                                                            className="px-2 py-1 bg-gray-900 border border-gray-600 rounded text-sm text-white"
                                                        >
                                                            <option value="ttl">TTL</option>
                                                            <option value="expire_time">Expire Time</option>
                                                        </select>
                                                        {updateTtlType === 'ttl' ? (
                                                            <select
                                                                value={updateTtlValue}
                                                                onChange={(e) => setUpdateTtlValue(parseInt(e.target.value))}
                                                                className="flex-1 px-2 py-1 bg-gray-900 border border-gray-600 rounded text-sm text-white"
                                                            >
                                                                {ttlOptions.map((opt) => (
                                                                    <option key={opt.seconds} value={opt.seconds}>
                                                                        {opt.label}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        ) : (
                                                            <input
                                                                type="datetime-local"
                                                                value={updateExpireTime}
                                                                onChange={(e) => setUpdateExpireTime(e.target.value)}
                                                                className="flex-1 px-2 py-1 bg-gray-900 border border-gray-600 rounded text-sm text-white"
                                                            />
                                                        )}
                                                        <button
                                                            onClick={() => handleUpdateCache(cache.cache_name || cache.name || '')}
                                                            className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm"
                                                        >
                                                            Update
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right Column - Results */}
                    <div className="space-y-6">
                        {/* Create Result */}
                        {activeTab === 'create' && createdCache && (
                            <div className="bg-green-900/30 border border-green-600 rounded-lg p-6">
                                <h3 className="text-lg font-semibold text-green-400 mb-3">✅ Cache Created!</h3>
                                <div className="space-y-2 text-sm">
                                    <p><span className="text-gray-400">Cache Name:</span> <code className="text-blue-400 bg-gray-800 px-2 py-0.5 rounded">{createdCache.cache_name}</code></p>
                                    {createdCache.display_name && (
                                        <p><span className="text-gray-400">Display Name:</span> {createdCache.display_name}</p>
                                    )}
                                    <p><span className="text-gray-400">Model:</span> {createdCache.model}</p>
                                    <p><span className="text-gray-400">Content Type:</span> {createdCache.content_type || 'text'}</p>
                                    {createdCache.token_count && (
                                        <p><span className="text-gray-400">Token Count:</span> {createdCache.token_count.toLocaleString()}</p>
                                    )}
                                    {createdCache.expire_time && (
                                        <p><span className="text-gray-400">Expires:</span> {new Date(createdCache.expire_time).toLocaleString()}</p>
                                    )}
                                </div>
                                <p className="text-gray-400 text-sm mt-4">
                                    Copy the Cache Name to use in the Query tab.
                                </p>
                            </div>
                        )}

                        {/* Query Result */}
                        {activeTab === 'query' && queryResult && (
                            <div className="space-y-4">
                                <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                                    <h3 className="text-lg font-semibold mb-3">Response</h3>
                                    <div className="bg-gray-800 rounded-lg p-4">
                                        <pre className="text-gray-300 whitespace-pre-wrap text-sm">{queryResult.response}</pre>
                                    </div>
                                </div>

                                {/* Cache Hit Info */}
                                {queryResult.cache_info && (
                                    <div className={`rounded-lg p-4 border ${queryResult.cache_info.cache_hit ? 'bg-green-900/30 border-green-600' : 'bg-yellow-900/30 border-yellow-600'}`}>
                                        <h4 className={`font-medium mb-2 ${queryResult.cache_info.cache_hit ? 'text-green-400' : 'text-yellow-400'}`}>
                                            {queryResult.cache_info.cache_hit ? '✅ Cache Hit!' : '⚠️ Cache Miss'}
                                        </h4>
                                        <div className="text-sm space-y-1">
                                            <p className="text-gray-300">Cached tokens in context: {queryResult.cache_info.cached_tokens_in_context.toLocaleString()}</p>
                                            <p className="text-gray-300">Cached tokens used: {queryResult.cache_info.cached_tokens_used.toLocaleString()}</p>
                                            <p className="text-gray-300">Estimated savings: {queryResult.cache_info.estimated_savings}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Selected Cache Details */}
                        {activeTab === 'manage' && selectedCache && (
                            <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                                <h3 className="text-lg font-semibold mb-3">Cache Details</h3>
                                <pre className="bg-gray-800 rounded-lg p-4 text-sm text-gray-300 overflow-auto max-h-96">
                                    {JSON.stringify(selectedCache, null, 2)}
                                </pre>
                            </div>
                        )}

                        {/* Info Panel */}
                        {((activeTab === 'create' && !createdCache) ||
                          (activeTab === 'query' && !queryResult) ||
                          (activeTab === 'manage' && !selectedCache && caches.length === 0)) && (
                            <div className="bg-gray-900/50 rounded-lg p-6 border border-gray-800">
                                <h4 className="font-semibold text-gray-300 mb-4">💾 Context Caching Benefits</h4>
                                <div className="space-y-4 text-sm">
                                    <div>
                                        <h5 className="font-medium text-green-400">75% Cost Reduction</h5>
                                        <p className="text-gray-400">Pay only 25% of normal input price for cached tokens.</p>
                                    </div>
                                    <div>
                                        <h5 className="font-medium text-blue-400">Faster Responses</h5>
                                        <p className="text-gray-400">Cached content doesn't need reprocessing.</p>
                                    </div>
                                    <div>
                                        <h5 className="font-medium text-purple-400">Flexible TTL</h5>
                                        <p className="text-gray-400">Set duration (ttl) or specific time (expire_time).</p>
                                    </div>
                                    <div>
                                        <h5 className="font-medium text-yellow-400">File Support</h5>
                                        <p className="text-gray-400">Cache video, PDF, and audio files.</p>
                                    </div>
                                </div>
                                <div className="mt-4 pt-4 border-t border-gray-800">
                                    <h5 className="font-medium text-gray-400 mb-2">Storage Pricing</h5>
                                    <p className="text-xs text-gray-500">
                                        $1.00 per million tokens per hour
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
