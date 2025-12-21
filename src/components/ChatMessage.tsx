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
                className={`max-w-[85%] md:max-w-[80%] p-4 rounded-2xl transition-all duration-300 ${isUser
                    ? 'text-gray-900 dark:text-white'
                    : 'bg-gray-100 dark:bg-black border border-black/5 dark:border-white/10 text-gray-800 dark:text-gray-100 rounded-tl-none shadow-sm'
                    }`}
            >
                <div className="markdown-body text-sm md:text-base min-h-[1.5em] space-y-3">

                    {/* Reasoning Parts */}
                    {message.role === 'assistant' && hasReasoning && reasoningParts.map((part, index) => {
                        const isFinished = !!part.durationMs;
                        const isExpanded = expandedParts[index] ?? true;

                        return (
                            <div key={index} className="rounded-xl overflow-hidden border border-black/5 dark:border-white/5 bg-black/5 dark:bg-white/5 transition-all">
                                <button
                                    onClick={() => togglePart(index)}
                                    className="w-full flex items-center justify-between p-3 hover:bg-black/10 dark:hover:bg-white/5 transition-all text-[10px] text-gray-500 dark:text-gray-400 font-bold tracking-widest uppercase"
                                >
                                    <div className="flex items-center gap-2.5">
                                        {!isFinished ? (
                                            <>
                                                <div className="flex gap-1">
                                                   <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0s' }}></span>
                                                   <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                                                   <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                                                </div>
                                                <span className="text-blue-600 dark:text-blue-400">Analizando...</span>
                                            </>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-green-500">
                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4.01-5.5z" clipRule="evenodd" />
                                                </svg>
                                                <span>Razonamiento ({formatDuration(part.durationMs!)})</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className={`transform transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="m6 9 6 6 6-6" />
                                        </svg>
                                    </div>
                                </button>

                                <div
                                    className={`bg-white/50 dark:bg-black/20 text-gray-600 dark:text-gray-400 text-xs font-mono border-t border-black/5 dark:border-white/5 overflow-hidden transition-all duration-500 ease-in-out ${isExpanded ? 'max-h-[5000px] opacity-100 p-4' : 'max-h-0 opacity-0 p-0 border-none'
                                        }`}
                                >
                                    <div className="italic opacity-90 leading-relaxed whitespace-pre-wrap border-l-2 border-blue-500/30 pl-3">
                                        {part.content}
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {/* Main Content */}
                    {message.role === 'assistant' && message.content === '' && !hasReasoning && isLoading && isLast ? (
                        <div className="flex items-center gap-1.5 py-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0s' }}></span>
                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                        </div>
                    ) : (
                        <div className="whitespace-pre-wrap leading-relaxed">
                            <ReactMarkdown>{message.content}</ReactMarkdown>
                        </div>
                    )}

                    {/* Response Time - Always show for assistant messages */}
                    {message.role === 'assistant' && message.metrics?.reasoningDurationMs && (
                        <div className="mt-3 text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-gray-600 flex items-center gap-2 border-t border-black/5 dark:border-white/5 pt-2">
                            <span className="w-1 h-1 rounded-full bg-current opacity-30"></span>
                            Respuesta en {formatDuration(message.metrics.reasoningDurationMs)}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
