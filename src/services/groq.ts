export interface GroqMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  name?: string;
  tool_calls?: any[];
}

interface GroqStreamParams {
  apiKey: string;
  model: string;
  messages: GroqMessage[];
  tools?: any[];
  baseUrl?: string;
  signal?: AbortSignal;
  onDelta: (delta: string) => void;
  onToolCall?: (toolCall: any) => void;
}

const defaultBaseUrl = 'https://api.groq.com/openai/v1';

/**
 * Llamada síncrona (no stream) a Groq para manejar tool calls fácilmente
 */
export const callGroqChat = async ({
  apiKey,
  model,
  messages,
  tools,
  baseUrl = defaultBaseUrl,
  signal
}: Omit<GroqStreamParams, 'onDelta' | 'onToolCall'>) => {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      tools,
      stream: false
    }),
    signal
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Error en la API de Groq');
  }

  return await response.json();
};

export const streamGroqChat = async ({
  apiKey,
  model,
  messages,
  tools,
  baseUrl = defaultBaseUrl,
  signal,
  onDelta,
  onToolCall
}: GroqStreamParams) => {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      tools,
      stream: true
    }),
    signal
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Error en la API de Groq');
  }

  if (!response.body) throw new Error('No body');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.replace(/^data:\s*/, '');
      if (payload === '[DONE]') return;

      try {
        const data = JSON.parse(payload);
        const delta = data?.choices?.[0]?.delta;
        if (delta?.content) onDelta(delta.content);
        if (delta?.tool_calls && onToolCall) {
          onToolCall(delta.tool_calls[0]);
        }
      } catch { }
    }
  }
};
