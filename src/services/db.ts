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
        initTables(dbInstance);
    }

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
    saveDB(); // Save initial structure
};

// Save DB to local storage (IndexedDB via localforage)
export const saveDB = async () => {
    if (!dbInstance) return;
    const data = dbInstance.export();
    await localforage.setItem(DB_NAME, data);
};

// CRUD Operations

export interface Agent {
    id?: number;
    name: string;
    description: string;
    system_prompt: string;
}

export const getAgents = async (): Promise<Agent[]> => {
    const db = await getDB();
    const res = db.exec("SELECT * FROM agents ORDER BY id DESC");

    if (res.length === 0) return [];

    const columns = res[0].columns;
    const values = res[0].values;

    return values.map((v) => {
        const obj: any = {};
        columns.forEach((col, i) => {
            obj[col] = v[i];
        });
        return obj as Agent;
    });
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
