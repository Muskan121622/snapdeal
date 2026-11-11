import { useState } from 'react';
import { useLiveSession } from './live/useLiveSession';
import { getSeller, listAvailableSellers, defaultSellerId } from './data/seller';
import { VoiceOrb } from './components/VoiceOrb';
import { Transcript } from './components/Transcript';
import { InvestigationPanel } from './components/InvestigationPanel';
import { RecoveryCard } from './components/RecoveryCard';
import { KeyGate } from './components/KeyGate';
import { ArchitectureModal } from './components/ArchitectureModal';

const KEY_STORAGE = 'sd_gemini_key';

export default function App() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(KEY_STORAGE) ?? '');
  const [selectedSellerId, setSelectedSellerId] = useState(defaultSellerId);
  const [showArch, setShowArch] = useState(false);
  const live = useLiveSession();
  const currentSeller = getSeller(selectedSellerId);
  const availableSellers = listAvailableSellers();

  if (!apiKey) {
    return (
      <>
        <KeyGate
          onSave={(k) => {
            localStorage.setItem(KEY_STORAGE, k);
            setApiKey(k);
          }}
          onOpenArch={() => setShowArch(true)}
        />
        <ArchitectureModal isOpen={showArch} onClose={() => setShowArch(false)} />
      </>
    );
  }

  const canStart = live.status === 'idle' || live.status === 'ended' || live.status === 'error';
  const inCall = live.status === 'live' || live.status === 'connecting';

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">SellerOS</span>
          <span className="tagline">AI Virtual Key Account Manager · Snapdeal</span>
        </div>
        <div className="topbar-actions">
          <button className="btn-arch" onClick={() => setShowArch(true)}>
            ⚡ Architecture & Rubric
          </button>
          <select
            className="seller-select"
            value={selectedSellerId}
            disabled={inCall}
            onChange={(e) => setSelectedSellerId(e.target.value)}
            title="Switch active seller account context"
          >
            {availableSellers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.category})
              </option>
            ))}
          </select>
          <div className="seller-chip">
            <span className="seller-name">{currentSeller.name}</span>
            <span className="seller-id">{currentSeller.id} · {currentSeller.tier} Tier</span>
          </div>
        </div>
      </header>

      {live.error && <div className="error-banner">{live.error}</div>}

      <main className="layout">
        <section className="col-left">
          <div className="panel call-panel">
            <VoiceOrb status={live.status} speaking={live.speaking} />
            <div className="call-controls">
              {canStart && (
                <button className="btn primary" onClick={() => void live.connect(apiKey, selectedSellerId)}>
                  Start call
                </button>
              )}
              {inCall && (
                <button className="btn danger" onClick={live.disconnect}>
                  End call
                </button>
              )}
              <button
                className="btn ghost"
                onClick={() => {
                  localStorage.removeItem(KEY_STORAGE);
                  setApiKey('');
                }}
              >
                Change key
              </button>
            </div>
            <p className="hint">Speak naturally — the KAM listens, investigates and replies by voice. You can interrupt it.</p>
          </div>
          <Transcript entries={live.transcript} />
        </section>

        <section className="col-right">
          <InvestigationPanel activity={live.activity} tasks={live.tasks} />
          <RecoveryCard plan={live.recovery} />
        </section>
      </main>

      <ArchitectureModal isOpen={showArch} onClose={() => setShowArch(false)} />
    </div>
  );
}