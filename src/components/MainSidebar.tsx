import { useState, useEffect } from 'react';
import type { Thread, Agent } from '../services/db';

interface MainSidebarProps {
    currentThreadId: number | null;
    selectedAgentId?: number;
    onSelectThread: (id: number) => void;
    onNewThread: () => void;
    onSelectAgent: (agent: Agent | null) => void;
    onLogout: () => void;
    isOpen: boolean;
    onClose: () => void;
    theme: 'light' | 'dark';
    onToggleTheme: () => void;
    token: string | null;
    user: { username: string } | null;
    onOpenAuth: (mode: 'login' | 'signup') => void;
}

const BACKEND_URL = import.meta.env.CHAT_API_URL || 'http://localhost:3000';

export function MainSidebar({
    currentThreadId,
    selectedAgentId,
    onSelectThread,
    onNewThread,
    onSelectAgent,
    onLogout,
    isOpen,
    onClose,
    theme,
    onToggleTheme,
    token,
    user,
    onOpenAuth
}: MainSidebarProps) {
    const [threads, setThreads] = useState<Thread[]>([]);
    const [agents, setAgents] = useState<Agent[]>([]);

    // Collapsible states
    const [threadsOpen, setThreadsOpen] = useState(true);
    const [agentsOpen, setAgentsOpen] = useState(false);

    // Agent Form State
    const [isEditingAgent, setIsEditingAgent] = useState(false);
    const [agentName, setAgentName] = useState('');
    const [agentDesc, setAgentDesc] = useState('');
    const [systemPrompt, setSystemPrompt] = useState('');
    const [editAgentId, setEditAgentId] = useState<number | null>(null);

    // Thread Edit State
    const [editingThreadId, setEditingThreadId] = useState<number | null>(null);
    const [editThreadTitle, setEditThreadTitle] = useState('');
    const [editThreadAgentId, setEditThreadAgentId] = useState<number | null>(null);

    const loadData = async () => {
        if (!token) {
            setThreads([]);
            setAgents([]);
            return;
        }
        try {
            const headers = { 'Authorization': `Bearer ${token}` };
            
            const tRes = await fetch(`${BACKEND_URL}/threads`, { headers });
            if (tRes.ok) setThreads(await tRes.json());

            const aRes = await fetch(`${BACKEND_URL}/agents`, { headers });
            if (aRes.ok) setAgents(await aRes.json());
        } catch (err) {
            console.error("Error loading sidebar data:", err);
        }
    };

    useEffect(() => {
        loadData();
    }, [currentThreadId, selectedAgentId, token]);

    // Agent Handlers
    const handleSubmitAgent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token) return;

        const payload = { name: agentName, description: agentDesc, system_prompt: systemPrompt };

        const url = editAgentId ? `${BACKEND_URL}/agents/${editAgentId}` : `${BACKEND_URL}/agents`;
        const method = editAgentId ? 'PUT' : 'POST';

        await fetch(url, {
            method,
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        setAgentName(''); setAgentDesc(''); setSystemPrompt(''); setEditAgentId(null); setIsEditingAgent(false);
        await loadData();
    };

    const handleEditAgent = (agent: Agent) => {
        setAgentName(agent.name); setAgentDesc(agent.description); setSystemPrompt(agent.system_prompt);
        setEditAgentId(agent.id || null); setIsEditingAgent(true); setAgentsOpen(true);
    };

    const handleDeleteAgent = async (id: number) => {
        if (confirm('¿Eliminar agente?') && token) {
            await fetch(`${BACKEND_URL}/agents/${id}`, { 
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            await loadData();
        }
    };

    // Thread Handlers
    const startEditingThread = (thread: Thread, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingThreadId(thread.id!);
        setEditThreadTitle(thread.title);
        setEditThreadAgentId(thread.agent_id || null);
    };

    const saveThreadEdit = async () => {
        if (editingThreadId && token) {
            await fetch(`${BACKEND_URL}/threads/${editingThreadId}`, {
                method: 'PATCH',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ title: editThreadTitle, agent_id: editThreadAgentId })
            });
            setEditingThreadId(null);
            await loadData();
        }
    };

    const handleDeleteThread = async (id: number) => {
        if (confirm('¿Eliminar conversación?') && token) {
            await fetch(`${BACKEND_URL}/threads/${id}`, { 
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (currentThreadId === id) onNewThread();
            await loadData();
        }
    };

    return (
        <>
            {/* Mobile Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
                    onClick={onClose}
                />
            )}

            <div className={`
                fixed inset-y-0 left-0 z-50 md:relative 
                flex flex-col h-full bg-gray-50 dark:bg-[#0f0f11] border-r border-black/5 dark:border-white/10 
                w-72 md:w-72 overflow-hidden transition-all duration-300 ease-in-out
                ${isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'}
            `}>
                {/* Header */}
                <div className="p-5 border-b border-black/5 dark:border-white/5 flex items-center justify-between">
                    <h1 className="text-xl font-black bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent font-mono tracking-tighter">Athenas AI</h1>
                    <div className="flex items-center gap-1">
                        <button 
                            onClick={onToggleTheme}
                            className="p-2 text-gray-400 hover:text-blue-500 transition-colors rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
                            title={theme === 'light' ? 'Modo Oscuro' : 'Modo Claro'}
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
                        {token && (
                            <button onClick={onLogout} className="p-2 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-black/5 dark:hover:bg-white/5" title="Cerrar Sesión">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-4">
                    {!token ? (
                        <div className="flex flex-col gap-3 p-4 bg-blue-500/5 rounded-2xl border border-blue-500/10">
                            <p className="text-xs text-gray-500 text-center leading-relaxed">Inicia sesión para guardar tus chats y crear agentes personalizados.</p>
                            <div className="flex flex-col gap-2">
                                <button 
                                    onClick={() => onOpenAuth('login')}
                                    className="w-full bg-blue-600 text-white text-xs font-bold py-2.5 rounded-xl hover:bg-blue-500 transition-all active:scale-95"
                                >
                                    Iniciar Sesión
                                </button>
                                <button 
                                    onClick={() => onOpenAuth('signup')}
                                    className="w-full bg-black/5 dark:bg-white/5 text-gray-700 dark:text-gray-300 text-xs font-bold py-2.5 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 transition-all active:scale-95"
                                >
                                    Crear Cuenta
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Hilos Section */}
                            <div>
                                <button
                                    onClick={() => setThreadsOpen(!threadsOpen)}
                                    className="w-full flex items-center justify-between p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-all group"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Chats</span>
                                        <span className="bg-black/5 dark:bg-white/10 text-[10px] px-2 py-0.5 rounded-full text-gray-500 dark:text-gray-400">{threads.length}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div
                                            onClick={(e) => { e.stopPropagation(); onNewThread(); }}
                                            className="p-1 hover:bg-blue-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all text-blue-600 dark:text-blue-400"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" /></svg>
                                        </div>
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${threadsOpen ? 'rotate-180' : ''}`}><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
                                    </div>
                                </button>

                                {threadsOpen && (
                                    <div className="mt-2 space-y-1 animate-in">
                                        {threads.length === 0 && (
                                            <p className="text-[10px] text-center text-gray-400 py-4 italic">No hay chats recientes</p>
                                        )}
                                        {threads.map(thread => (
                                            <div key={thread.id} onClick={() => onSelectThread(thread.id!)} className={`group relative p-3 rounded-xl border cursor-pointer transition-all duration-200 ${currentThreadId === thread.id ? 'bg-blue-600/10 border-blue-500/30 text-blue-600 dark:text-blue-400' : 'bg-transparent border-transparent hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'}`}>
                                                {editingThreadId === thread.id ? (
                                                    <div className="space-y-2 animate-in" onClick={e => e.stopPropagation()}>
                                                        <input className="w-full bg-white dark:bg-black/40 border border-black/10 dark:border-white/20 rounded-lg p-2 text-xs text-gray-900 dark:text-white outline-none focus:ring-2 ring-blue-500/50" value={editThreadTitle} onChange={e => setEditThreadTitle(e.target.value)} autoFocus />
                                                        <select className="w-full bg-white dark:bg-black/40 border border-black/10 dark:border-white/20 rounded-lg p-2 text-xs text-gray-900 dark:text-white outline-none focus:ring-2 ring-blue-500/50" value={editThreadAgentId || ''} onChange={e => setEditThreadAgentId(e.target.value ? Number(e.target.value) : null)}>
                                                            <option value="">Sin Agente</option>
                                                            {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                                        </select>
                                                        <div className="flex gap-2">
                                                            <button onClick={saveThreadEdit} className="flex-1 bg-blue-600 text-white text-[10px] font-bold py-2 rounded-lg hover:bg-blue-500 transition-colors shadow-lg shadow-blue-500/20">Guardar</button>
                                                            <button onClick={() => setEditingThreadId(null)} className="flex-1 bg-black/5 dark:bg-white/10 text-gray-700 dark:text-gray-300 text-[10px] font-bold py-2 rounded-lg hover:bg-black/10 dark:hover:bg-white/20 transition-colors">Cancelar</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <h3 className="text-sm font-semibold truncate pr-14 transition-colors group-hover:text-blue-600 dark:group-hover:text-blue-400">{thread.title}</h3>
                                                        <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1.5 font-medium">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500/40"></span>
                                                        {agents.find(a => a.id === thread.agent_id)?.name || 'Asistente General'}
                                                        </p>
                                                        <div className="absolute top-1/2 -translate-y-1/2 right-2 opacity-0 group-hover:opacity-100 flex gap-1 transition-all">
                                                            <button onClick={(e) => startEditingThread(thread, e)} className="p-1.5 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-white dark:hover:bg-black rounded-lg shadow-sm transition-all"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" /></svg></button>
                                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteThread(thread.id!); }} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-white dark:hover:bg-black rounded-lg shadow-sm transition-all"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4z" clipRule="evenodd" /></svg></button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Agentes Section */}
                            <div>
                                <button
                                    onClick={() => setAgentsOpen(!agentsOpen)}
                                    className="w-full flex items-center justify-between p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-all group"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Agentes</span>
                                        <span className="bg-black/5 dark:bg-white/10 text-[10px] px-2 py-0.5 rounded-full text-gray-500 dark:text-gray-400">{agents.length}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div
                                            onClick={(e) => { e.stopPropagation(); setIsEditingAgent(true); setAgentsOpen(true); }}
                                            className="p-1 hover:bg-purple-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all text-purple-600 dark:text-purple-400"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" /></svg>
                                        </div>
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${agentsOpen ? 'rotate-180' : ''}`}><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
                                    </div>
                                </button>

                                {agentsOpen && (
                                    <div className="mt-2 space-y-1 animate-in">
                                        <div
                                            onClick={() => onSelectAgent(null)}
                                            className={`p-3 rounded-xl border cursor-pointer transition-all duration-200 ${!selectedAgentId ? 'bg-purple-600/10 border-purple-500/30 text-purple-600 dark:text-purple-400' : 'bg-transparent border-transparent hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'}`}
                                        >
                                            <h3 className="text-sm font-semibold transition-colors group-hover:text-purple-600 dark:group-hover:text-purple-400">Asistente General</h3>
                                            <p className="text-[10px] text-gray-400 mt-0.5 font-medium italic">Instrucciones básicas</p>
                                        </div>

                                        {agents.map(agent => (
                                            <div
                                                key={agent.id}
                                                onClick={() => onSelectAgent(agent)}
                                                className={`group relative p-3 rounded-xl border cursor-pointer transition-all duration-200 ${selectedAgentId === agent.id ? 'bg-purple-600/10 border-purple-500/30 text-purple-600 dark:text-purple-400' : 'bg-transparent border-transparent hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'}`}
                                            >
                                                <h3 className="text-sm font-semibold truncate pr-14 transition-colors group-hover:text-purple-600 dark:group-hover:text-purple-400">{agent.name}</h3>
                                                <p className="text-[10px] text-gray-400 truncate mt-0.5 font-medium">{agent.description}</p>
                                                <div className="absolute top-1/2 -translate-y-1/2 right-2 opacity-0 group-hover:opacity-100 flex gap-1 transition-all">
                                                    <button onClick={(e) => { e.stopPropagation(); handleEditAgent(agent); }} className="p-1.5 text-gray-400 hover:text-purple-500 dark:hover:text-purple-400 hover:bg-white dark:hover:bg-black rounded-lg shadow-sm transition-all"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" /></svg></button>
                                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteAgent(agent.id!); }} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-white dark:hover:bg-black rounded-lg shadow-sm transition-all"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4z" clipRule="evenodd" /></svg></button>
                                                </div>
                                            </div>
                                        ))}

                                        {isEditingAgent && (
                                            <form onSubmit={handleSubmitAgent} className="p-4 bg-white dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-2xl space-y-3 mt-4 animate-slide-up shadow-xl">
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-gray-500 uppercase px-1">Nombre</label>
                                                    <input type="text" className="w-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-lg p-2 text-xs text-gray-900 dark:text-white outline-none focus:ring-2 ring-purple-500/50" value={agentName} onChange={e => setAgentName(e.target.value)} required />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-gray-500 uppercase px-1">Descripción</label>
                                                    <input type="text" className="w-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-lg p-2 text-xs text-gray-900 dark:text-white outline-none focus:ring-2 ring-purple-500/50" value={agentDesc} onChange={e => setAgentDesc(e.target.value)} />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-gray-500 uppercase px-1">Instrucciones (System Prompt)</label>
                                                    <textarea className="w-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-lg p-2 text-xs text-gray-900 dark:text-white min-h-[100px] outline-none focus:ring-2 ring-purple-500/50 resize-none" value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)} required />
                                                </div>
                                                <div className="flex gap-2 pt-2">
                                                    <button type="submit" className="flex-1 bg-purple-600 hover:bg-purple-500 text-white py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg shadow-purple-500/20 active:scale-95">Guardar</button>
                                                    <button type="button" onClick={() => setIsEditingAgent(false)} className="flex-1 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95">Cancelar</button>
                                                </div>
                                            </form>
                                        )}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* User Footer */}
                <div className="p-4 bg-black/5 dark:bg-black/20 border-t border-black/5 dark:border-white/5 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-sm font-black text-white shadow-lg ring-2 ring-white/10">
                        {user ? user.username[0].toUpperCase() : '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-900 dark:text-gray-200 truncate">{user ? user.username : 'Invitado'}</p>
                        <p className={`text-[10px] font-bold flex items-center gap-1.5 mt-0.5 ${token ? 'text-green-600 dark:text-green-500' : 'text-gray-400'}`}>
                           <span className={`w-1.5 h-1.5 rounded-full ${token ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span>
                           {token ? 'En línea' : 'Sin conexión'}
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}
