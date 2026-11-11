import type { RecoveryPlan } from '../agent/tools';

export function RecoveryCard({ plan }: { plan: RecoveryPlan | null }) {
  if (!plan) {
    return (
      <div className="panel">
        <div className="panel-title">Seller Growth Action Plan</div>
        <div className="empty">Generated at the end of the call.</div>
      </div>
    );
  }
  return (
    <div className="panel recovery">
      <div className="panel-title">
        Seller Growth Action Plan
        <span className="health">{plan.businessHealth}</span>
      </div>
      <p className="recovery-headline">{plan.headline}</p>
      <div className="actions">
        {plan.actions.map((a) => (
          <div key={a.title} className="action">
            <span className={`priority ${a.priority.toLowerCase()}`}>{a.priority}</span>
            <div className="action-body">
              <div className="action-title">{a.title}</div>
              <div className="action-detail">{a.detail}</div>
              <div className="action-reason">{a.reason}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="panel-title sub">Next steps</div>
      <ul className="next-steps">
        {plan.nextSteps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
    </div>
  );
}