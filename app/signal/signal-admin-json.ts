type JsonObject = Record<string, any>;

export async function readRequiredJsonPayload(response: Response): Promise<JsonObject> {
  const text = await response.text();
  if (!text.trim()) {
    throw new Error(`HTTP ${response.status}: empty response`);
  }

  try {
    const payload = JSON.parse(text) as unknown;
    if (payload && typeof payload === 'object') {
      return payload as JsonObject;
    }
    throw new Error('JSON payload must be an object');
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`HTTP ${response.status}: ${text.slice(0, 180)}`);
    }
    throw error;
  }
}
