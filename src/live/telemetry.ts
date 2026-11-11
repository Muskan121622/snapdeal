// Dev-only telemetry: reports call events to a local sink (tools/voice-monitor.mjs)
// so the conversation can be watched from the terminal. Never sends the API key.
const enabled = import.meta.env.DEV;

export function logEvent(type: string, payload: Record<string, unknown> = {}): void {
  if (!enabled) return;
  try {
    const host =
      typeof window !== 'undefined' && window.location.hostname
        ? window.location.hostname
        : 'localhost';
    void fetch(`http://${host}:5174/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ type, ...payload }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Best-effort only; telemetry must never break the live call.
  }
}