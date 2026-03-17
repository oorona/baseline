/**
 * *** DEMO CODE *** - Comprehensive Function Calling Demo
 * 
 * Demonstrates all function calling features:
 * - 4 Modes: AUTO, ANY, NONE, VALIDATED
 * - 6 Predefined Scenarios with 25+ functions
 * - Parallel Function Calling (multiple functions at once)
 * - Compositional Calling (chained workflows)
 * - Multi-Tool Use (Google Search + Code Execution)
 * - Multi-Turn Conversations with function results
 * - Automatic Simulation for demos
 * 
 * @see https://ai.google.dev/gemini-api/docs/function-calling
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { withPermission } from '@/lib/components/with-permission';
import { PermissionLevel } from '@/lib/permissions';
import { apiClient } from '@/app/api-client';

// Types
interface FunctionCall {
    name: string;
    args: Record<string, any>;
}

interface SimulatedResult {
    function: string;
    result: Record<string, any>;
}

interface ScenarioInfo {
    name: string;
    description: string;
    function_count: number;
    functions: string[];
    example_prompts: string[];
}

interface ConversationTurn {
    role: 'user' | 'model' | 'function';
    content?: string;
    function_calls?: FunctionCall[];
    function_results?: SimulatedResult[];
}

type Mode = 'AUTO' | 'ANY' | 'NONE' | 'VALIDATED';

const MODES: { value: Mode; label: string; description: string; color: string }[] = [
    { value: 'AUTO', label: 'AUTO', description: 'Model decides when to call functions', color: 'blue' },
    { value: 'ANY', label: 'ANY', description: 'Force function call on every request', color: 'green' },
    { value: 'NONE', label: 'NONE', description: 'Disable function calling', color: 'gray' },
    { value: 'VALIDATED', label: 'VALIDATED', description: 'Force call with text fallback', color: 'purple' },
];

function FunctionCallingDemoPage() {
    const params = useParams();
    const guildId = params.guildId as string;

    // State
    const [prompt, setPrompt] = useState("What's the weather in Tokyo and New York?");
    const [mode, setMode] = useState<Mode>('AUTO');
    const [scenario, setScenario] = useState<string>('weather');
    const [scenarios, setScenarios] = useState<Record<string, ScenarioInfo>>({});
    const [enableSimulation, setEnableSimulation] = useState(true);
    const [enableGoogleSearch, setEnableGoogleSearch] = useState(false);
    const [enableCodeExecution, setEnableCodeExecution] = useState(false);
    const [loading, setLoading] = useState(false);
    const [loadingScenarios, setLoadingScenarios] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<any>(null);
    const [conversation, setConversation] = useState<ConversationTurn[]>([]);
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Load scenarios on mount
    useEffect(() => {
        loadScenarios();
    }, []);

    const loadScenarios = async () => {
        try {
            const data = await apiClient.geminiFunctionCallingScenarios();
            setScenarios(data.scenarios || {});
        } catch (e) {
            console.error('Failed to load scenarios:', e);
        } finally {
            setLoadingScenarios(false);
        }
    };

    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        
        setLoading(true);
        setError(null);

        try {
            const response = await apiClient.geminiFunctionCalling({
                prompt,
                mode,
                scenario,
                simulate_execution: enableSimulation,
                enable_google_search: enableGoogleSearch,
                enable_code_execution: enableCodeExecution,
            });
            
            setResult(response);
            
            // Add to conversation
            const newTurns: ConversationTurn[] = [
                { role: 'user', content: prompt }
            ];
            
            if (response.function_calls?.length > 0) {
                newTurns.push({
                    role: 'model',
                    function_calls: response.function_calls,
                    function_results: response.simulated_results
                });
            }
            
            if (response.text_response) {
                newTurns.push({
                    role: 'model',
                    content: response.text_response
                });
            }
            
            setConversation(prev => [...prev, ...newTurns]);
            
        } catch (e: any) {
            setError(e.response?.data?.detail || e.message || 'Failed to process');
        } finally {
            setLoading(false);
        }
    };

    const handleExampleClick = (examplePrompt: string) => {
        setPrompt(examplePrompt);
    };

    const clearConversation = () => {
        setConversation([]);
        setResult(null);
    };

    const currentScenario = scenarios[scenario];

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
                <h1 className="text-2xl font-bold text-white">🔧 Function Calling Demo</h1>
            </div>

            {/* Info Banner */}
            <div className="mb-6 p-4 bg-blue-900/20 border border-blue-600/30 rounded-lg">
                <p className="text-blue-200/80">
                    <strong>Function Calling</strong> enables Gemini to call external functions/APIs based on user intent.
                    This demo showcases all features: <span className="text-blue-300">parallel calling</span>, 
                    <span className="text-green-300"> compositional workflows</span>, 
                    <span className="text-purple-300"> multi-tool use</span>, and 
                    <span className="text-yellow-300"> automatic simulation</span>.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column - Configuration */}
                <div className="space-y-6">
                    {/* Scenario Selector */}
                    <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                        <h3 className="text-lg font-semibold text-white mb-4">📁 Scenario</h3>
                        
                        {loadingScenarios ? (
                            <div className="animate-pulse h-20 bg-gray-800 rounded" />
                        ) : (
                            <div className="grid grid-cols-2 gap-2">
                                {Object.entries(scenarios).map(([key, info]) => (
                                    <button
                                        key={key}
                                        onClick={() => setScenario(key)}
                                        className={`p-3 rounded-lg text-left transition-all ${
                                            scenario === key
                                                ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                                                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                                        }`}
                                    >
                                        <div className="font-medium text-sm">{info.name}</div>
                                        <div className="text-xs opacity-70 mt-1">
                                            {info.function_count} functions
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                        
                        {currentScenario && (
                            <div className="mt-4 p-3 bg-gray-800 rounded-lg">
                                <p className="text-sm text-gray-400">{currentScenario.description}</p>
                                <div className="mt-2 flex flex-wrap gap-1">
                                    {currentScenario.functions.map(fn => (
                                        <span key={fn} className="px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-300 font-mono">
                                            {fn}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Mode Selector */}
                    <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                        <h3 className="text-lg font-semibold text-white mb-4">⚙️ Mode</h3>
                        <div className="grid grid-cols-2 gap-2">
                            {MODES.map(m => (
                                <button
                                    key={m.value}
                                    onClick={() => setMode(m.value)}
                                    className={`p-3 rounded-lg text-left transition-all ${
                                        mode === m.value
                                            ? `bg-${m.color}-600 text-white ring-2 ring-${m.color}-400`
                                            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                                    }`}
                                    style={{
                                        backgroundColor: mode === m.value 
                                            ? m.color === 'blue' ? '#2563eb' 
                                            : m.color === 'green' ? '#16a34a'
                                            : m.color === 'purple' ? '#9333ea'
                                            : '#4b5563'
                                            : undefined
                                    }}
                                >
                                    <div className="font-mono font-bold text-sm">{m.label}</div>
                                    <div className="text-xs opacity-70 mt-1">{m.description}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Prompt Input */}
                    <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                        <h3 className="text-lg font-semibold text-white mb-4">💬 Prompt</h3>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Enter your prompt..."
                            className="w-full h-28 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        />
                        
                        {/* Options */}
                        <div className="mt-4 space-y-2">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={enableSimulation}
                                    onChange={(e) => setEnableSimulation(e.target.checked)}
                                    className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-300">
                                    🎭 Simulate function execution (mock data)
                                </span>
                            </label>
                            
                            <button
                                onClick={() => setShowAdvanced(!showAdvanced)}
                                className="text-sm text-gray-400 hover:text-gray-300"
                            >
                                {showAdvanced ? '▼' : '▶'} Advanced Options
                            </button>
                            
                            {showAdvanced && (
                                <div className="pl-4 space-y-2 border-l-2 border-gray-700">
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={enableGoogleSearch}
                                            onChange={(e) => setEnableGoogleSearch(e.target.checked)}
                                            className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-green-500 focus:ring-green-500"
                                        />
                                        <span className="text-sm text-gray-300">
                                            🔍 Enable Google Search (multi-tool)
                                        </span>
                                    </label>
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={enableCodeExecution}
                                            onChange={(e) => setEnableCodeExecution(e.target.checked)}
                                            className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-purple-500 focus:ring-purple-500"
                                        />
                                        <span className="text-sm text-gray-300">
                                            💻 Enable Code Execution (multi-tool)
                                        </span>
                                    </label>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={handleGenerate}
                            disabled={loading || !prompt.trim()}
                            className={`w-full mt-4 py-3 rounded-lg font-medium transition-colors ${
                                loading || !prompt.trim()
                                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                    : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                                    Processing...
                                </span>
                            ) : (
                                '🚀 Call Functions'
                            )}
                        </button>
                    </div>

                    {/* Example Prompts */}
                    {currentScenario && (
                        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                            <h3 className="text-lg font-semibold text-white mb-3">💡 Try These</h3>
                            <div className="space-y-2">
                                {currentScenario.example_prompts.map((example, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleExampleClick(example)}
                                        className="w-full text-left px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 text-sm transition-colors"
                                    >
                                        {example}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Column - Results */}
                <div className="space-y-6">
                    {/* Error Display */}
                    {error && (
                        <div className="bg-red-900/20 border border-red-600/30 rounded-lg p-4">
                            <p className="text-red-400">{error}</p>
                        </div>
                    )}

                    {/* Function Calls Result */}
                    {result?.success && result.function_calls?.length > 0 && (
                        <div className="bg-green-900/20 rounded-lg p-6 border border-green-600/30">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-green-300">
                                    🔧 Function Calls 
                                    {result.parallel_calls && (
                                        <span className="ml-2 px-2 py-0.5 bg-yellow-600/30 text-yellow-300 text-xs rounded">
                                            PARALLEL
                                        </span>
                                    )}
                                </h3>
                                <span className="text-xs text-gray-400 font-mono">
                                    mode: {result.mode}
                                </span>
                            </div>
                            
                            <div className="space-y-4">
                                {result.function_calls.map((call: FunctionCall, idx: number) => (
                                    <div key={idx} className="bg-gray-800 rounded-lg overflow-hidden">
                                        <div className="px-4 py-2 bg-gray-700/50 flex items-center justify-between">
                                            <span className="font-mono text-blue-400 font-medium">
                                                {call.name}()
                                            </span>
                                            <span className="text-xs text-gray-500">
                                                Call #{idx + 1}
                                            </span>
                                        </div>
                                        <div className="p-4">
                                            <div className="text-xs text-gray-500 mb-1">Arguments:</div>
                                            <pre className="text-sm text-gray-300 overflow-x-auto bg-gray-900/50 p-2 rounded">
                                                {JSON.stringify(call.args, null, 2)}
                                            </pre>
                                            
                                            {/* Simulated Result */}
                                            {enableSimulation && result.simulated_results?.[idx] && (
                                                <div className="mt-3 pt-3 border-t border-gray-700">
                                                    <div className="text-xs text-green-500 mb-1 flex items-center gap-1">
                                                        🎭 Simulated Result:
                                                    </div>
                                                    <pre className="text-sm text-green-300/80 overflow-x-auto bg-green-900/20 p-2 rounded">
                                                        {JSON.stringify(result.simulated_results[idx].result, null, 2)}
                                                    </pre>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Text Response */}
                    {result?.success && result.text_response && (
                        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                            <h3 className="text-lg font-semibold text-white mb-4">💬 Text Response</h3>
                            <p className="text-gray-300 whitespace-pre-wrap">{result.text_response}</p>
                        </div>
                    )}

                    {/* Code Execution Result */}
                    {result?.code_execution && (
                        <div className="bg-purple-900/20 rounded-lg p-6 border border-purple-600/30">
                            <h3 className="text-lg font-semibold text-purple-300 mb-4">💻 Code Execution</h3>
                            <pre className="text-sm text-gray-300 overflow-x-auto bg-gray-800 p-3 rounded">
                                {result.code_execution.code}
                            </pre>
                            {result.code_execution.output && (
                                <div className="mt-2 p-2 bg-gray-700 rounded text-sm text-green-300">
                                    Output: {result.code_execution.output}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Usage Stats */}
                    {result?.usage && (
                        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-400">
                                    Tokens: {result.usage.prompt_tokens} → {result.usage.completion_tokens}
                                </span>
                                <span className="text-gray-400">
                                    Cost: ${result.usage.cost?.toFixed(6) || '0.00'}
                                </span>
                                <span className="text-gray-400">
                                    {result.usage.latency_ms}ms
                                </span>
                            </div>
                        </div>
                    )}

                    {/* No Function Calls */}
                    {result?.success && !result.function_calls?.length && !result.text_response && (
                        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                            <h3 className="text-lg font-semibold text-white mb-4">Result</h3>
                            <p className="text-gray-400">No function calls detected for this prompt.</p>
                        </div>
                    )}

                    {/* Empty State */}
                    {!result && !loading && !error && (
                        <div className="bg-gray-900 rounded-lg p-12 border border-gray-800 text-center">
                            <div className="text-6xl mb-4">🔧</div>
                            <h3 className="text-lg font-medium text-gray-300 mb-2">Ready to Call Functions</h3>
                            <p className="text-gray-500 text-sm max-w-md mx-auto">
                                Select a scenario, enter a prompt, and see how Gemini intelligently 
                                determines which functions to call and with what arguments.
                            </p>
                        </div>
                    )}

                    {/* Loading State */}
                    {loading && (
                        <div className="bg-gray-900 rounded-lg p-12 border border-gray-800 text-center">
                            <div className="animate-spin h-10 w-10 border-3 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                            <p className="text-gray-300">Analyzing prompt and calling functions...</p>
                        </div>
                    )}

                    {/* Conversation History */}
                    {conversation.length > 0 && (
                        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-white">📜 Conversation</h3>
                                <button
                                    onClick={clearConversation}
                                    className="text-xs text-gray-400 hover:text-white px-2 py-1 bg-gray-800 rounded"
                                >
                                    Clear
                                </button>
                            </div>
                            <div className="space-y-3 max-h-96 overflow-y-auto">
                                {conversation.map((turn, idx) => (
                                    <div 
                                        key={idx}
                                        className={`p-3 rounded-lg ${
                                            turn.role === 'user' 
                                                ? 'bg-blue-900/20 border-l-2 border-blue-500'
                                                : 'bg-gray-800 border-l-2 border-green-500'
                                        }`}
                                    >
                                        <div className="text-xs text-gray-500 mb-1">
                                            {turn.role === 'user' ? '👤 User' : '🤖 Model'}
                                        </div>
                                        {turn.content && (
                                            <p className="text-sm text-gray-300">{turn.content}</p>
                                        )}
                                        {turn.function_calls && (
                                            <div className="text-sm">
                                                {turn.function_calls.map((fc, i) => (
                                                    <span key={i} className="inline-block mr-2 px-2 py-0.5 bg-green-700/30 text-green-300 rounded font-mono text-xs">
                                                        {fc.name}()
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Documentation Reference */}
                    <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
                        <h4 className="text-sm font-medium text-gray-400 mb-2">📚 Reference</h4>
                        <ul className="text-xs text-gray-500 space-y-1">
                            <li>• <strong>AUTO</strong>: Model chooses when to call functions</li>
                            <li>• <strong>ANY</strong>: Force function calls (use <code className="text-blue-400">allowed_function_names</code> to restrict)</li>
                            <li>• <strong>NONE</strong>: Disable function calling, functions are context only</li>
                            <li>• <strong>VALIDATED</strong>: Like ANY but can respond with text if no function fits</li>
                            <li>• <strong>Parallel</strong>: Multiple functions in one turn (e.g., "weather in Tokyo AND London")</li>
                            <li>• <strong>Multi-turn</strong>: Chain function results across conversation turns</li>
                        </ul>
                        <a 
                            href="https://ai.google.dev/gemini-api/docs/function-calling"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block mt-2 text-xs text-blue-400 hover:underline"
                        >
                            View Documentation →
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default withPermission(FunctionCallingDemoPage, PermissionLevel.USER);
