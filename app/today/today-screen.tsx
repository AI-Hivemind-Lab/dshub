import type { DayViewResult } from "@/lib/hub/day-view";
import { addDays, formatLongDate, formatShortDate } from "@/lib/prep/dates";
import type { DayView, FundGroup, SlackLink } from "@/lib/prep/types";

export interface TodayScreenProps {
  date: string;
  today: string;
  notice: string | null;
  result: DayViewResult | null;
  unmappedEmail: string | null;
  nowMs: number;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function updatedLabel(fetchedAt: number, nowMs: number): string {
  const minutes = Math.floor((nowMs - fetchedAt) / 60_000);
  return minutes < 1 ? "updated just now" : `updated ${minutes} min ago`;
}

function dateRange(start: string | null, due: string | null): string {
  if (!due) return "";
  if (!start || start === due) return `due ${formatShortDate(due)}`;
  return `${formatShortDate(start)} → ${formatShortDate(due)}`;
}

function DateNav({ date, today }: { date: string; today: string }) {
  return (
    <nav className="date-nav">
      <a href={`/today?date=${addDays(date, -1)}`} aria-label="Previous day">◀</a>
      <strong>{formatLongDate(date)}</strong>
      {date === today && <span className="today-tag">today</span>}
      <a href={`/today?date=${addDays(date, 1)}`} aria-label="Next day">▶</a>
      <form method="get" action="/today" className="date-form">
        <input type="date" name="date" defaultValue={date} aria-label="Pick a date" />
        <button type="submit">Go</button>
      </form>
      <a href={`/today?date=${date}&refresh=1`} className="refresh">⟳ Refresh</a>
    </nav>
  );
}

function SlackItem({ icon, label, link }: { icon: string; label: string; link: SlackLink | null }) {
  if (!link) return <span className="missing">{icon} {label}: not found</span>;
  return (
    <a href={link.url} target="_blank" rel="noreferrer">
      {icon} {label}{link.isThread ? " (thread)" : ""} ↗
    </a>
  );
}

function Files({ group }: { group: FundGroup }) {
  const hidden = group.hiddenImageCount;
  const hiddenLabel = hidden > 0 ? `(${plural(hidden, "image")} hidden)` : "";
  if (group.files.length === 0 && hidden === 0) return <p className="files">📎 No attachments</p>;
  return (
    <p className="files">
      📎{" "}
      {group.files.map((f, i) => (
        <span key={f.url}>
          {i > 0 && " · "}
          <a href={f.url} target="_blank" rel="noreferrer">{f.title}</a>
        </span>
      ))}
      {hiddenLabel && ` ${hiddenLabel}`}
    </p>
  );
}

function FundCard({ group }: { group: FundGroup }) {
  return (
    <section className="card">
      <h2>
        <a href={group.url} target="_blank" rel="noreferrer">{group.name} ↗</a>
      </h2>
      {group.loadError && <p className="card-error">Couldn&apos;t load details</p>}
      <ul className="subtasks">
        {group.subtasks.map((s) => (
          <li key={s.id}>
            <a href={s.url} target="_blank" rel="noreferrer">{s.name}</a>{" "}
            <span className="dates">{dateRange(s.startDate, s.dueDate)}</span>
          </li>
        ))}
      </ul>
      {!group.loadError && (
        <>
          <p className="slack">
            <SlackItem icon="💬" label="CS channel" link={group.slack.cs} />
            <SlackItem icon="🧪" label="Testing channel" link={group.slack.testing} />
          </p>
          <Files group={group} />
        </>
      )}
    </section>
  );
}

function DayBody({ view }: { view: DayView }) {
  if (view.groups.length === 0) {
    return <p className="empty">Nothing in flight for this date. Only open tasks are shown.</p>;
  }
  return (
    <>
      <p className="summary">
        {plural(view.subtaskCount, "sub-task")} · {plural(view.groups.length, "fund task")}
      </p>
      {view.groups.map((g) => (
        <FundCard key={g.parentId} group={g} />
      ))}
    </>
  );
}

export function TodayScreen({ date, today, notice, result, unmappedEmail, nowMs }: TodayScreenProps) {
  return (
    <>
      <DateNav date={date} today={today} />
      {result?.view && (
        <p className="updated">
          {updatedLabel(result.fetchedAt, nowMs)}
          {result.stale ? " · stale" : ""}
        </p>
      )}
      {notice && <p className="banner notice">{notice}</p>}
      {unmappedEmail && (
        <p className="banner error">
          Your Google account ({unmappedEmail}) isn&apos;t linked to a ClickUp member.
        </p>
      )}
      {result?.error && <p className="banner error">{result.error}</p>}
      {result?.view && <DayBody view={result.view} />}
    </>
  );
}
