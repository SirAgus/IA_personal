import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { AgentManager } from './components/AgentManager';
import type { Agent } from './services/db';
import './index.css';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// Access environment variables directly as they are now exposed via vite.config.ts
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

  // Agent State
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === AUTH_USER_ENV && password === AUTH_PASS_ENV) {
      setIsAuthenticated(true);
      setError('');
    } else {
      setError('Credenciales inválidas');
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]); // Scroll on loading change too

  const handleSelectAgent = (agent: Agent) => {
    setSelectedAgent(agent);
    setMessages([]);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    // Prepare messages for API (include system prompt + history)
    const messagesPayload = [
      ...(selectedAgent ? [{ role: 'system', content: selectedAgent.system_prompt }] : []),
      ...newMessages.map(m => ({ role: m.role, content: m.content }))
    ];

    try {
      // Add empty assistant message immediately to hold the place / show loading if needed
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      console.log("Sending request to:", API_URL);
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: MODEL,
          messages: messagesPayload,
          stream: true, // Enable streaming
        }),
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      if (!response.body) throw new Error('ReadableStream not supported in this browser.');

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');

      let assistantMessageContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.trim() === '') continue;
          if (line.trim() === 'data: [DONE]') continue;

          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              const content = data.choices?.[0]?.delta?.content || '';

              if (content) {
                assistantMessageContent += content;

                // Update the last message with new content
                setMessages(prev => {
                  const newMessages = [...prev];
                  const lastMsg = newMessages[newMessages.length - 1];
                  if (lastMsg.role === 'assistant') {
                    lastMsg.content = assistantMessageContent;
                  }
                  return newMessages;
                });
              }
            } catch (e) {
              console.warn('Error parsing stream chunk', e);
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => {
        const newMsgs = [...prev];
        // If last message is empty assistant message, update it to error
        const lastMsg = newMsgs[newMsgs.length - 1];
        if (lastMsg.role === 'assistant' && lastMsg.content === '') {
          lastMsg.content = 'Error al conectar con el servidor de chat.';
        } else {
          newMsgs.push({ role: 'assistant', content: 'Error al conectar con el servidor de chat.' });
        }
        return newMsgs;
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen w-full">
        <form onSubmit={handleLogin} className="glass p-8 rounded-2xl w-full max-w-md flex flex-col gap-6">
          <h1 className="text-3xl font-bold text-center bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Bienvenido
          </h1>
          <div className="flex flex-col gap-2">
            <label className="text-sm text-gray-400">Usuario</label>
            <input
              type="text"
              className="bg-black/20 border border-white/10 rounded-lg p-3 text-white input-glow"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Ingrese su usuario"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm text-gray-400">Contraseña</label>
            <input
              type="password"
              className="bg-black/20 border border-white/10 rounded-lg p-3 text-white input-glow"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <button type="submit" className="btn-primary py-3 rounded-lg font-semibold tracking-wide">
            Entrar
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-[#0f0f11] overflow-hidden">
      <div className="relative z-50">
        <AgentManager onSelectAgent={handleSelectAgent} selectedAgentId={selectedAgent?.id} />
      </div>

      <div className="flex flex-col flex-1 h-full max-w-4xl mx-auto p-4 md:p-6 gap-4 pl-16 md:pl-20">
        {/* Header */}
        <header className="flex justify-between items-center py-2 border-b border-white/10 mb-2">
          <div className="flex flex-col">
            <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              Chat IA
            </h2>
            {selectedAgent && <span className="text-xs text-gray-400">Agente: {selectedAgent.name}</span>}
          </div>
          <div className="text-xs text-green-400 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
            Conectado
          </div>
        </header>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-2 pb-4 scroll-smooth">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex w-full ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] md:max-w-[70%] p-4 rounded-2xl backdrop-blur-sm ${m.role === 'user'
                  ? 'bg-blue-600/20 border border-blue-500/30 text-white rounded-tr-none'
                  : 'bg-white/5 border border-white/10 text-gray-100 rounded-tl-none'
                  }`}
              >
                <div className="markdown-body text-sm md:text-base min-h-[1.5em]">
                  {m.role === 'assistant' && m.content === '' && isLoading ? (
                    <div className="loading-wave">
                      <div className="loading-bar"></div>
                      <div className="loading-bar"></div>
                      <div className="loading-bar"></div>
                      <div className="loading-bar"></div>
                    </div>
                  ) : (
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  )}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <form onSubmit={sendMessage} className="relative mt-auto pt-2">
          <input
            type="text"
            className="w-full bg-white/5 border border-white/10 rounded-xl p-4 pr-16 text-white placeholder-gray-500 input-glow transition-all"
            placeholder="Escribe tu mensaje..."
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="absolute right-2 top-1/2 -translate-y-[45%] btn-primary p-2 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-5 h-5"
            >
              <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}

export default App;
