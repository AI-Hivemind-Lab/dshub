"use client";

import { useState, type ReactNode } from "react";
import type { DayViewResult } from "@/lib/hub/day-view";
import { pickSelectedFund, withFundParam } from "@/lib/hub/fund-param";
import { addDays, formatLongDate } from "@/lib/prep/dates";
import { groupByUrgency } from "@/lib/prep/urgency";
import { FundBrowser } from "./fund-browser";

export interface TodayScreenProps {
  date: string;
  today: string;
  notice: string | null;
  result: DayViewResult | null;
  unmappedEmail: string | null;
  nowMs: number;
  initialFundId: string | null;
  userArea: ReactNode;
}

function updatedLabel(fetchedAt: number, nowMs: number): string {
  const minutes = Math.floor((nowMs - fetchedAt) / 60_000);
  return minutes < 1 ? "updated just now" : `updated ${minutes} min ago`;
}

function DateNav({ date, today, fundId }: { date: string; today: string; fundId: string | null }) {
  const link = (d: string, extra = "") => withFundParam(`/today?date=${d}${extra}`, fundId);
  return (
    <nav className="date-nav" aria-label="Date">
      <a href={link(addDays(date, -1))} aria-label="Previous day">◀</a>
      <strong>{formatLongDate(date)}</strong>
      <a href={link(addDays(date, 1))} aria-label="Next day">▶</a>
      {date === today ? (
        <span className="today-chip">today</span>
      ) : (
        <a className="today-link" href={link(today)}>Jump to today</a>
      )}
      <form method="get" action="/today" className="date-form">
        <input type="date" name="date" defaultValue={date} aria-label="Pick a date" />
        {fundId && <input type="hidden" name="fund" value={fundId} readOnly />}
        <button type="submit">Go</button>
      </form>
      <a className="refresh" href={link(date, "&refresh=1")}>⟳ Refresh</a>
    </nav>
  );
}

export function TodayScreen(props: TodayScreenProps) {
  const { date, today, notice, result, unmappedEmail, nowMs, initialFundId, userArea } = props;
  const groups = result?.view ? groupByUrgency(result.view.groups, date) : [];
  const [selectedId, setSelectedId] = useState<string | null>(() => pickSelectedFund(groups, initialFundId));

  function handleSelect(id: string) {
    setSelectedId(id);
    const url = new URL(window.location.href);
    url.searchParams.delete("refresh");
    window.history.replaceState(null, "", withFundParam(`${url.pathname}${url.search}`, id));
  }

  return (
    <>
      <header className="topbar">
        <span className="brand">Team Hub</span>
        <DateNav date={date} today={today} fundId={selectedId} />
        {result?.view && (
          <span className="updated">
            {updatedLabel(result.fetchedAt, nowMs)}
            {result.stale ? " · stale" : ""}
          </span>
        )}
        {userArea}
      </header>
      {notice && <p className="banner banner-notice">{notice}</p>}
      {unmappedEmail && (
        <p className="banner banner-error">
          Your Google account ({unmappedEmail}) isn&apos;t linked to a ClickUp member.
        </p>
      )}
      {result?.error && <p className="banner banner-error">{result.error}</p>}
      {result?.view &&
        (groups.length === 0 ? (
          <div className="empty-state">
            <p>Nothing in flight for this date. Only open tasks are shown.</p>
          </div>
        ) : (
          <FundBrowser groups={groups} selectedId={selectedId} onSelect={handleSelect} />
        ))}
    </>
  );
}
