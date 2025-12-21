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
    onClose
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
        try {
            const tRes = await fetch(`${BACKEND_URL}/threads`);
            if (tRes.ok) setThreads(await tRes.json());

            const aRes = await fetch(`${BACKEND_URL}/agents`);
            if (aRes.ok) setAgents(await aRes.json());
        } catch (err) {
            console.error("Error loading sidebar data:", err);
        }
    };

    useEffect(() => {
        loadData();
    }, [currentThreadId, selectedAgentId]);

    // Agent Handlers
    const handleSubmitAgent = async (e: React.FormEvent) => {
        e.preventDefault();
        const payload = { name: agentName, description: agentDesc, system_prompt: systemPrompt };

        const url = editAgentId ? `${BACKEND_URL}/agents/${editAgentId}` : `${BACKEND_URL}/agents`;
        const method = editAgentId ? 'PUT' : 'POST';

        await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
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
        if (confirm('¿Eliminar agente?')) {
            await fetch(`${BACKEND_URL}/agents/${id}`, { method: 'DELETE' });
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
        if (editingThreadId) {
            await fetch(`${BACKEND_URL}/threads/${editingThreadId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: editThreadTitle, agent_id: editThreadAgentId })
            });
            setEditingThreadId(null);
            await loadData();
        }
    };

    const handleDeleteThread = async (id: number) => {
        if (confirm('¿Eliminar conversación?')) {
            await fetch(`${BACKEND_URL}/threads/${id}`, { method: 'DELETE' });
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
                flex flex-col h-full bg-[#0f0f11] border-r border-white/10 
                w-72 md:w-72 overflow-hidden transition-transform duration-300 ease-in-out
                ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            `}>
                {/* Header */}
                <div className="p-4 border-b border-white/5 flex items-center justify-between">
                    <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">Athenas AI</h1>
                    <button onClick={onLogout} className="p-2 text-gray-500 hover:text-white transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">

                    {/* Hilos Section */}
                    <div className="border-b border-white/5">
                        <button
                            onClick={() => setThreadsOpen(!threadsOpen)}
                            className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors group"
                        >
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-gray-300">Hilos</span>
                                <span className="bg-white/10 text-[10px] px-1.5 rounded-full text-gray-400">{threads.length}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div
                                    onClick={(e) => { e.stopPropagation(); onNewThread(); }}
                                    className="p-1 hover:bg-white/10 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-blue-400"><path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" /></svg>
                                </div>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`w-5 h-5 text-gray-500 transition-transform ${threadsOpen ? 'rotate-180' : ''}`}><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
                            </div>
                        </button>

                        {threadsOpen && (
                            <div className="px-2 pb-4 space-y-1">
                                <button
                                    onClick={onNewThread}
                                    className="w-full text-left p-2 rounded-lg text-xs font-medium text-gray-400 hover:bg-white/5 border border-dashed border-white/10 mb-2 flex items-center gap-2"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" /></svg>
                                    Nueva Conversación
                                </button>

                                {threads.map(thread => (
                                    <div key={thread.id} onClick={() => onSelectThread(thread.id!)} className={`group relative p-3 rounded-xl border cursor-pointer transition-all ${currentThreadId === thread.id ? 'bg-blue-600/10 border-blue-500/30' : 'bg-transparent border-transparent hover:bg-white/5 hover:border-white/10'}`}>
                                        {editingThreadId === thread.id ? (
                                            <div className="space-y-2" onClick={e => e.stopPropagation()}>
                                                <input className="w-full bg-black/40 border border-white/20 rounded p-1 text-xs text-white" value={editThreadTitle} onChange={e => setEditThreadTitle(e.target.value)} autoFocus />
                                                <select className="w-full bg-black/40 border border-white/20 rounded p-1 text-xs text-white" value={editThreadAgentId || ''} onChange={e => setEditThreadAgentId(e.target.value ? Number(e.target.value) : null)}>
                                                    <option value="">Sin Agente</option>
                                                    {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                                </select>
                                                <div className="flex gap-1">
                                                    <button onClick={saveThreadEdit} className="flex-1 bg-green-600/40 text-[10px] py-1 rounded">Ok</button>
                                                    <button onClick={() => setEditingThreadId(null)} className="flex-1 bg-white/10 text-[10px] py-1 rounded">X</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <h3 className="text-sm font-medium text-gray-200 truncate pr-14">{thread.title}</h3>
                                                <p className="text-[10px] text-gray-500 mt-1">{agents.find(a => a.id === thread.agent_id)?.name || 'Sin Agente'}</p>
                                                <div className="absolute top-3 right-2 opacity-0 group-hover:opacity-100 flex gap-1">
                                                    <button onClick={(e) => startEditingThread(thread, e)} className="p-1 text-gray-500 hover:text-white"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" /></svg></button>
                                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteThread(thread.id!); }} className="p-1 text-gray-500 hover:text-red-400"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4z" clipRule="evenodd" /></svg></button>
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
                            className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors group"
                        >
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-gray-300">Agentes</span>
                                <span className="bg-white/10 text-[10px] px-1.5 rounded-full text-gray-400">{agents.length}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div
                                    onClick={(e) => { e.stopPropagation(); setIsEditingAgent(true); setAgentsOpen(true); }}
                                    className="p-1 hover:bg-white/10 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-purple-400"><path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" /></svg>
                                </div>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`w-5 h-5 text-gray-500 transition-transform ${agentsOpen ? 'rotate-180' : ''}`}><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
                            </div>
                        </button>

                        {agentsOpen && (
                            <div className="px-2 pb-4 space-y-1">
                                <div
                                    onClick={() => onSelectAgent(null)}
                                    className={`p-3 rounded-xl border cursor-pointer transition-all ${!selectedAgentId ? 'bg-purple-600/10 border-purple-500/30' : 'bg-transparent border-transparent hover:bg-white/5 hover:border-white/10'}`}
                                >
                                    <h3 className="text-sm font-medium text-gray-200">Asistente General</h3>
                                    <p className="text-[10px] text-gray-500 mt-0.5">Sin instrucciones específicas</p>
                                </div>

                                {agents.map(agent => (
                                    <div
                                        key={agent.id}
                                        onClick={() => onSelectAgent(agent)}
                                        className={`group relative p-3 rounded-xl border cursor-pointer transition-all ${selectedAgentId === agent.id ? 'bg-purple-600/10 border-purple-500/30' : 'bg-transparent border-transparent hover:bg-white/5 hover:border-white/10'}`}
                                    >
                                        <h3 className="text-sm font-medium text-gray-200 truncate pr-14">{agent.name}</h3>
                                        <p className="text-[10px] text-gray-500 truncate mt-0.5">{agent.description}</p>
                                        <div className="absolute top-3 right-2 opacity-0 group-hover:opacity-100 flex gap-1">
                                            <button onClick={(e) => { e.stopPropagation(); handleEditAgent(agent); }} className="p-1 text-gray-500 hover:text-white"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" /></svg></button>
                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteAgent(agent.id!); }} className="p-1 text-gray-500 hover:text-red-400"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4z" clipRule="evenodd" /></svg></button>
                                        </div>
                                    </div>
                                ))}

                                {isEditingAgent && (
                                    <form onSubmit={handleSubmitAgent} className="p-3 bg-black/40 border border-white/10 rounded-xl space-y-3 mt-4">
                                        <input type="text" placeholder="Nombre" className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-white" value={agentName} onChange={e => setAgentName(e.target.value)} required />
                                        <input type="text" placeholder="Descripción" className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-white" value={agentDesc} onChange={e => setAgentDesc(e.target.value)} />
                                        <textarea placeholder="Prompt" className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-white min-h-[80px]" value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)} required />
                                        <div className="flex gap-2">
                                            <button type="submit" className="flex-1 bg-purple-600 hover:bg-purple-500 text-white py-1.5 rounded-lg text-[10px] font-bold">Guardar</button>
                                            <button type="button" onClick={() => setIsEditingAgent(false)} className="flex-1 bg-white/5 hover:bg-white/10 text-white py-1.5 rounded-lg text-[10px] font-bold">Cancelar</button>
                                        </div>
                                    </form>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* User Footer */}
                <div className="p-4 bg-black/20 border-t border-white/5 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white shadow-lg">U</div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-200 truncate">Usuario</p>
                        <p className="text-[10px] text-green-500 flex items-center gap-1">Conectado</p>
                    </div>
                </div>
            </div>
        </>
    );
}
