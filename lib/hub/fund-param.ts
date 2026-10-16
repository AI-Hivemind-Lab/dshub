import type { UrgencyGroup } from "@/lib/prep/types";

/** Returns `pathname + search` of `href` with `fund` set (or removed when null); other params are kept. */
export function withFundParam(href: string, fundId: string | null): string {
  const url = new URL(href, "http://localhost");
  if (fundId) url.searchParams.set("fund", fundId);
  else url.searchParams.delete("fund");
  return `${url.pathname}${url.search}`;
}

/** URL to write after selecting a fund: current path + params, minus a sticky `refresh`, with `fund` set. */
export function selectionHref(currentHref: string, fundId: string): string {
  const url = new URL(currentHref, "http://localhost");
  url.searchParams.delete("refresh");
  return withFundParam(`${url.pathname}${url.search}`, fundId);
}

/** The requested fund if it is listed, otherwise the first fund in list order. */
export function pickSelectedFund(groups: UrgencyGroup[], requested: string | null | undefined): string | null {
  const funds = groups.flatMap((g) => g.funds);
  if (requested && funds.some((f) => f.parentId === requested)) return requested;
  return funds[0]?.parentId ?? null;
}
