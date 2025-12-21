import { useState, useRef, useEffect, useMemo } from 'react';
import { MainSidebar } from './components/MainSidebar';
import { ChatMessage } from './components/ChatMessage';
import { type Agent, createThread, addMessage, getThreadMessages, getThreadById, getAgentById, updateThreadAgent } from './services/db';
import './index.css';

interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  reasoning_content?: string;
  reasoning_parts?: { content: string; durationMs?: number }[];
  metrics?: {
    reasoningDurationMs?: number;
  };
}

const API_URL = import.meta.env.CHAT_API_URL;
const MODEL = import.meta.env.CHAT_MODEL;
const AUTH_USER_ENV = import.meta.env.AUTH_USER;
const AUTH_PASS_ENV = import.meta.env.AUTH_PASSWORD;

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [currentThreadId, setCurrentThreadId] = useState<number | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [reasoningLevel, setReasoningLevel] = useState<'instant' | 'low' | 'medium' | 'high'>(() => {
    return (localStorage.getItem('reasoningLevel') as 'instant' | 'low' | 'medium' | 'high') || 'medium';
  });

  useEffect(() => {
    const storedAuth = localStorage.getItem('isAuthenticated');
    if (storedAuth === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  // Sync state when thread changes
  useEffect(() => {
    const loadThreadData = async () => {
      if (!isAuthenticated || !currentThreadId) return;

      const thread = await getThreadById(currentThreadId);
      if (thread) {
        if (thread.agent_id) {
          const agent = await getAgentById(thread.agent_id);
          setSelectedAgent(agent);
        } else {
          setSelectedAgent(null);
        }

        const threadMsgs = await getThreadMessages(currentThreadId);
        setMessages(threadMsgs.map(msg => ({
          role: msg.role as 'user' | 'assistant' | 'system' | 'tool',
          content: msg.content,
          reasoning_content: msg.reasoning_content || undefined,
          metrics: msg.metrics,
        })));
      }
    };
    loadThreadData();
  }, [isAuthenticated, currentThreadId]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === AUTH_USER_ENV && password === AUTH_PASS_ENV) {
      setIsAuthenticated(true);
      localStorage.setItem('isAuthenticated', 'true');
      setError('');
    } else {
      setError('Credenciales inválidas');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('isAuthenticated');
    setMessages([]);
    setSelectedAgent(null);
    setCurrentThreadId(null);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSelectAgent = async (agent: Agent | null) => {
    setSelectedAgent(agent);
    if (currentThreadId) {
      await updateThreadAgent(currentThreadId, agent?.id || null);
    }
  };

  const handleSelectThread = (id: number) => {
    setCurrentThreadId(id);
    setIsSidebarOpen(false); // Close sidebar on mobile after selection
  };

  const handleNewThread = () => {
    setCurrentThreadId(null);
    setMessages([]);
    setSelectedAgent(null);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    let targetThreadId = currentThreadId;

    // AUTO-CREATE THREAD IF MISSING
    if (!targetThreadId) {
      const firstWords = input.trim().split(' ').slice(0, 5).join(' ');
      const title = firstWords.length > 30 ? firstWords.substring(0, 30) + '...' : firstWords;
      targetThreadId = await createThread(title || 'Nuevo Chat', selectedAgent?.id);
      setCurrentThreadId(targetThreadId);
    }

    const userMessage: Message = { role: 'user', content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);

    await addMessage({
      thread_id: targetThreadId,
      role: 'user',
      content: input
    });

    setInput('');
    setIsLoading(true);

    try {
      await processChatInteraction(newMessages, targetThreadId);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error al procesar la solicitud.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const processChatInteraction = async (allMessages: Message[], threadId: number) => {
    const MAX_ITERATIONS = 5;
    let iteration = 0;
    const contextMessages = allMessages.slice(-10);
    let msgs = [...contextMessages];

    const GLOBAL_SYSTEM_PROMPT = `
Eres un asistente de IA útil y capaz.
Tienes acceso a herramientas para buscar en internet (web_search) y ver la fecha (get_current_date).
Úsalas cuando el usuario te pida información actual o fechas.
No inventes información si puedes buscarla.
    `.trim();

    const combinedSystemPrompt = selectedAgent
      ? `${GLOBAL_SYSTEM_PROMPT}\n\n---\n\nInstrucciones Específicas del Agente:\n${selectedAgent.system_prompt}${reasoningLevel === 'high' ? '\n\nRazona paso a paso y justifica cada decisión.' : ''}${(reasoningLevel === 'instant' || reasoningLevel === 'low') ? '\n\nIMPORTANT: Do NOT think, reason or use internal monologue. Provide a direct and concise answer immediately.' : ''}`
      : `${GLOBAL_SYSTEM_PROMPT}${reasoningLevel === 'high' ? '\n\nRazona paso a paso y justifica cada decisión.' : ''}${(reasoningLevel === 'instant' || reasoningLevel === 'low') ? '\n\nIMPORTANT: Do NOT think, reason or use internal monologue. Provide a direct and concise answer immediately.' : ''}`;

    const initialSystemMessages = [{ role: 'system', content: combinedSystemPrompt }];

    const maxTokensMap = {
      instant: 64,
      low: 128,
      medium: 1024,
      high: 4096
    };

    while (iteration < MAX_ITERATIONS) {
      iteration++;
      setMessages(prev => [...prev, { role: 'assistant', content: '', reasoning_content: '' }]);

      const messagesPayload = [
        ...initialSystemMessages,
        ...msgs.map(m => ({
          role: m.role,
          content: m.content,
          tool_calls: (m as any).tool_calls,
          tool_call_id: (m as any).tool_call_id
        }))
      ];

      const { tools } = await import('./services/tools');

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: MODEL,
          messages: messagesPayload,
          tools: tools,
          stream: true,
          max_tokens: maxTokensMap[reasoningLevel],
          reasoning: { enabled: reasoningLevel !== 'low' && reasoningLevel !== 'instant' }
        }),
      });

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantContent = '';
      let assistantReasoning = '';
      let toolCallsArgs: any[] = [];
      let currentToolCallIndex = -1;
      let reasoningStartTime: number | null = null;
      let reasoningEndTime: number | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ') || line.trim() === 'data: [DONE]') continue;

          const jsonStr = line.replace('data: ', '');
          try {
            const data = JSON.parse(jsonStr);
            const delta = data.choices?.[0]?.delta;
            if (!delta) continue;

            if (delta.reasoning_content && reasoningLevel !== 'instant' && reasoningLevel !== 'low') {
              if (reasoningStartTime === null) reasoningStartTime = Date.now();
              assistantReasoning += delta.reasoning_content;
              setMessages(prev => {
                const newPrev = [...prev];
                const lastMsg = newPrev[newPrev.length - 1];
                if (lastMsg.role === 'assistant') lastMsg.reasoning_content = assistantReasoning;
                return newPrev;
              });
            }

            if (delta.content) {
              if (reasoningStartTime !== null && reasoningEndTime === null) {
                reasoningEndTime = Date.now();
                setMessages(prev => {
                  const newPrev = [...prev];
                  const lastMsg = newPrev[newPrev.length - 1];
                  if (lastMsg.role === 'assistant') {
                    lastMsg.metrics = { reasoningDurationMs: (reasoningEndTime! - reasoningStartTime!) };
                  }
                  return newPrev;
                });
              }
              assistantContent += delta.content;
              setMessages(prev => {
                const newPrev = [...prev];
                const lastMsg = newPrev[newPrev.length - 1];
                if (lastMsg.role === 'assistant') lastMsg.content = assistantContent;
                return newPrev;
              });
            }

            if (delta.tool_calls) {
              const tc = delta.tool_calls[0];
              if (tc.id) {
                toolCallsArgs.push({ id: tc.id, function: { name: tc.function.name, arguments: '' }, type: 'function' });
                currentToolCallIndex = toolCallsArgs.length - 1;
              } else if (currentToolCallIndex >= 0 && tc.function?.arguments) {
                toolCallsArgs[currentToolCallIndex].function.arguments += tc.function.arguments;
              }
            }
          } catch (e) { }
        }
      }

      if (reasoningStartTime !== null && reasoningEndTime === null) {
        reasoningEndTime = Date.now();
        setMessages(prev => {
          const newPrev = [...prev];
          const lastMsg = newPrev[newPrev.length - 1];
          if (lastMsg.role === 'assistant') {
            lastMsg.metrics = { reasoningDurationMs: (reasoningEndTime! - reasoningStartTime!) };
            lastMsg.content = assistantContent;
          }
          return newPrev;
        });
      }

      if (toolCallsArgs.length > 0) {
        await addMessage({
          thread_id: threadId,
          role: 'assistant',
          content: assistantContent,
          reasoning_content: assistantReasoning,
          metrics: { reasoningDurationMs: reasoningEndTime && reasoningStartTime ? reasoningEndTime - reasoningStartTime : undefined }
        });

        msgs.push({ role: 'assistant', content: assistantContent, tool_calls: toolCallsArgs } as any);

        const toolOutputs = [];
        const { executeTool } = await import('./services/tools');

        for (const toolCall of toolCallsArgs) {
          const args = JSON.parse(toolCall.function.arguments);
          const result = await executeTool(toolCall.function.name, args);
          const outputMsg = { role: 'tool', tool_call_id: toolCall.id, content: String(result) };
          toolOutputs.push(outputMsg);
          await addMessage({ thread_id: threadId, role: 'tool', content: String(result) });
        }
        msgs.push(...toolOutputs as any);
        continue;
      }

      await addMessage({
        thread_id: threadId,
        role: 'assistant',
        content: assistantContent,
        reasoning_content: assistantReasoning,
        metrics: { reasoningDurationMs: reasoningEndTime && reasoningStartTime ? reasoningEndTime - reasoningStartTime : undefined }
      });
      return;
    }
  };

  // Grouped messages for rendering
  const groupedMessages = useMemo(() => {
    const groups: Message[] = [];
    for (const msg of messages) {
      if (msg.role === 'system' || msg.role === 'tool') continue;
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.role === 'assistant' && msg.role === 'assistant') {
        if (!lastGroup.reasoning_parts) {
          lastGroup.reasoning_parts = lastGroup.reasoning_content ? [{ content: lastGroup.reasoning_content, durationMs: lastGroup.metrics?.reasoningDurationMs }] : [];
        }
        if (msg.reasoning_content) {
          lastGroup.reasoning_parts.push({ content: msg.reasoning_content, durationMs: msg.metrics?.reasoningDurationMs });
        }
        lastGroup.content = [lastGroup.content, msg.content].filter(Boolean).join('\n\n');
        lastGroup.reasoning_content = lastGroup.reasoning_parts.map(p => p.content).filter(Boolean).join('\n\n---\n\n');
        const totalDur = lastGroup.reasoning_parts.reduce((acc, p) => acc + (p.durationMs || 0), 0);
        lastGroup.metrics = { reasoningDurationMs: totalDur > 0 ? totalDur : undefined };
      } else {
        const newMsg = { ...msg };
        if (newMsg.reasoning_content && !newMsg.reasoning_parts) {
          newMsg.reasoning_parts = [{ content: newMsg.reasoning_content, durationMs: newMsg.metrics?.reasoningDurationMs }];
        }
        groups.push(newMsg);
      }
    }
    return groups;
  }, [messages]);

  if (!isAuthenticated) return (
    <div className="flex items-center justify-center min-h-screen w-full">
      <form onSubmit={handleLogin} className="glass p-8 rounded-2xl w-full max-w-md flex flex-col gap-6">
        <h1 className="text-3xl font-bold text-center bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">Bienvenido</h1>
        <div className="flex flex-col gap-2">
          <label className="text-sm text-gray-400">Usuario</label>
          <input type="text" className="bg-black/20 border border-white/10 rounded-lg p-3 text-white" value={username} onChange={e => setUsername(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm text-gray-400">Contraseña</label>
          <input type="password" className="bg-black/20 border border-white/10 rounded-lg p-3 text-white" value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        <button type="submit" className="btn-primary py-3 rounded-lg font-semibold">Entrar</button>
      </form>
    </div>
  );

  return (
    <div className="flex h-screen w-full bg-[#0f0f11] overflow-hidden">
      {/* Unified Left Sidebar */}
      <MainSidebar
        currentThreadId={currentThreadId}
        selectedAgentId={selectedAgent?.id}
        onSelectThread={handleSelectThread}
        onNewThread={() => { handleNewThread(); setIsSidebarOpen(false); }}
        onSelectAgent={(agent) => { handleSelectAgent(agent); setIsSidebarOpen(false); }}
        onLogout={handleLogout}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Chat Area */}
      <div className="flex flex-col flex-1 h-full max-w-4xl mx-auto p-4 md:p-6 gap-4 px-4 md:px-12 relative">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-2 mb-2 glass rounded-xl">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <h1 className="text-lg font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">IA Chat</h1>
          <div className="w-10"></div> {/* Spacer for symmetry */}
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2 pb-4 scroll-smooth custom-scrollbar">
          {groupedMessages.length === 0 && !isLoading && (
            <div className="h-full flex flex-col items-center justify-center opacity-30 select-none">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-24 h-24 mb-4"><path d="M4.913 2.658c2.075-.21 4.19-.308 6.33-.293 2.14-.015 4.255.083 6.33.293 1.12.114 1.913 1.046 1.904 2.158v11.516c.009 1.112-.784 2.044-1.904 2.158-1.539.155-3.097.235-4.66.239-1.563-.004-3.121-.084-4.66-.239-1.12-.114-1.913-1.046-1.904-2.158V4.816c-.009-1.112.784-2.044 1.904-2.158zM4.502 19.341c-.822.112-1.502.73-1.502 1.559V21l.003.069a.75.75 0 00.744.681h16.506a.75.75 0 00.744-.681l.003-.069v-.1c0-.83-.681-1.447-1.503-1.559-1.517-.208-3.085-.314-4.688-.317-1.603.003-3.171.109-4.688.317a60.709 60.709 0 00-4.688.317z" /></svg>
              <div className="text-2xl font-bold">¿En qué puedo ayudarte hoy?</div>
              <div className="text-sm mt-2">Selecciona un agente o simplemente comienza a escribir.</div>
            </div>
          )}
          {groupedMessages.map((m, idx) => (
            <ChatMessage key={idx} message={m} isLoading={isLoading} isLast={idx === groupedMessages.length - 1} />
          ))}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={sendMessage} className="relative mt-auto pt-2 flex flex-col gap-3">
          {/* Reasoning Level Selector */}
          <div className="flex items-center gap-2 self-start ml-2 text-[10px] font-bold tracking-wider uppercase text-gray-500 bg-black/40 p-1 px-2 rounded-full border border-white/5">
            <span className="mr-1 opacity-50">Razonamiento:</span>
            {(['instant', 'low', 'medium', 'high'] as const).map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => {
                  setReasoningLevel(lvl);
                  localStorage.setItem('reasoningLevel', lvl);
                }}
                className={`px-3 py-1 rounded-full transition-all ${reasoningLevel === lvl
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                  : 'hover:text-gray-300'
                  }`}
              >
                {lvl === 'instant' ? 'Instantáneo' : lvl === 'low' ? 'Bajo' : lvl === 'medium' ? 'Medio' : 'Alto'}
              </button>
            ))}
          </div>

          <div className="relative w-full">
            <textarea
              ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 120)}px`; } }}
              className="w-full bg-white/5 border border-white/10 rounded-xl p-4 pr-16 text-white placeholder-gray-500 input-glow transition-all resize-none overflow-y-auto leading-relaxed"
              style={{ minHeight: '56px' }}
              placeholder="Escribe tu mensaje..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(e); } }}
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="absolute right-2 bottom-3 btn-primary p-2 rounded-lg text-white disabled:opacity-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default App;
