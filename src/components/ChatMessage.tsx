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
        <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} animate-in message-appear`}>
            <div
                className={`max-w-[85%] md:max-w-[75%] p-4 md:p-5 rounded-3xl transition-all duration-300 relative group ${isUser
                    ? 'bg-[var(--user-bubble-bg)] text-white shadow-lg shadow-blue-500/20 rounded-tr-none'
                    : 'bg-[var(--assistant-bubble-bg)] dark:bg-[var(--glass-bg)] backdrop-blur-md border border-[var(--border-color)] text-[var(--text-primary)] rounded-tl-none shadow-sm'
                    }`}
            >
                {/* Avatar/Name Badge (Optional/Subtle) */}
                <div className={`absolute -top-6 ${isUser ? 'right-2' : 'left-2'} text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity`}>
                    {isUser ? 'Tú' : 'Athenas AI'}
                </div>

                <div className="markdown-body text-[15px] md:text-[16px] min-h-[1.5em] space-y-4">

                    {/* Reasoning Parts with Premium Glass Effect */}
                    {message.role === 'assistant' && hasReasoning && reasoningParts.map((part, index) => {
                        const isFinished = !!part.durationMs;
                        const isExpanded = expandedParts[index] ?? true;

                        return (
                            <div key={index} className="rounded-2xl overflow-hidden border border-black/5 dark:border-white/10 bg-black/5 dark:bg-white/5 backdrop-blur-sm transition-all mb-2">
                                <button
                                    onClick={() => togglePart(index)}
                                    className="w-full flex items-center justify-between p-3.5 hover:bg-black/10 dark:hover:bg-white/10 transition-all text-[11px] text-gray-500 dark:text-gray-400 font-bold tracking-wider"
                                >
                                    <div className="flex items-center gap-3">
                                        {!isFinished ? (
                                            <div className="flex items-center gap-2">
                                                <div className="flex gap-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" style={{ animationDelay: '0.2s' }}></span>
                                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" style={{ animationDelay: '0.4s' }}></span>
                                                </div>
                                                <span className="text-blue-500 font-mono italic">Procesando razonamiento...</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-green-500">
                                                        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                                    </svg>
                                                </div>
                                                <span className="opacity-80">Pensado durante {formatDuration(part.durationMs!)}</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className={`transform transition-transform duration-500 ${isExpanded ? 'rotate-180' : ''}`}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="m6 9 6 6 6-6" />
                                        </svg>
                                    </div>
                                </button>

                                <div
                                    className={`bg-black/5 dark:bg-black/40 text-gray-600 dark:text-gray-400 text-[13px] leading-relaxed border-t border-black/5 dark:border-white/5 overflow-hidden transition-all duration-700 ease-in-out ${isExpanded ? 'max-h-[5000px] opacity-100 p-5' : 'max-h-0 opacity-0 p-0 border-none'
                                        }`}
                                >
                                    <div className="italic font-light border-l-2 border-blue-500/40 pl-4 whitespace-pre-wrap">
                                        {part.content}
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {/* Main Content Rendered with Markdown */}
                    {message.role === 'assistant' && message.content === '' && !hasReasoning && isLoading && isLast ? (
                        <div className="py-4">
                            <div className="loading-wave">
                                <div className="loading-bar"></div>
                                <div className="loading-bar"></div>
                                <div className="loading-bar"></div>
                                <div className="loading-bar"></div>
                            </div>
                        </div>
                    ) : (
                        <div className={`leading-relaxed ${isUser ? 'prose-invert' : ''}`}>
                            <ReactMarkdown>{message.content}</ReactMarkdown>
                        </div>
                    )}

                    {/* Metrics Footer */}
                    {message.role === 'assistant' && message.metrics?.reasoningDurationMs && (
                        <div className="mt-4 pt-3 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 flex items-center gap-3 border-t border-black/5 dark:border-white/5">
                            <div className="flex -space-x-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                            </div>
                            <span>Finalizado en {formatDuration(message.metrics.reasoningDurationMs)}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
