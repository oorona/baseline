/**
 * *** DEMO CODE *** - Text-to-Speech Demo
 * Demonstrates Gemini's TTS capabilities with:
 * - All 30 voice options with descriptions
 * - Multi-speaker support (up to 2 speakers)
 * - Emotion/style control via prompting
 * - Audio Profile, Scene, and Director's Notes templates
 * - Models: gemini-2.5-flash-preview-tts, gemini-2.5-pro-preview-tts
 * 
 * Documentation: https://ai.google.dev/gemini-api/docs/speech-generation
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { withPermission } from '@/lib/components/with-permission';
import { PermissionLevel } from '@/lib/permissions';
import { apiClient } from '@/app/api-client';

// All 30 TTS Voice Options from documentation
const VOICES = [
    // Row 1
    { value: 'Zephyr', label: 'Zephyr', desc: 'Bright', category: 'expressive' },
    { value: 'Puck', label: 'Puck', desc: 'Upbeat', category: 'expressive' },
    { value: 'Charon', label: 'Charon', desc: 'Informative', category: 'professional' },
    // Row 2
    { value: 'Kore', label: 'Kore', desc: 'Firm', category: 'professional' },
    { value: 'Fenrir', label: 'Fenrir', desc: 'Excitable', category: 'expressive' },
    { value: 'Leda', label: 'Leda', desc: 'Youthful', category: 'casual' },
    // Row 3
    { value: 'Orus', label: 'Orus', desc: 'Firm', category: 'professional' },
    { value: 'Aoede', label: 'Aoede', desc: 'Breezy', category: 'casual' },
    { value: 'Callirrhoe', label: 'Callirrhoe', desc: 'Easy-going', category: 'casual' },
    // Row 4
    { value: 'Autonoe', label: 'Autonoe', desc: 'Bright', category: 'expressive' },
    { value: 'Enceladus', label: 'Enceladus', desc: 'Breathy', category: 'special' },
    { value: 'Iapetus', label: 'Iapetus', desc: 'Clear', category: 'professional' },
    // Row 5
    { value: 'Umbriel', label: 'Umbriel', desc: 'Easy-going', category: 'casual' },
    { value: 'Algieba', label: 'Algieba', desc: 'Smooth', category: 'special' },
    { value: 'Despina', label: 'Despina', desc: 'Smooth', category: 'special' },
    // Row 6
    { value: 'Erinome', label: 'Erinome', desc: 'Clear', category: 'professional' },
    { value: 'Algenib', label: 'Algenib', desc: 'Gravelly', category: 'special' },
    { value: 'Rasalgethi', label: 'Rasalgethi', desc: 'Informative', category: 'professional' },
    // Row 7
    { value: 'Laomedeia', label: 'Laomedeia', desc: 'Upbeat', category: 'expressive' },
    { value: 'Achernar', label: 'Achernar', desc: 'Soft', category: 'special' },
    { value: 'Alnilam', label: 'Alnilam', desc: 'Firm', category: 'professional' },
    // Row 8
    { value: 'Schedar', label: 'Schedar', desc: 'Even', category: 'professional' },
    { value: 'Gacrux', label: 'Gacrux', desc: 'Mature', category: 'special' },
    { value: 'Pulcherrima', label: 'Pulcherrima', desc: 'Forward', category: 'expressive' },
    // Row 9
    { value: 'Achird', label: 'Achird', desc: 'Friendly', category: 'casual' },
    { value: 'Zubenelgenubi', label: 'Zubenelgenubi', desc: 'Casual', category: 'casual' },
    { value: 'Vindemiatrix', label: 'Vindemiatrix', desc: 'Gentle', category: 'special' },
    // Row 10
    { value: 'Sadachbia', label: 'Sadachbia', desc: 'Lively', category: 'expressive' },
    { value: 'Sadaltager', label: 'Sadaltager', desc: 'Knowledgeable', category: 'professional' },
    { value: 'Sulafat', label: 'Sulafat', desc: 'Warm', category: 'special' },
];

// Voice categories for filtering
const VOICE_CATEGORIES = [
    { value: 'all', label: 'All Voices' },
    { value: 'professional', label: '💼 Professional' },
    { value: 'expressive', label: '✨ Expressive' },
    { value: 'casual', label: '😊 Casual' },
    { value: 'special', label: '🎭 Special' },
];

// TTS Model Options
const TTS_MODELS = [
    { 
        value: 'gemini-2.5-flash-preview-tts', 
        label: 'Gemini 2.5 Flash TTS', 
        desc: 'Fast, lower cost',
        pricing: '$0.50 / 1M input tokens'
    },
    { 
        value: 'gemini-2.5-pro-preview-tts', 
        label: 'Gemini 2.5 Pro TTS', 
        desc: 'Higher quality, expressive',
        pricing: '$2.00 / 1M input tokens'
    },
];

// Emotion/Style Presets
const STYLE_PRESETS = [
    { value: '', label: 'None (use text as-is)' },
    { value: 'cheerful', label: '😊 Cheerful', prompt: 'Say cheerfully and with enthusiasm:' },
    { value: 'calm', label: '🧘 Calm & Relaxed', prompt: 'Say in a calm, relaxed tone:' },
    { value: 'excited', label: '🎉 Excited', prompt: 'Say with excitement and energy:' },
    { value: 'serious', label: '😐 Serious', prompt: 'Say in a serious, professional manner:' },
    { value: 'whisper', label: '🤫 Whisper', prompt: 'Say in a soft whisper:' },
    { value: 'news', label: '📰 News Anchor', prompt: 'Say like a professional news anchor:' },
    { value: 'story', label: '📖 Storyteller', prompt: 'Say like narrating an engaging story:' },
    { value: 'angry', label: '😠 Frustrated', prompt: 'Say with frustration:' },
    { value: 'sad', label: '😢 Sad', prompt: 'Say with sadness in your voice:' },
    { value: 'custom', label: '✏️ Custom Prompt...' },
];

// Sample prompts with different styles
const SAMPLE_PROMPTS = [
    {
        label: 'Simple greeting',
        text: 'Hello! Welcome to our Discord server. We are happy to have you here.',
        style: 'cheerful',
    },
    {
        label: 'News headline',
        text: 'Breaking news: Scientists have discovered a new species of deep-sea fish that glows in complete darkness.',
        style: 'news',
    },
    {
        label: 'Spooky whisper',
        text: 'By the pricking of my thumbs, something wicked this way comes...',
        style: 'whisper',
    },
    {
        label: 'Multi-speaker conversation',
        text: 'Speaker1: How was your day?\nSpeaker2: It was great! I finished the project early.',
        style: '',
        multiSpeaker: true,
    },
];

// 24 Supported Languages (auto-detected from text)
const SUPPORTED_LANGUAGES = [
    { code: 'ar-EG', label: 'Arabic (Egyptian)' },
    { code: 'bn-BD', label: 'Bengali (Bangladesh)' },
    { code: 'de-DE', label: 'German (Germany)' },
    { code: 'en-IN', label: 'English (India)' },
    { code: 'en-US', label: 'English (US)' },
    { code: 'es-US', label: 'Spanish (US)' },
    { code: 'fr-FR', label: 'French (France)' },
    { code: 'hi-IN', label: 'Hindi (India)' },
    { code: 'id-ID', label: 'Indonesian' },
    { code: 'it-IT', label: 'Italian (Italy)' },
    { code: 'ja-JP', label: 'Japanese' },
    { code: 'ko-KR', label: 'Korean' },
    { code: 'mr-IN', label: 'Marathi (India)' },
    { code: 'nl-NL', label: 'Dutch (Netherlands)' },
    { code: 'pl-PL', label: 'Polish' },
    { code: 'pt-BR', label: 'Portuguese (Brazil)' },
    { code: 'ro-RO', label: 'Romanian' },
    { code: 'ru-RU', label: 'Russian' },
    { code: 'ta-IN', label: 'Tamil (India)' },
    { code: 'te-IN', label: 'Telugu (India)' },
    { code: 'th-TH', label: 'Thai' },
    { code: 'tr-TR', label: 'Turkish' },
    { code: 'uk-UA', label: 'Ukrainian' },
    { code: 'vi-VN', label: 'Vietnamese' },
];

// Director's Notes Template - Full prompting structure from official docs
const DIRECTORS_TEMPLATE = `# AUDIO PROFILE: Jaz R.
## "The Morning Hype"

## THE SCENE: The London Studio
It is 10:00 PM in a glass-walled studio overlooking the moonlit London skyline,
but inside, it is blindingly bright. The red "ON AIR" tally light is blazing.
Jaz is standing up, not sitting, bouncing on the balls of their heels to the
rhythm of a thumping backing track.

### DIRECTOR'S NOTES
Style:
* The "Vocal Smile": You must hear the grin in the audio. The soft palate is
  always raised to keep the tone bright, sunny, and explicitly inviting.
* Dynamics: High projection without shouting. Punchy consonants and elongated
  vowels on excitement words (e.g., "Beauuutiful morning").

Pacing: Speaks at an energetic pace, keeping up with the fast music. Speaks
with a "bouncing" cadence. High-speed delivery with fluid transitions.

Accent: Jaz is from Brixton, London

### TRANSCRIPT
Yes, massive vibes in the studio! You are locked in and it is absolutely
popping off in London right now. If you're stuck on the tube, or just sat
there pretending to work... stop it. Seriously, I see you. Turn this up!`;

function TTSDemoPage() {
    const params = useParams();
    const guildId = params.guildId as string;

    // Basic state
    const [text, setText] = useState('');
    const [voice, setVoice] = useState('Kore');
    const [voice2, setVoice2] = useState('Puck');
    const [model, setModel] = useState('gemini-2.5-flash-preview-tts');
    const [voiceCategory, setVoiceCategory] = useState('all');
    
    // Advanced options
    const [mode, setMode] = useState<'single' | 'multi'>('single');
    const [stylePreset, setStylePreset] = useState('');
    const [customStylePrompt, setCustomStylePrompt] = useState('');
    const [showAdvanced, setShowAdvanced] = useState(false);
    
    // Multi-speaker config
    const [speaker1Name, setSpeaker1Name] = useState('Speaker1');
    const [speaker2Name, setSpeaker2Name] = useState('Speaker2');
    
    // Results
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<any>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);

    // Filter voices by category
    const filteredVoices = voiceCategory === 'all' 
        ? VOICES 
        : VOICES.filter(v => v.category === voiceCategory);

    // Build the full prompt with style
    const buildFullPrompt = (): string => {
        let finalText = text;
        
        if (stylePreset === 'custom' && customStylePrompt) {
            finalText = `${customStylePrompt}\n\n${text}`;
        } else if (stylePreset) {
            const preset = STYLE_PRESETS.find(s => s.value === stylePreset);
            if (preset?.prompt) {
                finalText = `${preset.prompt}\n\n${text}`;
            }
        }
        
        return finalText;
    };

    const handleGenerate = async () => {
        if (!text.trim()) return;
        
        setLoading(true);
        setError(null);
        setResult(null);
        setAudioUrl(null);

        try {
            let response;
            
            if (mode === 'multi') {
                // Multi-speaker TTS
                response = await apiClient.geminiTTSMulti({
                    text: buildFullPrompt(),
                    speakers: [
                        { name: speaker1Name, voice_name: voice },
                        { name: speaker2Name, voice_name: voice2 },
                    ],
                });
            } else {
                // Single-speaker TTS with style
                response = await apiClient.geminiTTS({
                    text: buildFullPrompt(),
                    voice_name: voice,
                    style_prompt: stylePreset === 'custom' ? customStylePrompt : undefined,
                });
            }
            
            setResult(response);
            
            if (response.success && response.audio_base64) {
                // Convert base64 to blob URL for audio playback
                const byteCharacters = atob(response.audio_base64);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: response.mime_type || 'audio/wav' });
                setAudioUrl(URL.createObjectURL(blob));
            }
        } catch (e: any) {
            setError(e.response?.data?.detail || e.message || 'Failed to generate speech');
        } finally {
            setLoading(false);
        }
    };

    // Clean up audio URL on unmount
    useEffect(() => {
        return () => {
            if (audioUrl) {
                URL.revokeObjectURL(audioUrl);
            }
        };
    }, [audioUrl]);

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
                <h1 className="text-2xl font-bold text-white">🔊 Text-to-Speech Demo</h1>
            </div>

            {/* Info Banner */}
            <div className="mb-8 p-4 bg-yellow-900/20 border border-yellow-600/30 rounded-lg">
                <p className="text-yellow-200/70">
                    <strong>Gemini TTS</strong> converts text to natural-sounding speech with controllable style, 
                    emotion, and 30 voice options. Use prompts to control pace, accent, and delivery.
                    <a 
                        href="https://ai.google.dev/gemini-api/docs/speech-generation" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="ml-2 text-yellow-400 hover:text-yellow-300 underline"
                    >
                        View Documentation →
                    </a>
                </p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* Left Column - Input */}
                <div className="xl:col-span-2 space-y-6">
                    {/* Mode Toggle */}
                    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                        <div className="flex gap-2">
                            <button
                                onClick={() => setMode('single')}
                                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                                    mode === 'single'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                                }`}
                            >
                                👤 Single Speaker
                            </button>
                            <button
                                onClick={() => setMode('multi')}
                                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                                    mode === 'multi'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                                }`}
                            >
                                👥 Multi-Speaker (2)
                            </button>
                        </div>
                    </div>

                    {/* Main Input Card */}
                    <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                        {/* Text Input */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                {mode === 'multi' 
                                    ? `Text (use "${speaker1Name}:" and "${speaker2Name}:" to indicate speakers)`
                                    : 'Text to Speak'
                                }
                            </label>
                            <textarea
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                placeholder={mode === 'multi' 
                                    ? `${speaker1Name}: Hello, how are you?\n${speaker2Name}: I'm doing great, thanks for asking!`
                                    : 'Enter the text you want to convert to speech...'
                                }
                                className="w-full h-40 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                            />
                            <div className="mt-1 flex justify-between text-sm text-gray-500">
                                <span>{text.length} characters</span>
                                <span>Context limit: 32k tokens</span>
                            </div>
                        </div>

                        {/* Style/Emotion Selection */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Style / Emotion
                            </label>
                            <select
                                value={stylePreset}
                                onChange={(e) => setStylePreset(e.target.value)}
                                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                {STYLE_PRESETS.map((style) => (
                                    <option key={style.value} value={style.value}>
                                        {style.label}
                                    </option>
                                ))}
                            </select>
                            {stylePreset === 'custom' && (
                                <input
                                    type="text"
                                    value={customStylePrompt}
                                    onChange={(e) => setCustomStylePrompt(e.target.value)}
                                    placeholder="Enter your style prompt (e.g., 'Say with excitement and wonder:')"
                                    className="mt-2 w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            )}
                        </div>

                        {/* Voice Category Filter */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Voice Category
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {VOICE_CATEGORIES.map((cat) => (
                                    <button
                                        key={cat.value}
                                        onClick={() => setVoiceCategory(cat.value)}
                                        className={`px-3 py-1 rounded-full text-sm transition-colors ${
                                            voiceCategory === cat.value
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                                        }`}
                                    >
                                        {cat.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Voice Selection */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                {mode === 'multi' ? `${speaker1Name}'s Voice` : 'Voice'}
                            </label>
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-48 overflow-y-auto p-2 bg-gray-800/50 rounded-lg">
                                {filteredVoices.map((v) => (
                                    <button
                                        key={v.value}
                                        onClick={() => setVoice(v.value)}
                                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                                            voice === v.value
                                                ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                                                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                                        }`}
                                    >
                                        <div className="font-semibold">{v.label}</div>
                                        <div className="text-[10px] opacity-70">{v.desc}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Second Voice for Multi-Speaker */}
                        {mode === 'multi' && (
                            <>
                                <div className="mb-4 grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Speaker 1 Name
                                        </label>
                                        <input
                                            type="text"
                                            value={speaker1Name}
                                            onChange={(e) => setSpeaker1Name(e.target.value)}
                                            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Speaker 2 Name
                                        </label>
                                        <input
                                            type="text"
                                            value={speaker2Name}
                                            onChange={(e) => setSpeaker2Name(e.target.value)}
                                            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        {speaker2Name}&apos;s Voice
                                    </label>
                                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-48 overflow-y-auto p-2 bg-gray-800/50 rounded-lg">
                                        {filteredVoices.map((v) => (
                                            <button
                                                key={v.value}
                                                onClick={() => setVoice2(v.value)}
                                                className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                                                    voice2 === v.value
                                                        ? 'bg-green-600 text-white ring-2 ring-green-400'
                                                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                                                }`}
                                            >
                                                <div className="font-semibold">{v.label}</div>
                                                <div className="text-[10px] opacity-70">{v.desc}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}

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
                                {/* Model Selection */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        TTS Model
                                    </label>
                                    <select
                                        value={model}
                                        onChange={(e) => setModel(e.target.value)}
                                        className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        {TTS_MODELS.map((m) => (
                                            <option key={m.value} value={m.value}>
                                                {m.label} - {m.desc} ({m.pricing})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Director's Notes Template */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Director&apos;s Notes Template
                                    </label>
                                    <button
                                        onClick={() => setText(DIRECTORS_TEMPLATE)}
                                        className="text-sm text-blue-400 hover:text-blue-300"
                                    >
                                        📋 Insert Template
                                    </button>
                                    <p className="mt-1 text-xs text-gray-500">
                                        Use the Audio Profile + Scene + Director&apos;s Notes format for best control over performance
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Generate Button */}
                        <button
                            onClick={handleGenerate}
                            disabled={loading || !text.trim()}
                            className={`w-full py-3 rounded-lg font-medium transition-colors ${
                                loading || !text.trim()
                                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                    : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                        >
                            {loading ? 'Generating Audio...' : `Generate ${mode === 'multi' ? 'Multi-Speaker ' : ''}Speech`}
                        </button>
                    </div>

                    {/* Sample Prompts */}
                    <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                        <h3 className="text-lg font-semibold text-white mb-3">Sample Prompts</h3>
                        <div className="space-y-2">
                            {SAMPLE_PROMPTS.map((sample) => (
                                <button
                                    key={sample.label}
                                    onClick={() => {
                                        setText(sample.text);
                                        setStylePreset(sample.style);
                                        if (sample.multiSpeaker) {
                                            setMode('multi');
                                        }
                                    }}
                                    className="w-full text-left px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 text-sm transition-colors"
                                >
                                    <div className="font-medium text-white">{sample.label}</div>
                                    <div className="text-xs text-gray-400 truncate">{sample.text}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Column - Output & Info */}
                <div className="space-y-6">
                    {/* Error Display */}
                    {error && (
                        <div className="bg-red-900/20 border border-red-600/30 rounded-lg p-4">
                            <p className="text-red-400">{error}</p>
                        </div>
                    )}

                    {/* Audio Result */}
                    {result?.success && audioUrl && (
                        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                            <h3 className="text-lg font-semibold text-white mb-4">🎵 Generated Audio</h3>
                            <audio 
                                controls 
                                className="w-full mb-4"
                                src={audioUrl}
                            />
                            <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                                <div className="bg-gray-800 rounded-lg p-3 text-center">
                                    <div className="text-lg font-bold text-blue-400">{result.voice || voice}</div>
                                    <div className="text-xs text-gray-400">Voice</div>
                                </div>
                                <div className="bg-gray-800 rounded-lg p-3 text-center">
                                    <div className="text-lg font-bold text-green-400">{result.text_length || text.length}</div>
                                    <div className="text-xs text-gray-400">Characters</div>
                                </div>
                                {result.usage && (
                                    <>
                                        <div className="bg-gray-800 rounded-lg p-3 text-center">
                                            <div className="text-lg font-bold text-purple-400">
                                                {result.usage.prompt_tokens || '—'}
                                            </div>
                                            <div className="text-xs text-gray-400">Input Tokens</div>
                                        </div>
                                        <div className="bg-gray-800 rounded-lg p-3 text-center">
                                            <div className="text-lg font-bold text-yellow-400">
                                                ${result.usage.estimated_cost?.toFixed(6) || '0.000000'}
                                            </div>
                                            <div className="text-xs text-gray-400">Est. Cost</div>
                                        </div>
                                    </>
                                )}
                            </div>
                            <a
                                href={audioUrl}
                                download="gemini-speech.wav"
                                className="block text-center py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 text-sm transition-colors"
                            >
                                ⬇️ Download Audio
                            </a>
                        </div>
                    )}

                    {/* Loading State */}
                    {loading && (
                        <div className="bg-gray-900 rounded-lg p-12 border border-gray-800 text-center">
                            <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                            <p className="text-gray-300">Generating speech...</p>
                            <p className="text-xs text-gray-500 mt-2">This may take a few seconds</p>
                        </div>
                    )}

                    {/* Empty State */}
                    {!result && !loading && !error && (
                        <div className="bg-gray-900 rounded-lg p-12 border border-gray-800 text-center">
                            <div className="text-6xl mb-4">🔊</div>
                            <h3 className="text-lg font-medium text-gray-300 mb-2">Ready to Speak</h3>
                            <p className="text-gray-500">Enter text and select a voice to generate speech</p>
                        </div>
                    )}

                    {/* Voice Quick Reference */}
                    <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                        <h3 className="text-lg font-semibold text-white mb-3">Voice Recommendations</h3>
                        <div className="space-y-3 text-sm">
                            <div>
                                <span className="text-blue-400 font-medium">💼 Professional:</span>
                                <span className="text-gray-400 ml-2">Charon, Kore, Orus, Schedar</span>
                            </div>
                            <div>
                                <span className="text-green-400 font-medium">😊 Friendly:</span>
                                <span className="text-gray-400 ml-2">Puck, Aoede, Achird</span>
                            </div>
                            <div>
                                <span className="text-purple-400 font-medium">✨ Expressive:</span>
                                <span className="text-gray-400 ml-2">Fenrir, Zephyr, Sadachbia</span>
                            </div>
                            <div>
                                <span className="text-yellow-400 font-medium">🤫 Subtle:</span>
                                <span className="text-gray-400 ml-2">Enceladus, Achernar, Vindemiatrix</span>
                            </div>
                        </div>
                    </div>

                    {/* Supported Languages */}
                    <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                        <h3 className="text-lg font-semibold text-white mb-3">🌍 24 Supported Languages</h3>
                        <p className="text-xs text-gray-500 mb-3">Languages are auto-detected from text</p>
                        <div className="grid grid-cols-2 gap-1 text-xs text-gray-400 max-h-40 overflow-y-auto">
                            {SUPPORTED_LANGUAGES.map((lang) => (
                                <div key={lang.code} className="truncate" title={lang.label}>
                                    <span className="text-gray-500">{lang.code}</span> {lang.label.split(' (')[0]}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Prompting Guide */}
                    <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                        <h3 className="text-lg font-semibold text-white mb-3">📚 Prompting Guide</h3>
                        <div className="space-y-3 text-sm text-gray-400">
                            <div>
                                <span className="text-blue-400 font-medium">Audio Profile:</span>
                                <span className="ml-2">Name + Role/Archetype</span>
                            </div>
                            <div>
                                <span className="text-green-400 font-medium">Scene:</span>
                                <span className="ml-2">Location, mood, environment</span>
                            </div>
                            <div>
                                <span className="text-purple-400 font-medium">Director's Notes:</span>
                                <span className="ml-2">Style, pacing, accent</span>
                            </div>
                            <div>
                                <span className="text-yellow-400 font-medium">Transcript:</span>
                                <span className="ml-2">Text to speak</span>
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-3">
                            Use the template in Advanced Options for best control over performance
                        </p>
                    </div>

                    {/* Tips */}
                    <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                        <h3 className="text-lg font-semibold text-white mb-3">💡 Pro Tips</h3>
                        <ul className="space-y-2 text-sm text-gray-400">
                            <li>• Use natural language style prompts to control emotion</li>
                            <li>• Match voice personality to desired emotion (Enceladus = breathy for tired)</li>
                            <li>• For multi-speaker, use consistent speaker names in text</li>
                            <li>• Context window is 32k tokens max</li>
                            <li>• TTS models only accept text input, produce audio only</li>
                            <li>• Output: WAV format, 24kHz, mono, 16-bit</li>
                            <li>• "Vocal Smile" technique: high soft palate for bright tone</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default withPermission(TTSDemoPage, PermissionLevel.USER);
