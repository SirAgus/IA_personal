import initSqlJs, { type Database } from 'sql.js';
import localforage from 'localforage';

let dbInstance: Database | null = null;
const DB_NAME = 'chat_agents_db';

// Initialize DB
export const getDB = async (): Promise<Database> => {
    if (dbInstance) return dbInstance;

    const SQL = await initSqlJs({
        locateFile: (file) => `/${file}`,
    });

    const savedData = await localforage.getItem<Uint8Array>(DB_NAME);

    if (savedData) {
        dbInstance = new SQL.Database(savedData);
    } else {
        dbInstance = new SQL.Database();
    }
    initTables(dbInstance);

    return dbInstance;
};

// Initialize Tables
const initTables = (db: Database) => {
    db.run(`
        CREATE TABLE IF NOT EXISTS agents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            system_prompt TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS threads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            agent_id INTEGER,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            thread_id INTEGER,
            role TEXT,
            content TEXT,
            reasoning_content TEXT,
            metrics TEXT, -- JSON string
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(thread_id) REFERENCES threads(id) ON DELETE CASCADE
        );
    `);
    saveDB(); // Save initial structure
};

// ... existing storage functions ...
export const saveDB = async () => {
    if (!dbInstance) return;
    const data = dbInstance.export();
    await localforage.setItem(DB_NAME, data);
};

// --- Types ---
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
    metrics?: any; // Stored as JSON string
    created_at?: string;
}

// --- Agents ---
export const getAgents = async (): Promise<Agent[]> => {
    const db = await getDB();
    const res = db.exec("SELECT * FROM agents ORDER BY id DESC");
    if (res.length === 0) return [];
    return parseResult<Agent>(res[0]);
};

export const addAgent = async (agent: Omit<Agent, 'id'>) => {
    const db = await getDB();
    db.run("INSERT INTO agents (name, description, system_prompt) VALUES (?, ?, ?)", [agent.name, agent.description, agent.system_prompt]);
    await saveDB();
};

export const updateAgent = async (id: number, agent: Omit<Agent, 'id'>) => {
    const db = await getDB();
    db.run("UPDATE agents SET name = ?, description = ?, system_prompt = ? WHERE id = ?", [agent.name, agent.description, agent.system_prompt, id]);
    await saveDB();
};

export const deleteAgent = async (id: number) => {
    const db = await getDB();
    db.run("DELETE FROM agents WHERE id = ?", [id]);
    await saveDB();
};

// --- Threads ---
export const createThread = async (title: string, agentId?: number): Promise<number> => {
    const db = await getDB();
    db.run("INSERT INTO threads (title, agent_id) VALUES (?, ?)", [title, agentId || null]);
    const res = db.exec("SELECT last_insert_rowid() as id");
    await saveDB();
    return res[0].values[0][0] as number;
};

export const getThreads = async (): Promise<Thread[]> => {
    const db = await getDB();
    const res = db.exec("SELECT * FROM threads ORDER BY updated_at DESC");
    if (res.length === 0) return [];
    return parseResult<Thread>(res[0]);
};

export const getThreadById = async (id: number): Promise<Thread | null> => {
    const db = await getDB();
    const res = db.exec("SELECT * FROM threads WHERE id = ?", [id]);
    if (res.length === 0) return null;
    return parseResult<Thread>(res[0])[0];
};

export const getAgentById = async (id: number): Promise<Agent | null> => {
    const db = await getDB();
    const res = db.exec("SELECT * FROM agents WHERE id = ?", [id]);
    if (res.length === 0) return null;
    return parseResult<Agent>(res[0])[0];
};

export const updateThreadTitle = async (id: number, title: string) => {
    const db = await getDB();
    db.run("UPDATE threads SET title = ? WHERE id = ?", [title, id]);
    await saveDB();
};

export const updateThreadAgent = async (id: number, agentId: number | null) => {
    const db = await getDB();
    db.run("UPDATE threads SET agent_id = ? WHERE id = ?", [agentId, id]);
    await saveDB();
};

export const deleteThread = async (id: number) => {
    const db = await getDB();
    db.run("DELETE FROM threads WHERE id = ?", [id]);
    db.run("DELETE FROM messages WHERE thread_id = ?", [id]);
    await saveDB();
};

// --- Messages ---
export const addMessage = async (msg: DBMessage) => {
    const db = await getDB();
    const metricsStr = msg.metrics ? JSON.stringify(msg.metrics) : null;

    db.run(
        "INSERT INTO messages (thread_id, role, content, reasoning_content, metrics) VALUES (?, ?, ?, ?, ?)",
        [msg.thread_id, msg.role, msg.content, msg.reasoning_content || null, metricsStr]
    );

    // Update thread timestamp
    db.run("UPDATE threads SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", [msg.thread_id]);
    await saveDB();
};

export const getThreadMessages = async (threadId: number, limit: number = 50, offset: number = 0): Promise<DBMessage[]> => {
    const db = await getDB();
    // We want the oldest messages first for the chat view, but with pagination we normally select latest.
    // However, "pagination of 10 messages" usually means loading history backwards.
    // For simplicity, let's fetch in reverse creation order (newest first) with limit, then reverse back.

    const res = db.exec(
        `SELECT * FROM messages WHERE thread_id = ? ORDER BY id DESC LIMIT ? OFFSET ?`,
        [threadId, limit, offset]
    );

    if (res.length === 0) return [];

    const msgs = parseResult<DBMessage>(res[0]);

    // Parse JSON metrics
    msgs.forEach(m => {
        if (typeof m.metrics === 'string') {
            try { m.metrics = JSON.parse(m.metrics); } catch { }
        }
    });

    return msgs.reverse(); // Return in chronological order
};

// Helper to parse sql.js result
function parseResult<T>(res: { columns: string[], values: any[][] }): T[] {
    const columns = res.columns;
    const values = res.values;
    return values.map((v) => {
        const obj: any = {};
        columns.forEach((col, i) => {
            obj[col] = v[i];
        });
        return obj as T;
    });
}
