import { stripCodeFences } from '../agents/extractor';

/**
 * Phase 26 (§2.3–§2.4, vision `04` §3.2 Step 9 amendment synthesis + §4
 * amendment mode; `07` §3 patched-page preservation): the structured-patch
 * SCHEMA, the deterministic VALIDATOR, and the deterministic APPLIER for the
 * Amendment Writer's output.
 *
 * The Amendment Writer (src/agents/amendment.ts) reads an existing
 * synthesized page plus ONLY the new evidence and emits strict JSON —
 * `{ "operations": [...] }` — over a SMALL, CLOSED operation vocabulary:
 *
 *   - `add-evidence`   — append rendered item lines under a NAMED EXISTING
 *                        section (`## Mentions`, `## Claims`, a composite
 *                        `### <Member Title>` group, a comparison
 *                        `## Table: ...` section).
 *   - `add-section`    — a new dated/typed section, inserted before
 *                        `## Sources`.
 *   - `add-member`     — (composite pages) a new member group; the member
 *                        must already be covered by the composite's current
 *                        page data (Step 6b routing), never invented here.
 *   - `edit-prose`     — replace ONE bounded existing prose span; the old
 *                        text must appear verbatim and UNIQUELY.
 *   - `flag-contradiction` — insert a marked blockquote quoting BOTH sides
 *                        verbatim with their citations; the older claim is
 *                        never deleted.
 *
 * There is deliberately NO delete-evidence and NO rewrite-page operation —
 * the amendment cannot remove preserved content (phase doc §2.3). Anything
 * outside the vocabulary is a schema violation; a failed patch re-enters the
 * standard reask loop and on exhaustion falls back to normal full synthesis
 * (the universal fallback) — the on-disk page is touched only by a validated
 * merged result (never half-patched).
 */

// ---------------------------------------------------------------------------
// The operation vocabulary (closed)
// ---------------------------------------------------------------------------

export interface AddEvidenceOperation {
  op: 'add-evidence';
  /**
   * The EXACT heading of an existing section. Two forms:
   * `## Mentions` (a level-2 section) or `## Mentions > ### <Member Title>`
   * (a composite member group — the parent section, then the member). A
   * heading that appears more than once must be qualified.
   */
  section: string;
  /** Rendered item lines to append (markdown list lines, citation markers included). */
  items: string[];
}

export interface AddSectionOperation {
  op: 'add-section';
  /** The new section heading (e.g. `## Developments 2026` or `Developments 2026`). */
  heading: string;
  /** The section body (prose in the output language, items verbatim with citations). */
  body: string;
}

export interface PatchMemberSection {
  /** The parent `##` section the group lands under (e.g. `Mentions`). */
  section: string;
  /** The group's item lines. */
  items: string[];
}

export interface AddMemberOperation {
  op: 'add-member';
  member: { slug: string; title: string };
  /** The member's evidence groups, one per parent section. */
  sections: PatchMemberSection[];
}

export interface EditProseOperation {
  op: 'edit-prose';
  /** The exact existing span to replace — must appear verbatim and UNIQUELY. */
  oldText: string;
  newText: string;
}

export interface FlagContradictionOperation {
  op: 'flag-contradiction';
  /** The existing section the flag block lands in (exact heading). */
  section: string;
  /** The older claim text, verbatim — it must already be on the page. */
  olderClaim: string;
  /** The older claim's citation marker (e.g. `[^src1]`). */
  olderCitation: string;
  /** The newer (contradicting) claim text, verbatim. */
  newerClaim: string;
  /** The newer claim's citation marker. */
  newerCitation: string;
}

export type PatchOperation =
  | AddEvidenceOperation
  | AddSectionOperation
  | AddMemberOperation
  | EditProseOperation
  | FlagContradictionOperation;

export interface Patch {
  operations: PatchOperation[];
}

/** The page kinds a patch can target (mirrors the synthesis stages). */
export type PatchPageKind = 'entity' | 'topic' | 'composite' | 'comparison';

export interface PatchValidationContext {
  /** The page content the patch applies to (frontmatter + body). */
  pageContent: string;
  pageKind: PatchPageKind;
  /**
   * For composite pages: the members the composite's CURRENT page data covers
   * (post Step 6b routing). `add-member` may only name one of these — a
   * member for a source the Phase 25 record does not cover never reaches the
   * composite and must go through Step 6b first (gate 26.7).
   */
  members?: Array<{ slug: string; title: string }>;
}

// ---------------------------------------------------------------------------
// Parse (fence-tolerant strict JSON)
// ---------------------------------------------------------------------------

