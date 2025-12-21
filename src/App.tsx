import { useState, useRef, useEffect, useMemo } from 'react';
import { MainSidebar } from './components/MainSidebar';
import { ChatMessage } from './components/ChatMessage';
import { type Agent } from './services/db';
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

interface User {
  id: number;
  username: string;
  email: string;
}

const BACKEND_URL = import.meta.env.CHAT_API_URL || 'http://localhost:3000';

function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [authMode, setAuthMode] = useState<'login' | 'signup' | null>(null);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [currentThreadId, setCurrentThreadId] = useState<number | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('local-model');
  const [reasoningLevel, setReasoningLevel] = useState<'instant' | 'low' | 'medium' | 'high'>(() => {
    return (localStorage.getItem('reasoningLevel') as 'instant' | 'low' | 'medium' | 'high') || 'medium';
  });
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [refreshSidebar, setRefreshSidebar] = useState(0);

  const isCreatingThread = useRef(false);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    // Fetch available models
    const fetchModels = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/models`);
        if (res.ok) {
          const models = await res.json();
          setAvailableModels(models);
          if (models.length > 0) setSelectedModel(models[0]);
        }
      } catch (err) {
        console.error("Error fetching models:", err);
      }
    };
    fetchModels();
  }, []);

  // Sync state when thread changes
  useEffect(() => {
    const loadThreadData = async () => {
      if (!token || !currentThreadId) {
        if (!currentThreadId) setMessages([]);
        return;
      }

      // If we just created this thread locally, don't fetch/overwrite 
      // until the interaction is finished to avoid wiping the user message.
      if (isCreatingThread.current) {
        isCreatingThread.current = false;
        return;
      }

      try {
        const res = await fetch(`${BACKEND_URL}/threads/${currentThreadId}/messages`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to load messages');
        const data = await res.json();

        setMessages(data.messages.map((msg: any) => ({
          role: msg.role,
          content: msg.content,
          reasoning_content: msg.reasoning_content,
          metrics: msg.metrics,
        })));

        const threadRes = await fetch(`${BACKEND_URL}/threads/${currentThreadId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (threadRes.ok) {
          const threadData = await threadRes.json();
          if (threadData.agent_id) {
            const agentRes = await fetch(`${BACKEND_URL}/agents/${threadData.agent_id}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (agentRes.ok) {
              const agentData = await agentRes.json();
              setSelectedAgent(agentData);
            }
          } else {
            setSelectedAgent(null);
          }
        }
      } catch (err) {
        console.error("Error loading thread:", err);
      }
    };
    loadThreadData();
  }, [token, currentThreadId]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch(`${BACKEND_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al iniciar sesión');
      
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setAuthMode(null);
      setUsername('');
      setPassword('');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch(`${BACKEND_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al registrarse');
      
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setAuthMode(null);
      setUsername('');
      setEmail('');
      setPassword('');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
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
    if (currentThreadId && token) {
      await fetch(`${BACKEND_URL}/threads/${currentThreadId}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ agent_id: agent?.id || null })
      });
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

    // AUTO-CREATE THREAD IF MISSING AND AUTHENTICATED
    if (!targetThreadId && token) {
      const firstWords = input.trim().split(' ').slice(0, 5).join(' ');
      const title = firstWords.length > 30 ? firstWords.substring(0, 30) + '...' : firstWords;

      try {
        const res = await fetch(`${BACKEND_URL}/threads`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ title, agent_id: selectedAgent?.id })
        });
        if (res.ok) {
          const data = await res.json();
          targetThreadId = data.id;
          isCreatingThread.current = true; // Mark as internal creation
          setCurrentThreadId(targetThreadId);
        } else {
          const errorData = await res.json();
          throw new Error(errorData.error || 'No se pudo crear el hilo de conversación');
        }
      } catch (err: any) {
        console.error("Error creating thread:", err);
        setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
        return;
      }
    }

    const userMessage: Message = { role: 'user', content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);

    setInput('');
    setIsLoading(true);

    try {
      await processChatInteraction(newMessages, targetThreadId, selectedAgent);
      // Refresh sidebar to ensure new threads or updated titles are visible
      setRefreshSidebar(prev => prev + 1);
    } catch (err: any) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'assistant', content: err.message || 'Error al conectar con el servidor.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const processChatInteraction = async (allMessages: Message[], threadId: number | null, agent: Agent | null) => {
    const contextMessages = allMessages.slice(-10);

    setMessages(prev => [...prev, { role: 'assistant', content: '', reasoning_content: '' }]);

    const startTime = Date.now(); // Tiempo total de respuesta

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${BACKEND_URL}/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        messages: contextMessages,
        ...(threadId ? { thread_id: threadId } : {}),
        ...(agent?.id ? { agent_id: agent.id } : {}),
        model: selectedModel,
        options: {
          reasoning: reasoningLevel
        }
      }),
    });

    if (response.status === 429) {
      const data = await response.json();
      throw new Error(data.error || 'Límite alcanzado. Por favor regístrate.');
    }

    if (!response.ok) throw new Error('Error en la API');
    if (!response.body) throw new Error('No hay cuerpo en la respuesta');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let assistantContent = '';
    let assistantReasoning = '';
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

          if (delta.reasoning_content && reasoningLevel !== 'instant') {
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
            }
            assistantContent += delta.content;
            setMessages(prev => {
              const newPrev = [...prev];
              const lastMsg = newPrev[newPrev.length - 1];
              if (lastMsg.role === 'assistant') {
                lastMsg.content = assistantContent;
                // Solo asignar tiempo si no hay reasoning (modo instantáneo)
                if (!lastMsg.reasoning_content) {
                  lastMsg.metrics = { reasoningDurationMs: Date.now() - startTime };
                }
              }
              return newPrev;
            });
          }
        } catch (e) { }
      }
    }

    // Al finalizar el stream, asegurar que se muestre el tiempo total solo si no hay reasoning
    setMessages(prev => {
      const newPrev = [...prev];
      const lastMsg = newPrev[newPrev.length - 1];
      if (lastMsg.role === 'assistant' && !lastMsg.metrics?.reasoningDurationMs && !lastMsg.reasoning_content) {
        lastMsg.metrics = { reasoningDurationMs: Date.now() - startTime };
      }
      return newPrev;
    });
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

  return (
    <div className="flex h-full w-full bg-white dark:bg-[#0f0f11] text-gray-900 dark:text-gray-100 transition-colors duration-500 overflow-hidden">
      {/* Auth Overlays */}
      {authMode && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
          <div className="glass p-8 rounded-2xl w-full max-w-md flex flex-col gap-6 animate-slide-up relative">
            <button 
              onClick={() => setAuthMode(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-200"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="flex justify-center mb-2">
               <div className="relative">
                 <div className="absolute -inset-4 bg-blue-500/20 blur-2xl rounded-full animate-pulse"></div>
                 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-16 h-16 text-blue-500 relative">
                   <path d="M12 8V4H8" />
                   <rect width="16" height="12" x="4" y="8" rx="2" />
                   <path d="M2 14h2" />
                   <path d="M20 14h2" />
                   <path d="M15 13v2" />
                   <path d="M9 13v2" />
                 </svg>
               </div>
            </div>
            <h2 className="text-3xl font-bold text-center bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              {authMode === 'login' ? 'Iniciar Sesión' : 'Registrarse'}
            </h2>
            
            <form onSubmit={authMode === 'login' ? handleLogin : handleSignup} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm text-gray-500 dark:text-gray-400">Usuario</label>
                <input 
                  type="text" 
                  className="bg-black/5 dark:bg-black/20 border border-black/10 dark:border-white/10 rounded-lg p-3 text-gray-900 dark:text-white focus:ring-2 ring-blue-500/50 outline-none transition-all" 
                  value={username} 
                  onChange={e => setUsername(e.target.value)} 
                  required
                />
              </div>

              {authMode === 'signup' && (
                <div className="flex flex-col gap-2">
                  <label className="text-sm text-gray-500 dark:text-gray-400">Email</label>
                  <input 
                    type="email" 
                    className="bg-black/5 dark:bg-black/20 border border-black/10 dark:border-white/10 rounded-lg p-3 text-gray-900 dark:text-white focus:ring-2 ring-blue-500/50 outline-none transition-all" 
                    value={email} 
                    onChange={e => setEmail(e.target.value)} 
                    required
                  />
                </div>
              )}

              <div className="flex flex-col gap-2">
                <label className="text-sm text-gray-500 dark:text-gray-400">Contraseña</label>
                <input
                  type="password"
                  autoComplete={authMode === 'login' ? "current-password" : "new-password"}
                  className="bg-black/5 dark:bg-black/20 border border-black/10 dark:border-white/10 rounded-lg p-3 text-gray-900 dark:text-white focus:ring-2 ring-blue-500/50 outline-none transition-all"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>

              {error && <p className="text-red-500 dark:text-red-400 text-sm text-center animate-shake">{error}</p>}
              
              <button type="submit" className="btn-primary py-3 rounded-lg font-semibold shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all">
                {authMode === 'login' ? 'Entrar' : 'Crear Cuenta'}
              </button>
            </form>

            <p className="text-center text-sm text-gray-500">
              {authMode === 'login' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}
              <button 
                onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                className="ml-2 text-blue-500 hover:underline font-bold"
              >
                {authMode === 'login' ? 'Regístrate' : 'Inicia Sesión'}
              </button>
            </p>
          </div>
        </div>
      )}

      <MainSidebar
        currentThreadId={currentThreadId}
        selectedAgentId={selectedAgent?.id}
        onSelectThread={handleSelectThread}
        onNewThread={() => { handleNewThread(); setIsSidebarOpen(false); }}
        onSelectAgent={(agent) => { handleSelectAgent(agent); setIsSidebarOpen(false); }}
        onLogout={handleLogout}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        theme={theme}
        onToggleTheme={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
        token={token}
        user={user}
        onOpenAuth={(mode) => setAuthMode(mode)}
        refreshTrigger={refreshSidebar}
      />

      <div className="flex flex-col flex-1 h-full max-w-4xl mx-auto p-4 md:p-6 gap-2 md:gap-4 px-4 md:px-12 relative animate-fade-in overflow-hidden" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {/* Mobile Header - Fixed at top */}
        <div className="md:hidden flex-shrink-0 flex items-center justify-between p-2 mb-2 glass rounded-xl z-10">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-blue-500 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <h1 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent font-mono tracking-tighter">Athenas AI</h1>
          <button 
            onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
            className="p-2 text-gray-500 dark:text-gray-400"
          >
            {theme === 'light' ? (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M3 12h2.25m.386-6.364l1.591 1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M3 12h2.25m.386-6.364l1.591 1.591M12 15.75a3 3 0 100-6 3 3 0 000 6z" />
              </svg>
            )}
          </button>
        </div>

        {/* Chat Messages Area */}
        <div className="flex-1 overflow-y-auto space-y-6 pr-2 pb-4 scroll-smooth custom-scrollbar relative">
          {groupedMessages.length === 0 && !isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center select-none animate-slide-up p-4">
              <div className="relative mb-6 group">
                <div className="absolute -inset-8 bg-blue-500/10 dark:bg-blue-500/20 blur-3xl rounded-full group-hover:bg-blue-500/30 transition-all duration-700"></div>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-24 h-24 md:w-28 md:h-28 text-blue-600 dark:text-blue-400 relative drop-shadow-2xl transition-transform duration-500 group-hover:scale-110">
                  <path d="M12 8V4H8" />
                  <rect width="16" height="12" x="4" y="8" rx="2" />
                  <path d="M2 14h2" />
                  <path d="M20 14h2" />
                  <path d="M15 13v2" />
                  <path d="M9 13v2" />
                </svg>
              </div>
              <div className="text-2xl md:text-3xl font-extrabold text-center bg-gradient-to-r from-gray-800 to-gray-400 dark:from-gray-100 dark:to-gray-500 bg-clip-text text-transparent px-4">¿En qué puedo ayudarte hoy?</div>
              <div className="text-sm md:text-base mt-3 text-gray-500 dark:text-gray-400 font-medium tracking-wide text-center">Selecciona un agente o simplemente comienza a escribir.</div>
            </div>
          )}
          
          <div className="space-y-6">
            {groupedMessages.map((m, idx) => (
              <ChatMessage key={idx} message={m} isLoading={isLoading} isLast={idx === groupedMessages.length - 1} />
            ))}
          </div>
          <div ref={messagesEndRef} />
        </div>

        {/* Input Footer - Fixed at bottom */}
        <form onSubmit={sendMessage} className="flex-shrink-0 relative mt-auto pt-2 flex flex-col gap-3 animate-slide-up z-10">
          <div className="flex flex-wrap items-center gap-3 ml-1">
            {/* Model Selector */}
            <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase text-gray-500 dark:text-gray-400 bg-black/5 dark:bg-black/40 p-1.5 px-3 rounded-full border border-black/5 dark:border-white/5 hover:border-blue-500/30 transition-all cursor-pointer group shadow-sm">
              <span className="opacity-50 group-hover:text-blue-500 transition-colors">Modelo:</span>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="bg-transparent text-gray-700 dark:text-gray-300 outline-none cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-bold"
              >
                {availableModels.length > 0 ? (
                  availableModels.map((m: any) => {
                    const modelId = typeof m === 'object' ? (m.id || m.name) : m;
                    const modelDisplay = typeof m === 'object' ? (m.name || m.id) : m;
                    return (
                      <option key={modelId} value={modelId} className="bg-white dark:bg-[#0f0f11] text-gray-900 dark:text-white">
                        {modelDisplay}
                      </option>
                    );
                  })
                ) : (
                  <option value="local-model" className="bg-white dark:bg-[#0f0f11] text-gray-900 dark:text-white">local-model</option>
                )}
              </select>
            </div>

            {/* Reasoning Level Selector */}
            <div className="flex items-center gap-1 text-[10px] font-bold tracking-widest uppercase text-gray-500 dark:text-gray-400 bg-black/5 dark:bg-black/40 p-1 px-1 rounded-full border border-black/5 dark:border-white/5 shadow-sm">
              {(['instant', 'low', 'medium', 'high'] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => {
                    setReasoningLevel(lvl);
                    localStorage.setItem('reasoningLevel', lvl);
                  }}
                  className={`px-3 py-1.5 rounded-full transition-all duration-300 ${reasoningLevel === lvl
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 scale-105'
                    : 'hover:text-gray-900 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                >
                  {lvl === 'instant' ? 'Instantáneo' : lvl === 'low' ? 'Bajo' : lvl === 'medium' ? 'Medio' : 'Alto'}
                </button>
              ))}
            </div>
          </div>

          <div className="relative w-full group">
            <textarea
              ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 120)}px`; } }}
              className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl p-4 pr-16 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 ring-blue-500/50 outline-none transition-all resize-none overflow-y-auto leading-relaxed shadow-sm"
              style={{ minHeight: '64px' }}
              placeholder="Escribe tu mensaje..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(e); } }}
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="absolute right-3 bottom-3.5 btn-primary p-2.5 rounded-xl text-white disabled:opacity-30 disabled:scale-95 disabled:grayscale transition-all shadow-lg shadow-blue-500/20 active:scale-90"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                </svg>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default App;
