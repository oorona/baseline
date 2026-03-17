/**
 * *** DEMO CODE *** - Embeddings Demo
 * Generate vector embeddings for semantic search, clustering, and classification.
 * 
 * Features:
 * - Task type selection (SEMANTIC_SIMILARITY, RETRIEVAL_*, CLASSIFICATION, etc.)
 * - Output dimensionality control (768, 1536, 3072)
 * - Similarity comparison between two texts
 * - Batch embedding support
 * - Token usage display
 * 
 * Documentation: https://ai.google.dev/gemini-api/docs/embeddings
 */

'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { withPermission } from '@/lib/components/with-permission';
import { PermissionLevel } from '@/lib/permissions';
import { apiClient } from '@/app/api-client';

// *** DEMO CODE *** - Embedding Model Info
const EMBEDDING_MODEL = {
    name: 'gemini-embedding-001',
    maxTokens: 2048,
    defaultDimensions: 3072,
    dimensionOptions: [768, 1536, 3072],
    notes: 'Free tier, recommended for production use'
};

// *** DEMO CODE *** - Task Type Options (from documentation)
const TASK_TYPES = [
    { 
        value: 'SEMANTIC_SIMILARITY', 
        label: 'Semantic Similarity', 
        desc: 'Compare the similarity of two texts',
        useCase: 'Finding similar documents, deduplication'
    },
    { 
        value: 'RETRIEVAL_DOCUMENT', 
        label: 'Retrieval (Document)', 
        desc: 'Embed documents for search indexing',
        useCase: 'Building search indexes, RAG knowledge bases'
    },
    { 
        value: 'RETRIEVAL_QUERY', 
        label: 'Retrieval (Query)', 
        desc: 'Embed search queries',
        useCase: 'Query vectors for searching documents'
    },
    { 
        value: 'CLASSIFICATION', 
        label: 'Classification', 
        desc: 'Embeddings optimized for text classification',
        useCase: 'Sentiment analysis, topic categorization'
    },
    { 
        value: 'CLUSTERING', 
        label: 'Clustering', 
        desc: 'Embeddings optimized for clustering',
        useCase: 'Grouping similar content, content organization'
    },
    { 
        value: 'CODE_RETRIEVAL_QUERY', 
        label: 'Code Retrieval (Query)', 
        desc: 'Natural language queries for code search',
        useCase: 'Searching code repositories with natural language'
    },
    { 
        value: 'QUESTION_ANSWERING', 
        label: 'Question Answering', 
        desc: 'Embeddings for QA systems',
        useCase: 'FAQ matching, support ticket routing'
    },
    { 
        value: 'FACT_VERIFICATION', 
        label: 'Fact Verification', 
        desc: 'Verify facts against a corpus',
        useCase: 'Claim verification, fact-checking systems'
    },
];

// *** DEMO CODE *** - Dimensionality Options
const DIMENSION_OPTIONS = [
    { value: 768, label: '768', desc: 'Faster, smaller storage', recommended: false },
    { value: 1536, label: '1536', desc: 'Balanced performance', recommended: true },
    { value: 3072, label: '3072', desc: 'Highest quality (default)', recommended: false },
];

