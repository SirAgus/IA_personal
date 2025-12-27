export interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GroqStreamParams {
  apiKey: string;
  model: string;
  messages: GroqMessage[];
  baseUrl?: string;
  signal?: AbortSignal;
  onDelta: (delta: string) => void;
}

const defaultBaseUrl = 'https://api.groq.com/openai/v1';

export const streamGroqChat = async ({
  apiKey,
  model,
  messages,
  baseUrl = defaultBaseUrl,
  signal,
  onDelta
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
      stream: true
    }),
    signal
  });

  if (!response.ok) {
    const text = await response.text();
    try {
      const parsed = JSON.parse(text);
      const message = parsed?.error?.message || parsed?.message;
      throw new Error(message || 'Error en la API de Groq');
    } catch {
      throw new Error(text || 'Error en la API de Groq');
    }
  }

  if (!response.body) {
    throw new Error('No hay cuerpo en la respuesta');
  }

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
        const delta = data?.choices?.[0]?.delta?.content;
        if (delta) onDelta(delta);
      } catch {
        // Ignore malformed chunks.
      }
    }
  }
};
