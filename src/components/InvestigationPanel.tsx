import type { ActivityEntry } from '../live/useLiveSession';
import type { MockTask } from '../agent/tools';

export function InvestigationPanel({ activity, tasks }: { activity: ActivityEntry[]; tasks: MockTask[] }) {
  return (
    <div className="panel">
      <div className="panel-title">Live investigation</div>
      <div className="activity">
        {activity.length === 0 && <div className="empty">Tool calls appear here as the KAM works.</div>}
        {activity.map((a) => (
          <div key={a.id} className={`activity-row ${a.status}`}>
            <span className="dot">{a.status === 'done' ? '✓' : '…'}</span>
            <span className="activity-label">{a.label}</span>
            <span className="activity-tool">{a.tool}</span>
          </div>
        ))}
      </div>
      {tasks.length > 0 && (
        <>
          <div className="panel-title sub">Logged actions</div>
          <div className="tasks">
            {tasks.map((t) => (
              <div key={t.id} className="task">
                <span className="task-id">{t.id}</span>
                <span className="task-title">{t.title}</span>
                <span className="task-status">{t.status}{t.when ? ` · ${t.when}` : ''}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}