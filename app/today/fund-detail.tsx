import type { CSSProperties } from "react";
import { formatShortDate } from "@/lib/prep/dates";
import { formatEstimate } from "@/lib/prep/format";
import { toNoteParts } from "@/lib/prep/notes";
import type { FundGroup, SlackLink, SubTask } from "@/lib/prep/types";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function dateRange(start: string | null, due: string | null): string {
  if (!due) return "";
  if (!start || start === due) return `due ${formatShortDate(due)}`;
  return `${formatShortDate(start)} → ${formatShortDate(due)}`;
}

function SlackChip(props: { icon: string; label: string; missingLabel: string; link: SlackLink | null; className: string }) {
  const { icon, label, missingLabel, link, className } = props;
  if (!link) return <span className="chip chip-off">{icon} {missingLabel}</span>;
  return (
    <a className={`chip ${className}`} href={link.url} target="_blank" rel="noreferrer">
      {icon} {label}{link.isThread ? " (thread)" : ""} ↗
    </a>
  );
}

function Files({ fund }: { fund: FundGroup }) {
  const hidden = fund.hiddenImageCount;
  if (fund.files.length === 0 && hidden === 0) {
    return (
      <div className="chips">
        <span className="chip chip-off">No attachments</span>
      </div>
    );
  }
  return (
    <div className="chips">
      {fund.files.map((f) => (
        <a key={f.url} className="chip chip-file" href={f.url} target="_blank" rel="noreferrer">
          📎 {f.title} ↗
        </a>
      ))}
      {hidden > 0 && <span className="images-hidden">({plural(hidden, "image")} hidden)</span>}
    </div>
  );
}

function SubTaskRow({ sub }: { sub: SubTask }) {
  const estimate = formatEstimate(sub.estimateMs);
  return (
    <li className="subtask">
      <a className="subtask-name" href={sub.url} target="_blank" rel="noreferrer" title={sub.name}>
        {sub.shortName} ↗
      </a>
      {sub.status && (
        <span className="status-pill" style={{ "--status": sub.status.color } as CSSProperties}>
          {sub.status.label}
        </span>
      )}
      {sub.priority && (
        <span className="priority" style={{ color: sub.priority.color }}>
          ⚑ {sub.priority.label}
        </span>
      )}
      {estimate && <span className="estimate">⏱ {estimate}</span>}
      <span className="dates">{dateRange(sub.startDate, sub.dueDate)}</span>
    </li>
  );
}

function Notes({ notes }: { notes: string }) {
  return (
    <p className="notes">
      {toNoteParts(notes).map((part, i) =>
        "url" in part ? (
          <a key={i} href={part.url} target="_blank" rel="noreferrer">{part.label}</a>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </p>
  );
}

export function FundDetail({ fund }: { fund: FundGroup }) {
  const subline = [fund.client, fund.listName].filter(Boolean).join(" · ");
  return (
    <article className="detail">
      <header>
        <h2 className="detail-title">
          <a href={fund.url} target="_blank" rel="noreferrer">{fund.name} ↗</a>
        </h2>
        {subline && <p className="detail-sub">{subline}</p>}
      </header>
      {fund.loadError && <p className="detail-error">Couldn&apos;t load details</p>}
      {!fund.loadError && fund.facts.length > 0 && (
        <dl className="facts">
          {fund.facts.map((f) => (
            <div className="fact" key={f.label}>
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
      )}
      <h3 className="section-label">Your sub-tasks</h3>
      <ul className="subtask-list">
        {fund.subtasks.map((s) => (
          <SubTaskRow key={s.id} sub={s} />
        ))}
      </ul>
      {!fund.loadError && (
        <>
          <h3 className="section-label">Channels</h3>
          <div className="chips">
            <SlackChip icon="💬" label="CS channel" missingLabel="No CS channel" link={fund.slack.cs} className="chip-cs" />
            <SlackChip icon="🧪" label="Testing channel" missingLabel="No testing channel" link={fund.slack.testing} className="chip-test" />
          </div>
          <h3 className="section-label">Files</h3>
          <Files fund={fund} />
          {fund.notes && (
            <>
              <h3 className="section-label">Notes</h3>
              <Notes notes={fund.notes} />
            </>
          )}
        </>
      )}
    </article>
  );
}
