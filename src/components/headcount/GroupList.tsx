import { Trash2 } from 'lucide-react';
import { REPLIES, turnoutChance, type GuestGroup, type Reply } from '../../lib/headcount';
import { CLOSENESS_LABELS, DISTANCE_LABELS, REPLY_LABELS } from './labels';

interface Props {
  groups: GuestGroup[];
  onReply: (id: string, reply: Reply) => void;
  onRemove: (id: string) => void;
}

/** Everyone invited, with what each family said on the phone and how many of them are likely to come. */
export function GroupList({ groups, onReply, onRemove }: Props) {
  if (groups.length === 0) {
    return <p className="muted">No guests yet. Add your first family above, or try the example.</p>;
  }
  return (
    <ul className="plain headcount-list" aria-label="Invited families and groups">
      {groups.map((g) => (
        <li key={g.id}>
          <div className="headcount-who">
            <strong>{g.name}</strong>
            <span className="muted small">
              {CLOSENESS_LABELS[g.closeness]} · {DISTANCE_LABELS[g.distance]}
            </span>
          </div>
          <p className="headcount-count">
            <strong>{g.people}</strong> invited · about{' '}
            <strong>{Math.round(g.people * turnoutChance(g))}</strong> likely
          </p>
          <div className="headcount-reply">
            <label className="sr-only" htmlFor={`reply-${g.id}`}>
              What {g.name} said
            </label>
            <select
              id={`reply-${g.id}`}
              value={g.reply}
              onChange={(e) => onReply(g.id, e.target.value as Reply)}
            >
              {REPLIES.map((r) => (
                <option key={r} value={r}>
                  {REPLY_LABELS[r]}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="icon-btn"
              aria-label={`Remove ${g.name}`}
              onClick={() => onRemove(g.id)}
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
