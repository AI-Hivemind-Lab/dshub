import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClickUpError, createClickUpClient, retryDelayMs } from "./client";
import { fund1, subFormSupport, subUi } from "./test-fixtures";

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

function setup(...responses: Array<Response | Error>) {
  const fetchFn = vi.fn(async () => {
    const next = responses.shift();
    if (!next) throw new Error("unexpected fetch");
    if (next instanceof Error) throw next;
    return next;
  });
  const sleep = vi.fn(async () => {});
  const client = createClickUpClient({
    token: "pk_test", teamId: "T1", spaceId: "S1",
    fetchFn: fetchFn as unknown as typeof fetch, sleep, now: () => 1_000_000,
  });
  return { client, fetchFn, sleep };
}

beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

describe("listUserTasks", () => {
  it("sends the right query and paginates", async () => {
    const { client, fetchFn } = setup(
      json({ tasks: [subFormSupport], last_page: false }),
      json({ tasks: [subUi], last_page: true }),
    );
    const tasks = await client.listUserTasks(42);
    expect(tasks.map((t) => t.id)).toEqual(["sub1", "sub3"]);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("https://api.clickup.com/api/v2/team/T1/task?");
    expect(url).toContain("page=0");
    expect(url).toContain("subtasks=true");
    expect(url).toContain("include_closed=false");
    expect(url).toContain("assignees%5B%5D=42");
    expect(url).toContain("space_ids%5B%5D=S1");
    expect((init.headers as Record<string, string>).Authorization).toBe("pk_test");
    expect((fetchFn.mock.calls[1] as unknown as [string])[0]).toContain("page=1");
  });

  it("stops on a short page when last_page is absent", async () => {
    const { client, fetchFn } = setup(json({ tasks: [subFormSupport] }));
    await client.listUserTasks(42);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});

describe("getTask", () => {
  it("requests the markdown description", async () => {
    const { client, fetchFn } = setup(json(fund1));
    const task = await client.getTask("fund1");
    expect(task.name).toBe("Fortress Lending Fund V (Unlevered)");
    expect((fetchFn.mock.calls[0] as unknown as [string])[0]).toBe(
      "https://api.clickup.com/api/v2/task/fund1?include_markdown_description=true",
    );
  });
});

describe("listMembers", () => {
  it("returns members of the configured team", async () => {
    const { client } = setup(
      json({
        teams: [
          { id: "T0", members: [{ user: { id: 1, username: "other", email: "o@x.com" } }] },
          { id: "T1", members: [{ user: { id: 42, username: "Toai", email: "toainguyen@anduintransact.com" } }] },
        ],
      }),
    );
    expect(await client.listMembers()).toEqual([
      { id: 42, username: "Toai", email: "toainguyen@anduintransact.com" },
    ]);
  });

  it("throws if the team is missing", async () => {
    const { client } = setup(json({ teams: [] }));
    await expect(client.listMembers()).rejects.toMatchObject({ status: 404 });
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("clickup_error"));
  });
});

describe("errors and retries", () => {
  it("retries once after a 429", async () => {
    const { client, sleep } = setup(json({}, 429, { "retry-after": "2" }), json(fund1));
    expect((await client.getTask("fund1")).id).toBe("fund1");
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it("fails after a second 429", async () => {
    const { client } = setup(json({}, 429), json({}, 429));
    await expect(client.getTask("fund1")).rejects.toMatchObject({ status: 429 });
  });

  it("wraps HTTP errors", async () => {
    const { client } = setup(json({ err: "nope" }, 401));
    const err = await client.getTask("fund1").catch((e) => e);
    expect(err).toBeInstanceOf(ClickUpError);
    expect(err.status).toBe(401);
    expect(err.endpoint).toBe("/task/fund1?include_markdown_description=true");
  });

  it("passes an abort signal so requests time out", async () => {
    const { client, fetchFn } = setup(json(fund1));
    await client.getTask("fund1");
    const [, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("wraps a non-JSON 200 response as a ClickUpError", async () => {
    const { client } = setup(
      new Response("<html>proxy error</html>", { status: 200, headers: { "content-type": "text/html" } }),
    );
    const err = await client.getTask("fund1").catch((e) => e);
    expect(err).toBeInstanceOf(ClickUpError);
    expect(err.status).toBe(200);
    expect(err.message).toContain("Invalid JSON");
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("clickup_error"));
  });

  it("wraps network errors as status 0", async () => {
    const { client } = setup(new Error("ECONNRESET"));
    await expect(client.getTask("fund1")).rejects.toMatchObject({ status: 0 });
  });
});

describe("retryDelayMs", () => {
  it("prefers Retry-After, then X-RateLimit-Reset, then 1s, clamped to 10s", () => {
    expect(retryDelayMs(new Headers({ "retry-after": "3" }), 0)).toBe(3000);
    expect(retryDelayMs(new Headers({ "x-ratelimit-reset": "1005" }), 1_000_000)).toBe(5000);
    expect(retryDelayMs(new Headers(), 0)).toBe(1000);
    expect(retryDelayMs(new Headers({ "retry-after": "60" }), 0)).toBe(10000);
    expect(retryDelayMs(new Headers({ "x-ratelimit-reset": "1" }), 1_000_000)).toBe(0);
  });
});
