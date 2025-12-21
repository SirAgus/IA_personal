import { useState, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';

interface ReasoningPart {
    content: string;
    durationMs?: number;
}

interface Message {
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    reasoning_content?: string;
    reasoning_parts?: ReasoningPart[];
    metrics?: {
        reasoningDurationMs?: number;
    };
}

interface ChatMessageProps {
    message: Message;
    isLoading: boolean;
    isLast: boolean;
}

export const ChatMessage = ({ message, isLoading, isLast }: ChatMessageProps) => {
    const isUser = message.role === 'user';

    // Determine reasoning sources: use parts if available, otherwise fallback to single content array
    const reasoningParts = useMemo(() => {
        if (message.reasoning_parts && message.reasoning_parts.length > 0) {
            return message.reasoning_parts;
        }
        if (message.reasoning_content) {
            return [{ content: message.reasoning_content, durationMs: message.metrics?.reasoningDurationMs }];
        }
        return [];
    }, [message.reasoning_parts, message.reasoning_content, message.metrics?.reasoningDurationMs]);

    const hasReasoning = reasoningParts.length > 0;

    // State to track expanded status of each reasoning part
    const [expandedParts, setExpandedParts] = useState<boolean[]>([]);

    useEffect(() => {
        // Sync expanded state size with parts
        setExpandedParts(prev => {
            const newExpandedState = Array(reasoningParts.length).fill(false);

            for (let i = 0; i < reasoningParts.length; i++) {
                const isFinished = !!reasoningParts[i].durationMs;
                if (i >= prev.length || prev[i] === undefined) {
                    newExpandedState[i] = !isFinished; // Expand if not finished (active thinking)
                } else {
                    newExpandedState[i] = prev[i]; // Retain previous manual toggle
                }
            }
            return newExpandedState;
        });
    }, [reasoningParts.length]);

    const togglePart = (index: number) => {
        setExpandedParts(prev => {
            const next = [...prev];
            next[index] = !next[index];
            return next;
        });
    };

    const formatDuration = (ms: number) => {
        const seconds = Math.floor(ms / 1000);
        if (seconds >= 60) {
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            return `${minutes}m ${remainingSeconds}s`;
        }
        return `${seconds}s`;
    };

    return (
        <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
            <div
                className={`max-w-[85%] md:max-w-[70%] p-4 rounded-2xl ${isUser
                    ? 'text-white'
                    : 'bg-black border border-white/10 text-gray-100 rounded-tl-none'
                    }`}
            >
                <div className="markdown-body text-sm md:text-base min-h-[1.5em] space-y-2">

                    {/* Reasoning Parts */}
                    {message.role === 'assistant' && hasReasoning && reasoningParts.map((part, index) => {
                        const isFinished = !!part.durationMs;
                        const isExpanded = expandedParts[index] ?? true;

                        return (
                            <div key={index} className="rounded-lg overflow-hidden border border-white/5">
                                <button
                                    onClick={() => togglePart(index)}
                                    className="w-full flex items-center justify-between p-2 bg-black/40 hover:bg-black/60 transition-colors text-xs text-gray-400 font-mono tracking-wide"
                                >
                                    <div className="flex items-center gap-2">
                                        {!isFinished ? (
                                            <>
                                                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></span>
                                                <span className="text-purple-400 font-medium">THINKING</span>
                                            </>
                                        ) : (
                                            <span className="text-gray-500">
                                                Thinking for {formatDuration(part.durationMs!)}
                                            </span>
                                        )}
                                    </div>
                                    <div className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="m6 9 6 6 6-6" />
                                        </svg>
                                    </div>
                                </button>

                                <div
                                    className={`bg-black/20 text-gray-400 text-xs font-mono border-t border-white/5 overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[5000px] opacity-100 p-3' : 'max-h-0 opacity-0 p-0 border-none'
                                        }`}
                                >
                                    <div className="italic opacity-90 leading-relaxed whitespace-pre-wrap">
                                        {part.content}
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {/* Main Content */}
                    {message.role === 'assistant' && message.content === '' && !hasReasoning && isLoading && isLast ? (
                        <div className="loading-wave">
                            <div className="loading-bar"></div>
                            <div className="loading-bar"></div>
                            <div className="loading-bar"></div>
                            <div className="loading-bar"></div>
                        </div>
                    ) : (
                        <div className="whitespace-pre-wrap">
                            <ReactMarkdown>{message.content}</ReactMarkdown>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
