// Browser audio helpers: 16kHz PCM mic capture and 24kHz PCM gapless playback.

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function int16ToBase64LE(int16: Int16Array): string {
  const bytes = new Uint8Array(int16.length * 2);
  for (let i = 0; i < int16.length; i++) {
    const v = int16[i];
    bytes[i * 2] = v & 0xff;
    bytes[i * 2 + 1] = (v >> 8) & 0xff;
  }
  return bytesToBase64(bytes);
}

export async function startMicCapture(onChunk: (base64: string) => void): Promise<() => void> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
  });
  const ctx = new AudioContext({ sampleRate: 16000 });
  await ctx.audioWorklet.addModule('/audio/capture.worklet.js');
  const src = ctx.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(ctx, 'capture-processor');
  const silent = ctx.createGain();
  silent.gain.value = 0;
  node.port.onmessage = (e: MessageEvent<Int16Array>) => onChunk(int16ToBase64LE(e.data));
  src.connect(node);
  node.connect(silent);
  silent.connect(ctx.destination);

  return () => {
    node.port.onmessage = null;
    src.disconnect();
    node.disconnect();
    silent.disconnect();
    stream.getTracks().forEach((t) => t.stop());
    void ctx.close();
  };
}

export class AudioPlayer {
  private ctx: AudioContext;
  private nextTime = 0;
  private sources = new Set<AudioBufferSourceNode>();

  constructor(sampleRate = 24000) {
    this.ctx = new AudioContext({ sampleRate });
  }

  async resume(): Promise<void> {
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }

  play(base64: string): void {
    const bytes = base64ToBytes(base64);
    const int16 = new Int16Array(Math.floor(bytes.length / 2));
    for (let i = 0; i < int16.length; i++) int16[i] = bytes[i * 2] | (bytes[i * 2 + 1] << 8);
    const float = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) float[i] = int16[i] / 32768;

    const buf = this.ctx.createBuffer(1, float.length, this.ctx.sampleRate);
    buf.copyToChannel(float, 0);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.ctx.destination);
    const now = this.ctx.currentTime;
    if (this.nextTime < now) this.nextTime = now;
    src.start(this.nextTime);
    this.nextTime += buf.duration;
    this.sources.add(src);
    src.onended = () => this.sources.delete(src);
  }

  // Barge-in: drop everything currently queued so the seller can interrupt.
  stop(): void {
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    }
    this.sources.clear();
    this.nextTime = 0;
  }

  close(): void {
    this.stop();
    void this.ctx.close();
  }
}