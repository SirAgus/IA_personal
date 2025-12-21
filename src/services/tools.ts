// This file is now handled by the backend.
// Frontend no longer executes tools locally.
export const tools = [];
export const executeTool = async () => {
    throw new Error("Tools are now handled by the backend.");
};
