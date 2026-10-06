import type { TtlCache } from "@/lib/cache/ttl-cache";
import type { ClickUpClient } from "@/lib/clickup/client";
import type { ClickUpMember } from "@/lib/clickup/types";

const KEY = "members";

export function createMemberResolver(
  client: Pick<ClickUpClient, "listMembers">,
  cache: TtlCache<ClickUpMember[]>,
): (email: string) => Promise<ClickUpMember | null> {
  return async (email) => {
    let members = cache.get(KEY);
    if (!members) {
      members = await client.listMembers();
      cache.set(KEY, members);
    }
    const target = email.toLowerCase();
    return members.find((m) => m.email?.toLowerCase() === target) ?? null;
  };
}
