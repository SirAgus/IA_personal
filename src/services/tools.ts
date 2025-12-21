export const tools = [
    {
        type: "function",
        function: {
            name: "get_current_date",
            description: "Devuelve la fecha actual del sistema",
            parameters: {
                type: "object",
                properties: {}
            }
        }
    },
    {
        type: "function",
        function: {
            name: "web_search",
            description: "Realiza una búsqueda real en internet utilizando DuckDuckGo. Útil para obtener información actual, noticias o verificar datos recientes.",
            parameters: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description: "El término o pregunta exacta a buscar."
                    }
                },
                required: ["query"]
            }
        }
    }
];

export const executeTool = async (name: string, args: any) => {
    console.log(`Executing tool: ${name}`, args);

    if (name === 'get_current_date') {
        return new Date().toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    if (name === 'web_search') {
        try {
            const apiKey = import.meta.env.SERPAPI_KEY || import.meta.env.VITE_SERPAPI_KEY;
            if (!apiKey) {
                return "Error: No se ha configurado la API Key de SerpAPI (SERPAPI_KEY).";
            }

            const query = encodeURIComponent(args.query);
            // Use our local proxy to avoid CORS
            const url = `/api/serpapi/search.json?q=${query}&api_key=${apiKey}&engine=google&google_domain=google.com&gl=us&hl=es`;

            const response = await fetch(url);

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`SerpAPI Error (${response.status}): ${errText}`);
            }

            const data = await response.json();
            console.log("SerpAPI Response:", data);

            // Parse meaningful results
            let result = "";

            // 1. Answer Box (Direct Answer)
            if (data.answer_box) {
                if (data.answer_box.answer) {
                    result += `Respuesta Directa: ${data.answer_box.answer}\n\n`;
                } else if (data.answer_box.snippet) {
                    result += `Resumen Destacado: ${data.answer_box.snippet}\n\n`;
                }
            }

            // 2. Knowledge Graph
            if (data.knowledge_graph) {
                if (data.knowledge_graph.description) {
                    result += `Información General: ${data.knowledge_graph.description}\n\n`;
                }
            }

            // 3. Organic Results (Top 5)
            if (data.organic_results && data.organic_results.length > 0) {
                result += "Resultados de búsqueda:\n";
                data.organic_results.slice(0, 5).forEach((item: any, index: number) => {
                    result += `${index + 1}. [${item.title}](${item.link})\n`;
                    if (item.snippet) {
                        result += `   ${item.snippet}\n`;
                    }
                    result += "\n";
                });
            }

            if (!result) {
                return `No se encontraron resultados relevantes en Google para "${args.query}".`;
            }

            return result;

        } catch (e) {
            console.error("Web Search Error", e);
            return `Error al buscar en web: ${e instanceof Error ? e.message : String(e)}`;
        }
    }

    return `Herramienta ${name} no implementada.`;
};
