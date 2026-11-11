import { useCallback, useRef, useState } from 'react';
import { GoogleGenAI, Modality, type LiveServerMessage, type Session, type FunctionCall } from '@google/genai';
import { systemPrompt } from '../agent/systemPrompt';
import { toolDeclarations, executeTool, type RecoveryPlan, type MockTask, type ToolEffect } from '../agent/tools';
import { initConversation, resetConversationState } from '../agent/conversationState';
import { getSeller, defaultSellerId } from '../data/seller';
import { startMicCapture, AudioPlayer } from './audio';
import { logEvent } from './telemetry';

export type CallStatus = 'idle' | 'connecting' | 'live' | 'ended' | 'error';

export interface TranscriptEntry {
  id: number;
  role: 'seller' | 'kam';
  text: string;
}

export interface ActivityEntry {
  id: number;
  tool: string;
  label: string;
  status: 'running' | 'done';
}

const MODEL = 'gemini-3.8-live';

export function useLiveSession() {
  const [status, setStatus] = useState<CallStatus>('idle');
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [recovery, setRecovery] = useState<RecoveryPlan | null>(null);
  const [tasks, setTasks] = useState<MockTask[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);

  const sessionRef = useRef<Session | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);
  const micStopRef = useRef<(() => void) | null>(null);
  const idRef = useRef(0);
  const inputEntryRef = useRef<number | null>(null);
  const outputEntryRef = useRef<number | null>(null);
  const turnLogRef = useRef<{ seller: string; kam: string }>({ seller: '', kam: '' });
  const audioLoggedRef = useRef(false);

  const appendTranscript = useCallback((role: 'seller' | 'kam', text: string) => {
    const ref = role === 'seller' ? inputEntryRef : outputEntryRef;
    if (ref.current === null) {
      const id = ++idRef.current;
      ref.current = id;
      setTranscript((prev) => [...prev, { id, role, text }]);
    } else {
      const id = ref.current;
      setTranscript((prev) => prev.map((e) => (e.id === id ? { ...e, text: e.text + text } : e)));
    }
  }, []);

  const applyEffect = useCallback((effect: ToolEffect) => {
    if (effect.kind === 'recovery') setRecovery(effect.plan);
    else setTasks((prev) => [...prev, effect.task]);
  }, []);

  const processTools = useCallback(
    (calls: FunctionCall[]) => {
      const responses = calls.map((fc) => {
        const name = fc.name ?? '';
        logEvent('tool-call', { name, args: fc.args ?? {} });
        const aid = ++idRef.current;

        // Show running indicator
        setActivity((prev) => [...prev, { id: aid, tool: name, label: `Executing ${name}...`, status: 'running' }]);

        try {
          const result = executeTool(name, fc.args ?? {});
          logEvent('tool-response', { name, response: result.response });

          // Update once finished
          setActivity((prev) =>
            prev.map((a) => (a.id === aid ? { ...a, status: 'done', label: result.activity } : a))
          );

          if (result.effect) applyEffect(result.effect);
          return { id: fc.id, name, response: result.response };
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          setActivity((prev) =>
            prev.map((a) => (a.id === aid ? { ...a, status: 'done', label: `Failed: ${name}` } : a))
          );
          return { id: fc.id, name, response: { error: errMsg } };
        }
      });

      sessionRef.current?.sendToolResponse({ functionResponses: responses });
    },
    [applyEffect]
  );

  const handleMessage = useCallback(
    (msg: LiveServerMessage) => {
      if (msg.toolCall?.functionCalls?.length) processTools(msg.toolCall.functionCalls);
      const sc = msg.serverContent;
      if (!sc) return;
      if (sc.interrupted) {
        logEvent('interrupted', {});
        playerRef.current?.stop();
        setSpeaking(false);
        audioLoggedRef.current = false;
      }
      for (const part of sc.modelTurn?.parts ?? []) {
        if (part.inlineData?.data) {
          if (!audioLoggedRef.current) {
            logEvent('audio', { playing: true });
            audioLoggedRef.current = true;
          }
          playerRef.current?.play(part.inlineData.data);
          setSpeaking(true);
        }
      }
      if (sc.inputTranscription?.text) {
        turnLogRef.current.seller += sc.inputTranscription.text;
        appendTranscript('seller', sc.inputTranscription.text);
      }
      if (sc.outputTranscription?.text) {
        turnLogRef.current.kam += sc.outputTranscription.text;
        appendTranscript('kam', sc.outputTranscription.text);
      }
      if (sc.turnComplete) {
        logEvent('turn', { seller: turnLogRef.current.seller, kam: turnLogRef.current.kam });
        turnLogRef.current = { seller: '', kam: '' };
        audioLoggedRef.current = false;
        setSpeaking(false);
        inputEntryRef.current = null;
        outputEntryRef.current = null;
      }
    },
    [processTools, appendTranscript]
  );

  const cleanupAudio = useCallback(() => {
    micStopRef.current?.();
    micStopRef.current = null;
    playerRef.current?.close();
    playerRef.current = null;
  }, []);

  const connect = useCallback(
    async (apiKey: string, sellerId: string = defaultSellerId) => {
      setError(null);
      setStatus('connecting');
      logEvent('status', { status: 'connecting', sellerId });
      setTranscript([]);
      setActivity([]);
      setRecovery(null);
      setTasks([]);
      inputEntryRef.current = null;
      outputEntryRef.current = null;
      turnLogRef.current = { seller: '', kam: '' };
      audioLoggedRef.current = false;

      // Session & Conversation Lifecycle initialization
      const conversationId = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      initConversation(conversationId, sellerId);
      const activeSeller = getSeller(sellerId);

      playerRef.current = new AudioPlayer();
      await playerRef.current.resume();

      const ai = new GoogleGenAI({ apiKey, apiVersion: 'v1beta' });
      try {
        const session = await ai.live.connect({
          model: MODEL,
          config: {
            responseModalities: [Modality.AUDIO],
            systemInstruction: systemPrompt,
            tools: [{ functionDeclarations: toolDeclarations }],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            temperature: 0.4,
            contextWindowCompression: {
              triggerTokens: '16000',
              slidingWindow: { targetTokens: '8000' },
            },
          },
          callbacks: {
            onopen: () => {
              setStatus('live');
              logEvent('ws-open', {});
              void (async () => {
                try {
                  micStopRef.current = await startMicCapture((b64) => {
                    sessionRef.current?.sendRealtimeInput({
                      audio: { data: b64, mimeType: 'audio/pcm;rate=16000' },
                    });
                  });
                  logEvent('mic-start', {});
                } catch (e) {
                  const m =
                    'Microphone access failed: ' +
                    (e instanceof Error ? e.message : String(e)) +
                    '. Allow the mic and retry.';
                  setError(m);
                  logEvent('mic-error', { message: m });
                  return;
                }

                // Dynamic, prompt opening greeting based on the active seller context
                logEvent('prompt', {});
                sessionRef.current?.sendClientContent({
                  turns: [
                    {
                      role: 'user',
                      parts: [
                        {
                          text: `[CALL CONNECTED] The seller (${activeSeller.contactPerson || activeSeller.name} from "${activeSeller.name}", Category: ${activeSeller.category}) is on the line. Call getSellerProfile to verify their account, then immediately speak your warm greeting aloud by their name and ask how you can help them today.`,
                        },
                      ],
                    },
                  ],
                  turnComplete: true,
                });
              })();
            },
            onmessage: handleMessage,
            onerror: (e) => {
              const m = e.message || 'Live connection error';
              setError(m);
              setStatus('error');
              logEvent('ws-error', { message: m });
            },
            onclose: () => {
              cleanupAudio();
              logEvent('ws-close', {});
              setStatus((prev) => (prev === 'error' ? prev : 'ended'));
            },
          },
        });
        sessionRef.current = session;
      } catch (err) {
        cleanupAudio();
        const m = err instanceof Error ? err.message : String(err);
        setError(m);
        setStatus('error');
        logEvent('connect-error', { message: m });
      }
    },
    [handleMessage, cleanupAudio]
  );

  const disconnect = useCallback(() => {
    cleanupAudio();
    sessionRef.current?.close();
    sessionRef.current = null;
    setSpeaking(false);
    setStatus('ended');
    logEvent('status', { status: 'ended-by-user' });
  }, [cleanupAudio]);

  return { status, transcript, activity, recovery, tasks, error, speaking, connect, disconnect };
}