import matter from 'gray-matter';
import { combinedAliases } from '../utils/aliases';
import { formatWikilink } from '../utils/wikilinks';

/**
 * Phase 23 (phase doc §2.2, backlog B21 — comparison-table articles; canon:
 * vision `05` §9 custom page types, `03` §3.1 extended with `comparisons/`,
 * `02` §3 two-layer pages, `06` §1-§3): the COMPARISON page kind. One article
 * per comparison-table SUBJECT — the entity the table is ABOUT — holding
 * every source's table as its own dated section, preserved verbatim as that
 * source printed it (`01` Principle 3 — compounding). Cross-PDF structural
 * drift (changed columns, added years, renamed rows, renumbered captions) is
 * EMBRACED, never force-merged: identity holds via the canonical subject
 * slug (a renamed/renumbered table reconciles onto ONE page through the
 * entity's canonical identity), the normalized-title slug is only the
 * fallback when the subject is not a known entity.
 *
 * The extractor RECONSTRUCTS the printed table into markdown (pdfjs destroys
 * table geometry): the markdown STRUCTURE is the extractor's, the VALUES are
 * the PDF's — row-value preservation (every row's subject + its numbers) is
 * the check in `validation/preservation-check.ts` (gate 23.5), not
 * byte-substring.
 *
 * `type: comparison` pages carry the complete deterministic frontmatter
 * (title, type, aliases union over every distinct table caption, wiki, real
 * `updated`, aggregated `sources`), one dated `## Table: <source>, p. <page>`
 * section per source table, per-table entity links, the deterministic
 * `## Related comparisons in prose` bridge (claims sharing the table's
 * entities, linking out to the topic/entity pages where free-text
 * comparisons already live — honest empty form when none exist), and
 * basename `## Sources`. The `sparse` flag NEVER applies (a comparison page
 * is rich by construction — it exists only because a full table exists).
 */

export interface ComparisonTableSection {
  /** Workspace-relative source PDF path (forward slashes). */
  source: string;
  /** Chunk page range of the extraction that produced the table (e.g. "16-20"). */
  pages: string;
  /** The PDF page the table starts on (the extractor's `page`). */
  page: number;
  /** The table's own caption as that source printed it. */
  tableTitle: string;
  /** What the rows compare (free-text; '' when the extractor recorded none). */
  rowDimension: string;
  /** What the columns show (free-text; '' when the extractor recorded none). */
  colDimension: string;
  /** Canonical entity slugs appearing in the table (post-curation remap). */
  entities: string[];
  /** The extractor-reconstructed markdown table — structure the extractor's, VALUES the PDF's. */
  markdown: string;
  /** One-sentence statement of what the table compares ('' when none recorded). */
  summary: string;
}

/**
 * One `## Related comparisons in prose` entry (phase doc §2.3, gate 23.6b):
 * a claim from the corpus sharing at least one of the table's entities,
 * linking out to the LIVE topic page (claim.type) and the shared entity
 * pages where the free-text comparison already lives.
 */
export interface ComparisonBridgeEntry {
  /** The claim text, verbatim from extraction. */
  text: string;
  /** The claim's type — the live topic page's slug. */
  topicSlug: string;
  /** The claim's entities that intersect the table's entities. */
  entities: string[];
  source: string;
  pages: string;
}

export interface ComparisonPageData {
  /** Subject display title (the entity's name when resolvable, else the table caption). */
  title: string;
  /** Canonical subject-entity slug when resolvable; slugify(table title) fallback. */
  slug: string;
  /** Always 'comparisons' (the arc's ratified top-level folder, `03` §3.1 extended). */
  folder: string;
  wiki: string;
  /** The identity key: the canonical subject slug when resolvable, else the title slug. */
  subject: string;
  /** One dated section per source table, ordered by source then page. */
  tables: ComparisonTableSection[];
  /** The deterministic prose bridge (claims sharing the table's entities). */
  bridge: ComparisonBridgeEntry[];
  slugToTitle: Record<string, string>;
  /** Distinct table captions seen across sources (drift aliases — old titles find the page). */
  aliases?: string[];
}

function sourceKey(file: string, pages: string): string {
  return `${file}|${pages}`;
}

