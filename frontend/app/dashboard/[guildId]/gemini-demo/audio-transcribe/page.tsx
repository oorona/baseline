/**
 * *** DEMO CODE *** - Audio Transcription Demo
 * Demonstrates Gemini's audio understanding capabilities with:
 * - Microphone recording via MediaRecorder API
 * - URL-based audio and YouTube transcription
 * - Speaker diarization (identify different speakers)
 * - Emotion detection per segment (happy, sad, angry, neutral)
 * - Timestamp generation and range extraction (MM:SS format)
 * - Language detection and translation
 * - Multiple output formats (text, SRT, VTT, JSON)
 * - Sound understanding (music, birdsong, sirens, etc.)
 * 
 * Technical notes from official docs:
 * - Token rate: 32 tokens per second of audio
 * - Max audio length: 9.5 hours per prompt
 * - Downsampled to: 16 Kbps
 * - Multi-channel audio combined to single channel
 * - Supported formats: WAV, MP3, AIFF, AAC, OGG, FLAC
 * 
 * Documentation: https://ai.google.dev/gemini-api/docs/audio
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '../../../../api-client';

interface TranscriptionSegment {
    start_time: number;
    end_time: number;
    text: string;
    speaker?: string;
    emotion?: 'happy' | 'sad' | 'angry' | 'neutral';
    language?: string;
    language_code?: string;
    translation?: string;
}

interface TranscriptionResult {
    transcription: string;
    text?: string;
    summary?: string;
    segments?: TranscriptionSegment[];
    duration_seconds?: number;
    language?: string;
    word_count?: number;
    usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
        estimated_cost?: number;
    };
}

// Supported audio formats
const AUDIO_FORMATS = [
    { mime: 'audio/webm', ext: 'webm', label: 'WebM' },
    { mime: 'audio/mp4', ext: 'mp4', label: 'MP4' },
    { mime: 'audio/ogg', ext: 'ogg', label: 'OGG' },
    { mime: 'audio/wav', ext: 'wav', label: 'WAV' },
];

// Sample audio URLs for testing
const SAMPLE_AUDIO_URLS = [
    { label: 'Speech (10s)', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
    { label: 'Jazz', url: 'https://www2.cs.uic.edu/~i101/SoundFiles/BaachGav662.wav' },
    { label: 'Piano', url: 'https://www2.cs.uic.edu/~i101/SoundFiles/PinkPanther60.wav' },
    { label: 'Star Wars', url: 'https://www2.cs.uic.edu/~i101/SoundFiles/StarWars60.wav' },
];

// Sample YouTube URLs for testing
const SAMPLE_YOUTUBE_URLS = [
    { label: 'TED Talk', url: 'https://www.youtube.com/watch?v=8jPQjjsBbIc' },
    { label: 'Music', url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw' },
];

// Get the best supported format for this browser
function getSupportedMimeType(): string {
    for (const format of AUDIO_FORMATS) {
        if (MediaRecorder.isTypeSupported(format.mime)) {
            return format.mime;
        }
    }
    return 'audio/webm'; // fallback
}

export default function AudioTranscribeDemoPage() {
    const params = useParams();
    const guildId = params?.guildId as string;

    // Input mode
    const [inputMode, setInputMode] = useState<'url' | 'youtube' | 'microphone'>('url');
    
    // URL-based input
    const [audioUrl, setAudioUrl] = useState('');
    
    // Microphone recording
    const [isRecording, setIsRecording] = useState(false);
    const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
    const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
    const [recordingTime, setRecordingTime] = useState(0);
    const [micPermission, setMicPermission] = useState<'granted' | 'denied' | 'prompt' | 'unsupported'>('prompt');
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    
    // Transcription options
    const [includeTimestamps, setIncludeTimestamps] = useState(true);
    const [speakerDiarization, setSpeakerDiarization] = useState(false);
    const [detectEmotion, setDetectEmotion] = useState(false);
    const [detectLanguage, setDetectLanguage] = useState(true);
    const [translateToEnglish, setTranslateToEnglish] = useState(false);
    const [numSpeakers, setNumSpeakers] = useState(2);
    const [outputFormat, setOutputFormat] = useState<'text' | 'srt' | 'vtt' | 'json'>('text');
    const [language, setLanguage] = useState('');
    const [customPrompt, setCustomPrompt] = useState('');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');

    // Results
    const [result, setResult] = useState<TranscriptionResult | null>(null);
    const [formattedOutput, setFormattedOutput] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Check microphone permission on mount
    useEffect(() => {
        if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
            navigator.permissions?.query({ name: 'microphone' as PermissionName })
                .then((result) => {
                    setMicPermission(result.state as 'granted' | 'denied' | 'prompt');
                    result.onchange = () => {
                        setMicPermission(result.state as 'granted' | 'denied' | 'prompt');
                    };
                })
                .catch(() => {
                    // Permissions API not fully supported
                    setMicPermission('prompt');
                });
        } else {
            setMicPermission('unsupported');
        }
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (recordedUrl) {
                URL.revokeObjectURL(recordedUrl);
            }
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [recordedUrl]);

    // Start microphone recording
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setMicPermission('granted');
            
            const mimeType = getSupportedMimeType();
            const mediaRecorder = new MediaRecorder(stream, { mimeType });
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: mimeType });
                setRecordedBlob(blob);
                const url = URL.createObjectURL(blob);
                setRecordedUrl(url);
                
                // Stop all tracks
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start(1000); // Collect data every second
            setIsRecording(true);
            setRecordingTime(0);
            
            // Start timer
            timerRef.current = setInterval(() => {
                setRecordingTime((prev) => prev + 1);
            }, 1000);

        } catch (err: any) {
            if (err.name === 'NotAllowedError') {
                setMicPermission('denied');
                setError('Microphone access denied. Please allow microphone access in your browser settings.');
            } else {
                setError(`Failed to start recording: ${err.message}`);
            }
        }
    };

    // Stop recording
    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        }
    };

    // Clear recording
    const clearRecording = () => {
        if (recordedUrl) {
            URL.revokeObjectURL(recordedUrl);
        }
        setRecordedBlob(null);
        setRecordedUrl(null);
        setRecordingTime(0);
    };

    // Format time display
    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Format timestamp for SRT/VTT
    const formatTimestamp = (seconds: number, useVttFormat: boolean): string => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 1000);
        const separator = useVttFormat ? '.' : ',';
        return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}${separator}${ms.toString().padStart(3, '0')}`;
    };

    const formatAsVTT = (segments: TranscriptionSegment[]) => {
        let vtt = 'WEBVTT\n\n';
        segments.forEach((seg, idx) => {
            const startTime = formatTimestamp(seg.start_time, true);
            const endTime = formatTimestamp(seg.end_time, true);
            vtt += `${idx + 1}\n${startTime} --> ${endTime}\n`;
            if (seg.speaker) vtt += `<v ${seg.speaker}>`;
            vtt += `${seg.text}`;
            if (seg.emotion) vtt += ` [${seg.emotion}]`;
            vtt += '\n\n';
        });
        return vtt;
    };

    const formatAsSRT = (segments: TranscriptionSegment[]) => {
        let srt = '';
        segments.forEach((seg, idx) => {
            const startTime = formatTimestamp(seg.start_time, false);
            const endTime = formatTimestamp(seg.end_time, false);
            srt += `${idx + 1}\n${startTime} --> ${endTime}\n`;
            if (seg.speaker) srt += `[${seg.speaker}] `;
            srt += seg.text;
            if (seg.emotion) srt += ` (${seg.emotion})`;
            srt += '\n\n';
        });
        return srt;
    };

    const handleTranscribe = async () => {
        // Validate input
        if (inputMode === 'microphone' && !recordedBlob) {
            setError('Please record audio first');
            return;
        }
        if (inputMode !== 'microphone' && !audioUrl.trim()) {
            setError('Please enter an audio URL or YouTube URL');
            return;
        }

        setLoading(true);
        setError('');
        setResult(null);
        setFormattedOutput('');

        try {
            let response: TranscriptionResult;

            if (inputMode === 'microphone' && recordedBlob) {
                // Convert blob to base64 for API
                const reader = new FileReader();
                const base64Promise = new Promise<string>((resolve, reject) => {
                    reader.onloadend = () => {
                        const base64 = (reader.result as string).split(',')[1];
                        resolve(base64);
                    };
                    reader.onerror = reject;
                });
                reader.readAsDataURL(recordedBlob);
                const audioBase64 = await base64Promise;

                // Call API with base64 audio
                response = await apiClient.geminiAudioTranscribe({
                    audio_base64: audioBase64,
                    include_timestamps: includeTimestamps,
                    include_speaker_labels: speakerDiarization,
                    detect_emotion: detectEmotion,
                    detect_language: detectLanguage,
                    translate_to_english: translateToEnglish,
                    num_speakers: speakerDiarization ? numSpeakers : undefined,
                    language: language || undefined,
                    prompt: customPrompt || undefined,
                } as any);
            } else {
                // URL-based transcription
                const requestBody: any = {
                    include_timestamps: includeTimestamps,
                    include_speaker_labels: speakerDiarization,
                    detect_emotion: detectEmotion,
                    detect_language: detectLanguage,
                    translate_to_english: translateToEnglish,
                };

                if (inputMode === 'youtube') {
                    requestBody.youtube_url = audioUrl;
                } else {
                    requestBody.audio_url = audioUrl;
                }

                if (speakerDiarization) {
                    requestBody.num_speakers = numSpeakers;
                }
                if (language) {
                    requestBody.language = language;
                }
                if (customPrompt) {
                    requestBody.prompt = customPrompt;
                }

                response = await apiClient.geminiAudioTranscribe(requestBody);
            }

            setResult(response);

            // Format output based on selected format
            if (outputFormat === 'json') {
                setFormattedOutput(JSON.stringify(response, null, 2));
            } else if (outputFormat === 'vtt' && response.segments) {
                setFormattedOutput(formatAsVTT(response.segments));
            } else if (outputFormat === 'srt' && response.segments) {
                setFormattedOutput(formatAsSRT(response.segments));
            } else {
                setFormattedOutput(response.transcription || response.text || '');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to transcribe audio');
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    const downloadOutput = () => {
        const extensions: Record<string, string> = {
            text: 'txt',
            srt: 'srt',
            vtt: 'vtt',
            json: 'json',
        };
        const blob = new Blob([formattedOutput], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `transcription.${extensions[outputFormat]}`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Emotion badge color
    const getEmotionColor = (emotion?: string) => {
        switch (emotion) {
            case 'happy': return 'bg-green-500/20 text-green-400';
            case 'sad': return 'bg-blue-500/20 text-blue-400';
            case 'angry': return 'bg-red-500/20 text-red-400';
            default: return 'bg-gray-500/20 text-gray-400';
        }
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
                <h1 className="text-2xl font-bold text-white">🎤 Audio Transcription Demo</h1>
            </div>

            {/* Description */}
            <div className="mb-8 p-4 bg-blue-900/20 border border-blue-600/30 rounded-lg">
                <p className="text-blue-200/70">
                    Transcribe audio from microphone, files, or YouTube with speaker detection, emotion analysis, and translation.
                </p>
                <p className="text-blue-200/50 text-sm mt-2">
                    📚 <a 
                        href="https://ai.google.dev/gemini-api/docs/audio" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="underline hover:text-blue-300"
                    >
                        View Gemini Audio Documentation
                    </a>
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Panel - Input */}
                <div className="space-y-6">
                    {/* Input Mode Selector */}
                    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                        <h3 className="text-lg font-semibold text-white mb-3">🎧 Audio Source</h3>
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => setInputMode('microphone')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                                    inputMode === 'microphone'
                                        ? 'bg-red-600 text-white'
                                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                }`}
                            >
                                🎙️ Microphone
                            </button>
                            <button
                                onClick={() => setInputMode('url')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                                    inputMode === 'url'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                }`}
                            >
                                🔊 Audio URL
                            </button>
                            <button
                                onClick={() => setInputMode('youtube')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                                    inputMode === 'youtube'
                                        ? 'bg-red-600 text-white'
                                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                }`}
                            >
                                📺 YouTube
                            </button>
                        </div>
                    </div>

                    {/* Input Section */}
                    <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                        {/* Microphone Recording */}
                        {inputMode === 'microphone' && (
                            <div className="space-y-4">
                                {micPermission === 'unsupported' && (
                                    <div className="bg-yellow-900/30 border border-yellow-600/30 rounded-lg p-4">
                                        <p className="text-yellow-300">
                                            ⚠️ Your browser doesn&apos;t support microphone recording. Try Chrome, Firefox, or Edge.
                                        </p>
                                    </div>
                                )}

                                {micPermission === 'denied' && (
                                    <div className="bg-red-900/30 border border-red-600/30 rounded-lg p-4">
                                        <p className="text-red-300">
                                            🚫 Microphone access denied. Please allow microphone access in your browser settings and refresh the page.
                                        </p>
                                    </div>
                                )}

                                {micPermission !== 'unsupported' && micPermission !== 'denied' && (
                                    <div className="flex flex-col items-center py-4">
                                        {/* Recording indicator */}
                                        <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-4 transition-all ${
                                            isRecording 
                                                ? 'bg-red-600 animate-pulse' 
                                                : recordedBlob 
                                                    ? 'bg-green-600' 
                                                    : 'bg-gray-700'
                                        }`}>
                                            <span className="text-4xl">
                                                {isRecording ? '🔴' : recordedBlob ? '✓' : '🎙️'}
                                            </span>
                                        </div>

                                        {/* Timer */}
                                        <div className="text-2xl font-mono mb-4 text-white">
                                            {formatTime(recordingTime)}
                                        </div>

                                        {/* Controls */}
                                        <div className="flex gap-4">
                                            {!isRecording && !recordedBlob && (
                                                <button
                                                    onClick={startRecording}
                                                    className="px-5 py-2 bg-red-600 hover:bg-red-700 rounded-full font-medium transition-colors"
                                                >
                                                    🎙️ Start Recording
                                                </button>
                                            )}
                                            {isRecording && (
                                                <button
                                                    onClick={stopRecording}
                                                    className="px-5 py-2 bg-gray-600 hover:bg-gray-700 rounded-full font-medium transition-colors"
                                                >
                                                    ⏹️ Stop
                                                </button>
                                            )}
                                            {recordedBlob && !isRecording && (
                                                <button
                                                    onClick={clearRecording}
                                                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
                                                >
                                                    🗑️ Clear
                                                </button>
                                            )}
                                        </div>

                                        {/* Playback preview */}
                                        {recordedUrl && (
                                            <div className="mt-4 w-full">
                                                <audio controls src={recordedUrl} className="w-full" />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* URL Input */}
                        {(inputMode === 'url' || inputMode === 'youtube') && (
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    {inputMode === 'youtube' ? '📺 YouTube URL' : '🔊 Audio File URL'}
                                </label>
                                <input
                                    type="text"
                                    value={audioUrl}
                                    onChange={(e) => setAudioUrl(e.target.value)}
                                    placeholder={
                                        inputMode === 'youtube'
                                            ? 'https://www.youtube.com/watch?v=...'
                                            : 'https://example.com/audio.mp3'
                                    }
                                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <span className="text-xs text-gray-500">Try:</span>
                                    {(inputMode === 'youtube' ? SAMPLE_YOUTUBE_URLS : SAMPLE_AUDIO_URLS).map((sample) => (
                                        <button
                                            key={sample.url}
                                            onClick={() => setAudioUrl(sample.url)}
                                            className="text-xs text-blue-400 hover:text-blue-300 px-2 py-0.5 bg-gray-800 rounded border border-gray-700"
                                        >
                                            {sample.label}
                                        </button>
                                    ))}
                                </div>
                                <p className="mt-2 text-xs text-gray-500">
                                    Supported: MP3, WAV, OGG, FLAC, AAC, AIFF • Max: 9.5 hours
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Transcription Options */}
                    <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
                        <h3 className="text-lg font-semibold text-white mb-4">⚙️ Options</h3>
                        
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            {/* Timestamps */}
                            <label className="flex items-center gap-2 cursor-pointer bg-gray-800 p-3 rounded-lg hover:bg-gray-750 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={includeTimestamps}
                                    onChange={(e) => setIncludeTimestamps(e.target.checked)}
                                    className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-white text-sm">⏱️ Timestamps</span>
                            </label>

                            {/* Speaker Diarization */}
                            <label className="flex items-center gap-2 cursor-pointer bg-gray-800 p-3 rounded-lg hover:bg-gray-750 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={speakerDiarization}
                                    onChange={(e) => setSpeakerDiarization(e.target.checked)}
                                    className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-white text-sm">👥 Speakers</span>
                            </label>

                            {/* Emotion Detection */}
                            <label className="flex items-center gap-2 cursor-pointer bg-gray-800 p-3 rounded-lg hover:bg-gray-750 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={detectEmotion}
                                    onChange={(e) => setDetectEmotion(e.target.checked)}
                                    className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-white text-sm">😊 Emotions</span>
                            </label>

                            {/* Language Detection */}
                            <label className="flex items-center gap-2 cursor-pointer bg-gray-800 p-3 rounded-lg hover:bg-gray-750 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={detectLanguage}
                                    onChange={(e) => setDetectLanguage(e.target.checked)}
                                    className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-white text-sm">🌐 Language</span>
                            </label>

                            {/* Translation */}
                            <label className="flex items-center gap-2 cursor-pointer bg-gray-800 p-3 rounded-lg hover:bg-gray-750 transition-colors col-span-2">
                                <input
                                    type="checkbox"
                                    checked={translateToEnglish}
                                    onChange={(e) => setTranslateToEnglish(e.target.checked)}
                                    className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-white text-sm">🔄 Translate to English</span>
                            </label>
                        </div>

                        {/* Num Speakers (conditional) */}
                        {speakerDiarization && (
                            <div className="mb-4 p-3 bg-gray-800 rounded-lg">
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Speakers: <span className="text-blue-400">{numSpeakers}</span>
                                </label>
                                <input
                                    type="range"
                                    min="1"
                                    max="10"
                                    value={numSpeakers}
                                    onChange={(e) => setNumSpeakers(parseInt(e.target.value))}
                                    className="w-full"
                                />
                            </div>
                        )}

                        {/* Output Format */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Output Format
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {[
                                    { value: 'text', label: '📝 Text' },
                                    { value: 'srt', label: '🎬 SRT' },
                                    { value: 'vtt', label: '📺 VTT' },
                                    { value: 'json', label: '🔧 JSON' },
                                ].map((fmt) => (
                                    <button
                                        key={fmt.value}
                                        onClick={() => setOutputFormat(fmt.value as typeof outputFormat)}
                                        className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                                            outputFormat === fmt.value
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                        }`}
                                    >
                                        {fmt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Advanced Options */}
                        <button
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="text-sm text-blue-400 hover:text-blue-300"
                        >
                            {showAdvanced ? '▼ Hide' : '▶ Show'} Advanced
                        </button>

                        {showAdvanced && (
                            <div className="mt-4 space-y-4 p-4 bg-gray-800/50 rounded-lg">
                                {/* Timestamp Range */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        ⏱️ Time Range (optional)
                                    </label>
                                    <div className="flex gap-2 items-center">
                                        <input
                                            type="text"
                                            value={startTime}
                                            onChange={(e) => setStartTime(e.target.value)}
                                            placeholder="00:00"
                                            className="w-20 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                                        />
                                        <span className="text-gray-500">to</span>
                                        <input
                                            type="text"
                                            value={endTime}
                                            onChange={(e) => setEndTime(e.target.value)}
                                            placeholder="end"
                                            className="w-20 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                                        />
                                    </div>
                                </div>
                                
                                {/* Language hint */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Language Hint
                                    </label>
                                    <input
                                        type="text"
                                        value={language}
                                        onChange={(e) => setLanguage(e.target.value)}
                                        placeholder="en, es, fr, ja..."
                                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                                    />
                                </div>

                                {/* Custom Prompt */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Custom Prompt
                                    </label>
                                    <textarea
                                        value={customPrompt}
                                        onChange={(e) => setCustomPrompt(e.target.value)}
                                        placeholder="Context to help transcription..."
                                        rows={2}
                                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Submit Button */}
                    <button
                        onClick={handleTranscribe}
                        disabled={loading || (inputMode === 'microphone' ? !recordedBlob : !audioUrl.trim())}
                        className={`w-full py-4 rounded-lg font-medium text-lg transition-colors ${
                            loading
                                ? 'bg-gray-700 text-gray-500 cursor-wait'
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span>
                                Transcribing...
                            </span>
                        ) : (
                            '🎤 Transcribe Audio'
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
                                <h3 className="text-lg font-semibold text-white">📝 Transcription Result</h3>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => copyToClipboard(formattedOutput)}
                                        className="text-gray-400 hover:text-white px-2 py-1 bg-gray-800 rounded text-sm"
                                    >
                                        📋 Copy
                                    </button>
                                    <button
                                        onClick={downloadOutput}
                                        className="text-gray-400 hover:text-white px-2 py-1 bg-gray-800 rounded text-sm"
                                    >
                                        💾 Download
                                    </button>
                                </div>
                            </div>

                            {/* Summary */}
                            {result.summary && (
                                <div className="mb-4 p-3 bg-blue-900/20 border border-blue-600/30 rounded-lg">
                                    <h4 className="text-sm font-medium text-blue-400 mb-1">Summary</h4>
                                    <p className="text-gray-300 text-sm">{result.summary}</p>
                                </div>
                            )}

                            {/* Metadata */}
                            <div className="grid grid-cols-2 gap-2 mb-4">
                                {result.language && (
                                    <div className="bg-gray-800 rounded-lg p-2 text-center">
                                        <div className="text-sm font-bold text-green-400">{result.language}</div>
                                        <div className="text-xs text-gray-400">Language</div>
                                    </div>
                                )}
                                {result.duration_seconds && (
                                    <div className="bg-gray-800 rounded-lg p-2 text-center">
                                        <div className="text-sm font-bold text-blue-400">
                                            {Math.floor(result.duration_seconds / 60)}:{(Math.floor(result.duration_seconds) % 60).toString().padStart(2, '0')}
                                        </div>
                                        <div className="text-xs text-gray-400">Duration</div>
                                    </div>
                                )}
                                {result.usage && (
                                    <>
                                        <div className="bg-gray-800 rounded-lg p-2 text-center">
                                            <div className="text-sm font-bold text-purple-400">{result.usage.total_tokens || 0}</div>
                                            <div className="text-xs text-gray-400">Tokens</div>
                                        </div>
                                        <div className="bg-gray-800 rounded-lg p-2 text-center">
                                            <div className="text-sm font-bold text-yellow-400">
                                                ${result.usage.estimated_cost?.toFixed(6) || '0.000000'}
                                            </div>
                                            <div className="text-xs text-gray-400">Cost</div>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Formatted Output */}
                            <div className="bg-gray-800 rounded-lg p-4 max-h-96 overflow-auto">
                                <pre className="text-gray-300 whitespace-pre-wrap text-sm font-mono">
                                    {formattedOutput}
                                </pre>
                            </div>
                        </div>
                    )}

                    {/* Loading State */}
                    {loading && (
                        <div className="bg-gray-900 rounded-lg p-12 border border-gray-800 text-center">
                            <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                            <p className="text-gray-300">Transcribing audio...</p>
                            <p className="text-gray-500 text-sm mt-2">Audio = 32 tokens/second</p>
                        </div>
                    )}

                    {/* Empty State */}
                    {!result && !loading && !error && (
                        <div className="bg-gray-900 rounded-lg p-12 border border-gray-800 text-center">
                            <div className="text-6xl mb-4">🎤</div>
                            <h3 className="text-lg font-medium text-gray-300 mb-2">Ready to Transcribe</h3>
                            <p className="text-gray-500">
                                {inputMode === 'microphone' 
                                    ? 'Record audio or enter a URL to get started'
                                    : 'Enter an audio URL and click Transcribe'}
                            </p>
                        </div>
                    )}

                    {/* Documentation Panel */}
                    <div className="bg-gray-900/50 rounded-lg p-6 border border-gray-800">
                        <h3 className="text-sm font-semibold text-gray-400 mb-3">📚 Documentation</h3>
                        <div className="text-xs text-gray-500 space-y-2">
                            <p><strong>Technical Details:</strong></p>
                            <ul className="list-disc list-inside space-y-1">
                                <li>Token rate: 32 tokens per second</li>
                                <li>Max duration: 9.5 hours per prompt</li>
                                <li>Formats: WAV, MP3, OGG, FLAC, AAC, AIFF</li>
                            </ul>
                            <p className="mt-3"><strong>Capabilities:</strong></p>
                            <ul className="list-disc list-inside space-y-1">
                                <li>Transcription & translation</li>
                                <li>Speaker diarization</li>
                                <li>Emotion detection</li>
                                <li>Timestamp extraction</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