function EmbeddingsDemoPage() {
    const params = useParams();
    const guildId = params.guildId as string;

    // State for single embedding
    const [content, setContent] = useState('');
    const [taskType, setTaskType] = useState('SEMANTIC_SIMILARITY');
    const [dimensions, setDimensions] = useState(1536);
    
    // State for similarity comparison
    const [text1, setText1] = useState('');
    const [text2, setText2] = useState('');
    const [mode, setMode] = useState<'single' | 'compare'>('single');
    
    // Results and status
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<any>(null);
    const [similarity, setSimilarity] = useState<number | null>(null);

    // Get current task type info
    const currentTaskType = TASK_TYPES.find(t => t.value === taskType) || TASK_TYPES[0];

    // *** DEMO CODE *** - Calculate cosine similarity
    const cosineSimilarity = (a: number[], b: number[]): number => {
        if (a.length !== b.length) return 0;
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    };

    // *** DEMO CODE *** - Handle single embedding generation
    const handleGenerateSingle = async () => {
        if (!content.trim()) return;
        
        setLoading(true);
        setError(null);
        setResult(null);
        setSimilarity(null);

        try {
            const response = await apiClient.geminiEmbeddings({
                content,
                task_type: taskType,
                output_dimensionality: dimensions
            });
            setResult(response);
        } catch (e: unknown) {
            const errorMessage = e instanceof Error ? e.message : 'Failed to generate embeddings';
            const axiosError = e as { response?: { data?: { detail?: string } } };
            setError(axiosError.response?.data?.detail || errorMessage);
        } finally {
            setLoading(false);
        }
    };

    // *** DEMO CODE *** - Handle similarity comparison
    const handleCompare = async () => {
        if (!text1.trim() || !text2.trim()) return;
        
        setLoading(true);
        setError(null);
        setResult(null);
        setSimilarity(null);

        try {
            // Get embeddings for both texts
            const [result1, result2] = await Promise.all([
                apiClient.geminiEmbeddings({
                    content: text1,
                    task_type: 'SEMANTIC_SIMILARITY',
                    output_dimensionality: dimensions
                }),
                apiClient.geminiEmbeddings({
                    content: text2,
                    task_type: 'SEMANTIC_SIMILARITY',
                    output_dimensionality: dimensions
                })
            ]);

            if (result1.success && result2.success && result1.embedding && result2.embedding) {
                const sim = cosineSimilarity(result1.embedding, result2.embedding);
                setSimilarity(sim);
                setResult({
                    success: true,
                    text1_tokens: result1.token_count || content.length / 4,
                    text2_tokens: result2.token_count || content.length / 4,
                    dimensions: result1.dimensions
                });
            } else {
                setError('Failed to generate one or both embeddings');
            }
        } catch (e: unknown) {
            const errorMessage = e instanceof Error ? e.message : 'Failed to compare texts';
            const axiosError = e as { response?: { data?: { detail?: string } } };
            setError(axiosError.response?.data?.detail || errorMessage);
        } finally {
            setLoading(false);
        }
    };

    // *** DEMO CODE *** - Get similarity interpretation
    const getSimilarityInterpretation = (sim: number): { label: string; color: string } => {
        if (sim >= 0.9) return { label: 'Very Similar', color: 'text-green-400' };
        if (sim >= 0.7) return { label: 'Similar', color: 'text-lime-400' };
        if (sim >= 0.5) return { label: 'Moderately Similar', color: 'text-yellow-400' };
        if (sim >= 0.3) return { label: 'Somewhat Related', color: 'text-orange-400' };
        return { label: 'Different', color: 'text-red-400' };
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
                <h1 className="text-2xl font-bold text-white">📊 Embeddings Demo</h1>
            </div>

            {/* Info Banner */}
            <div className="mb-8 p-4 bg-yellow-900/20 border border-yellow-600/30 rounded-lg">
                <p className="text-yellow-200/70">
                    Generate vector embeddings for semantic search, clustering, and classification.
                    Using <code className="text-yellow-300">{EMBEDDING_MODEL.name}</code> (free tier).
                    <a 
                        href="https://ai.google.dev/gemini-api/docs/embeddings" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="ml-2 text-yellow-400 hover:text-yellow-300 underline"
                    >
                        View Documentation →
                    </a>
                </p>
            </div>

            {/* Mode Toggle */}
            <div className="mb-6 flex gap-2">
                <button
                    onClick={() => setMode('single')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        mode === 'single'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                >
                    Single Embedding
                </button>
                <button
                    onClick={() => setMode('compare')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        mode === 'compare'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                >
                    Compare Similarity
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Input Panel */}
                <div className="space-y-6">
                    <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                        {mode === 'single' ? (
                            <>
                                {/* Single Embedding Mode */}
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Text Content
                                    </label>
                                    <textarea
                                        value={content}
                                        onChange={(e) => setContent(e.target.value)}
                                        placeholder="Enter text to generate embeddings for..."
                                        className="w-full h-32 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <p className="mt-1 text-xs text-gray-500">
                                        {content.length} characters • Max {EMBEDDING_MODEL.maxTokens} tokens
                                    </p>
                                </div>

                                {/* Task Type */}
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Task Type
                                    </label>
                                    <select
                                        value={taskType}
                                        onChange={(e) => setTaskType(e.target.value)}
                                        className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                                    >
                                        {TASK_TYPES.map((t) => (
                                            <option key={t.value} value={t.value}>
                                                {t.label}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="mt-2 text-xs text-gray-500">
                                        {currentTaskType.desc}
                                    </p>
                                    <p className="mt-1 text-xs text-gray-400">
                                        <strong>Use case:</strong> {currentTaskType.useCase}
                                    </p>
                                </div>
                            </>
                        ) : (
                            <>
                                {/* Comparison Mode */}
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Text 1
                                    </label>
                                    <textarea
                                        value={text1}
                                        onChange={(e) => setText1(e.target.value)}
                                        placeholder="Enter first text..."
                                        className="w-full h-24 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Text 2
                                    </label>
                                    <textarea
                                        value={text2}
                                        onChange={(e) => setText2(e.target.value)}
                                        placeholder="Enter second text to compare..."
                                        className="w-full h-24 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </>
                        )}

                        {/* Output Dimensionality */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Output Dimensionality
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                {DIMENSION_OPTIONS.map((d) => (
                                    <button
                                        key={d.value}
                                        onClick={() => setDimensions(d.value)}
                                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                            dimensions === d.value
                                                ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                                                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                                        }`}
                                    >
                                        {d.label}
                                        {d.recommended && (
                                            <span className="ml-1 text-xs text-yellow-400">★</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                            <p className="mt-2 text-xs text-gray-500">
                                {DIMENSION_OPTIONS.find(d => d.value === dimensions)?.desc}
                            </p>
                        </div>

                        {/* Action Button */}
                        <button
                            onClick={mode === 'single' ? handleGenerateSingle : handleCompare}
                            disabled={loading || (mode === 'single' ? !content.trim() : !text1.trim() || !text2.trim())}
                            className={`w-full py-3 rounded-lg font-medium transition-colors ${
                                loading || (mode === 'single' ? !content.trim() : !text1.trim() || !text2.trim())
                                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                    : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span>
                                    Generating...
                                </span>
                            ) : mode === 'single' ? (
                                'Generate Embeddings'
                            ) : (
                                'Compare Similarity'
                            )}
                        </button>
                    </div>

                    {/* Example Pairs for Comparison */}
                    {mode === 'compare' && (
                        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                            <h3 className="text-lg font-semibold text-white mb-3">Example Pairs</h3>
                            <div className="space-y-2">
                                {[
                                    { t1: 'The quick brown fox jumps over the lazy dog.', t2: 'A fast russet-colored fox leaps over a sleepy canine.', expected: 'High' },
                                    { t1: 'I love programming in Python.', t2: 'Python is my favorite language for coding.', expected: 'High' },
                                    { t1: 'The weather is sunny today.', t2: 'Machine learning is fascinating.', expected: 'Low' },
                                    { t1: 'How do I reset my password?', t2: 'I forgot my login credentials.', expected: 'High' },
                                ].map((example, i) => (
                                    <button
                                        key={i}
                                        onClick={() => { setText1(example.t1); setText2(example.t2); }}
                                        className="w-full text-left px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 text-sm"
                                    >
                                        <span className="text-xs text-gray-500">Expected: {example.expected}</span>
                                        <div className="truncate">&quot;{example.t1.substring(0, 40)}...&quot;</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* What are embeddings */}
                    <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                        <h3 className="text-lg font-semibold text-white mb-3">What are Embeddings?</h3>
                        <p className="text-gray-400 text-sm mb-4">
                            Embeddings are numerical vector representations that capture the semantic meaning of text.
                            Similar meanings produce vectors that are close in the embedding space.
                        </p>
                        <ul className="text-gray-400 text-sm space-y-2">
                            <li className="flex items-start gap-2">
                                <span className="text-blue-400">🔍</span>
                                <span><strong>Semantic Search</strong> - Find content by meaning, not just keywords</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-green-400">📁</span>
                                <span><strong>Clustering</strong> - Group similar documents together</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-purple-400">🏷️</span>
                                <span><strong>Classification</strong> - Categorize text automatically</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-yellow-400">🤖</span>
                                <span><strong>RAG</strong> - Retrieval Augmented Generation for LLMs</span>
                            </li>
                        </ul>
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

                    {/* Similarity Result */}
                    {mode === 'compare' && similarity !== null && (
                        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                            <h3 className="text-lg font-semibold text-white mb-4">Similarity Result</h3>
                            
                            <div className="text-center mb-6">
                                <div className={`text-6xl font-bold mb-2 ${getSimilarityInterpretation(similarity).color}`}>
                                    {(similarity * 100).toFixed(1)}%
                                </div>
                                <p className={`text-lg ${getSimilarityInterpretation(similarity).color}`}>
                                    {getSimilarityInterpretation(similarity).label}
                                </p>
                            </div>

                            {/* Similarity Scale */}
                            <div className="mb-4">
                                <div className="h-4 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded-full relative">
                                    <div 
                                        className="absolute top-0 w-1 h-full bg-white rounded-full shadow-lg"
                                        style={{ left: `${similarity * 100}%` }}
                                    />
                                </div>
                                <div className="flex justify-between text-xs text-gray-500 mt-1">
                                    <span>Different (0%)</span>
                                    <span>Similar (50%)</span>
                                    <span>Identical (100%)</span>
                                </div>
                            </div>

                            <p className="text-sm text-gray-400">
                                Cosine similarity measures the angle between two embedding vectors.
                                Values close to 1 indicate semantic similarity.
                            </p>
                        </div>
                    )}

                    {/* Single Embedding Result */}
                    {mode === 'single' && result?.success && (
                        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                            <h3 className="text-lg font-semibold text-white mb-4">Embedding Result</h3>
                            
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="bg-gray-800 rounded-lg p-3 text-center">
                                    <div className="text-2xl font-bold text-blue-400">{result.dimensions}</div>
                                    <div className="text-xs text-gray-400">Dimensions</div>
                                </div>
                                <div className="bg-gray-800 rounded-lg p-3 text-center">
                                    <div className="text-lg font-bold text-green-400">{taskType}</div>
                                    <div className="text-xs text-gray-400">Task Type</div>
                                </div>
                            </div>

                            {result.token_count && (
                                <div className="mb-4 bg-gray-800 rounded-lg p-3">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-400">Tokens used:</span>
                                        <span className="text-white">{result.token_count}</span>
                                    </div>
                                </div>
                            )}

                            <div className="mb-4">
                                <h4 className="text-sm font-medium text-gray-300 mb-2">
                                    First 10 values (of {result.dimensions}):
                                </h4>
                                <div className="bg-gray-800 rounded-lg p-3 font-mono text-xs text-gray-400 overflow-x-auto">
                                    [{result.embedding?.slice(0, 10).map((v: number) => v.toFixed(6)).join(', ')}...]
                                </div>
                            </div>

                            <p className="text-sm text-gray-500">
                                Store these vectors in a vector database (Pinecone, Qdrant, Weaviate, etc.) for similarity search.
                            </p>
                        </div>
                    )}

                    {/* Loading */}
                    {loading && (
                        <div className="bg-gray-900 rounded-lg p-12 border border-gray-800 text-center">
                            <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                            <p className="text-gray-300">Generating embeddings...</p>
                        </div>
                    )}

                    {/* Empty State */}
                    {!result && similarity === null && !loading && !error && (
                        <div className="bg-gray-900 rounded-lg p-12 border border-gray-800 text-center">
                            <div className="text-6xl mb-4">📊</div>
                            <h3 className="text-lg font-medium text-gray-300 mb-2">
                                {mode === 'single' ? 'Ready to Embed' : 'Ready to Compare'}
                            </h3>
                            <p className="text-gray-500">
                                {mode === 'single' 
                                    ? 'Enter text and click Generate' 
                                    : 'Enter two texts to compare their semantic similarity'
                                }
                            </p>
                        </div>
                    )}

                    {/* Model Info */}
                    <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                        <h3 className="text-lg font-semibold text-white mb-3">📋 Model Information</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-400">Model</span>
                                <span className="text-white font-mono">{EMBEDDING_MODEL.name}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">Max Input</span>
                                <span className="text-white">{EMBEDDING_MODEL.maxTokens} tokens</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">Dimensions</span>
                                <span className="text-white">768 / 1536 / 3072</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">Pricing</span>
                                <span className="text-green-400">Free (generous limits)</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="mt-8 p-4 bg-gray-900 rounded-lg border border-gray-800 text-center">
                <p className="text-gray-400 text-sm">
                    *** DEMO CODE *** - Embeddings generated using <code className="text-blue-400">{EMBEDDING_MODEL.name}</code>
                </p>
            </div>
        </div>
    );
}

export default withPermission(EmbeddingsDemoPage, PermissionLevel.USER);
