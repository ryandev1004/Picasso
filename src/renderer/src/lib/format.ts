// Small text helpers for labels.

/** "1 version", "3 versions" */
export function plural(count: number, word: string): string {
  return count === 1 ? `1 ${word}` : `${count} ${word}s`;
}

/** "Today · 3 versions", or just "Today" when there's only one version. */
export function withVersions(when: string, versionCount: number): string {
  return versionCount > 1
    ? `${when} · ${plural(versionCount, "version")}`
    : when;
}
