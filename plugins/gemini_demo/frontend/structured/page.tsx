/**
 * *** DEMO CODE *** - Comprehensive Structured Output Demo
 * 
 * Demonstrates Gemini's structured output capabilities:
 * - Predefined schemas (person, recipe, article, review, feedback, event, product, sentiment, language, intent)
 * - Custom JSON Schema
 * - Enum classification mode
 * - Tool integration (Google Search, URL Context)
 * - Schema validation
 * 
 * Documentation: https://ai.google.dev/gemini-api/docs/structured-output
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { withPermission } from '@/lib/components/with-permission';
import { PermissionLevel } from '@/lib/permissions';
import { apiClient } from '@/app/api-client';

// Predefined schema options with examples
const PREDEFINED_SCHEMAS = [
    { 
        value: 'person', 
        label: '👤 Person', 
        desc: 'Extract person information',
        example: 'John Smith is a 32-year-old software engineer at Google. He lives in San Francisco and specializes in machine learning and Python. He has a PhD from Stanford University.'
    },
    { 
        value: 'recipe', 
        label: '🍳 Recipe', 
        desc: 'Parse cooking recipes',
        example: 'To make classic French toast, you need 4 slices of bread, 2 eggs, 1/4 cup milk, 1 tsp vanilla, and 2 tbsp butter. Beat eggs with milk and vanilla. Dip bread slices in mixture. Fry in butter until golden, about 2-3 minutes per side. Serves 2. Prep: 5 min, Cook: 10 min.'
    },
    { 
        value: 'article', 
        label: '📰 Article', 
        desc: 'Analyze articles/documents',
        example: 'The AI Revolution in Healthcare: A new study by MIT researchers shows that machine learning models can detect cancer 30% earlier than traditional methods. Dr. Sarah Chen, lead researcher, says this could save millions of lives. The technology is expected to be available in hospitals by 2025.'
    },
    { 
        value: 'review', 
        label: '⭐ Review', 
        desc: 'Parse product reviews',
        example: 'I bought the Sony WH-1000XM5 headphones last month and they are absolutely amazing! The noise cancellation is the best I have ever experienced. Battery life lasts about 30 hours. The only downside is the high price at $400 and they can get warm during long sessions. Overall 4.5/5, highly recommend for commuters and travelers.'
    },
    { 
        value: 'feedback', 
        label: '💬 Feedback', 
        desc: 'Classify user feedback',
        example: 'The new dashboard update is fantastic! Much more intuitive than before. However, I noticed the export feature is slower now and sometimes crashes on large files. Would be great if you could fix this.'
    },
    { 
        value: 'event', 
        label: '📅 Event', 
        desc: 'Extract event details',
        example: 'Join us for TechCon 2024! Date: March 15-17, 2024 at the Moscone Center, San Francisco. Keynote by Satya Nadella at 9am. Early bird tickets $299 until January 31. Topics include AI, Cloud Computing, and Cybersecurity. Register at techcon2024.com'
    },
    { 
        value: 'product', 
        label: '📦 Product', 
        desc: 'Extract product info',
        example: 'Apple MacBook Pro 14" M3 Pro chip, 18GB RAM, 512GB SSD. Space Gray. Regular price $1,999, now on sale for $1,799 (10% off). In stock. Features include Liquid Retina XDR display, 17-hour battery, MagSafe 3 charging. Weight: 3.5 lbs. Dimensions: 12.31 x 8.71 x 0.60 inches.'
    },
    { 
        value: 'sentiment', 
        label: '😊 Sentiment', 
        desc: 'Simple sentiment analysis',
        example: 'This is the worst customer service I have ever experienced. Waited 2 hours on hold only to be disconnected!'
    },
    { 
        value: 'language', 
        label: '🌍 Language', 
        desc: 'Detect language',
        example: 'Bonjour! Comment allez-vous aujourdhui? Je suis très content de vous rencontrer.'
    },
    { 
        value: 'intent', 
        label: '🎯 Intent', 
        desc: 'Classify user intent',
        example: 'Can you help me reset my password? I tried clicking the forgot password link but it is not working.'
    },
];

// Example custom schemas
const CUSTOM_SCHEMA_EXAMPLES: Record<string, { name: string; schema: object; prompt: string }> = {
    simple: {
        name: 'Simple Object',
        schema: {
            type: 'object',
            properties: {
                name: { type: 'string', description: 'Name of the item' },
                category: { type: 'string', enum: ['electronics', 'clothing', 'food', 'other'] },
                price: { type: 'number', minimum: 0 }
            },
            required: ['name', 'category']
        },
        prompt: 'Extract: iPhone 15 Pro, electronics category, costs $999'
    },
    nested: {
        name: 'Nested Objects',
        schema: {
            type: 'object',
            properties: {
                company: { type: 'string' },
                address: {
                    type: 'object',
                    properties: {
                        street: { type: 'string' },
                        city: { type: 'string' },
                        country: { type: 'string' }
                    },
                    required: ['city', 'country']
                },
                employees: { type: 'integer', minimum: 1 }
            },
            required: ['company', 'address']
        },
        prompt: 'Acme Corp is located at 123 Main St, San Francisco, USA. They have 500 employees.'
    },
    arrays: {
        name: 'Arrays with Constraints',
        schema: {
            type: 'object',
            properties: {
                title: { type: 'string' },
                tags: {
                    type: 'array',
                    items: { type: 'string' },
                    minItems: 1,
                    maxItems: 5,
                    description: 'Up to 5 relevant tags'
                },
                scores: {
                    type: 'array',
                    items: { type: 'number', minimum: 0, maximum: 100 },
                    description: 'Numeric scores 0-100'
                }
            },
            required: ['title', 'tags']
        },
        prompt: 'Blog post about machine learning, tags: AI, neural networks, deep learning. Quality score 85, relevance score 92.'
    },
    nullable: {
        name: 'Nullable Fields',
        schema: {
            type: 'object',
            properties: {
                name: { type: 'string' },
                nickname: { type: ['string', 'null'], description: 'Optional nickname' },
                age: { type: ['integer', 'null'], description: 'Age if known' },
                verified: { type: 'boolean' }
            },
            required: ['name', 'verified']
        },
        prompt: 'John Doe, verified user. No nickname or age provided.'
    }
};

function StructuredDemoPage() {
    const params = useParams();
    const guildId = params.guildId as string;

    // Mode: 'predefined', 'custom', 'enum'
    const [mode, setMode] = useState<'predefined' | 'custom' | 'enum'>('predefined');
    
    // Common state
    const [prompt, setPrompt] = useState(PREDEFINED_SCHEMAS[0].example);
    const [model, setModel] = useState('gemini-3-flash-preview');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [result, setResult] = useState<any>(null);
    
    // Predefined schema mode
    const [selectedSchema, setSelectedSchema] = useState('person');
    
    // Custom schema mode
    const [customSchemaJson, setCustomSchemaJson] = useState(JSON.stringify(CUSTOM_SCHEMA_EXAMPLES.simple.schema, null, 2));
    const [customSchemaExample, setCustomSchemaExample] = useState('simple');
    
    // Enum classification mode
    const [enumValues, setEnumValues] = useState('positive, neutral, negative');
    const [enumType, setEnumType] = useState<'string' | 'integer' | 'number'>('string');
    
    // Options
    const [useTools, setUseTools] = useState<string[]>([]);
    const [returnSchema, setReturnSchema] = useState(false);
    const [validateResponse, setValidateResponse] = useState(true);
    
    // Available schemas from backend
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [availableSchemas, setAvailableSchemas] = useState<any>(null);

    // Load available schemas on mount
    useEffect(() => {
        const loadSchemas = async () => {
            try {
                const schemas = await apiClient.geminiStructuredSchemas();
                setAvailableSchemas(schemas);
            } catch (e) {
                console.error('Failed to load schemas:', e);
            }
        };
        loadSchemas();
    }, []);

    const handleSchemaChange = (schemaName: string) => {
        setSelectedSchema(schemaName);
        const schema = PREDEFINED_SCHEMAS.find(s => s.value === schemaName);
        if (schema) {
            setPrompt(schema.example);
        }
    };

    const handleCustomExampleChange = (example: string) => {
        setCustomSchemaExample(example);
        const ex = CUSTOM_SCHEMA_EXAMPLES[example];
        if (ex) {
            setCustomSchemaJson(JSON.stringify(ex.schema, null, 2));
            setPrompt(ex.prompt);
        }
    };

    const handleGenerate = async () => {
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const requestBody: any = {
                prompt,
                model,
                return_schema: returnSchema,
                validate_response: validateResponse
            };

            if (mode === 'predefined') {
                requestBody.schema_name = selectedSchema;
            } else if (mode === 'custom') {
                requestBody.schema_name = 'custom';
                try {
                    requestBody.custom_schema = JSON.parse(customSchemaJson);
                } catch {
                    setError('Invalid JSON schema. Please check your schema syntax.');
                    setLoading(false);
                    return;
                }
            } else if (mode === 'enum') {
                const values = enumValues.split(',').map(v => v.trim()).filter(v => v);
                if (values.length < 2) {
                    setError('Please provide at least 2 enum values separated by commas.');
                    setLoading(false);
                    return;
                }
                requestBody.enum_values = values;
                requestBody.enum_type = enumType;
            }

            // Add tools if selected (Gemini 3 only)
            if (useTools.length > 0 && model.includes('gemini-3')) {
                requestBody.use_tools = useTools;
            }

            const response = await apiClient.geminiStructured(requestBody);
            setResult(response);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
            setError(e.response?.data?.detail || e.message || 'Failed to generate structured output');
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    // Suppress unused variable warning
    void availableSchemas;

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
                <h1 className="text-2xl font-bold text-white">📋 Structured Output Demo</h1>
            </div>

            {/* Description */}
            <div className="mb-8 p-4 bg-blue-900/20 border border-blue-600/30 rounded-lg">
                <p className="text-blue-200/70">
                    Generate structured JSON output that conforms to a predefined or custom schema.
                    Ideal for data extraction, classification, and generating inputs for tools/APIs.
                </p>
                <p className="text-blue-200/50 text-sm mt-2">
                    📚 <a 
                        href="https://ai.google.dev/gemini-api/docs/structured-output" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="underline hover:text-blue-300"
                    >
                        View Gemini Structured Output Documentation
                    </a>
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Panel - Input */}
                <div className="space-y-6">
                    {/* Mode Selector */}
                    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                        <h3 className="text-lg font-semibold text-white mb-3">🔧 Schema Mode</h3>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setMode('predefined')}
                                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                                    mode === 'predefined'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                }`}
                            >
                                📦 Predefined
                            </button>
                            <button
                                onClick={() => setMode('custom')}
                                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                                    mode === 'custom'
                                        ? 'bg-purple-600 text-white'
                                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                }`}
                            >
                                ✏️ Custom
                            </button>
                            <button
                                onClick={() => setMode('enum')}
                                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                                    mode === 'enum'
                                        ? 'bg-green-600 text-white'
                                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                }`}
                            >
                                🏷️ Enum
                            </button>
                        </div>
                    </div>

                    {/* Schema Configuration */}
                    <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                        {mode === 'predefined' && (
                            <>
                                <h3 className="text-lg font-semibold text-white mb-3">📦 Predefined Schema</h3>
                                <div className="grid grid-cols-2 gap-2 mb-4">
                                    {PREDEFINED_SCHEMAS.map((schema) => (
                                        <button
                                            key={schema.value}
                                            onClick={() => handleSchemaChange(schema.value)}
                                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                                                selectedSchema === schema.value
                                                    ? 'bg-blue-600 text-white'
                                                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                                            }`}
                                        >
                                            <div>{schema.label}</div>
                                            <div className="text-xs opacity-70">{schema.desc}</div>
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}

                        {mode === 'custom' && (
                            <>
                                <h3 className="text-lg font-semibold text-white mb-3">✏️ Custom JSON Schema</h3>
                                
                                {/* Example selector */}
                                <div className="mb-3">
                                    <label className="block text-sm text-gray-400 mb-1">Load Example:</label>
                                    <div className="flex gap-2 flex-wrap">
                                        {Object.entries(CUSTOM_SCHEMA_EXAMPLES).map(([key, ex]) => (
                                            <button
                                                key={key}
                                                onClick={() => handleCustomExampleChange(key)}
                                                className={`px-2 py-1 rounded text-xs transition-colors ${
                                                    customSchemaExample === key
                                                        ? 'bg-purple-600 text-white'
                                                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                                }`}
                                            >
                                                {ex.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <textarea
                                    value={customSchemaJson}
                                    onChange={(e) => setCustomSchemaJson(e.target.value)}
                                    className="w-full h-48 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    placeholder="Enter JSON Schema..."
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Supported: type, properties, required, enum, minimum, maximum, items, minItems, maxItems
                                </p>
                            </>
                        )}

                        {mode === 'enum' && (
                            <>
                                <h3 className="text-lg font-semibold text-white mb-3">🏷️ Enum Classification</h3>
                                <p className="text-sm text-gray-400 mb-3">
                                    Simple mode: output will be exactly one of the values you specify.
                                </p>
                                
                                <div className="mb-3">
                                    <label className="block text-sm text-gray-400 mb-1">Values (comma-separated):</label>
                                    <input
                                        type="text"
                                        value={enumValues}
                                        onChange={(e) => setEnumValues(e.target.value)}
                                        placeholder="positive, neutral, negative"
                                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Value Type:</label>
                                    <div className="flex gap-2">
                                        {(['string', 'integer', 'number'] as const).map((t) => (
                                            <button
                                                key={t}
                                                onClick={() => setEnumType(t)}
                                                className={`px-3 py-1 rounded text-sm ${
                                                    enumType === t
                                                        ? 'bg-green-600 text-white'
                                                        : 'bg-gray-800 text-gray-400'
                                                }`}
                                            >
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Prompt Input */}
                    <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            📝 Input Text
                        </label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Enter the text to extract structured data from..."
                            className="w-full h-32 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Options */}
                    <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                        <h3 className="text-lg font-semibold text-white mb-3">⚙️ Options</h3>
                        
                        {/* Model selector */}
                        <div className="mb-4">
                            <label className="block text-sm text-gray-400 mb-1">Model:</label>
                            <select
                                value={model}
                                onChange={(e) => setModel(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                            >
                                <option value="gemini-3-flash-preview">Gemini 3 Flash (Recommended)</option>
                                <option value="gemini-3-pro-preview">Gemini 3 Pro</option>
                                <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                                <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                            </select>
                        </div>

                        {/* Tool integration (Gemini 3 only) */}
                        {model.includes('gemini-3') && (
                            <div className="mb-4">
                                <label className="block text-sm text-gray-400 mb-1">Tools (Gemini 3 only):</label>
                                <div className="flex gap-2">
                                    <label className="flex items-center gap-2 bg-gray-800 px-3 py-2 rounded-lg cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={useTools.includes('google_search')}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setUseTools([...useTools, 'google_search']);
                                                } else {
                                                    setUseTools(useTools.filter(t => t !== 'google_search'));
                                                }
                                            }}
                                            className="rounded"
                                        />
                                        <span className="text-sm text-white">🔍 Google Search</span>
                                    </label>
                                    <label className="flex items-center gap-2 bg-gray-800 px-3 py-2 rounded-lg cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={useTools.includes('url_context')}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setUseTools([...useTools, 'url_context']);
                                                } else {
                                                    setUseTools(useTools.filter(t => t !== 'url_context'));
                                                }
                                            }}
                                            className="rounded"
                                        />
                                        <span className="text-sm text-white">🌐 URL Context</span>
                                    </label>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    Combine structured output with real-time web data
                                </p>
                            </div>
                        )}

                        {/* Additional options */}
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={returnSchema}
                                    onChange={(e) => setReturnSchema(e.target.checked)}
                                    className="rounded"
                                />
                                <span className="text-sm text-gray-300">Return schema</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={validateResponse}
                                    onChange={(e) => setValidateResponse(e.target.checked)}
                                    className="rounded"
                                />
                                <span className="text-sm text-gray-300">Validate response</span>
                            </label>
                        </div>
                    </div>

                    {/* Submit Button */}
                    <button
                        onClick={handleGenerate}
                        disabled={loading || !prompt.trim()}
                        className={`w-full py-4 rounded-lg font-medium text-lg transition-colors ${
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
                            '📋 Generate Structured Output'
                        )}
                    </button>
                </div>

                {/* Right Panel - Output */}
                <div className="space-y-6">
                    {/* Error Display */}
                    {error && (
                        <div className="bg-red-900/20 border border-red-600/30 rounded-lg p-4">
                            <p className="text-red-400">{error}</p>
                        </div>
                    )}

                    {/* Results */}
                    {result && (
                        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-white">📋 Structured Result</h3>
                                <button
                                    onClick={() => copyToClipboard(JSON.stringify(result.result, null, 2))}
                                    className="text-gray-400 hover:text-white px-2 py-1 bg-gray-800 rounded text-sm"
                                >
                                    📋 Copy
                                </button>
                            </div>

                            {/* Metadata */}
                            <div className="grid grid-cols-3 gap-2 mb-4">
                                <div className="bg-gray-800 rounded-lg p-2 text-center">
                                    <div className="text-sm font-bold text-blue-400">{result.mode}</div>
                                    <div className="text-xs text-gray-400">Mode</div>
                                </div>
                                <div className="bg-gray-800 rounded-lg p-2 text-center">
                                    <div className="text-sm font-bold text-purple-400">{result.schema_name}</div>
                                    <div className="text-xs text-gray-400">Schema</div>
                                </div>
                                <div className="bg-gray-800 rounded-lg p-2 text-center">
                                    <div className="text-sm font-bold text-yellow-400">
                                        ${result.cost?.toFixed(6) || '0.000000'}
                                    </div>
                                    <div className="text-xs text-gray-400">Cost</div>
                                </div>
                            </div>

                            {/* Validation result */}
                            {result.validation && (
                                <div className={`mb-4 p-2 rounded-lg text-sm ${
                                    result.validation.valid
                                        ? 'bg-green-900/20 text-green-400 border border-green-600/30'
                                        : 'bg-yellow-900/20 text-yellow-400 border border-yellow-600/30'
                                }`}>
                                    {result.validation.valid 
                                        ? '✓ Schema validation passed'
                                        : `⚠ Missing required fields: ${result.validation.missing_required?.join(', ')}`
                                    }
                                </div>
                            )}

                            {/* Tools used */}
                            {result.tools_used && result.tools_used.length > 0 && (
                                <div className="mb-4 p-2 bg-blue-900/20 rounded-lg text-sm text-blue-400 border border-blue-600/30">
                                    🔧 Tools used: {result.tools_used.join(', ')}
                                </div>
                            )}

                            {/* Main result */}
                            <pre className="bg-gray-800 rounded-lg p-4 text-sm text-gray-300 overflow-x-auto whitespace-pre-wrap max-h-96">
                                {JSON.stringify(result.result, null, 2)}
                            </pre>

                            {/* Token usage */}
                            {result.usage && (
                                <div className="mt-4 text-xs text-gray-500">
                                    Tokens: {result.usage.prompt_tokens} input + {result.usage.completion_tokens} output = {result.usage.total_tokens} total
                                </div>
                            )}
                        </div>
                    )}

                    {/* Schema Preview (when return_schema is enabled) */}
                    {result?.schema && (
                        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                            <h3 className="text-lg font-semibold text-white mb-3">📐 Schema Used</h3>
                            <pre className="bg-gray-800 rounded-lg p-4 text-xs text-gray-400 overflow-x-auto max-h-64">
                                {JSON.stringify(result.schema, null, 2)}
                            </pre>
                        </div>
                    )}

                    {/* Loading State */}
                    {loading && (
                        <div className="bg-gray-900 rounded-lg p-12 border border-gray-800 text-center">
                            <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                            <p className="text-gray-300">Generating structured output...</p>
                        </div>
                    )}

                    {/* Empty State */}
                    {!result && !loading && !error && (
                        <div className="bg-gray-900 rounded-lg p-12 border border-gray-800 text-center">
                            <div className="text-6xl mb-4">📋</div>
                            <h3 className="text-lg font-medium text-gray-300 mb-2">Ready to Generate</h3>
                            <p className="text-gray-500">
                                Select a schema mode and enter text to extract structured data
                            </p>
                        </div>
                    )}

                    {/* Documentation Panel */}
                    <div className="bg-gray-900/50 rounded-lg p-6 border border-gray-800">
                        <h3 className="text-sm font-semibold text-gray-400 mb-3">📚 Documentation</h3>
                        <div className="text-xs text-gray-500 space-y-2">
                            <p><strong>Use Cases:</strong></p>
                            <ul className="list-disc list-inside space-y-1">
                                <li><strong>Data Extraction:</strong> Pull specific info from text</li>
                                <li><strong>Classification:</strong> Categorize using enums</li>
                                <li><strong>Agentic Workflows:</strong> Generate tool inputs</li>
                            </ul>
                            <p className="mt-3"><strong>Schema Features:</strong></p>
                            <ul className="list-disc list-inside space-y-1">
                                <li>Types: string, number, integer, boolean, object, array, null</li>
                                <li>Strings: enum, format (date-time, date, time)</li>
                                <li>Numbers: enum, minimum, maximum</li>
                                <li>Arrays: items, minItems, maxItems</li>
                                <li>Nullable: use [&quot;string&quot;, &quot;null&quot;]</li>
                            </ul>
                            <p className="mt-3"><strong>Best Practices:</strong></p>
                            <ul className="list-disc list-inside space-y-1">
                                <li>Use description fields to guide the model</li>
                                <li>Use enum for classification tasks</li>
                                <li>Keep schemas reasonably sized</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default withPermission(StructuredDemoPage, PermissionLevel.USER);
