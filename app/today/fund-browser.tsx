import type { UrgencyGroup } from "@/lib/prep/types";
import { FundDetail } from "./fund-detail";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export interface FundBrowserProps {
  groups: UrgencyGroup[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function FundBrowser({ groups, selectedId, onSelect }: FundBrowserProps) {
  const selected = groups.flatMap((g) => g.funds).find((f) => f.parentId === selectedId) ?? null;
  return (
    <div className="browser">
      <nav className="fund-list" aria-label="Fund tasks">
        {groups.map((group) => (
          <section className="fund-group" key={group.key}>
            <h2 className="group-label">{group.label} · {group.funds.length}</h2>
            <ul>
              {group.funds.map((fund) => {
                const isSelected = fund.parentId === selectedId;
                return (
                  <li key={fund.parentId}>
                    <button
                      type="button"
                      className={isSelected ? "fund-item is-selected" : "fund-item"}
                      aria-current={isSelected ? "true" : undefined}
                      title={fund.name}
                      onClick={() => onSelect(fund.parentId)}
                    >
                      <span className={`urgency-dot urgency-${group.key}`} aria-hidden="true" />
                      <span className="fund-item-name">{fund.name}</span>
                      <span className="fund-item-meta">
                        {plural(fund.subtasks.length, "sub-task")}
                        {fund.topPriority && (
                          <span style={{ color: fund.topPriority.color }}> · ⚑ {fund.topPriority.label}</span>
                        )}
                        {fund.loadError && <span title="Couldn't load details"> · ⚠</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </nav>
      {selected && <FundDetail fund={selected} />}
    </div>
  );
}
