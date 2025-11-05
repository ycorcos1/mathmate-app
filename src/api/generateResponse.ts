export type ChatMessagePayload = {
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string | null;
};

export type SocraticStepType = 'hint' | 'check' | 'final';

export type GenerateResponseMode = 'default' | 'hint';

export type GenerateResponseResult = {
  content: string;
  stepType?: SocraticStepType;
};

export type StreamingChunk = {
  content: string;
  stepType?: SocraticStepType;
  done?: boolean;
  error?: string;
};

const DEFAULT_REGION = 'us-central1';

const resolveFunctionsBaseUrl = () => {
  const explicit = import.meta.env.VITE_FUNCTIONS_BASE_URL;

  if (explicit && typeof explicit === 'string') {
    return explicit.replace(/\/$/, '');
  }

  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;

  if (!projectId) {
    throw new Error('VITE_FIREBASE_PROJECT_ID is required to resolve Functions base URL.');
  }

  return `https://${DEFAULT_REGION}-${projectId}.cloudfunctions.net`;
};

export const callGenerateResponse = async (
  messages: ChatMessagePayload[],
  mode: GenerateResponseMode = 'default',
  stream = false,
): Promise<GenerateResponseResult> => {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('messages array is required.');
  }

  const baseUrl = resolveFunctionsBaseUrl();
  const response = await fetch(`${baseUrl}/generateResponse`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
        imageUrl: msg.imageUrl ?? null,
      })),
      mode,
      stream,
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => 'Unknown error');
    throw new Error(`generateResponse failed: ${response.status} ${details}`);
  }

  const data = (await response.json()) as { content?: string; stepType?: SocraticStepType };

  if (!data || typeof data.content !== 'string') {
    throw new Error('generateResponse returned an invalid payload.');
  }

  return {
    content: data.content,
    stepType: data.stepType,
  };
};

export const callGenerateResponseStream = async (
  messages: ChatMessagePayload[],
  mode: GenerateResponseMode = 'default',
  onChunk: (chunk: StreamingChunk) => void,
): Promise<GenerateResponseResult> => {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('messages array is required.');
  }

  const baseUrl = resolveFunctionsBaseUrl();
  const response = await fetch(`${baseUrl}/generateResponse`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
        imageUrl: msg.imageUrl ?? null,
      })),
      mode,
      stream: true,
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => 'Unknown error');
    throw new Error(`generateResponse failed: ${response.status} ${details}`);
  }

  if (!response.body) {
    throw new Error('Response body is null');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalResult: GenerateResponseResult | null = null;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      // Process complete lines (SSE format: "data: {...}\n\n")
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6); // Remove "data: " prefix

          if (dataStr === '[DONE]') {
            continue;
          }

          try {
            const chunk = JSON.parse(dataStr) as StreamingChunk;
            onChunk(chunk);

            if (chunk.done) {
              finalResult = {
                content: chunk.content || '',
                stepType: chunk.stepType,
              };
            }

            if (chunk.error) {
              throw new Error(chunk.error);
            }
          } catch (parseError) {
            console.error('Failed to parse SSE chunk:', parseError, dataStr);
            // Continue processing other chunks
          }
        }
      }
    }

    // Process any remaining buffer
    if (buffer.trim()) {
      const lines = buffer.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6);
          if (dataStr !== '[DONE]') {
            try {
              const chunk = JSON.parse(dataStr) as StreamingChunk;
              onChunk(chunk);
              if (chunk.done) {
                finalResult = {
                  content: chunk.content || '',
                  stepType: chunk.stepType,
                };
              }
            } catch (parseError) {
              console.error('Failed to parse final SSE chunk:', parseError);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Streaming error:', error);
    throw error;
  } finally {
    reader.releaseLock();
  }

  if (!finalResult) {
    throw new Error('Stream completed without final result');
  }

  return finalResult;
};
