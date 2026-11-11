import type { CallStatus } from '../live/useLiveSession';

export function VoiceOrb({ status, speaking }: { status: CallStatus; speaking: boolean }) {
  const state =
    status === 'live' ? (speaking ? 'speaking' : 'listening') : status;
  const label: Record<string, string> = {
    idle: 'Ready to call',
    connecting: 'Connecting…',
    listening: 'Listening…',
    speaking: 'Speaking…',
    ended: 'Call ended',
    error: 'Connection error',
  };
  return (
    <div className={`orb-wrap orb-${state}`}>
      <div className="orb">
        <div className="orb-core" />
        <div className="orb-ring r1" />
        <div className="orb-ring r2" />
      </div>
      <div className="orb-label">{label[state] ?? state}</div>
    </div>
  );
}