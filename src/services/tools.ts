const MCP_URL = "https://documentsbackendfinancego-production.up.railway.app";

export const tools = [
    {
        type: "function",
        function: {
            name: "financego_api_docs",
            description: "Consulta la documentación oficial de la API de Financego. Puedes buscar endpoints, obtener payloads de ejemplo, códigos de error y especificaciones técnicas.",
            parameters: {
                type: "object",
                properties: {
                    action: {
                        type: "string",
                        enum: ["list", "search", "get_details"],
                        description: "La acción a realizar: listar todo, buscar por palabra clave, u obtener detalles de un archivo."
                    },
                    query: {
                        type: "string",
                        description: "La palabra clave a buscar (ej: 'login') o la ruta del archivo (ej: 'auth/login.md')."
                    }
                },
                required: ["action"]
            }
        }
    }
];

export const executeTool = async (name: string, args: any) => {
    if (name === "financego_api_docs") {
        const { action, query } = args;

        // Mapeo de herramientas internas del MCP a las acciones del tool de Groq
        const toolMap: Record<string, string> = {
            'list': 'list_all_endpoints',
            'search': 'search_endpoints',
            'get_details': 'get_endpoint_info'
        };

        const internalToolName = toolMap[action];
        const internalArgs = action === 'list' ? {} : (action === 'search' ? { query } : { filePath: query });

        try {
            // Como no queremos implementar todo el protocolo SSE client en frontend, 
            // podemos usar el endpoint /messages del servidor si lo exponemos correctamente,
            // o mejor aún, llamamos a la lógica enviando un comando.
            // Dado que el servidor Railway que montamos es un servidor MCP SSE estándar,
            // implementaremos un pequeño fetch compatible con su endpoint de mensajes.

            // NOTA: Para este caso, lo más sencillo es llamar al servidor MCP.
            // Pero para no complicar el frontend con SSE, usaremos una versión simplificada 
            // del protocolo que nuestro server.js puede manejar si lo ajustamos.

            // O, podemos simplemente añadir un endpoint HTTP normal al server.js para facilitar esto.
            // Por ahora, intentaremos la llamada al servidor de mensajes.

            // Si el server.js de Railway no tiene un endpoint REST simple, vamos a tener que
            // usar el asistente para añadir uno o usar un cliente SSE.

            // Voy a optar por lo MAS ROBUSTO: Añadir un endpoint REST simple a server.js en Railway
            // para que el frontend pueda consultar sin complicaciones de SSE.

            const response = await fetch(`${MCP_URL}/api/docs`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, query })
            });

            return await response.json();
        } catch (error: any) {
            console.error("Error calling Financego MCP:", error);
            return { error: `Error conectando con la documentación: ${error.message}` };
        }
    }

    throw new Error(`Tool ${name} not found`);
};
