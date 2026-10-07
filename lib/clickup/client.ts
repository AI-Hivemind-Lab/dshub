import type { ClickUpMember, ClickUpTask } from "./types";

const BASE_URL = "https://api.clickup.com/api/v2";
const MAX_PAGES = 20;
const PAGE_SIZE = 100;
const REQUEST_TIMEOUT_MS = 10_000;

export class ClickUpError extends Error {
  constructor(
    public status: number,
    public endpoint: string,
    message: string,
  ) {
    super(message);
    this.name = "ClickUpError";
  }
}

export interface ClickUpClient {
  listMembers(): Promise<ClickUpMember[]>;
  listUserTasks(userId: number): Promise<ClickUpTask[]>;
  getTask(id: string): Promise<ClickUpTask>;
}

export interface ClickUpClientOptions {
  token: string;
  teamId: string;
  spaceId: string;
  fetchFn?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

const clamp = (ms: number) => Math.min(10_000, Math.max(0, ms));

export function retryDelayMs(headers: Headers, nowMs: number): number {
  const retryAfter = Number(headers.get("retry-after"));
  if (headers.has("retry-after") && !Number.isNaN(retryAfter)) return clamp(retryAfter * 1000);
  const reset = Number(headers.get("x-ratelimit-reset"));
  if (headers.has("x-ratelimit-reset") && !Number.isNaN(reset)) return clamp(reset * 1000 - nowMs);
  return 1000;
}

function logError(endpoint: string, status: number, ms: number): void {
  console.error(JSON.stringify({ msg: "clickup_error", endpoint, status, ms }));
}

export function createClickUpClient(opts: ClickUpClientOptions): ClickUpClient {
  const fetchFn = opts.fetchFn ?? fetch;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = opts.now ?? Date.now;

  async function request<T>(endpoint: string, retried = false): Promise<T> {
    const started = now();
    let res: Response;
    try {
      res = await fetchFn(BASE_URL + endpoint, {
        headers: { Authorization: opts.token },
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      logError(endpoint, 0, now() - started);
      throw new ClickUpError(0, endpoint, `Network error: ${(err as Error).message}`);
    }
    if (res.status === 429 && !retried) {
      await sleep(retryDelayMs(res.headers, now()));
      return request<T>(endpoint, true);
    }
    if (!res.ok) {
      logError(endpoint, res.status, now() - started);
      throw new ClickUpError(res.status, endpoint, `ClickUp ${res.status} on ${endpoint}`);
    }
    try {
      return (await res.json()) as T;
    } catch {
      logError(endpoint, res.status, now() - started);
      throw new ClickUpError(res.status, endpoint, `Invalid JSON from ClickUp on ${endpoint}`);
    }
  }

  return {
    async listMembers() {
      type TeamsResponse = {
        teams: { id: string; members: { user: ClickUpMember }[] }[];
      };
      const data = await request<TeamsResponse>("/team");
      const team = data.teams.find((t) => String(t.id) === opts.teamId);
      if (!team) {
        logError("/team", 404, 0);
        throw new ClickUpError(404, "/team", `Team ${opts.teamId} not found for this token`);
      }
      return team.members.map(({ user }) => ({ id: user.id, username: user.username, email: user.email }));
    },

    async listUserTasks(userId) {
      const all: ClickUpTask[] = [];
      for (let page = 0; page < MAX_PAGES; page++) {
        const qs = new URLSearchParams({ page: String(page), subtasks: "true", include_closed: "false" });
        qs.append("assignees[]", String(userId));
        qs.append("space_ids[]", opts.spaceId);
        const data = await request<{ tasks: ClickUpTask[]; last_page?: boolean }>(
          `/team/${opts.teamId}/task?${qs}`,
        );
        all.push(...data.tasks);
        if (data.last_page ?? data.tasks.length < PAGE_SIZE) break;
      }
      return all;
    },

    async getTask(id) {
      return request<ClickUpTask>(`/task/${encodeURIComponent(id)}?include_markdown_description=true`);
    },
  };
}