/**
 * Parse the raw Amendment Writer output into a Patch. Fence-tolerant (the
 * `parseDecisionList` pattern); exact error strings feed the reask.
 */
export function parsePatch(rawText: string): { patch?: Patch; errors: string[] } {
  const candidate = stripCodeFences(rawText);
  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate) as unknown;
  } catch (err) {
    return { errors: [`output is not valid JSON (${(err as Error).message})`] };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { errors: ['output must be a single JSON object of the shape { "operations": [...] }'] };
  }
  const raw = parsed as Record<string, unknown>;
  if (!Array.isArray(raw.operations)) {
    return { errors: ['output must be a single JSON object of the shape { "operations": [...] }'] };
  }
  return { patch: { operations: raw.operations as PatchOperation[] }, errors: [] };
}

// ---------------------------------------------------------------------------
// Heading utilities (the anchor machinery)
// ---------------------------------------------------------------------------

interface Heading {
  level: number;
  /** The heading text without the leading #'s, trimmed. */
  text: string;
  /** 0-based line index. */
  line: number;
}

const HEADING_PATTERN = /^(#{1,6})\s+(.*)$/;

/** Every ATX heading in the page, in order (frontmatter delimiters never match). */
function headingsOf(content: string): Heading[] {
  const headings: Heading[] = [];
  const lines = content.split('\n');
  for (let index = 0; index < lines.length; index++) {
    const match = HEADING_PATTERN.exec(lines[index]);
    if (match !== null) {
      headings.push({ level: match[1].length, text: match[2].trim(), line: index });
    }
  }
  return headings;
}

/** Strip one leading heading marker from an anchor part (`## X`/`### X` → `X`). */
function anchorPartText(part: string): string {
  const match = /^(#{1,6})\s+(.*)$/.exec(part.trim());
  return (match !== null ? match[2] : part).trim();
}

interface ResolvedAnchor {
  /** The insertion scope: [headingLine, endLine) — insert before endLine. */
  startLine: number;
  endLine: number;
}

/**
 * Resolve one anchor spec against the page. `spec` is either
 * `<Section>` (a level-2 section) or `<Section> > <Member>` (a level-3
 * member group inside the section). Returns named errors when the heading is
 * unknown or ambiguous.
 */
function resolveAnchor(content: string, spec: string): { anchor?: ResolvedAnchor; errors: string[] } {
  const parts = spec.split('>').map((part) => anchorPartText(part));
  if (parts.some((part) => part.length === 0)) {
    return { errors: [`anchor "${spec}" is malformed — use "## Section" or "## Section > ### Member"`] };
  }
  const headings = headingsOf(content);
  const lines = content.split('\n');
  const scopeEnd = (fromLine: number, level: number): number => {
    for (let index = fromLine + 1; index < lines.length; index++) {
      const match = HEADING_PATTERN.exec(lines[index]);
      if (match !== null && match[1].length <= level) {
        return index;
      }
    }
    return lines.length;
  };

  if (parts.length === 1) {
    const matches = headings.filter((heading) => heading.level === 2 && heading.text === parts[0]);
    if (matches.length === 0) {
      return { errors: [`anchor "${spec}": no section with this exact heading exists on the page`] };
    }
    if (matches.length > 1) {
      return {
        errors: [
          `anchor "${spec}": the heading appears ${matches.length} times — qualify it as "## Parent > ### Member"`,
        ],
      };
    }
    const start = matches[0].line;
    return { anchor: { startLine: start, endLine: scopeEnd(start, 2) }, errors: [] };
  }

  if (parts.length > 2) {
    return { errors: [`anchor "${spec}" is malformed — use "## Section" or "## Section > ### Member"`] };
  }
  const parents = headings.filter((heading) => heading.level === 2 && heading.text === parts[0]);
  if (parents.length === 0) {
    return { errors: [`anchor "${spec}": no section with this exact heading exists on the page`] };
  }
  if (parents.length > 1) {
    return {
      errors: [`anchor "${spec}": the parent heading appears ${parents.length} times`],
    };
  }
  const parentStart = parents[0].line;
  const parentEnd = scopeEnd(parentStart, 2);
  const members = headings.filter(
    (heading) => heading.level === 3 && heading.text === parts[1] && heading.line > parentStart && heading.line < parentEnd,
  );
  if (members.length === 0) {
    return {
      errors: [
        `anchor "${spec}": no member group with this exact heading exists inside "## ${parts[0]}"`,
      ],
    };
  }
  if (members.length > 1) {
    return {
      errors: [`anchor "${spec}": the member heading appears ${members.length} times inside "## ${parts[0]}"`],
    };
  }
  const start = members[0].line;
  return { anchor: { startLine: start, endLine: scopeEnd(start, 3) }, errors: [] };
}

/**
 * Insert a block of lines at the END of a resolved anchor's scope: after the
 * last non-blank line of the group, separated by exactly one blank line.
 */
function insertBlockAtAnchor(content: string, anchor: ResolvedAnchor, block: string[]): string {
  const lines = content.split('\n');
  let insertAt = anchor.endLine;
  while (insertAt > anchor.startLine + 1 && lines[insertAt - 1].trim() === '') {
    insertAt -= 1;
  }
  const before = lines.slice(0, insertAt);
  const after = lines.slice(insertAt);
  const needsLeadingBlank = before.length === 0 || before[before.length - 1].trim() !== '';
  const merged = [...before, ...(needsLeadingBlank ? [''] : []), ...block, ...after];
  return merged.join('\n');
}

/** Sections whose content is deterministically re-imposed after the patch. */
const DETERMINISTIC_SECTIONS = new Set(['Sources']);

// ---------------------------------------------------------------------------
// Validate (closed vocabulary + anchors, exact named errors)
// ---------------------------------------------------------------------------

/**
 * Deterministically validate a parsed patch against the page it will apply
 * to. Every error string is EXACT and feeds the reask correction block
 * verbatim (phase doc §2.4): unknown/duplicate anchor, edit-prose old-text
 * not found/not unique, add-member coverage/duplication, and the closed
 * vocabulary itself.
 */
export function validatePatch(patch: Patch, ctx: PatchValidationContext): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const content = ctx.pageContent;

  const isNonEmptyString = (value: unknown): value is string =>
    typeof value === 'string' && value.trim().length > 0;

  patch.operations.forEach((operation, index) => {
    const label = `operations[${index}]`;
    if (typeof operation !== 'object' || operation === null || Array.isArray(operation)) {
      errors.push(`${label}: must be an object`);
      return;
    }
    const op = (operation as { op?: unknown }).op;
    if (typeof op !== 'string') {
      errors.push(`${label}: missing "op" (allowed: add-evidence, add-section, add-member, edit-prose, flag-contradiction)`);
      return;
    }
    if (op === 'add-evidence') {
      const entry = operation as Partial<AddEvidenceOperation>;
      if (!isNonEmptyString(entry.section)) {
        errors.push(`${label} (add-evidence): "section" must be a non-empty string`);
        return;
      }
      if (!Array.isArray(entry.items) || entry.items.length === 0 || !entry.items.every(isNonEmptyString)) {
        errors.push(`${label} (add-evidence): "items" must be a non-empty list of non-empty strings`);
        return;
      }
      if (DETERMINISTIC_SECTIONS.has(anchorPartText(entry.section.split('>')[0]))) {
        errors.push(
          `${label} (add-evidence): "## Sources" is rebuilt deterministically — anchor the items in a content section instead`,
        );
        return;
      }
      const resolved = resolveAnchor(content, entry.section);
      errors.push(...resolved.errors.map((error) => `${label} (add-evidence) ${error}`));
      return;
    }
    if (op === 'add-section') {
      const entry = operation as Partial<AddSectionOperation>;
      if (!isNonEmptyString(entry.heading)) {
        errors.push(`${label} (add-section): "heading" must be a non-empty string`);
        return;
      }
      if (typeof entry.body !== 'string' || entry.body.trim().length === 0) {
        errors.push(`${label} (add-section): "body" must be a non-empty string`);
        return;
      }
      const headingText = anchorPartText(entry.heading);
      if (headingsOf(content).some((heading) => heading.text === headingText)) {
        errors.push(`${label} (add-section): a heading "${headingText}" already exists on the page`);
      }
      if (DETERMINISTIC_SECTIONS.has(headingText)) {
        errors.push(
          `${label} (add-section): "## Sources" is rebuilt deterministically — never add it as a section`,
        );
      }
      return;
    }
    if (op === 'add-member') {
      const entry = operation as Partial<AddMemberOperation>;
      if (ctx.pageKind !== 'composite') {
        errors.push(`${label} (add-member): add-member is only valid on composite pages`);
        return;
      }
      const member = entry.member as { slug?: unknown; title?: unknown } | undefined;
      if (
        typeof member !== 'object' ||
        member === null ||
        !isNonEmptyString(member.slug) ||
        !isNonEmptyString(member.title)
      ) {
        errors.push(`${label} (add-member): "member" must be { "slug", "title" } with non-empty strings`);
        return;
      }
      const covered = (ctx.members ?? []).some((candidate) => candidate.slug === member.slug);
      if (!covered) {
        errors.push(
          `${label} (add-member): member "${member.slug}" is not covered by the composite's current members — the source must route through materialize (Step 6b) first`,
        );
      }
      const alreadyOnPage =
        content.includes(`\`${member.slug}\``) ||
        headingsOf(content).some((heading) => heading.level === 3 && heading.text === member.title);
      if (alreadyOnPage) {
        errors.push(`${label} (add-member): member "${member.slug}" is already on the page`);
      }
      if (!Array.isArray(entry.sections) || entry.sections.length === 0) {
        errors.push(`${label} (add-member): "sections" must be a non-empty list of { "section", "items" }`);
        return;
      }
      for (const group of entry.sections) {
        const groupEntry = group as Partial<PatchMemberSection>;
        if (!isNonEmptyString(groupEntry.section)) {
          errors.push(`${label} (add-member): each member section needs a non-empty "section"`);
          continue;
        }
        if (!Array.isArray(groupEntry.items) || groupEntry.items.length === 0 || !groupEntry.items.every(isNonEmptyString)) {
          errors.push(`${label} (add-member): section "${groupEntry.section}" needs a non-empty "items" list`);
        }
      }
      return;
    }
    if (op === 'edit-prose') {
      const entry = operation as Partial<EditProseOperation>;
      if (!isNonEmptyString(entry.oldText) || typeof entry.newText !== 'string') {
        errors.push(`${label} (edit-prose): "oldText" and "newText" must be non-empty strings`);
        return;
      }
      const occurrences = content.split(entry.oldText).length - 1;
      if (occurrences === 0) {
        errors.push(`${label} (edit-prose): oldText is not found on the page — quote the exact existing span`);
      } else if (occurrences > 1) {
        errors.push(
          `${label} (edit-prose): oldText matches ${occurrences} places on the page — it must be unique (widen the span)`,
        );
      }
      return;
    }
    if (op === 'flag-contradiction') {
      const entry = operation as Partial<FlagContradictionOperation>;
      if (
        !isNonEmptyString(entry.section) ||
        !isNonEmptyString(entry.olderClaim) ||
        !isNonEmptyString(entry.olderCitation) ||
        !isNonEmptyString(entry.newerClaim) ||
        !isNonEmptyString(entry.newerCitation)
      ) {
        errors.push(
          `${label} (flag-contradiction): "section", "olderClaim", "olderCitation", "newerClaim", "newerCitation" must all be non-empty strings`,
        );
        return;
      }
      if (!content.includes(entry.olderClaim)) {
        errors.push(
          `${label} (flag-contradiction): the older claim text is not on the page — quote the existing claim verbatim`,
        );
      }
      if (DETERMINISTIC_SECTIONS.has(anchorPartText(entry.section.split('>')[0]))) {
        errors.push(
          `${label} (flag-contradiction): "## Sources" is rebuilt deterministically — flag inside a content section`,
        );
        return;
      }
      const resolved = resolveAnchor(content, entry.section);
      errors.push(...resolved.errors.map((error) => `${label} (flag-contradiction) ${error}`));
      return;
    }
    errors.push(
      `${label}: unknown operation "${op}" (allowed: add-evidence, add-section, add-member, edit-prose, flag-contradiction)`,
    );
  });

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Apply (deterministic, order-stable — never writes to disk)
// ---------------------------------------------------------------------------

/** Find the `## Sources` heading line, or the end of the page when absent. */
function sourcesInsertLine(content: string): number {
  const lines = content.split('\n');
  for (let index = 0; index < lines.length; index++) {
    const match = HEADING_PATTERN.exec(lines[index]);
    if (match !== null && match[1].length === 2 && match[2].trim() === 'Sources') {
      return index;
    }
  }
  return lines.length;
}

function normalizeSectionHeading(heading: string): string {
  const trimmed = heading.trim();
  return trimmed.startsWith('#') ? trimmed : `## ${trimmed}`;
}

/**
 * Deterministically apply a validated patch to the page content, in array
 * order (order-stable; each operation sees the output of the previous one).
 * Pure: returns the merged markdown, never touches disk. A mid-application
 * anchor failure (a later op anchored into a region an earlier op altered)
 * throws a named error — the caller's validator feeds it back as a reask.
 */
export function applyPatch(pageContent: string, patch: Patch): string {
  let content = pageContent;
  for (let index = 0; index < patch.operations.length; index++) {
    const operation = patch.operations[index];
    const label = `operations[${index}]`;
    const op = (operation as { op?: unknown }).op;
    if (op === 'add-evidence') {
      const entry = operation as AddEvidenceOperation;
      const resolved = resolveAnchor(content, entry.section);
      if (resolved.anchor === undefined) {
        throw new Error(
          `${label} (add-evidence) anchor "${entry.section}": no longer resolves after the preceding operations`,
        );
      }
      content = insertBlockAtAnchor(content, resolved.anchor, entry.items.map((item) => item.trimEnd()));
      continue;
    }
    if (op === 'add-section') {
      const entry = operation as AddSectionOperation;
      const heading = normalizeSectionHeading(entry.heading);
      if (headingsOf(content).some((candidate) => candidate.text === anchorPartText(heading))) {
        throw new Error(`${label} (add-section): a heading "${anchorPartText(heading)}" already exists`);
      }
      const lines = content.split('\n');
      const insertAt = sourcesInsertLine(content);
      const before = lines.slice(0, insertAt);
      const after = lines.slice(insertAt);
      while (before.length > 0 && before[before.length - 1].trim() === '') {
        before.pop();
      }
      content = [...before, '', heading, '', entry.body.trim(), '', ...after].join('\n');
      continue;
    }
    if (op === 'add-member') {
      const entry = operation as AddMemberOperation;
      content = applyAddMember(content, entry, label);
      continue;
    }
    if (op === 'edit-prose') {
      const entry = operation as EditProseOperation;
      const occurrences = content.split(entry.oldText).length - 1;
      if (occurrences !== 1) {
        throw new Error(
          `${label} (edit-prose): oldText matches ${occurrences} place(s) after the preceding operations — it must be unique`,
        );
      }
      content = content.replace(entry.oldText, entry.newText);
      continue;
    }
    if (op === 'flag-contradiction') {
      const entry = operation as FlagContradictionOperation;
      const resolved = resolveAnchor(content, entry.section);
      if (resolved.anchor === undefined) {
        throw new Error(
          `${label} (flag-contradiction) anchor "${entry.section}": no longer resolves after the preceding operations`,
        );
      }
      const block = [
        '> [!contradiction] Contradiction flagged between sources',
        `> **Older claim:** "${entry.olderClaim}" ${entry.olderCitation}`,
        `> **Newer claim:** "${entry.newerClaim}" ${entry.newerCitation}`,
        '> (Both claims are preserved verbatim above; the contradiction is unresolved pending further evidence.)',
      ];
      content = insertBlockAtAnchor(content, resolved.anchor, block);
      continue;
    }
    throw new Error(`${label}: unknown operation "${String(op)}"`);
  }
  return content;
}

/** Apply add-member: the Members list line + the per-section member groups. */
function applyAddMember(content: string, entry: AddMemberOperation, label: string): string {
  const { slug, title } = entry.member;
  if (content.includes(`\`${slug}\``)) {
    throw new Error(`${label} (add-member): member "${slug}" is already on the page`);
  }
  let working = content;

  // 1. The `## Members` list line.
  const membersAnchor = resolveAnchor(working, '## Members');
  if (membersAnchor.anchor === undefined) {
    throw new Error(`${label} (add-member): the page has no "## Members" section to extend`);
  }
  working = insertBlockAtAnchor(working, membersAnchor.anchor, [`- **${title}** (\`${slug}\`)`]);

  // 2. Each evidence group under its parent section — creating the parent
  //    section before `## Sources` when the page does not carry it yet.
  for (const group of entry.sections) {
    const parentText = anchorPartText(group.section.split('>')[0]);
    const existing = headingsOf(working).some(
      (heading) => heading.level === 2 && heading.text === parentText && !DETERMINISTIC_SECTIONS.has(heading.text),
    );
    const block = [`### ${title}`, '', ...group.items.map((item) => item.trimEnd())];
    if (existing) {
      const resolved = resolveAnchor(working, `## ${parentText}`);
      if (resolved.anchor === undefined) {
        throw new Error(`${label} (add-member): section "## ${parentText}" no longer resolves`);
      }
      working = insertBlockAtAnchor(working, resolved.anchor, block);
    } else {
      const lines = working.split('\n');
      const insertAt = sourcesInsertLine(working);
      const before = lines.slice(0, insertAt);
      const after = lines.slice(insertAt);
      while (before.length > 0 && before[before.length - 1].trim() === '') {
        before.pop();
      }
      working = [...before, '', `## ${parentText}`, '', ...block, '', ...after].join('\n');
    }
  }
  return working;
}
