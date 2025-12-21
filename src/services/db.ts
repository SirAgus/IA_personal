// This file formerly handled local sql.js storage.
// Now it only serves as a type definition file for the application.
// All persistence is handled by the backend.

export interface Agent {
    id?: number;
    name: string;
    description: string;
    system_prompt: string;
}

export interface Thread {
    id?: number;
    title: string;
    agent_id?: number | null;
    updated_at?: string;
}

export interface DBMessage {
    id?: number;
    thread_id: number;
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    reasoning_content?: string;
    metrics?: any;
    created_at?: string;
}
