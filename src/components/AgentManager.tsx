import React, { useState, useEffect } from 'react';
import { getAgents, addAgent, deleteAgent, updateAgent } from '../services/db';
import type { Agent } from '../services/db';

interface AgentManagerProps {
    onSelectAgent: (agent: Agent) => void;
    selectedAgentId?: number;
}

export function AgentManager({ onSelectAgent, selectedAgentId }: AgentManagerProps) {
    const [agents, setAgents] = useState<Agent[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    // Form State
    const [agentName, setAgentName] = useState('');
    const [agentDesc, setAgentDesc] = useState('');
    const [systemPrompt, setSystemPrompt] = useState('');
    const [editId, setEditId] = useState<number | null>(null);

    const loadAgents = async () => {
        const data = await getAgents();
        setAgents(data);
    };

    useEffect(() => {
        loadAgents();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (editId) {
            await updateAgent(editId, { name: agentName, description: agentDesc, system_prompt: systemPrompt });
        } else {
            await addAgent({ name: agentName, description: agentDesc, system_prompt: systemPrompt });
        }

        setAgentName('');
        setAgentDesc('');
        setSystemPrompt('');
        setEditId(null);
        setIsEditing(false);
        await loadAgents();
    };

    const handleEdit = (agent: Agent) => {
        setAgentName(agent.name);
        setAgentDesc(agent.description);
        setSystemPrompt(agent.system_prompt);
        setEditId(agent.id || null);
        setIsEditing(true);
    };

    const handleDelete = async (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm('¿Estás seguro de eliminar este agente?')) {
            await deleteAgent(id);
            await loadAgents();
            if (selectedAgentId === id) {
                // Handle deselection if needed, though parent controls this
            }
        }
    };

    const handleCancel = () => {
        setIsEditing(false);
        setEditId(null);
        setAgentName('');
        setAgentDesc('');
        setSystemPrompt('');
    };

    return (
        <div className={`fixed inset-y-0 left-0 bg-[#0f0f11] border-r border-white/10 w-80 transform transition-transform duration-300 ease-in-out z-50 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>

            {/* Toggle Button (Visible even when closed) */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="absolute top-4 -right-12 bg-[#0f0f11] border border-white/10 border-l-0 rounded-r-lg p-2 text-white hover:bg-white/5"
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d={isOpen ? "M6 18L18 6M6 6l12 12" : "M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"} />
                </svg>
            </button>

            <div className="flex flex-col h-full p-4">
                <h2 className="text-xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">Agentes</h2>

                {/* Agent List */}
                <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                    {agents.length === 0 && <p className="text-gray-500 text-sm text-center italic">No hay agentes configurados.</p>}

                    {agents.map(agent => (
                        <div
                            key={agent.id}
                            onClick={() => onSelectAgent(agent)}
                            className={`p-3 rounded-xl border cursor-pointer transition-all group relative ${selectedAgentId === agent.id ? 'bg-blue-600/20 border-blue-500/50' : 'bg-white/5 border-white/10 hover:border-white/30'}`}
                        >
                            <h3 className="font-semibold text-white">{agent.name}</h3>
                            <p className="text-xs text-gray-400 truncate">{agent.description}</p>

                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex gap-2">
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleEdit(agent); }}
                                    className="p-1 text-gray-300 hover:text-white bg-black/50 rounded"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                        <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
                                        <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
                                    </svg>
                                </button>
                                <button
                                    onClick={(e) => handleDelete(agent.id!, e)}
                                    className="p-1 text-red-400 hover:text-red-300 bg-black/50 rounded"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                        <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Add/Edit Form */}
                <div className="border-t border-white/10 pt-4">
                    {!isEditing ? (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="w-full btn-primary py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                            </svg>
                            Nuevo Agente
                        </button>
                    ) : (
                        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                            <input
                                type="text"
                                placeholder="Nombre del Agente"
                                className="bg-black/20 border border-white/10 rounded-lg p-2 text-sm text-white focus:border-blue-500 outline-none"
                                value={agentName}
                                onChange={e => setAgentName(e.target.value)}
                                required
                            />
                            <input
                                type="text"
                                placeholder="Breve descripción"
                                className="bg-black/20 border border-white/10 rounded-lg p-2 text-sm text-white focus:border-blue-500 outline-none"
                                value={agentDesc}
                                onChange={e => setAgentDesc(e.target.value)}
                            />
                            <textarea
                                placeholder="Prompt del Sistema (Instrucciones)"
                                className="bg-black/20 border border-white/10 rounded-lg p-2 text-sm text-white focus:border-blue-500 outline-none min-h-[100px]"
                                value={systemPrompt}
                                onChange={e => setSystemPrompt(e.target.value)}
                                required
                            />
                            <div className="flex gap-2">
                                <button type="submit" className="flex-1 btn-primary py-2 rounded-lg text-xs font-semibold">Guardar</button>
                                <button type="button" onClick={handleCancel} className="flex-1 bg-white/10 hover:bg-white/20 text-white py-2 rounded-lg text-xs font-semibold">Cancelar</button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
