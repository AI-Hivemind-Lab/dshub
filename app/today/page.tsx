import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { ClickUpError } from "@/lib/clickup/client";
import { describeError, type DayViewResult } from "@/lib/hub/day-view";
import { getHub } from "@/lib/hub/instance";
import { isValidDate, todayLocal } from "@/lib/prep/dates";
import { TodayScreen } from "./today-screen";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ date?: string; refresh?: string }>;

export default async function TodayPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/api/auth/signin?callbackUrl=%2Ftoday");

  const params = await searchParams;
  const hub = getHub();
  const today = todayLocal(hub.config.tzOffsetMinutes);
  const requested = params.date;
  const date = isValidDate(requested) ? requested : today;
  const notice =
    requested !== undefined && !isValidDate(requested)
      ? `"${requested}" isn't a valid date, showing today instead.`
      : null;

  let result: DayViewResult | null = null;
  let unmappedEmail: string | null = null;
  try {
    const member = await hub.resolveMember(email);
    if (!member) unmappedEmail = email;
    else result = await hub.dayViews.getDayView(member.id, date, { refresh: params.refresh === "1" });
  } catch (err) {
    if (!(err instanceof ClickUpError)) console.error(JSON.stringify({ msg: "today_page_error", error: String(err) }));
    result = { view: null, fetchedAt: Date.now(), stale: false, error: describeError(err) };
  }

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <main className="page">
      <header className="topbar">
        <span className="brand">Hub</span>
        <span className="user">{session?.user?.name ?? email}</span>
        <form action={signOutAction}>
          <button type="submit" className="link-button">Sign out</button>
        </form>
      </header>
      <TodayScreen
        date={date}
        today={today}
        notice={notice}
        result={result}
        unmappedEmail={unmappedEmail}
        nowMs={Date.now()}
      />
    </main>
  );
}
