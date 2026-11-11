import { useEffect, useRef } from 'react';
import type { TranscriptEntry } from '../live/useLiveSession';

export function Transcript({ entries }: { entries: TranscriptEntry[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [entries]);
  return (
    <div className="panel transcript-panel">
      <div className="panel-title">Live transcript</div>
      <div className="transcript" ref={ref}>
        {entries.length === 0 && <div className="empty">The conversation will appear here.</div>}
        {entries.map((e) => (
          <div key={e.id} className={`bubble ${e.role}`}>
            <span className="who">{e.role === 'seller' ? 'Seller' : 'Virtual KAM'}</span>
            <span className="say">{e.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}