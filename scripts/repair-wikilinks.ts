/**
 * Phase 20 (B20, phase doc §2.3): one-time wikilink-repair remediation over
 * every wiki in a workspace's wikis root.
 *
 * Usage:
 *
 *   npx tsx scripts/repair-wikilinks.ts [wikisRoot] [--dry]
 *
 * - `wikisRoot` defaults to `dist/wikis` (the live workspace the broken-link
 *   evidence came from). Every non-hidden DIRECTORY directly inside it is
 *   treated as a wiki; files at the root (e.g. `index-of-indexes.md`) are
 *   skipped.
 * - For each wiki, every entity/topic content page is repaired via
 *   `repairWikilinksInWiki` (unique-prefix / unique-alias rules only — never
 *   a guess), changed pages are rewritten, and `.state/ingestion.json`
 *   `pageHashes` is re-converged for every modified page so the next ingest
 *   sees tool-written content (no B19-class false "manual edit" flags).
 * - `--dry` prints the exact same per-wiki report without writing a byte.
 *
 * The repair semantics live in `src/utils/wikilink-repair.ts` and share the
 * link checker's slug universe (`src/validation/link-checker.ts`) — this
 * script is argument parsing, the root walk, and report printing only.
 */
import { readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { formatWikiRepairReport, repairWikilinksInWiki } from '../src/utils/wikilink-repair';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const positional = args.filter((arg) => arg !== '--dry');
  const wikisRoot = resolve(positional[0] ?? join('dist', 'wikis'));

  const entries = await readdir(wikisRoot, { withFileTypes: true });
  const wikiSlugs = entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort();

  if (wikiSlugs.length === 0) {
    console.log(`No wikis found under ${wikisRoot}`);
    return;
  }

  console.log(`Wikilink repair remediation over ${wikisRoot}${dry ? ' (DRY RUN)' : ''}`);
  let repaired = 0;
  let unrepairable = 0;
  let modified = 0;
  let unchanged = 0;
  for (const wikiSlug of wikiSlugs) {
    const report = await repairWikilinksInWiki(join(wikisRoot, wikiSlug), wikiSlug, { dry });
    console.log(formatWikiRepairReport(report));
    repaired += report.repaired.length;
    unrepairable += report.unrepairable.length;
    modified += report.modifiedPages.length;
    unchanged += report.unchangedPages;
  }
  console.log(
    `Total: ${repaired} repaired, ${unrepairable} unrepairable, ` +
      `${modified} page(s) ${dry ? 'would be modified' : 'modified'}, ${unchanged} unchanged ` +
      `across ${wikiSlugs.length} wiki(s).`,
  );
  if (dry) {
    console.log('Dry run — no files written.');
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
