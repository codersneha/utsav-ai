import { useState, type FormEvent } from 'react';
import { daysBetween, formatDate } from '../lib/dates';
import { tasksNeedingAttention, timelineProgress } from '../lib/timeline';
import type { CustomTask, Logistics, TaskPriority, Timeline } from '../types';

interface Props {
  timeline: Timeline;
  today: string;
  eventDate: string;
  done: Record<string, boolean>;
  onToggle: (id: string) => void;
  onAddTask: (task: Omit<CustomTask, 'id'>) => void;
  onRemoveTask: (id: string) => void;
  logistics: Logistics | null;
  logisticsLoading: boolean;
  logisticsNotice?: string;
}

function relative(days: number): string {
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days > 1) return `In ${days} days`;
  return `${Math.abs(days)} days ago`;
}

/** Task scheduler: milestones, completion, priorities, slippage alerts and the day-of plan. */
export function TimelinePanel(props: Props) {
  const { timeline, today, done } = props;
  const attention = tasksNeedingAttention(timeline, done, today);
  const progress = timelineProgress(timeline, done);

  return (
    <section aria-labelledby="timeline-heading">
      <h3 id="timeline-heading">Planning timeline</h3>
      <div className="progress-row">
        <label htmlFor="timeline-progress">Tasks done: {progress}%</label>
        <progress id="timeline-progress" max={100} value={progress}>
          {progress}%
        </progress>
      </div>

      {timeline.compressed && (
        <p className="notice">
          Your event is {timeline.leadDays} days away, sooner than the ideal planning window, so tasks have
          been compressed. Start with the High-priority ones.
        </p>
      )}
      {attention.overdue.length > 0 && (
        <div className="notice warning" role="status">
          <p>
            <strong>Needs attention:</strong> {attention.overdue.map((m) => m.task).join('; ')}{' '}
            {attention.overdue.length === 1 ? 'is' : 'are'} past due.
          </p>
          {attention.affected.length > 0 && (
            <p>These depend on it and may slip too: {attention.affected.map((m) => m.task).join('; ')}.</p>
          )}
        </div>
      )}

      <ol className="timeline">
        {timeline.milestones.map((m) => {
          const days = daysBetween(today, m.due);
          const isDone = Boolean(done[m.id]);
          const late = !isDone && m.due < today && m.daysBefore >= 0;
          return (
            <li
              key={m.id}
              className={`milestone phase-${m.phase.replace(/\s+/g, '-').toLowerCase()}${isDone ? ' done' : ''}`}
            >
              <div className="milestone-date">
                <time dateTime={m.due}>{formatDate(m.due)}</time>
                <span className={late ? 'late' : 'muted'}>{late ? 'Overdue' : relative(days)}</span>
              </div>
              <div>
                <span className="phase">{m.phase}</span>
                <span className={`badge prio-${m.priority.toLowerCase()}`}>{m.priority}</span>
                {m.custom && <span className="badge subtle">Your task</span>}
                <label className="check">
                  <input type="checkbox" checked={isDone} onChange={() => props.onToggle(m.id)} />
                  <span>{m.task}</span>
                </label>
                {m.custom && (
                  <button
                    type="button"
                    className="link-btn"
                    aria-label={`Remove task: ${m.task}`}
                    onClick={() => props.onRemoveTask(m.id)}
                  >
                    Remove
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <AddTaskForm today={today} eventDate={props.eventDate} onAdd={props.onAddTask} />

      <DaySchedule
        logistics={props.logistics}
        loading={props.logisticsLoading}
        notice={props.logisticsNotice}
      />
    </section>
  );
}

function AddTaskForm({
  today,
  eventDate,
  onAdd,
}: {
  today: string;
  eventDate: string;
  onAdd: (task: Omit<CustomTask, 'id'>) => void;
}) {
  const [task, setTask] = useState('');
  const [due, setDue] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('Medium');
  const [error, setError] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const text = task.trim();
    if (text.length < 3) return setError('Describe the task in a few words.');
    if (!due) return setError('Pick a due date.');
    setError('');
    onAdd({ task: text.slice(0, 120), due, priority });
    setTask('');
    setDue('');
  };

  return (
    <form className="card add-task" onSubmit={submit} noValidate aria-labelledby="add-task-heading">
      <h4 id="add-task-heading">Add your own task</h4>
      <div className="grid-3">
        <div className="field">
          <label htmlFor="new-task">Task</label>
          <input
            id="new-task"
            value={task}
            maxLength={120}
            aria-describedby={error ? 'new-task-error' : undefined}
            onChange={(e) => setTask(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="new-task-due">Due date</label>
          <input
            id="new-task-due"
            type="date"
            min={today}
            max={eventDate}
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="new-task-priority">Priority</label>
          <select
            id="new-task-priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
          >
            <option>High</option>
            <option>Medium</option>
            <option>Low</option>
          </select>
        </div>
      </div>
      {error && (
        <p id="new-task-error" className="field-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn">
        Add task
      </button>
    </form>
  );
}

function DaySchedule({
  logistics,
  loading,
  notice,
}: {
  logistics: Logistics | null;
  loading: boolean;
  notice?: string;
}) {
  return (
    <section className="day-schedule" aria-labelledby="day-heading" aria-busy={loading}>
      <h4 id="day-heading">Event-day schedule</h4>
      <div aria-live="polite">
        {loading && <p className="muted">Gemini is drafting your run-of-show…</p>}
        {!loading && notice && <p className="notice">{notice}</p>}
      </div>
      {logistics && !loading && (
        <>
          <p className="source-tag">
            {logistics.source === 'gemini'
              ? '✨ Drafted by Google Gemini — adjust timings with your vendors'
              : 'Sample schedule — adjust timings with your vendors'}
          </p>
          <ol className="schedule">
            {logistics.daySchedule.map((s) => (
              <li key={`${s.time}-${s.activity}`}>
                <time>{s.time}</time>
                <span>{s.activity}</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
