const SEPARATOR_START = /^[\s\-–—:]/;
const SEPARATORS = /^[\s\-–—:]+/;

/** Drops a leading copy of the parent's name (at a separator boundary) from a sub-task name. */
export function shortSubtaskName(name: string, parentName: string | null): string {
  if (!parentName || !name.startsWith(parentName)) return name;
  const rest = name.slice(parentName.length);
  if (!SEPARATOR_START.test(rest)) return name;
  const short = rest.replace(SEPARATORS, "");
  return short || name;
}
