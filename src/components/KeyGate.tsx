import { useState } from 'react';

export function KeyGate({ onSave, onOpenArch }: { onSave: (key: string) => void; onOpenArch?: () => void }) {
  const [key, setKey] = useState('');
  return (
    <div className="keygate">
      <div className="keygate-card">
        <h1>SellerOS</h1>
        <p className="tag">Your autonomous AI Key Account Manager for Snapdeal sellers.</p>
        <label htmlFor="key">Gemini API key</label>
        <input
          id="key"
          type="password"
          value={key}
          placeholder="Paste your Google AI Studio key"
          onChange={(e) => setKey(e.target.value)}
        />
        <button disabled={!key.trim()} onClick={() => onSave(key.trim())}>
          Save & continue
        </button>
        {onOpenArch && (
          <button className="btn-arch-gate" onClick={onOpenArch}>
            ⚡ View System Architecture & Rubric Blueprint
          </button>
        )}
        <p className="fine">
          Stored only in this browser (localStorage) for the demo. In production, mint short-lived
          ephemeral tokens from a backend instead of exposing a key. Use Chrome and allow the microphone.
        </p>
      </div>
    </div>
  );
}