function sourceFileName(file: string): string {
  return file.split('/').pop() ?? file;
}

function escapeYamlString(value: string): string {
  if (/[:#{}[\],&*!?|>'"%@`\n\r]/.test(value) || /^\s|\s$/.test(value)) {
    return JSON.stringify(value);
  }
  return value;
}

function stripCitations(text: string): string {
  return text.replace(/\[\^src\d+\]/g, '').trim();
}

/** `revenue-recognition` → `Revenue Recognition` (the topic-title house rule). */
function titleCaseSlug(slug: string): string {
  return slug
    .split('-')
    .map((word) => (word.length > 0 ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ');
}

/**
 * The page's citation map (phase doc §2.2/§2.3): one `srcN` per distinct
 * source + page reference — table sections cite their source at the table's
 * own page (`file|<page>`), bridge claims cite the claim's chunk range
 * (`file|<pages>`) exactly like the entity page; tables first (section
 * order), then bridge entries. Shared by the writer, the row-value
 * preservation check, and the synthesis `citationMap` slot so the three can
 * never drift apart (the `buildCompositeCitationMap` precedent).
 */
export function buildComparisonCitationMap(
  data: Pick<ComparisonPageData, 'tables' | 'bridge'>,
): { citationMap: Map<string, number>; keys: string[] } {
  const citationMap = new Map<string, number>();
  const keys: string[] = [];
  const assignKey = (file: string, pages: string): void => {
    const key = sourceKey(file, pages);
    if (citationMap.has(key)) {
      return;
    }
    const index = citationMap.size + 1;
    citationMap.set(key, index);
    keys.push(`src${index}`);
  };
  for (const table of data.tables) {
    assignKey(table.source, String(table.page));
  }
  for (const entry of data.bridge) {
    assignKey(entry.source, entry.pages);
  }
  return { citationMap, keys };
}

/**
 * Aggregate the frontmatter `sources` list: one entry per source file with
 * the unique page references (table pages + bridge chunk ranges) joined
 * (sorted) — covering every citation the page can carry (vision `06` §3).
 */
function buildComparisonFrontmatterSources(
  data: Pick<ComparisonPageData, 'tables' | 'bridge'>,
): Array<{ file: string; pages: string }> {
  const sourceRanges = new Map<string, Set<string>>();
  const add = (file: string, pages: string): void => {
    const set = sourceRanges.get(file) ?? new Set<string>();
    set.add(pages);
    sourceRanges.set(file, set);
  };
  for (const table of data.tables) {
    add(table.source, String(table.page));
  }
  for (const entry of data.bridge) {
    add(entry.source, entry.pages);
  }
  return Array.from(sourceRanges.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([file, pagesSet]) => ({
      file,
      pages: Array.from(pagesSet).sort((x, y) => x.localeCompare(y)).join(', '),
    }));
}

/**
 * The complete deterministic comparison-page frontmatter (vision `05` §2 +
 * phase doc §2.2), shared by `writeComparisonPage` and the
 * `enforceComparisonFrontmatterInMarkdown` re-imposition: title,
 * `type: comparison`, the aliases union (page title + every distinct table
 * caption), wiki, real `updated`, the full aggregated sources, and the
 * `comparison` tag — in this field order. `sparse` is NEVER emitted.
 */
function buildComparisonFrontmatter(data: ComparisonPageData, updated: string): Record<string, unknown> {
  const aliases = combinedAliases(data.title, data.slug, data.aliases);
  return {
    title: escapeYamlString(data.title),
    type: 'comparison',
    ...(aliases ? { aliases } : {}),
    wiki: data.wiki,
    updated,
    sources: buildComparisonFrontmatterSources(data),
    tags: ['comparison'],
  };
}

/**
 * Entity link rendering inside a comparison page (phase doc §2.2 "per-table
 * entity links"): a KNOWN slug renders the Obsidian pipe form; an unknown
 * slug (the warn-but-pass class — the table may mention an unextracted name)
 * renders as plain text, never a broken `[[slug]]`. The page's OWN SUBJECT
 * renders as plain title text (the composite fellow-member precedent — the
 * subject IS this page; a link to it would resolve back here and add noise).
 */
function comparisonEntityLink(slug: string, slugToTitle: Record<string, string>, ownSlug: string): string {
  if (slug === ownSlug) {
    return slugToTitle[slug] ?? slug;
  }
  const title = slugToTitle[slug];
  if (title === undefined) {
    return slug;
  }
  return formatWikilink(slug, title);
}

/**
 * The deterministic `## Related comparisons in prose` bridge lines (gate
 * 23.6b), shared by the writer and the enforcer: one line per claim sharing
 * the table's entities — the claim text verbatim, a link to the LIVE topic
 * page (claim.type), and links to the shared entity pages — or the honest
 * empty form when no prose claim references the table's subjects.
 */
function buildComparisonBridgeLines(data: ComparisonPageData): string[] {
  if (data.bridge.length === 0) {
    return ['- No prose claims in the corpus reference this comparison\'s subjects yet.'];
  }
  const { citationMap } = buildComparisonCitationMap(data);
  return data.bridge.map((entry) => {
    const index = citationMap.get(sourceKey(entry.source, entry.pages));
    if (index === undefined) {
      throw new Error(`Citation map missing entry for ${entry.source} pages ${entry.pages}.`);
    }
    const topicLink = formatWikilink(entry.topicSlug, titleCaseSlug(entry.topicSlug));
    const entityLinks = entry.entities.map((slug) => comparisonEntityLink(slug, data.slugToTitle, data.slug));
    return `- "${stripCitations(entry.text)}" — see ${topicLink} (${entityLinks.join(', ')}) [^src${index}]`;
  });
}

/**
 * Render a comparison page as a markdown string with YAML frontmatter (phase
 * doc §2.2 — the deterministic shell): one dated `## Table: <source>,
 * p. <page>` section per source table with the table markdown preserved
 * verbatim as that source printed it, per-table entity links, the
 * deterministic `## Related comparisons in prose` bridge, and `## Sources`
 * in basename form. Citation numbering is the `buildComparisonCitationMap`
 * order.
 */
export function writeComparisonPage(data: ComparisonPageData): string {
  const updated = new Date().toISOString();
  const { citationMap } = buildComparisonCitationMap(data);
  const getCitation = (file: string, pages: string): string => {
    const index = citationMap.get(sourceKey(file, pages));
    if (index === undefined) {
      throw new Error(`Citation map missing entry for ${file} pages ${pages}.`);
    }
    return `[^src${index}]`;
  };

  const lines: string[] = [];

  for (const table of data.tables) {
    lines.push(`## Table: ${sourceFileName(table.source)}, p. ${table.page}`, '');
    if (table.rowDimension !== '' || table.colDimension !== '') {
      lines.push(
        `Rows compare: ${table.rowDimension !== '' ? table.rowDimension : '(not recorded)'} · Columns show: ${table.colDimension !== '' ? table.colDimension : '(not recorded)'}`,
        '',
      );
    }
    lines.push(table.markdown, '');
    if (table.entities.length > 0) {
      lines.push(`Entities: ${table.entities.map((slug) => comparisonEntityLink(slug, data.slugToTitle, data.slug)).join(', ')}`, '');
    }
    lines.push(`Summary: ${table.summary !== '' ? table.summary : '(not recorded)'} ${getCitation(table.source, String(table.page))}`, '');
  }

  // The deterministic prose bridge (gate 23.6b).
  lines.push('## Related comparisons in prose', '');
  lines.push(...buildComparisonBridgeLines(data), '');

  // Sources (basename form — the citation checker resolves these).
  const definitionEntries = Array.from(citationMap.entries())
    .map(([key, index]) => ({ key, index }))
    .sort((a, b) => a.index - b.index);
  if (definitionEntries.length > 0) {
    lines.push('## Sources', '');
    for (const { key, index } of definitionEntries) {
      const [file, pages] = key.split('|');
      lines.push(`[^src${index}]: ${sourceFileName(file)}, pages ${pages}`);
    }
    lines.push('');
  }

  const body = `\n${lines.join('\n')}\n`;
  return matter.stringify(body, buildComparisonFrontmatter(data, updated));
}

/**
 * Phase 23 (the Phase 17 `enforceFrontmatterInMarkdown` precedent):
 * deterministic frontmatter re-imposition over a synthesized (LLM-written)
 * comparison page — the COMPLETE frontmatter built from the page data
 * (title, `type: comparison`, aliases union, wiki, real `updated`,
 * aggregated sources, tag) written OVER the model's frontmatter, CREATED
 * when the model omitted the block entirely. The body is preserved
 * byte-for-byte; a page with unparseable model frontmatter is returned
 * unchanged (the schema validator already flags it).
 */
export function enforceComparisonFrontmatterInMarkdown(markdown: string, pageData: ComparisonPageData): string {
  let body = markdown;
  if (/^---[ \t]*\r?\n/.test(markdown)) {
    let parsed: matter.GrayMatterFile<string>;
    try {
      parsed = matter(markdown);
    } catch {
      return markdown;
    }
    body = parsed.content;
  }
  return matter.stringify(body, buildComparisonFrontmatter(pageData, new Date().toISOString()));
}

/**
 * Phase 23 (the Phase 17 `## Sources` enforcer precedent, applied to the
 * deterministic bridge): re-impose the `## Related comparisons in prose`
 * section over a synthesized page — the bridge is deterministic ground truth
 * (exactly the claims sharing the table's entities, computed from the
 * aggregate), so the model's rendering of it is never trusted. An existing
 * section is replaced up to the next `##` heading; a missing one is inserted
 * before `## Sources` (or appended at the end). Every other byte of the
 * model's page is preserved.
 */
export function enforceComparisonBridgeInMarkdown(markdown: string, pageData: ComparisonPageData): string {
  const section = ['## Related comparisons in prose', '', ...buildComparisonBridgeLines(pageData), ''].join('\n');
  const lines = markdown.split('\n');
  const start = lines.findIndex((line) => /^## Related comparisons in prose[ \t\r]*$/.test(line));
  if (start === -1) {
    const sourcesIndex = lines.findIndex((line) => /^## Sources[ \t\r]*$/.test(line));
    if (sourcesIndex !== -1) {
      return [...lines.slice(0, sourcesIndex), section, ...lines.slice(sourcesIndex)].join('\n');
    }
    const base = markdown.endsWith('\n') ? markdown.slice(0, -1) : markdown;
    return `${base}\n\n${section}`;
  }
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index++) {
    if (/^## /.test(lines[index])) {
      end = index;
      break;
    }
  }
  return [...lines.slice(0, start), section, ...lines.slice(end)].join('\n');
}

/**
 * One parsed data row of a markdown comparison table: the row subject (the
 * first cell — the row's compared subject) and the row's distinct numeric
 * values in cell order (the PDF's own numbers — `12.876`, `79,2`, `78,6` and
 * `79,8` from a CI range, `0`). This is the ROW-VALUE vocabulary of gate
 * 23.5: the markdown structure is the extractor's reconstruction, so
 * preservation is checked on these values, never byte-substring.
 */
export interface ComparisonRowValues {
  subject: string;
  numbers: string[];
}

const NUMBER_PATTERN = /\d+(?:[.,]\d+)*/g;

/**
 * Parse an extractor-reconstructed markdown table into its data rows' key
 * values (gate 23.5). The first `|` line is the header; a `|---|` separator
 * line is skipped; every later `|` line is a data row. A table with no data
 * rows yields no values (nothing to check).
 */
export function comparisonRowValues(markdown: string): ComparisonRowValues[] {
  const tableLines = markdown
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|'));
  if (tableLines.length === 0) {
    return [];
  }
  const dataLines = tableLines.slice(1).filter((line) => !/^\|[\s:|-]+\|?$/.test(line) || !line.includes('-'));
  const rows: ComparisonRowValues[] = [];
  for (const line of dataLines) {
    const cells = line
      .split('|')
      .slice(1, line.endsWith('|') ? -1 : undefined)
      .map((cell) => cell.trim());
    if (cells.length === 0 || cells.every((cell) => cell === '')) {
      continue;
    }
    const subject = cells[0];
    const numbers = new Set<string>();
    for (const cell of cells) {
      for (const match of cell.matchAll(NUMBER_PATTERN)) {
        numbers.add(match[0]);
      }
    }
    rows.push({ subject, numbers: Array.from(numbers) });
  }
  return rows;
}
