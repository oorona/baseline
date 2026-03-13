'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '../../../../api-client';
import { withPermission } from '@/lib/components/with-permission';
import { PermissionLevel } from '@/lib/permissions';

type TabType = 'create' | 'upload' | 'query' | 'manage' | 'documents';

interface FileStore {
    name: string;
    display_name: string;
    create_time?: string;
    update_time?: string;
}

interface UploadedFile {
    document_id: string;
    display_name: string;
    size_bytes?: number;
    estimated_tokens?: number;
    metadata?: Array<{ key: string; string_value?: string; numeric_value?: number }>;
}

interface Document {
    name: string;
    display_name: string;
    create_time?: string;
    metadata?: Array<{ key: string; string_value?: string; numeric_value?: number }>;
}

interface Citation {
    source: string;
    title: string;
    text: string;
}

interface QueryResult {
    response: string;
    citations: Citation[];
    model: string;
    usage: Record<string, unknown>;
}

interface MetadataField {
    key: string;
    type: 'string' | 'number';
    value: string;
}

function FileSearchDemoPage() {
    const params = useParams();
    const guildId = params?.guildId as string;

    // Tab state
    const [activeTab, setActiveTab] = useState<TabType>('create');

    // Create store state
    const [storeName, setStoreName] = useState('');
    const [storeDescription, setStoreDescription] = useState('');
    const [createdStore, setCreatedStore] = useState<FileStore | null>(null);
    const [createLoading, setCreateLoading] = useState(false);

    // Upload state
    const [uploadStoreName, setUploadStoreName] = useState('');
    const [uploadContent, setUploadContent] = useState('');
    const [uploadDisplayName, setUploadDisplayName] = useState('');
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
    const [uploadLoading, setUploadLoading] = useState(false);
    // Chunking config
    const [maxTokensPerChunk, setMaxTokensPerChunk] = useState(200);
    const [maxOverlapTokens, setMaxOverlapTokens] = useState(20);
    const [showChunkingConfig, setShowChunkingConfig] = useState(false);
    // Metadata
    const [metadataFields, setMetadataFields] = useState<MetadataField[]>([]);
    const [showMetadata, setShowMetadata] = useState(false);

    // Query state
    const [queryStoreNames, setQueryStoreNames] = useState('');
    const [queryText, setQueryText] = useState('');
    const [queryModel, setQueryModel] = useState('gemini-2.5-flash');
    const [metadataFilter, setMetadataFilter] = useState('');
    const [includeCitations, setIncludeCitations] = useState(true);
    const [useStructuredOutput, setUseStructuredOutput] = useState(false);
    const [responseSchema, setResponseSchema] = useState('');
    const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
    const [queryLoading, setQueryLoading] = useState(false);

    // Manage state
    const [stores, setStores] = useState<FileStore[]>([]);
    const [manageLoading, setManageLoading] = useState(false);

    // Documents state
    const [docStoreName, setDocStoreName] = useState('');
    const [documents, setDocuments] = useState<Document[]>([]);
    const [documentsLoading, setDocumentsLoading] = useState(false);

    const [error, setError] = useState('');

    // Add metadata field
    const addMetadataField = () => {
        setMetadataFields([...metadataFields, { key: '', type: 'string', value: '' }]);
    };

    const removeMetadataField = (index: number) => {
        setMetadataFields(metadataFields.filter((_, i) => i !== index));
    };

    const updateMetadataField = (index: number, field: Partial<MetadataField>) => {
        const updated = [...metadataFields];
        updated[index] = { ...updated[index], ...field };
        setMetadataFields(updated);
    };

    const handleCreateStore = async () => {
        if (!storeName.trim()) {
            setError('Please enter a store name');
            return;
        }

        setCreateLoading(true);
        setError('');
        setCreatedStore(null);

        try {
            const result = await apiClient.geminiFileSearchStore({
                name: storeName,
                display_name: storeName,
                description: storeDescription || undefined,
            });

            setCreatedStore({
                name: result.store_name,
                display_name: storeName,
                create_time: new Date().toISOString(),
            });
            setStoreName('');
            setStoreDescription('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create store');
        } finally {
            setCreateLoading(false);
        }
    };

    const handleUploadFile = async () => {
        if (!uploadStoreName.trim()) {
            setError('Please enter a store name');
            return;
        }
        if (!uploadContent && !uploadFile) {
            setError('Please enter content or select a file');
            return;
        }
        if (!uploadDisplayName.trim()) {
            setError('Please enter a display name for the file');
            return;
        }

        setUploadLoading(true);
        setError('');
        setUploadedFile(null);

        try {
            let content = uploadContent;
            if (uploadFile) {
                content = await uploadFile.text();
            }

            // Build custom metadata
            const customMetadata = metadataFields
                .filter(m => m.key.trim())
                .map(m => ({
                    key: m.key,
                    string_value: m.type === 'string' ? m.value : undefined,
                    numeric_value: m.type === 'number' ? parseFloat(m.value) : undefined,
                }));

            const result = await apiClient.geminiFileSearchUpload({
                store_name: uploadStoreName,
                content: content,
                display_name: uploadDisplayName,
                custom_metadata: customMetadata.length > 0 ? customMetadata : undefined,
                chunking_config: showChunkingConfig ? {
                    max_tokens_per_chunk: maxTokensPerChunk,
                    max_overlap_tokens: maxOverlapTokens,
                } : undefined,
            });

            setUploadedFile({
                document_id: result.document_id,
                display_name: uploadDisplayName,
                size_bytes: result.size_bytes,
                estimated_tokens: result.estimated_tokens,
                metadata: customMetadata,
            });
            setUploadContent('');
            setUploadDisplayName('');
            setUploadFile(null);
            setMetadataFields([]);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to upload file');
        } finally {
            setUploadLoading(false);
        }
    };

    const handleQuery = async () => {
        if (!queryStoreNames.trim()) {
            setError('Please enter at least one store name');
            return;
        }
        if (!queryText.trim()) {
            setError('Please enter a search query');
            return;
        }

        setQueryLoading(true);
        setError('');
        setQueryResult(null);

        try {
            const storeNames = queryStoreNames.split(',').map(s => s.trim()).filter(Boolean);

            let parsedSchema;
            if (useStructuredOutput && responseSchema) {
                try {
                    parsedSchema = JSON.parse(responseSchema);
                } catch {
                    setError('Invalid JSON schema');
                    setQueryLoading(false);
                    return;
                }
            }

            let parsedMetadataFilter;
            if (metadataFilter.trim()) {
                try {
                    parsedMetadataFilter = JSON.parse(metadataFilter);
                } catch {
                    setError('Invalid metadata filter JSON');
                    setQueryLoading(false);
                    return;
                }
            }

            const result = await apiClient.geminiFileSearchQuery({
                store_names: storeNames,
                query: queryText,
                model: queryModel,
                metadata_filter: parsedMetadataFilter,
                response_schema: parsedSchema,
                include_citations: includeCitations,
            });

            setQueryResult({
                response: result.response,
                citations: result.citations || [],
                model: result.model,
                usage: result.usage || {},
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to search');
        } finally {
            setQueryLoading(false);
        }
    };

    const handleListStores = async () => {
        setManageLoading(true);
        setError('');

        try {
            const result = await apiClient.geminiFileSearchList();
            setStores(result.stores || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to list stores');
        } finally {
            setManageLoading(false);
        }
    };

    const handleDeleteStore = async (storeName: string) => {
        if (!confirm(`Delete store "${storeName}"? This will delete all documents.`)) return;

        setManageLoading(true);
        setError('');

        try {
            await apiClient.geminiFileSearchDeleteStore(storeName);
            setStores(stores.filter(s => s.name !== storeName));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete store');
        } finally {
            setManageLoading(false);
        }
    };

    const handleListDocuments = async () => {
        if (!docStoreName.trim()) {
            setError('Please enter a store name');
            return;
        }

        setDocumentsLoading(true);
        setError('');

        try {
            const result = await apiClient.geminiFileSearchDocuments(docStoreName);
            setDocuments(result.documents || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to list documents');
        } finally {
            setDocumentsLoading(false);
        }
    };

    const handleDeleteDocument = async (documentName: string) => {
        if (!confirm(`Delete document "${documentName}"?`)) return;

        setDocumentsLoading(true);
        setError('');

        try {
            await apiClient.geminiFileSearchDeleteDocument(documentName);
            setDocuments(documents.filter(d => d.name !== documentName));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete document');
        } finally {
            setDocumentsLoading(false);
        }
    };

    const tabs: { id: TabType; label: string; icon: string }[] = [
        { id: 'create', label: 'Create Store', icon: '➕' },
        { id: 'upload', label: 'Upload', icon: '📤' },
        { id: 'query', label: 'Query', icon: '🔍' },
        { id: 'documents', label: 'Documents', icon: '📄' },
        { id: 'manage', label: 'Stores', icon: '⚙️' },
    ];

    const models = [
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
        { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
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
                            <span className="text-4xl">🔍</span>
                            File Search Demo
                        </h1>
                        <p className="text-gray-400 mt-2">
                            RAG with semantic search, metadata filtering, and grounded responses
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
                        {/* Create Store Tab */}
                        {activeTab === 'create' && (
                            <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                                <h2 className="text-xl font-semibold mb-4">Create File Search Store</h2>
                                <p className="text-gray-400 mb-6 text-sm">
                                    Create a persistent store for document indexing. Stores have no TTL and persist until deleted.
                                </p>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Display Name *
                                        </label>
                                        <input
                                            type="text"
                                            value={storeName}
                                            onChange={(e) => setStoreName(e.target.value)}
                                            placeholder="My Knowledge Base"
                                            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Description (optional)
                                        </label>
                                        <textarea
                                            value={storeDescription}
                                            onChange={(e) => setStoreDescription(e.target.value)}
                                            placeholder="A store for project documentation..."
                                            rows={2}
                                            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>

                                    <button
                                        onClick={handleCreateStore}
                                        disabled={createLoading}
                                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                                    >
                                        {createLoading ? 'Creating...' : 'Create Store'}
                                    </button>
                                </div>

                                {/* Info box */}
                                <div className="mt-6 p-4 bg-blue-900/20 border border-blue-800 rounded-lg">
                                    <h4 className="font-medium text-blue-400 mb-2">💡 Storage Info</h4>
                                    <ul className="text-sm text-gray-400 space-y-1">
                                        <li>• Storage is free (no hourly cost)</li>
                                        <li>• Embedding costs apply at upload time</li>
                                        <li>• Max file: 100MB | Total: 1GB-1TB based on tier</li>
                                    </ul>
                                </div>
                            </div>
                        )}

                        {/* Upload Tab */}
                        {activeTab === 'upload' && (
                            <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                                <h2 className="text-xl font-semibold mb-4">Upload Document</h2>
                                <p className="text-gray-400 mb-6 text-sm">
                                    Upload content with optional chunking configuration and custom metadata.
                                </p>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Store Name *
                                        </label>
                                        <input
                                            type="text"
                                            value={uploadStoreName}
                                            onChange={(e) => setUploadStoreName(e.target.value)}
                                            placeholder="fileSearchStores/..."
                                            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Display Name *
                                        </label>
                                        <input
                                            type="text"
                                            value={uploadDisplayName}
                                            onChange={(e) => setUploadDisplayName(e.target.value)}
                                            placeholder="My Document.pdf"
                                            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>

                                    {/* File or Text Content */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Content (file or text) *
                                        </label>
                                        <div className="border-2 border-dashed border-gray-700 rounded-lg p-4 text-center mb-2">
                                            <input
                                                type="file"
                                                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                                                className="hidden"
                                                id="file-upload"
                                                accept=".txt,.md,.json,.csv,.html,.xml,.py,.js,.ts,.pdf"
                                            />
                                            <label htmlFor="file-upload" className="cursor-pointer">
                                                <span className="text-2xl">📁</span>
                                                <p className="text-gray-400 text-sm">Click to select a file</p>
                                            </label>
                                        </div>
                                        {uploadFile && (
                                            <div className="text-sm text-gray-400 mb-2">
                                                Selected: {uploadFile.name} ({(uploadFile.size / 1024).toFixed(1)} KB)
                                            </div>
                                        )}
                                        <p className="text-gray-500 text-xs mb-2">Or paste text content:</p>
                                        <textarea
                                            value={uploadContent}
                                            onChange={(e) => setUploadContent(e.target.value)}
                                            placeholder="Paste document content here..."
                                            rows={4}
                                            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 text-sm"
                                        />
                                    </div>

                                    {/* Chunking Configuration */}
                                    <div className="border border-gray-700 rounded-lg p-4">
                                        <button
                                            type="button"
                                            onClick={() => setShowChunkingConfig(!showChunkingConfig)}
                                            className="flex items-center gap-2 text-sm font-medium text-gray-300"
                                        >
                                            <span>{showChunkingConfig ? '▼' : '▶'}</span>
                                            Chunking Configuration
                                        </button>
                                        {showChunkingConfig && (
                                            <div className="mt-4 space-y-3">
                                                <div>
                                                    <label className="block text-xs text-gray-400 mb-1">
                                                        Max Tokens Per Chunk (100-2000): {maxTokensPerChunk}
                                                    </label>
                                                    <input
                                                        type="range"
                                                        min="100"
                                                        max="2000"
                                                        step="50"
                                                        value={maxTokensPerChunk}
                                                        onChange={(e) => setMaxTokensPerChunk(parseInt(e.target.value))}
                                                        className="w-full"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-gray-400 mb-1">
                                                        Max Overlap Tokens (0-200): {maxOverlapTokens}
                                                    </label>
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max="200"
                                                        step="10"
                                                        value={maxOverlapTokens}
                                                        onChange={(e) => setMaxOverlapTokens(parseInt(e.target.value))}
                                                        className="w-full"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Custom Metadata */}
                                    <div className="border border-gray-700 rounded-lg p-4">
                                        <button
                                            type="button"
                                            onClick={() => setShowMetadata(!showMetadata)}
                                            className="flex items-center gap-2 text-sm font-medium text-gray-300"
                                        >
                                            <span>{showMetadata ? '▼' : '▶'}</span>
                                            Custom Metadata (for filtering)
                                        </button>
                                        {showMetadata && (
                                            <div className="mt-4 space-y-2">
                                                {metadataFields.map((field, idx) => (
                                                    <div key={idx} className="flex gap-2 items-center">
                                                        <input
                                                            type="text"
                                                            placeholder="Key"
                                                            value={field.key}
                                                            onChange={(e) => updateMetadataField(idx, { key: e.target.value })}
                                                            className="flex-1 px-3 py-1 bg-gray-800 border border-gray-700 rounded text-sm"
                                                        />
                                                        <select
                                                            value={field.type}
                                                            onChange={(e) => updateMetadataField(idx, { type: e.target.value as 'string' | 'number' })}
                                                            className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm"
                                                        >
                                                            <option value="string">String</option>
                                                            <option value="number">Number</option>
                                                        </select>
                                                        <input
                                                            type="text"
                                                            placeholder="Value"
                                                            value={field.value}
                                                            onChange={(e) => updateMetadataField(idx, { value: e.target.value })}
                                                            className="flex-1 px-3 py-1 bg-gray-800 border border-gray-700 rounded text-sm"
                                                        />
                                                        <button
                                                            onClick={() => removeMetadataField(idx)}
                                                            className="text-red-400 hover:text-red-300 px-2"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                ))}
                                                <button
                                                    onClick={addMetadataField}
                                                    className="text-blue-400 hover:text-blue-300 text-sm"
                                                >
                                                    + Add Metadata Field
                                                </button>
                                                <p className="text-xs text-gray-500">
                                                    Example: author=John, year=2024, category=docs
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        onClick={handleUploadFile}
                                        disabled={uploadLoading}
                                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                                    >
                                        {uploadLoading ? 'Uploading...' : 'Upload & Index'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Query Tab */}
                        {activeTab === 'query' && (
                            <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                                <h2 className="text-xl font-semibold mb-4">Semantic Query</h2>
                                <p className="text-gray-400 mb-6 text-sm">
                                    Query stores with semantic search, metadata filtering, and optional structured output.
                                </p>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Store Names * (comma-separated)
                                        </label>
                                        <input
                                            type="text"
                                            value={queryStoreNames}
                                            onChange={(e) => setQueryStoreNames(e.target.value)}
                                            placeholder="fileSearchStores/abc, fileSearchStores/def"
                                            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Query up to 5 stores at once</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Query *
                                        </label>
                                        <textarea
                                            value={queryText}
                                            onChange={(e) => setQueryText(e.target.value)}
                                            placeholder="What are the main features of the product?"
                                            rows={3}
                                            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                Model
                                            </label>
                                            <select
                                                value={queryModel}
                                                onChange={(e) => setQueryModel(e.target.value)}
                                                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                                            >
                                                {models.map((m) => (
                                                    <option key={m.id} value={m.id}>{m.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                Metadata Filter
                                            </label>
                                            <input
                                                type="text"
                                                value={metadataFilter}
                                                onChange={(e) => setMetadataFilter(e.target.value)}
                                                placeholder="author=John"
                                                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <label className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={includeCitations}
                                                onChange={(e) => setIncludeCitations(e.target.checked)}
                                                className="rounded bg-gray-800 border-gray-700"
                                            />
                                            <span className="text-sm text-gray-300">Include Citations</span>
                                        </label>
                                        <label className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={useStructuredOutput}
                                                onChange={(e) => setUseStructuredOutput(e.target.checked)}
                                                className="rounded bg-gray-800 border-gray-700"
                                            />
                                            <span className="text-sm text-gray-300">Structured Output</span>
                                        </label>
                                    </div>

                                    {useStructuredOutput && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                Response JSON Schema
                                            </label>
                                            <textarea
                                                value={responseSchema}
                                                onChange={(e) => setResponseSchema(e.target.value)}
                                                placeholder='{"type": "object", "properties": {...}}'
                                                rows={4}
                                                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono text-xs focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                    )}

                                    <button
                                        onClick={handleQuery}
                                        disabled={queryLoading}
                                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                                    >
                                        {queryLoading ? 'Searching...' : 'Search'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Documents Tab */}
                        {activeTab === 'documents' && (
                            <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                                <h2 className="text-xl font-semibold mb-4">Document Management</h2>
                                <p className="text-gray-400 mb-6 text-sm">
                                    View and manage individual documents within a store.
                                </p>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Store Name
                                        </label>
                                        <input
                                            type="text"
                                            value={docStoreName}
                                            onChange={(e) => setDocStoreName(e.target.value)}
                                            placeholder="fileSearchStores/..."
                                            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>

                                    <button
                                        onClick={handleListDocuments}
                                        disabled={documentsLoading}
                                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                                    >
                                        {documentsLoading ? 'Loading...' : 'List Documents'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Manage Tab */}
                        {activeTab === 'manage' && (
                            <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-xl font-semibold">File Search Stores</h2>
                                    <button
                                        onClick={handleListStores}
                                        disabled={manageLoading}
                                        className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                                    >
                                        {manageLoading ? 'Loading...' : '🔄 Refresh'}
                                    </button>
                                </div>

                                {stores.length === 0 ? (
                                    <div className="text-center py-8 text-gray-500">
                                        <div className="text-4xl mb-2">📂</div>
                                        <p>No stores found. Click Refresh to load.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {stores.map((store) => (
                                            <div 
                                                key={store.name}
                                                className="flex items-center justify-between bg-gray-800 rounded-lg p-4"
                                            >
                                                <div>
                                                    <p className="font-medium text-white">{store.display_name}</p>
                                                    <p className="text-xs text-gray-500 font-mono mt-1">{store.name}</p>
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteStore(store.name)}
                                                    className="text-red-400 hover:text-red-300 px-3 py-1 rounded transition-colors"
                                                >
                                                    🗑️
                                                </button>
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
                        {activeTab === 'create' && createdStore && (
                            <div className="bg-green-900/30 border border-green-600 rounded-lg p-6">
                                <h3 className="text-lg font-semibold text-green-400 mb-3">✅ Store Created!</h3>
                                <div className="space-y-2 text-sm">
                                    <p><span className="text-gray-400">Name:</span> <code className="text-blue-400 bg-gray-800 px-2 py-0.5 rounded">{createdStore.name}</code></p>
                                    <p><span className="text-gray-400">Display Name:</span> {createdStore.display_name}</p>
                                </div>
                                <p className="text-gray-400 text-sm mt-4">
                                    Copy the Name to use in Upload and Query tabs.
                                </p>
                            </div>
                        )}

                        {/* Upload Result */}
                        {activeTab === 'upload' && uploadedFile && (
                            <div className="bg-green-900/30 border border-green-600 rounded-lg p-6">
                                <h3 className="text-lg font-semibold text-green-400 mb-3">✅ Document Uploaded!</h3>
                                <div className="space-y-2 text-sm">
                                    <p><span className="text-gray-400">Document ID:</span> <code className="text-blue-400">{uploadedFile.document_id}</code></p>
                                    <p><span className="text-gray-400">Display Name:</span> {uploadedFile.display_name}</p>
                                    {uploadedFile.size_bytes && (
                                        <p><span className="text-gray-400">Size:</span> {(uploadedFile.size_bytes / 1024).toFixed(1)} KB</p>
                                    )}
                                    {uploadedFile.estimated_tokens && (
                                        <p><span className="text-gray-400">Est. Tokens:</span> {uploadedFile.estimated_tokens.toLocaleString()}</p>
                                    )}
                                    {uploadedFile.metadata && uploadedFile.metadata.length > 0 && (
                                        <div>
                                            <span className="text-gray-400">Metadata:</span>
                                            <div className="mt-1 flex flex-wrap gap-1">
                                                {uploadedFile.metadata.map((m, i) => (
                                                    <span key={i} className="px-2 py-0.5 bg-gray-700 rounded text-xs">
                                                        {m.key}={m.string_value || m.numeric_value}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Query Result */}
                        {activeTab === 'query' && queryResult && (
                            <div className="space-y-4">
                                <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                                    <h3 className="text-lg font-semibold mb-3">Response</h3>
                                    <div className="prose prose-invert max-w-none text-sm">
                                        <pre className="whitespace-pre-wrap bg-gray-800 p-4 rounded-lg overflow-auto">
                                            {queryResult.response}
                                        </pre>
                                    </div>
                                    <div className="mt-4 text-xs text-gray-500">
                                        Model: {queryResult.model}
                                    </div>
                                </div>

                                {/* Citations */}
                                {queryResult.citations && queryResult.citations.length > 0 && (
                                    <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                                        <h3 className="text-lg font-semibold mb-3">📚 Citations ({queryResult.citations.length})</h3>
                                        <div className="space-y-3">
                                            {queryResult.citations.map((citation, idx) => (
                                                <div key={idx} className="bg-gray-800 p-3 rounded-lg">
                                                    <p className="text-sm text-blue-400 font-medium">{citation.title || citation.source}</p>
                                                    {citation.text && (
                                                        <p className="text-xs text-gray-400 mt-1">{citation.text}</p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Documents List */}
                        {activeTab === 'documents' && documents.length > 0 && (
                            <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                                <h3 className="text-lg font-semibold mb-4">Documents ({documents.length})</h3>
                                <div className="space-y-3">
                                    {documents.map((doc) => (
                                        <div 
                                            key={doc.name}
                                            className="flex items-center justify-between bg-gray-800 rounded-lg p-4"
                                        >
                                            <div>
                                                <p className="font-medium text-white">{doc.display_name}</p>
                                                <p className="text-xs text-gray-500 font-mono mt-1">{doc.name}</p>
                                                {doc.metadata && doc.metadata.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mt-2">
                                                        {doc.metadata.map((m, i) => (
                                                            <span key={i} className="px-2 py-0.5 bg-gray-700 rounded text-xs">
                                                                {m.key}={m.string_value || m.numeric_value}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => handleDeleteDocument(doc.name)}
                                                className="text-red-400 hover:text-red-300 px-3 py-1 rounded transition-colors"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Feature Info - Show when no results */}
                        {((activeTab === 'create' && !createdStore) ||
                          (activeTab === 'upload' && !uploadedFile) ||
                          (activeTab === 'query' && !queryResult) ||
                          (activeTab === 'documents' && documents.length === 0) ||
                          (activeTab === 'manage' && stores.length === 0)) && (
                            <div className="bg-gray-900/50 rounded-lg p-6 border border-gray-800">
                                <h4 className="font-semibold text-gray-300 mb-4">🔍 File Search Features</h4>
                                <div className="space-y-4 text-sm">
                                    <div>
                                        <h5 className="font-medium text-blue-400">Semantic Search</h5>
                                        <p className="text-gray-400">Find conceptually similar content, not just keyword matches.</p>
                                    </div>
                                    <div>
                                        <h5 className="font-medium text-blue-400">Chunking Configuration</h5>
                                        <p className="text-gray-400">Control how documents are split for optimal retrieval.</p>
                                    </div>
                                    <div>
                                        <h5 className="font-medium text-blue-400">Custom Metadata</h5>
                                        <p className="text-gray-400">Tag documents with key-value pairs for filtering.</p>
                                    </div>
                                    <div>
                                        <h5 className="font-medium text-blue-400">Metadata Filtering</h5>
                                        <p className="text-gray-400">Filter searches by metadata (e.g., author=John).</p>
                                    </div>
                                    <div>
                                        <h5 className="font-medium text-blue-400">Grounded Responses</h5>
                                        <p className="text-gray-400">Get citations showing where answers came from.</p>
                                    </div>
                                    <div>
                                        <h5 className="font-medium text-blue-400">Structured Output</h5>
                                        <p className="text-gray-400">Combine RAG with JSON schema responses.</p>
                                    </div>
                                </div>
                                <div className="mt-4 pt-4 border-t border-gray-800">
                                    <h5 className="font-medium text-gray-400 mb-2">Supported File Types</h5>
                                    <p className="text-xs text-gray-500">
                                        PDF, TXT, MD, HTML, JSON, CSV, XML, DOCX, PPTX, XLSX, PY, JS, TS, JAVA, C, CPP, GO, RS
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

export default withPermission(FileSearchDemoPage, PermissionLevel.DEVELOPER);
