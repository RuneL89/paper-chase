import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import matter from 'gray-matter';
import { extractText, getPageCount } from '../extraction/pdf';
import { renderTablesAsMarkdown } from '../extraction/markdown-tables';
import { sha256 } from '../utils/hash';
import { sourceSlugForFile } from '../utils/slug';
import { aliasesForTitle, enforceAliasesInMarkdown } from '../utils/aliases';
import { buildSlugUniverse } from '../validation/link-checker';
import { repairWikilinksInMarkdown } from '../utils/wikilink-repair';
import {
  buildCitationMap,
  enforceFrontmatterInMarkdown,
  enforceSourcesSectionInMarkdown,
  enforceSparseInMarkdown,
} from '../pages/entity-page';
import {
  enforceTopicFrontmatterInMarkdown,
  enforceTopicSourcesSectionInMarkdown,
} from '../pages/topic-page';
import { getLanguage, type LanguageCode } from '../utils/language';
import { sourcePdfPath, wikiDir, wikiRelativePath } from '../utils/paths';
import { readIngestionState, writeIngestionState } from '../state/ingestion-state';
import { readWikiLanguage, writeWikiLanguage } from '../state/language';
import { readFullRollingMemory } from '../state/rolling-memory';
import { readConflicts } from '../state/conflicts';
import { writeMetrics, sumLlmUsageSince, countLlmCallsSince, type IngestionMetrics } from '../state/metrics';
import { setModelRouting, isTransientTransportError, setStallWaitReporter, type StallWaitInfo } from '../llm/client';
import { beginReaskRun, reaskRepairs, runWithFeedbackRetry } from '../llm/reask';
import {
  isSkipEligible,
  pageDataHash,
  readSynthesisState,
  recordSynthesisPage,
  synthesisPagePath,
  type SynthesisPageKind,
  type SynthesisPageRecord,
} from '../state/synthesis-state';
import { loadSettings } from '../tui/settings';
import { writeSourcePage } from '../pages/source-page';
import { extractDocumentChunk, type ChunkExtraction } from './extract-chunk';
import {
  materialize,
  evidenceKeysFor,
  newEvidenceFor,
  type MaterializeOptions,
  type MaterializeResult,
  type NewEvidenceDelta,
} from '../materializer';
import { writeAmendment, buildAmendmentRequest, type AmendmentRequest } from '../agents/amendment';
import { parsePatch, validatePatch, applyPatch, type Patch } from '../llm/patch';
import { appendAmendmentLogRecord, countOperations } from '../state/amendment-log';
import type {
  CurateCallOptions,
  EntityCurationCandidate,
  EntityCurationOutcome,
  TopicCurationCandidate,
  TopicCurationOutcome,
} from '../agents/curation';
import { writeDoxContracts, writeWorkspaceIndex, type DoxIndexContext, type DoxWorkspaceEntryContext, type DoxWorkspaceProseContext } from '../dox-writer';
import { proposeAgentsUpdate, type AgentsUpdaterOptions } from '../agents/agents-updater';
import { runCrossWikiPass, type CrossWikiPassOptions, type CrossWikiPassResult } from '../cross-wiki/index';
import { validateWiki, logValidation, type ValidationSummary } from '../validation';
import {
  writeEntitySynthesis,
  writePermissiveEntitySynthesis,
  writeTopicSynthesis,
  writePermissiveTopicSynthesis,
  writeCompositeSynthesis,
  writePermissiveCompositeSynthesis,
  writeComparisonSynthesis,
  writePermissiveComparisonSynthesis,
} from '../agents/synthesis';
import { checkPreservation, checkTopicPreservation, checkCompositePreservation, checkComparisonPreservation } from '../validation/preservation-check';
import { logConflict } from '../state/conflicts';
import { appendSynthesisReportEntries, type SynthesisReportEntry } from '../state/synthesis-report';
import { runPool } from '../utils/worker-pool';
import type { EntityPageData } from '../pages/entity-page';
import type { TopicPageData } from '../pages/topic-page';
import {
  buildCompositeCitationMap,
  enforceCompositeFrontmatterInMarkdown,
  type CompositePageData,
} from '../pages/composite-page';
import {
  buildComparisonCitationMap,
  enforceComparisonBridgeInMarkdown,
  enforceComparisonFrontmatterInMarkdown,
  type ComparisonPageData,
} from '../pages/comparison-page';

export interface IngestOptions {
  /** Workspace directory containing wikis/; defaults to '.'. */
  workspace?: string;
  /** Pages per document-page chunk; defaults to 5. A page is never split. */
  pagesPerChunk?: number;
  /**
   * Run the Layer 2 Extractor on each newly-written chunk and save
   * `.state/extracted/<chunk-id>.json` (phase doc §2.3). Defaults to true
   * (CLI `ingest` extracts per the phase doc). Tests and key-less runs pass
   * `extract: false` to stay deterministic and LLM-free; when extraction is
   * enabled but the API key is missing, the Extractor's error propagates.
   */
  extract?: boolean;
  /**
   * Phase 5: run the optional Synthesis Writer after extraction, materialization,
   * and validation. Only has effect when `extract` is true. Defaults to false.
   */
  synthesis?: boolean;
  /** Progress callback (CLI prints these lines; the TUI renders them). */
  onProgress?: (message: string) => void;
  /**
   * Injectable extraction implementation (test-only). Defaults to the real
   * Layer 2 pipeline so the CLI and TUI make live LLM calls; tests can inject
   * a deterministic stub to exercise `extract: true` without an API key.
   */
  extractChunkFn?: (wikiDir: string, chunkId: string) => Promise<ChunkExtraction>;
  /**
   * Injectable synthesis implementation (test-only). Defaults to the real
   * Synthesis Writer; tests can inject a deterministic stub to exercise the
   * synthesis pipeline without an API key. Phase 12: the trailing `feedback`
   * (correction block on repair attempts) and `attempt` (1-based attempt
   * number) are optional — stubs that ignore them keep working.
   */
  synthesizeEntityFn?: (
    entityData: EntityPageData,
    agentsMd: string,
    logPath?: string,
    language?: { input: LanguageCode; output: LanguageCode },
    feedback?: string,
    attempt?: number,
  ) => Promise<string>;
  /**
   * Injectable permissive synthesis implementation (test-only). Defaults to the
   * real permissive Synthesis Writer; tests can inject a deterministic stub.
   */
  synthesizeEntityPermissiveFn?: (
    entityData: EntityPageData,
    agentsMd: string,
    logPath?: string,
    language?: { input: LanguageCode; output: LanguageCode },
    feedback?: string,
    attempt?: number,
  ) => Promise<string>;
  /**
   * Injectable topic synthesis implementation (test-only). Defaults to the real
   * topic Synthesis Writer; tests can inject a deterministic stub.
   */
  synthesizeTopicFn?: (
    topicData: TopicPageData,
    agentsMd: string,
    logPath?: string,
    language?: { input: LanguageCode; output: LanguageCode },
    feedback?: string,
    attempt?: number,
  ) => Promise<string>;
  /**
   * Injectable permissive topic synthesis implementation (test-only). Defaults to
   * the real permissive topic Synthesis Writer; tests can inject a deterministic stub.
   */
  synthesizeTopicPermissiveFn?: (
    topicData: TopicPageData,
    agentsMd: string,
    logPath?: string,
    language?: { input: LanguageCode; output: LanguageCode },
    feedback?: string,
    attempt?: number,
  ) => Promise<string>;
  /**
   * Phase 22 gate 22.10 (the five-class rollup amendment): injectable
   * COMPOSITE synthesis implementation (test-only, the `synthesizeEntityFn`
   * precedent). Defaults to the real composite Synthesis Writer; tests inject
   * a deterministic stub. The composite stage mirrors the entity/topic stages
   * exactly (strict → permissive → structured-template).
   */
  synthesizeCompositeFn?: (
    compositeData: CompositePageData,
    agentsMd: string,
    logPath?: string,
    language?: { input: LanguageCode; output: LanguageCode },
    feedback?: string,
    attempt?: number,
  ) => Promise<string>;
  /** Phase 22 gate 22.10: injectable permissive composite synthesis (test-only). */
  synthesizeCompositePermissiveFn?: (
    compositeData: CompositePageData,
    agentsMd: string,
    logPath?: string,
    language?: { input: LanguageCode; output: LanguageCode },
    feedback?: string,
    attempt?: number,
  ) => Promise<string>;
  /**
   * Phase 23 (§2.3, backlog B21): injectable COMPARISON synthesis
   * implementations (test-only, the `synthesizeCompositeFn` precedent).
   * Defaults to the real comparison Synthesis Writer; tests inject
   * deterministic stubs. The comparison stage mirrors the composite stage
   * exactly (strict → permissive → structured-template).
   */
  synthesizeComparisonFn?: (
    comparisonData: ComparisonPageData,
    agentsMd: string,
    logPath?: string,
    language?: { input: LanguageCode; output: LanguageCode },
    feedback?: string,
    attempt?: number,
  ) => Promise<string>;
  /** Phase 23: injectable permissive comparison synthesis (test-only). */
  synthesizeComparisonPermissiveFn?: (
    comparisonData: ComparisonPageData,
    agentsMd: string,
    logPath?: string,
    language?: { input: LanguageCode; output: LanguageCode },
    feedback?: string,
    attempt?: number,
  ) => Promise<string>;
  /**
   * Phase 26 (§2.3; the `synthesizeEntityFn` precedent): injectable Amendment
   * Writer (test-only). Defaults to the real `writeAmendment` (a patch-JSON
   * string out); tests inject a deterministic stub so every gate except the
   * live 26.11 is LLM-free.
   */
  amendmentFn?: (
    request: AmendmentRequest,
    agentsMd: string,
    logPath?: string,
    language?: { input: LanguageCode; output: LanguageCode },
    feedback?: string,
    attempt?: number,
  ) => Promise<string>;
  /**
   * Phase 6: run the DOX Writer in LLM mode — one LLM call per folder plus the
   * wiki root writes rich, content-based `index.md` descriptions. Deterministic
   * code always re-imposes the frontmatter and statistics over the LLM output,
   * and any LLM failure falls back to the deterministic contract. Defaults to
   * false (the library default stays deterministic and LLM-free); production
   * callers (CLI, TUI) pass true.
   */
  doxLlm?: boolean;
  /**
   * Injectable DOX index writer (test-only pass-through to writeDoxContracts).
   * Defaults to the real LLM implementation; tests inject a stub to exercise
   * `doxLlm: true` without an API key. Phase 12: optional trailing `feedback`
   * (correction block on repairs) and `attempt` (1-based attempt number).
   */
  writeDoxIndexFn?: (context: DoxIndexContext, feedback?: string, attempt?: number) => Promise<string>;
  /**
   * Injectable workspace index writer (test-only pass-through to
   * writeWorkspaceIndex). Defaults to the real LLM implementation.
   */
  writeWorkspaceIndexFn?: (context: DoxWorkspaceEntryContext, feedback?: string, attempt?: number) => Promise<string>;
  /**
   * Injectable workspace prose writer (test-only pass-through to
   * writeWorkspaceIndex, 2026-07-21 prose amendment). Defaults to the real
   * LLM implementation; needed so ingest-level `doxLlm: true` tests stay
   * LLM-free when the workspace prose regenerates.
   */
  writeWorkspaceProseFn?: (context: DoxWorkspaceProseContext, feedback?: string, attempt?: number) => Promise<string>;
  /**
   * Phase 7 (vision `04` §9.1): input language of this run's PDFs. Resolution
   * order: this flag → `lastInputLanguage` in `.state/language.json` → 'en'.
   * Persisted as `lastInputLanguage` after the run.
   */
  inputLanguage?: LanguageCode;
  /**
   * Phase 7 (vision `04` §9.1): output language override for this run.
   * Resolution order: this flag → `outputLanguage` in `.state/language.json`
   * → 'en'. Also forwarded (as the language's English name) to the DOX
   * Writer's workspace pass prose.
   */
  outputLanguage?: LanguageCode;
  /**
   * Phase 9: after the DOX contracts and workspace index are written, run the
   * AGENTS.md Updater — one LLM call proposing an updated wiki constitution,
   * saved to `.state/proposed-agents.md` for human review. The original
   * AGENTS.md is never overwritten. Defaults to false (opt-in via the CLI
   * `--update-agents` flag or the TUI ingest toggle).
   */
  updateAgents?: boolean;
  /**
   * Injectable AGENTS.md updater (test-only). Defaults to the real
   * proposeAgentsUpdate; tests inject a deterministic stub to exercise
   * `updateAgents: true` without an API key.
   */
  proposeAgentsUpdateFn?: (wikiSlug: string, options: AgentsUpdaterOptions) => Promise<string>;
  /**
   * Phase 14 (phase doc §2.2; the `writeDoxIndexFn` precedent): injectable
   * topic/entity curation implementations (test-only), passed through to the
   * materializer's curation stage so every gate stays LLM-free. Default to
   * the real curation calls.
   */
  curateTopicsFn?: (candidates: TopicCurationCandidate[], options: CurateCallOptions) => Promise<TopicCurationOutcome>;
  curateEntitiesFn?: (candidates: EntityCurationCandidate[], options: CurateCallOptions) => Promise<EntityCurationOutcome>;
  /**
   * Phase 16 (vision `04` §1 pool transport tuning): the deterministic
   * dispatch stagger between synthesis pool pickups, in milliseconds.
   * Defaults to SYNTHESIS_POOL_STAGGER_MS (250); tests pass 0 so the Phase 15
   * pool-semantics gates keep their overlap timing (the stagger is a dispatch
   * delay only — it changes no per-page outcome).
   */
  poolStaggerMs?: number;
  /**
   * Phase 24 (phase doc §2.8, vision `04` §3.2 Step 10 amended 2026-08-09):
   * run the Cross-Wiki Discovery pass after the workspace pass and before the
   * AGENTS.md Updater when the workspace holds ≥2 wikis (deterministic
   * preflight + optional relevance probe decide whether the full pass runs).
   * Defaults to false (the library default stays LLM-free; production callers
   * — CLI and TUI — pass true, the `doxLlm` precedent). Failures are logged
   * and never abort the ingest.
   */
  crossWiki?: boolean;
  /**
   * Phase 24 (user-ratified extension 2026-08-14): force the Cross-Wiki
   * Discovery pass to run even when the deterministic preflight would skip it
   * (relevance probe / unchanged). Useful when a curator updates wikis one at
   * a time and wants to refresh the workspace-level artifacts without deleting
   * `.state/cross-wiki/run-fingerprint.json`. Ignored when `crossWiki` is false.
   */
  forceCrossWiki?: boolean;
  /**
   * Injectable cross-wiki pass (test-only). Defaults to the real
   * `runCrossWikiPass`; tests inject a stub (or call the real pass with its
   * own component seams) to keep every gate LLM-free.
   */
  runCrossWikiPassFn?: (options: CrossWikiPassOptions) => Promise<CrossWikiPassResult>;
  /**
   * Phase 27 (vision `04` §1 Worker-process isolation amendment,
   * user-ratified 2026-09-02): restrict this run's per-PDF loop to exactly
   * these PDF FILE NAMES (raw/ discovery order is preserved; unknown names
   * are ignored). The conductor spawns one worker per PDF with this selector
   * set to a single name. Pipeline mechanics inside the selected PDFs are
   * unchanged — hash-skip, chunking, materialize, synthesis, and checkpoint
   * law all behave exactly as an unselected run would for those PDFs.
   */
  onlyPdfs?: string[];
  /**
   * Phase 27: run ONLY the deferred tail — content validation, the DOX
   * bottom-up chain, the workspace pass, Cross-Wiki Discovery, the AGENTS.md
   * Updater, and the end-of-run state write. The per-PDF loop and the
   * all-skipped fallback materialize/synthesis are skipped entirely: the
   * per-PDF workers already ran them and checkpointed their state. The
   * conductor's finalize worker uses this mode; the in-process default
   * (absent flag) is byte-identical to the pre-Phase-27 behavior.
   */
  finalizeOnly?: boolean;
  /**
   * Phase 27 v1.0.1: with `finalizeOnly`, also run the all-skipped repair
   * fallback (materialize + curation + synthesis) before the deferred tail.
   * The conductor passes this when NO PDF was ingested this run — restoring
   * the 2026-07-21 repair law's batch semantics (exactly one repair pass per
   * all-skip run) instead of one fallback per hash-skipped PDF worker. Ignored
   * in `onlyPdfs` runs (per-PDF workers never run the fallback).
   */
  idleFallback?: boolean;
  /**
   * Phase 27 v1.0.1: structured stall tap — fired with the same
   * {@link StallWaitInfo} the progress line renders, so the TUI worker can
   * emit a protocol event and the screen can render a live countdown. The
   * plain text stall line still flows through `onProgress` unchanged.
   */
  onStall?: (info: StallWaitInfo) => void;
}

export interface IngestedSource {
  source: string;
  file: string;
  pageCount: number;
  documentPages: string[];
  warnings: string[];
  tablesFound: number;
}

/** Per-chunk extraction counts (Phase 2, additive). */
export interface ChunkExtractionSummary {
  chunkId: string;
  entities: number;
  relationships: number;
  claims: number;
}

export interface IngestResult {
  wiki: string;
  wikiDir: string;
  ingested: IngestedSource[];
  /** Source slugs skipped because their SHA-256 is unchanged. */
  skipped: string[];
  /**
   * Phase 27 (vision `04` §1 Worker-process isolation amendment): PDF file
   * names whose worker crashed and whose crash the USER chose to defer —
   * user-initiated only, never automatic, deletes nothing; the PDF stays in
   * raw/ and is re-attempted on the next ingest run. Absent/empty for every
   * old caller (additive field).
   */
  deferred?: string[];
  /** One entry per extracted chunk (Phase 2, additive; empty when extract: false). */
  extractions: ChunkExtractionSummary[];
  /** Phase 4: deterministic validation summary produced after materialization. */
  validation?: ValidationSummary;
  /**
   * Phase 6: validation summary produced AFTER the DOX Writer wrote the
   * `index.md` contracts, so the final pass covers the DOX pages too. The
   * persisted `.state/validation-report.json` reflects this final pass.
   */
  finalValidation?: ValidationSummary;
  /** Phase 5: number of entity pages successfully synthesized. */
  synthesized?: number;
  /** Phase 5: number of entity pages successfully synthesized using the permissive fallback. */
  synthesizedPermissive?: number;
  /** Phase 5: number of topic pages successfully synthesized. */
  synthesizedTopics?: number;
  /** Phase 5: number of topic pages successfully synthesized using the permissive fallback. */
  synthesizedTopicsPermissive?: number;
  /** Phase 5: number of entity pages where preservation check failed. */
  synthesisConflicts?: number;
  /** Phase 5: number of topic pages where preservation check failed. */
  topicConflicts?: number;
  /** Phase 22 gate 22.10: composite pages successfully synthesized. */
  synthesizedComposites?: number;
  /** Phase 22 gate 22.10: composite pages synthesized via the permissive fallback. */
  synthesizedCompositesPermissive?: number;
  /** Phase 22 gate 22.10: composite pages where preservation check failed (shell kept). */
  compositeConflicts?: number;
  /** Phase 23 (§2.3): comparison pages successfully synthesized. */
  synthesizedComparisons?: number;
  /** Phase 23: comparison pages synthesized via the permissive fallback. */
  synthesizedComparisonsPermissive?: number;
  /** Phase 23: comparison pages where preservation check failed (shell kept). */
  comparisonConflicts?: number;
  /**
   * Phase 26 (§2.5): pages successfully amended by a validated patch this
   * run (synthesis-report `finalMode: 'patch-amended'`; one
   * `.state/amendment-log.jsonl` episode each).
   */
  patchedPages?: number;
  /** Phase 26 (§2.5): amendment episodes that exhausted into full synthesis. */
  patchFallbacks?: number;
  /** Phase 7: the resolved input/output languages of this run. */
  languages?: { input: LanguageCode; output: LanguageCode };
  /** Phase 9: true when the AGENTS.md Updater wrote `.state/proposed-agents.md`. */
  agentsUpdateProposed?: boolean;
  /**
   * Phase 11: true when the Synthesis Writer stage ran this run (so result
   * banners can show the Synthesis segment only then — the synthesized
   * counters themselves are always present and zero-initialized).
   */
  synthesisRan?: boolean;
  /**
   * Phase 16 (vision `04` Step 9 synthesis resume): entity pages skipped by
   * the resume rule this run — a skip-eligible `.state/synthesis-state.json`
   * record (strict/permissive pass with a matching aggregate fingerprint)
   * meant no LLM call and no rewrite. Zero on a first run.
   */
  synthesisSkipped?: number;
  /** Phase 16: topic pages skipped by the resume rule (same rule as above). */
  synthesisTopicsSkipped?: number;
  /** Phase 22 gate 22.10: composite pages skipped by the resume rule (same rule). */
  synthesisCompositesSkipped?: number;
  /** Phase 23 (§2.3): comparison pages skipped by the resume rule (same rule). */
  synthesisComparisonsSkipped?: number;
  /**
   * Phase 24: the Cross-Wiki Discovery pass outcome — `ran` false with the
   * skip reason when the preflight skipped it (unchanged fingerprint, probe
   * not-relevant, or <2 wikis); absent when the pass was not enabled.
   */
  crossWiki?: CrossWikiPassResult;
}

const DEFAULT_PAGES_PER_CHUNK = 5;

/**
 * Phase 7 v1.1.0 (bounded retry amendment, vision `04` §6 / `07` §5): each
 * synthesis mode gets up to 3 total attempts on preservation failure — a
 * quality failure, partly LLM variance — before the chain moves to the next
 * mode. Language-agnostic: applies to every ingest in every wiki.
 * Deterministic LLM errors (HTTP 4xx) still abort immediately.
 * Phase 12 (feedback-retry amendment, user-ratified 2026-07-23): the retry is
 * no longer blind — attempts 2+ carry the preservation check's exact dropped
 * items back to the writer via runWithFeedbackRetry.
 */
const SYNTHESIS_MAX_ATTEMPTS = 3;

/**
 * Phase 15 (vision `04` §1 concurrency note, user-ratified 2026-07-23 with
 * the L5 user-narrowed scope in optimizations.md): the entity- and
 * topic-synthesis stages run through a bounded worker pool with this FIXED
 * cap of 4 concurrent calls — a constant, deliberately NOT a Settings field
 * (ratified scope). Everything else in the pipeline stays sequential:
 * extraction (chunks share rolling-memory context), the curation calls, the
 * DOX Writer (bottom-up level dependencies), the workspace pass, and the
 * AGENTS.md Updater. No cost change — same calls, same models; the existing
 * 429/5xx retry machinery absorbs pool pressure at cap 4.
 */
export const SYNTHESIS_POOL_SIZE = 4;

/**
 * Phase 16 (vision `04` §1 pool transport tuning, user-ratified 2026-07-25):
 * deterministic dispatch stagger between synthesis pool pickups — pickup #n
 * starts ~250ms after pickup #(n-1), so a stage never fires 4 large requests
 * at the same instant. A fixed constant like the pool cap, deliberately NOT
 * a Settings field; a dispatch delay only (no per-page semantics change).
 */
export const SYNTHESIS_POOL_STAGGER_MS = 250;

/**
 * Phase 16 (vision `04` §6 outage detector, user-ratified 2026-07-25): per
 * synthesis stage, the run ABORTS with the transport error when EITHER this
 * many transport-failed pages occur consecutively (no successful call in
 * between — the counter resets on any page whose chain completed, including
 * quality template fallbacks, because the LLM demonstrably answered) ...
 */
export const TRANSPORT_OUTAGE_CONSECUTIVE_LIMIT = 5;

/**
 * Phase 16: ... OR transport-failed pages exceed this fraction of the stage's
 * attempted pages (strictly greater — 2 of 20 completes, 3 of 20 aborts).
 * Below both thresholds the run completes with per-page template fallbacks
 * and a summary warning.
 */
export const TRANSPORT_OUTAGE_RATE = 0.1;

/**
 * Phase 16 (vision `04` §6): per-stage outage-detector state. `total` is the
 * number of pages the stage will ATTEMPT this run (resume-skipped pages make
 * no calls, so they cannot witness an outage and are not counted).
 */
interface OutageDetector {
  consecutive: number;
  failed: number;
  total: number;
}

function makeOutageDetector(total: number): OutageDetector {
  return { consecutive: 0, failed: 0, total };
}

/** A page whose chain completed (any non-transport outcome) resets the streak. */
function recordDetectorSuccess(detector: OutageDetector): void {
  detector.consecutive = 0;
}

/**
 * A transport-failed page: count it, then ABORT by rethrowing its transport
 * error when either threshold trips (fail loud — a real outage signature, not
 * a hiccup). Below both thresholds the caller templates just this page.
 */
function recordDetectorTransportFailure(detector: OutageDetector, error: unknown): void {
  detector.failed += 1;
  detector.consecutive += 1;
  if (
    detector.consecutive >= TRANSPORT_OUTAGE_CONSECUTIVE_LIMIT ||
    detector.failed > detector.total * TRANSPORT_OUTAGE_RATE
  ) {
    throw error;
  }
}

interface SynthesisModeResult<C> {
  /** The synthesized page when a preservation check passed, else null. */
  page: string | null;
  attempts: number;
  /** The most recent preservation check; null only when the LLM call threw. */
  lastCheck: C | null;
}

/**
 * Build the validator-feedback error list from a preservation check: every
 * dropped mention context, relationship evidence, claim text, and citation
 * marker, verbatim (the reask prompt must carry the exact substrings the
 * writer must restore).
 */
function preservationFeedbackErrors(check: { passed: boolean }): string[] {
  const dropped = check as {
    droppedMentions?: string[];
    droppedRelationships?: string[];
    droppedClaims?: string[];
    droppedCitations?: string[];
    droppedRowValues?: string[]; // Phase 23 (gate 23.5)
    extraMarkers?: string[]; // Phase 18 (B18)
  };
  const errors: string[] = [];
  for (const mention of dropped.droppedMentions ?? []) {
    errors.push(`Dropped mention (restore this exact text): ${mention}`);
  }
  for (const evidence of dropped.droppedRelationships ?? []) {
    errors.push(`Dropped relationship evidence (restore this exact text): ${evidence}`);
  }
  for (const claim of dropped.droppedClaims ?? []) {
    errors.push(`Dropped claim (restore this exact text): ${claim}`);
  }
  // Phase 23 (gate 23.5): a comparison page's dropped or altered row values
  // join the feedback verbatim (the row's subject + its numbers are the PDF's
  // own values — restoring them is the correction).
  for (const rowValue of dropped.droppedRowValues ?? []) {
    errors.push(`Dropped table row value (restore this exact value): ${rowValue}`);
  }
  for (const citation of dropped.droppedCitations ?? []) {
    errors.push(`Dropped citation (restore this exact marker): ${citation}`);
  }
  // Phase 18 (B18, phase doc §2.2): off-map markers join the feedback so the
  // reask corrects them (never stripped deterministically — §2.3).
  for (const marker of dropped.extraMarkers ?? []) {
    errors.push(`Off-map citation marker (remove it or replace it with a key from the CITATION KEYS list): ${marker}`);
  }
  return errors.length > 0 ? errors : ['The preservation check failed; restore all dropped content verbatim.'];
}

async function trySynthesisMode<C extends { passed: boolean }>(
  runSynthesis: (feedback: string | null, attempt: number) => Promise<string>,
  runCheck: (page: string) => C,
  label: string,
): Promise<SynthesisModeResult<C>> {
  let lastCheck: C | null = null;
  let attemptsMade = 0;
  const outcome = await runWithFeedbackRetry<string>(
    (feedback, attempt) => {
      attemptsMade = attempt;
      return runSynthesis(feedback, attempt);
    },
    (page) => {
      const check = runCheck(page);
      lastCheck = check;
      return check.passed
        ? { valid: true, errors: [] }
        : { valid: false, errors: preservationFeedbackErrors(check) };
    },
    {
      maxAttempts: SYNTHESIS_MAX_ATTEMPTS,
      label,
      onRepair: () => {
        console.warn(
          `Preservation failed for ${label} (attempt ${attemptsMade}/${SYNTHESIS_MAX_ATTEMPTS}); retrying with validator feedback.`,
        );
      },
    },
  );
  return { page: outcome.output, attempts: outcome.attempts, lastCheck };
}

function loadAgentsMd(wikiDir: string): string {
  const path = join(wikiDir, 'AGENTS.md');
  try {
    return readFileSync(path, 'utf-8');
  } catch {
    return '';
  }
}

/**
 * Phase 11 (phase doc §2.4): the end-of-ingest result banner, shared by the
 * CLI and the TUI so both say exactly the same thing:
 * `Ingest complete: X ingested, Y skipped. Synthesis: A pages written
 * (B strict, C permissive), D conflicts. Validation passed.`
 * The Synthesis segment appears only when the Synthesis Writer stage ran;
 * the Validation segment only when a validation pass ran.
 */
export function formatIngestSummary(result: IngestResult): string {
  let summary = `Ingest complete: ${result.ingested.length} ingested, ${result.skipped.length} skipped.`;
  // Phase 27 (§2.3): the deferred segment appears only when the user chose
  // Skip on a crashed worker's PDF (defer is user-initiated only; the PDF is
  // re-attempted on the next run — nothing was deleted).
  if ((result.deferred?.length ?? 0) > 0) {
    summary += ` ${result.deferred!.length} deferred (re-attempted next ingest): ${result.deferred!.join(', ')}.`;
  }
  if (result.synthesisRan === true) {
    const strict =
      (result.synthesized ?? 0) + (result.synthesizedTopics ?? 0) + (result.synthesizedComposites ?? 0) + (result.synthesizedComparisons ?? 0);
    const permissive =
      (result.synthesizedPermissive ?? 0) +
      (result.synthesizedTopicsPermissive ?? 0) +
      (result.synthesizedCompositesPermissive ?? 0) +
      (result.synthesizedComparisonsPermissive ?? 0);
    const patched = result.patchedPages ?? 0;
    const conflicts =
      (result.synthesisConflicts ?? 0) + (result.topicConflicts ?? 0) + (result.compositeConflicts ?? 0) + (result.comparisonConflicts ?? 0);
    // Phase 26 (§2.5): the synthesis segment mentions `Patched N` when any
    // page was amended (byte-identical to the pre-Phase-26 banner otherwise).
    summary +=
      ` Synthesis: ${strict + permissive + patched} pages written ` +
      `(${strict} strict, ${permissive} permissive${patched > 0 ? `, ${patched} patched` : ''}), ${conflicts} conflicts.`;
  }
  const validation = result.finalValidation ?? result.validation;
  if (validation) {
    const issues =
      validation.links.broken.length +
      validation.citations.invalid.length +
      validation.citations.missingSource.length +
      validation.schema.invalid.length;
    summary += issues === 0 ? ' Validation passed.' : ' Validation found issues.';
  }
  return summary;
}

/**
 * Ingest every PDF in `wikis/<slug>/raw/` into raw document pages
 * (phase doc §2.2, Layer 1) and, unless `extract: false`, run the Layer 2
 * Extractor on each newly-written chunk (phase doc §2.3).
 *
 * For each PDF: SHA-256 hash, skip when unchanged (`.state/ingestion.json`),
 * extract text page-by-page with the frozen Phase 0 `extractText`, chunk
 * consecutive whole pages (default 5 per chunk), render detected plaintext
 * tables as markdown tables, and write `documents/<source>-part-NNN.md` with
 * YAML frontmatter (gray-matter). Then refresh the deterministic source page
 * and the ingestion state. Re-running is idempotent: unchanged PDFs are
 * skipped and changed PDFs rewrite (never duplicate) their pages.
 *
 * Layer 2 (per chunk, vision `04` §3.2 Step 5): the Extractor reads the
 * chunk's document page, the wiki constitution (AGENTS.md), and rolling
 * memory (read-only here; Phase 3 updates it) and its JSON is saved to
 * `.state/extracted/<chunk-id>.json`. Unchanged (hash-skipped) PDFs are
 * skipped entirely — no extraction (vision `04` §3.1). Extraction failures
 * (invalid JSON, schema errors, missing API key) throw and abort the ingest;
 * the system does not retry (vision `04` §6).
 *
 * Phase 5/6 (phase doc §3.5 pipeline order): after materialization, if
 * `synthesis` is true, the Synthesis Writer runs per entity/topic page,
 * replacing the structured template with a synthesized two-layer page only
 * when the preservation check passes. Then the content pages are validated
 * (`result.validation`), the DOX Writer writes the `index.md` contracts, and
 * a final validation pass covers the whole wiki including the DOX pages
 * (`result.finalValidation`).
 *
 * Phase 8 (phase doc §2.2-§2.5): removed PDFs (in state, no longer in raw/)
 * log a warning and keep their derived pages; changed PDFs are re-processed
 * under the current run's input language (with a warning when it differs
 * from the language they were originally extracted under) and their stale
 * extraction JSON is deleted first; the Materializer skips manually-edited
 * pages (content-hash mismatch vs `.state/ingestion.json` `pageHashes`) and
 * logs them to `.state/conflicts.json`; every run ends by writing the
 * compounding metrics to `.state/metrics.json` for the TUI Ingestion Log.
 */
export async function ingest(slug: string, options: IngestOptions = {}): Promise<IngestResult> {
  // Phase 16 v1.0.3 (user directive 2026-08-22): route the client's 429/5xx
  // stall waits into this run's progress channel so the TUI and CLI show a
  // live "waiting Ns" line during a multi-minute stall (cheap completion
  // over speed for throttled or erroring free-tier models). Cleared in the
  // finally so the reporter never leaks into another caller's run.
  // Phase 16 v1.0.6 (user-ratified 2026-08-30): network/timeout stalls
  // (statusCode 0) join the channel with their own label.
  // Phase 27 v1.0.1: the line names the failing call (info.label) and the
  // structured info also reaches options.onStall so the TUI worker can emit
  // a protocol event and the screen can render a live countdown.
  const reportProgress = options.onProgress;
  const reportStall = options.onStall;
  if (reportProgress || reportStall) {
    setStallWaitReporter((info) => {
      const reason =
        info.statusCode === 0
          ? 'Connection problem (network/timeout)'
          : info.statusCode === 429
            ? 'Rate limited by provider (HTTP 429)'
            : `Provider error (HTTP ${info.statusCode})`;
      const callLabel = info.label !== undefined ? ` — ${info.label}` : '';
      reportProgress?.(
        `${reason}${callLabel}: waiting ${info.waitSeconds}s before retry (attempt ${info.attempt}/${info.maxAttempts})...`,
      );
      reportStall?.(info);
    });
  }
  try {
    return await runIngest(slug, options);
  } finally {
    setStallWaitReporter(null);
  }
}

/** The ingest implementation (the exported wrapper owns the stall-reporter lifecycle). */
async function runIngest(slug: string, options: IngestOptions): Promise<IngestResult> {
  // Phase 12 (vision `04` §6): reset the per-run feedback-repair counter so
  // metrics.feedbackRepairs and the end-of-run prompt-quality warning reflect
  // exactly this run's reask activity across all five LLM call sites.
  beginReaskRun();

  const pagesPerChunk = options.pagesPerChunk ?? DEFAULT_PAGES_PER_CHUNK;
  const extract = options.extract ?? true;
  const synthesis = options.synthesis ?? false;
  if (!Number.isInteger(pagesPerChunk) || pagesPerChunk < 1) {
    throw new Error(`pagesPerChunk must be a positive integer, got ${pagesPerChunk}.`);
  }

  // Phase 11 (phase doc §2.2): per-call LLM model routing from the workspace
  // TUI settings (`.paper-chase.json`). This is the single integration point
  // — it covers both the CLI and the TUI because both call ingest(). A
  // settings failure must never break an ingest, so it is best-effort.
  // Phase 11 v1.5.0: the Settings-stored API keys ride along on the routing
  // config (they win over the environment per provider in the client).
  try {
    const tuiSettings = await loadSettings(options.workspace ?? '.');
    setModelRouting({
      ...tuiSettings.models,
      apiKeys: tuiSettings.apiKeys,
      customProviders: tuiSettings.customProviders,
    });
  } catch {
    // Keep whatever routing was already in effect.
  }

  const dir = wikiDir(options.workspace, slug);
  if (!existsSync(dir)) {
    throw new Error(`Wiki '${slug}' not found at ${dir}. Run 'init ${slug}' first.`);
  }
  const rawDir = join(dir, 'raw');
  if (!existsSync(rawDir)) {
    throw new Error(`Wiki '${slug}' has no raw/ directory. Run 'init ${slug}' to repair it.`);
  }

  const progress = options.onProgress ?? (() => {});

  // Phase 7 (vision `04` §9.1): resolve the run's language pair. Output:
  // CLI flag → .state/language.json → 'en'. Input: CLI flag →
  // lastInputLanguage → 'en'. Invalid codes throw via getLanguage.
  const languageState = await readWikiLanguage(dir);
  const output = getLanguage(options.outputLanguage ?? languageState.outputLanguage).code;
  const input = getLanguage(options.inputLanguage ?? languageState.lastInputLanguage).code;
  const language = { input, output };

  // Phase 7 (vision `04` §9.3 slug-forking caution): warn before processing
  // when the resolved input language differs from the last run and the wiki
  // already has extractions — the same name can slugify differently under a
  // different input language and fork into duplicate pages.
  if (input !== languageState.lastInputLanguage) {
    const extractedDir = join(dir, '.state', 'extracted');
    const hasExtractions =
      existsSync(extractedDir) &&
      (await readdir(extractedDir)).some((file) => file.endsWith('.json'));
    if (hasExtractions) {
      console.log(
        `Warning: input language '${input}' differs from the last run ('${languageState.lastInputLanguage}'). ` +
          `Re-ingesting the same names under a different language can create duplicate pages (slug forking).`,
      );
    }
  }

  let pdfFiles = (await readdir(rawDir))
    .filter((file) => file.toLowerCase().endsWith('.pdf'))
    .sort();

  // Phase 27 (§2.1 engine split): a worker-scoped run processes exactly the
  // selected PDFs (discovery order preserved; unknown names ignored — the
  // conductor only passes names it discovered itself). Absent selector =
  // byte-identical behavior.
  if (options.onlyPdfs !== undefined) {
    const selected = new Set(options.onlyPdfs);
    pdfFiles = pdfFiles.filter((file) => selected.has(file));
  }

  const result: IngestResult = {
    wiki: slug,
    wikiDir: dir,
    ingested: [],
    skipped: [],
    extractions: [],
    synthesized: 0,
    synthesizedPermissive: 0,
    synthesizedTopics: 0,
    synthesizedTopicsPermissive: 0,
    synthesisConflicts: 0,
    topicConflicts: 0,
    patchedPages: 0,
    patchFallbacks: 0,
    languages: language,
  };

  if (pdfFiles.length === 0 && !options.finalizeOnly) {
    // Phase 27 v1.0.1: a scoped worker whose target vanished between the
    // conductor's discovery and this spawn (stale list, PDF removed mid-run)
    // exits gracefully — one honest line per selected name. Never the
    // run-level removed-PDF warnings: with `onlyPdfs` the filtered list is
    // not the raw/ directory, and the finalize worker owns that check.
    if (options.onlyPdfs !== undefined) {
      for (const pdf of options.onlyPdfs) {
        progress(`Skipping ${pdf} — no longer in raw/.`);
      }
      await writeWikiLanguage(dir, { outputLanguage: languageState.outputLanguage, lastInputLanguage: input });
      return result;
    }
    // Phase 8 (phase doc §2.2): warn about removed PDFs even when raw/ is
    // now empty — recorded sources whose files are gone are exactly the
    // removed-PDF case. Derived pages are kept either way.
    const emptyRunState = await readIngestionState(dir);
    for (const recordedSlug of Object.keys(emptyRunState.sources)) {
      progress(
        `Warning: ${recordedSlug} is recorded in ingestion state but its PDF is no longer in raw/. Derived pages were kept.`,
      );
    }
    progress(`No PDFs found in wikis/${slug}/raw/.`);
    // Phase 7: remember the chosen input language even for an empty run.
    await writeWikiLanguage(dir, { outputLanguage: languageState.outputLanguage, lastInputLanguage: input });
    return result;
  }

  const state = await readIngestionState(dir);
  const now = new Date().toISOString();
  let lastMaterializeResult: MaterializeResult | undefined;

  // Phase 8 (phase doc §2.2/§5.1): capture the run's starting point for the
  // compounding metrics — ISO timestamp (LLM cost window), rolling memory
  // (entity/mention diff), conflicts count, and the set of already-known
  // source slugs (so "new PDFs" means first-time-ingested only).
  const runStartedAt = now;
  const runStartMs = Date.now();
  const memoryBefore = await readFullRollingMemory(dir);
  const conflictsBefore = (await readConflicts(dir)).conflicts.length;
  const knownSlugsAtStart = new Set(Object.keys(state.sources));

  // Phase 11 (phase doc §2.6): per-run extraction accumulators for the
  // extended metrics (claims are also counted by type for claimsByType).
  let relationshipsExtracted = 0;
  let claimsExtracted = 0;
  const claimsByType: Record<string, number> = {};
  // Phase 14 (phase doc §2.7): keep-all curation fallbacks across this run's
  // materialize calls (additive metrics counter).
  let curationFallbacksThisRun = 0;
  // Phase 16 (vision `04` §6): per-page transport fallbacks across this run's
  // synthesis stages (additive metrics.transportFailures counter).
  let transportFailuresThisRun = 0;
  // Phase 26 (§2.5): pages successfully patch-amended this run, and amendment
  // episodes that exhausted into normal full synthesis (metrics counters).
  let patchedPagesThisRun = 0;
  let patchFallbacksThisRun = 0;

  // Phase 8 (phase doc §2.2): removed PDFs — recorded in the ingestion state
  // but no longer present in raw/. Warn only; derived pages are KEPT so the
  // journalist can review before removal (nothing is deleted).
  // Phase 27 v1.0.1: this is a RUN-level check, so it runs only in unscoped
  // runs — a worker-scoped (`onlyPdfs`) list is the selector, not the raw/
  // directory, and would false-flag every other recorded source. The
  // finalize worker carries no selector, so the check still runs exactly
  // once per conductor run with the complete file list.
  if (options.onlyPdfs === undefined) {
    const presentSlugs = new Set(pdfFiles.map((file) => sourceSlugForFile(file)));
    for (const recordedSlug of Object.keys(state.sources)) {
      if (!presentSlugs.has(recordedSlug)) {
        progress(
          `Warning: ${recordedSlug} is recorded in ingestion state but its PDF is no longer in raw/. Derived pages were kept.`,
        );
      }
    }
  }

  // Phase 8 (phase doc §2.5): working copy of the recorded page hashes.
  // Updated after every materialize call so pages written earlier in THIS
  // run are never mistaken for manual edits by a later call in the same run.
  const workingPageHashes: Record<string, string> = { ...(state.pageHashes ?? {}) };
  const writtenPagePaths = new Set<string>();
  const conflictSkippedSlugs = new Set<string>();

  // Layer 3 (phase doc §2.5): materialize all entity, topic, and document
  // pages from every .state/extracted/*.json. The recorded page hashes flow
  // in so manually-edited pages are skipped (conflict logged) instead of
  // overwritten; the pages each call writes fold back into the working hash
  // map for the next call.
  // Phase 14 (phase doc §2.4): the curation stage rides the same enablement
  // as synthesis (an LLM stage; no new flag/toggle) — `curation: synthesis`.
  // The curate*Fn injections are the test seam (the writeDoxIndexFn
  // precedent) that keeps every gate LLM-free.
  const runMaterialize = async (): Promise<void> => {
    lastMaterializeResult = await materialize(slug, {
      workspace: options.workspace,
      pageHashes: workingPageHashes,
      curation: synthesis === true,
      language: { input, output },
      curateTopicsFn: options.curateTopicsFn,
      curateEntitiesFn: options.curateEntitiesFn,
    });
    for (const written of lastMaterializeResult.writtenPages) {
      workingPageHashes[written.path] = written.hash;
      writtenPagePaths.add(written.path);
    }
    // Phase 16 (vision `04` Step 9): synthesis-resume-preserved pages were
    // not rewritten; fold their current on-disk hashes into the working map
    // so the recorded hashes converge to the preserved content (a
    // mid-synthesis abort can otherwise leave a stale pre-synthesis hash
    // recorded, which would false-flag the page on the next run).
    for (const preserved of lastMaterializeResult.preservedPages) {
      workingPageHashes[preserved.path] = preserved.hash;
    }
    for (const conflictPath of lastMaterializeResult.conflicts) {
      const conflictSlug = conflictPath.split('/').pop()?.replace(/\.md$/, '');
      if (conflictSlug) {
        conflictSkippedSlugs.add(conflictSlug);
      }
      progress(`Skipping update of ${conflictPath} (manually edited). Conflict logged.`);
    }
    // Phase 19 (B19): observability for the safe-convergence path — pages
    // whose stale recorded hash was proven tool-written (disk == current
    // deterministic render) and converged instead of false-flagged.
    for (const convergedPath of lastMaterializeResult.convergedPages ?? []) {
      progress(`Converged stale page hash for ${convergedPath} (page matches the deterministic render; not a manual edit).`);
    }
    // Fork reconciliation (UAT fix): the Materializer deleted unmodified
    // duplicate pages left behind by an earlier cross-run folder fork. Drop
    // their recorded hashes so the deleted files are never tracked again.
    for (const removed of lastMaterializeResult.removedDuplicates) {
      delete workingPageHashes[removed.path];
      progress(`Removed duplicate page ${removed.path} (entity now lives at ${removed.canonicalPath}).`);
    }
    // Phase 14: fold the curation stage's effects into the run state —
    // fallback counter (metrics), rewritten-link hashes (so the recorded
    // hashes track the rewritten content), deleted merged-away/dropped pages
    // (untracked), and manual-edit veto skips (already logged as conflicts).
    const curation = lastMaterializeResult.curation;
    if (curation) {
      curationFallbacksThisRun += curation.fallbacks.length;
      for (const rewritten of curation.rewrittenLinks) {
        workingPageHashes[rewritten.path] = rewritten.hash;
        writtenPagePaths.add(rewritten.path);
      }
      for (const removedPath of curation.removedPages) {
        delete workingPageHashes[removedPath];
      }
      for (const skip of curation.manualEditSkips) {
        progress(`Curation ${skip.action} skipped for ${skip.page} (manually edited). Conflict logged.`);
      }
    }
    progress('Materialized entity, topic, and document pages.');
  };

  // ------------------------------------------------------------------
  // Phase 26 (§2.1–§2.3, vision `04` §1 per-PDF sequential ingestion +
  // §3.2 Step 9 amendment synthesis): the per-PDF loop state.
  // ------------------------------------------------------------------

  /**
   * The AMENDMENT SNAPSHOT: every skip-eligible page's PRE-materialize
   * on-disk content (the synthesized page a patch applies to), refreshed
   * before each PDF's materialize — materialize rewrites changed-fingerprint
   * pages as structured templates, so the amendment input must be captured
   * first. A run-level map: later PDFs overwrite entries, so it always holds
   * the latest synthesized/patched content per page, which is also how
   * amendments CHAIN across PDFs (PDF 3's snapshot re-reads PDF 2's patched
   * page from disk).
   */
  const amendmentSnapshot = new Map<string, string>();
  const snapshotAmendmentPages = async (): Promise<void> => {
    if (!(extract && synthesis)) {
      return;
    }
    const records = (await readSynthesisState(dir)).pages;
    for (const [relPath, record] of Object.entries(records)) {
      if (!isSkipEligible(record)) {
        continue;
      }
      const absolute = join(dir, relPath);
      if (!existsSync(absolute)) {
        continue;
      }
      try {
        amendmentSnapshot.set(relPath, await readFile(absolute, 'utf-8'));
      } catch {
        // Page vanished mid-run; no snapshot entry (the page is not amendable).
      }
    }
  };

  /**
   * Phase 26: run-level skip-count dedupe — a page skip-confirmed in more
   * than one per-PDF stage invocation (e.g. skipped in PDF 2's AND PDF 3's
   * stages) counts ONCE in the run-level result counters (the counter names
   * a page-level fact; the per-stage progress lines stay per-invocation).
   */
  const synthesisSkipCountedPages = new Set<string>();

  /**
   * Phase 19 (B19): the per-PDF checkpoint persists PRE-synthesis hashes; an
   * abort between a synthesis write and the end-of-run re-hash leaves
   * recorded(template) != disk(synthesized) and false-flags tool-written
   * pages next run. Re-hash from disk in a finally so even an aborting run
   * converges what it wrote. Phase 26: the guard now wraps the WHOLE
   * loop+stages region (defined here, invoked in the finally below).
   */
  const rehashWrittenPagesFromDisk = async (): Promise<void> => {
    if (extract && writtenPagePaths.size > 0) {
      for (const relativePath of writtenPagePaths) {
        try {
          const content = await readFile(join(dir, relativePath), 'utf-8');
          workingPageHashes[relativePath] = createHash('sha256').update(content, 'utf-8').digest('hex');
        } catch {
          // Page vanished between materialization and now; keep the old hash.
        }
      }
      state.pageHashes = workingPageHashes;
      await writeIngestionState(dir, state);
    }
  };

  // Phase 26 (vision `04` §1/§3.2, user-ratified 2026-08-26): each PDF runs
  // its own complete mini-pipeline — chunk → extract → materialize (with the
  // curation pair) → synthesize-or-AMEND — and is checkpointed only when its
  // pass through Steps 3-9 completes. The synthesis stages live in the
  // HOISTED `runSynthesisStages` function declared further below (after the
  // loop in source order; function declarations hoist, and every capture is
  // run-level state).
  // Phase 27 (§2.1, vision `04` §1 Worker-process isolation amendment): a
  // finalizeOnly run skips the loop entirely — the per-PDF workers already
  // ran each PDF's pass and checkpointed its state; this run goes straight
  // to the deferred tail below.
  try {
  for (const fileName of options.finalizeOnly ? [] : pdfFiles) {
    const pdfPath = join(rawDir, fileName);
    const sourceSlug = sourceSlugForFile(fileName);
    const hash = await sha256(pdfPath);
    const existing = state.sources[sourceSlug];

    if (existing && existing.hash === hash) {
      progress(`Skipping ${fileName} (unchanged)`);
      result.skipped.push(sourceSlug);
      continue;
    }

    // Phase 8 (phase doc §2.2 + vision `04` §9.3): a changed PDF is
    // re-processed under the CURRENT run's input language; warn when that
    // differs from the language it was originally extracted under.
    if (existing && existing.hash !== hash && existing.language && existing.language !== input) {
      progress(
        `Warning: ${fileName} was originally extracted under input language '${existing.language}'; re-processing under '${input}'.`,
      );
    }

    progress(`Extracting text from ${fileName}...`);
    const pageCount = await getPageCount(pdfPath);
    const pageTexts: string[] = [];
    const warnings: string[] = [];
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
      const pageText = await extractText(pdfPath, pageNumber, pageNumber);
      if (pageText.trim().length === 0) {
        warnings.push(`Page ${pageNumber} extracted to empty text`);
      }
      pageTexts.push(pageText);
    }

    const chunkCount = Math.max(1, Math.ceil(pageCount / pagesPerChunk));

    // Re-ingesting a changed PDF: remove its previous document pages first so
    // a shorter PDF never leaves stale part-NNN files behind (idempotency).
    // Phase 8 (phase doc §2.2): the old extraction JSON is replaced too —
    // remove each old chunk's `.state/extracted/<chunk-id>.json` so stale
    // extractions never feed the Materializer after re-processing.
    for (const oldPage of existing?.documentPages ?? []) {
      await rm(join(dir, oldPage), { force: true });
      const oldChunkId = oldPage.split('/').pop()?.replace(/\.md$/, '');
      if (oldChunkId) {
        await rm(join(dir, '.state', 'extracted', `${oldChunkId}.json`), { force: true });
      }
    }

    const documentPages: string[] = [];
    let tablesFound = 0;
    for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex++) {
      const startPage = chunkIndex * pagesPerChunk + 1;
      const endPage = Math.min((chunkIndex + 1) * pagesPerChunk, pageCount);
      progress(`Chunk ${chunkIndex + 1}/${chunkCount} (pages ${startPage}-${endPage})`);

      const rawChunkText = pageTexts.slice(startPage - 1, endPage).join('\n');
      const rendered = renderTablesAsMarkdown(rawChunkText);
      tablesFound += rendered.tablesFound;

      const part = String(chunkIndex + 1).padStart(3, '0');
      const docFileName = `${sourceSlug}-part-${part}.md`;
      const docTitle = `${sourceSlug}-part-${part}`;
      // Alias rule applied uniformly (UAT 6.3 fix): a document page's title
      // always equals its chunk-id basename, so this is always undefined and
      // document pages never carry an aliases field.
      const docAliases = aliasesForTitle(docTitle, docFileName.replace(/\.md$/, ''));
      const frontmatter = {
        title: docTitle,
        type: 'document',
        ...(docAliases ? { aliases: docAliases } : {}),
        wiki: slug,
        sources: [
          {
            file: sourcePdfPath(slug, fileName),
            pages: `${startPage}-${endPage}`,
            extracted: now,
            sha256: hash,
          },
        ],
        updated: now,
      };
      const body = `\n## Extracted Text: Pages ${startPage}-${endPage}\n\n${rendered.text}\n`;

      await mkdir(join(dir, 'documents'), { recursive: true });
      await writeFile(join(dir, 'documents', docFileName), matter.stringify(body, frontmatter), 'utf-8');
      documentPages.push(wikiRelativePath('documents', docFileName));

      // Layer 2 (phase doc §2.3): run the Extractor on the chunk just written
      // and save `.state/extracted/<chunk-id>.json`. extractDocumentChunk
      // reads the document page back from disk so the ingest path and the TUI
      // Test Extractor screen share one code path.
      if (extract) {
        const chunkId = docFileName.replace(/\.md$/, '');
        // Phase 7: the default extraction path threads the run's language pair
        // into the Extractor (language directive + slug transliteration).
        const run = options.extractChunkFn ?? ((d: string, id: string) => extractDocumentChunk(d, id, language));
        const extraction = await run(dir, chunkId);
        progress(
          `Extracted ${extraction.result.entities.length} entities, ${extraction.result.relationships.length} relationships, ` +
            `${extraction.result.claims.length} claims from chunk ${chunkId}.`,
        );
        result.extractions.push({
          chunkId,
          entities: extraction.result.entities.length,
          relationships: extraction.result.relationships.length,
          claims: extraction.result.claims.length,
        });
        // Phase 11: accumulate the run's extraction metrics.
        relationshipsExtracted += extraction.result.relationships.length;
        claimsExtracted += extraction.result.claims.length;
        for (const claim of extraction.result.claims) {
          claimsByType[claim.type] = (claimsByType[claim.type] ?? 0) + 1;
        }
      }
    }

    // Layer 3: after a source's chunks are extracted, materialize all
    // entity, topic, and document pages from every .state/extracted/*.json.
    // Phase 26 (§2.3): snapshot the skip-eligible pages' PRE-materialize
    // content FIRST — it is the amendment input, and materialize is about to
    // rewrite changed-fingerprint pages as structured templates.
    if (extract) {
      await snapshotAmendmentPages();
      await runMaterialize();
    }

    await writeSourcePage(dir, {
      wiki: slug,
      fileName,
      filePath: sourcePdfPath(slug, fileName),
      sourceSlug,
      sha256: hash,
      pageCount,
      ingested: existing?.ingestedAt ?? now,
      updated: now,
      warnings,
      documentPages,
    });

    // Phase 26 (§2.1, vision `04` §1 + §3.2): the synthesis stage (entities →
    // topics → composites → comparisons, pool cap 4, WITH the amendment
    // path) runs INSIDE the per-PDF loop — this PDF's pass through Steps 3-9
    // completes here, so the next PDF materializes and synthesizes against a
    // wiki that already includes this PDF's synthesized pages.
    if (extract) {
      await runSynthesisStages(fileName);
    }

    // Phase 8 (vision `04` §9.3): record the input language this source was
    // extracted under so a later changed-PDF re-process can warn on drift.
    state.sources[sourceSlug] = { hash, documentPages, ingestedAt: now, language: input };
    // Phase 16 (vision `04` Step 11 checkpointing, user-ratified 2026-07-25;
    // Phase 26 amendment 2026-08-26): persist this PDF's ingestion record the
    // moment its OWN pass through Steps 3-9 completes — chunks extracted,
    // materialize done, synthesis/amendment done. An abort after this point
    // never re-extracts a finished PDF: the resume's Phase 8 hash-skip sees
    // the checkpoint. An abort BEFORE it re-processes the PDF, with the
    // per-page synthesis records preserving whatever already completed.
    state.pageHashes = workingPageHashes;
    await writeIngestionState(dir, state);
    progress(`Ingested ${fileName} -> ${documentPages.length} document page(s)`);
    result.ingested.push({
      source: sourceSlug,
      file: fileName,
      pageCount,
      documentPages,
      warnings,
      tablesFound,
    });
  }

  // Phase 8 (UAT fork fix): materialize also runs when EVERY PDF was
  // skipped, so an already-forked wiki is repaired by one more ingest even
  // when nothing changed (re-deriving pages from the same extraction set is
  // idempotent; recorded hashes prevent false manual-edit conflicts). Runs
  // only when extractions exist so a wiki without Layer-2 data keeps its
  // rolling memory untouched. Phase 26: the fallback materialize ALSO runs
  // the synthesis stages once (with the amendment path — template-retry
  // semantics preserved; a wiki whose every PDF hash-skips still retries its
  // template-fallback pages exactly as before).
  // Phase 27 (§2.1): never in a finalizeOnly run — the per-PDF workers
  // already materialized and synthesized against the grown aggregate, and
  // re-running the fallback would re-synthesize the whole wiki.
  // Phase 27 v1.0.1: the fallback is RUN-LEVEL, not worker-level — it runs
  // in unscoped runs exactly as before (batch law, 2026-07-21 repair), and
  // in a finalizeOnly run ONLY when the conductor passes `idleFallback`
  // (nothing was ingested this run). Per-PDF (`onlyPdfs`) workers never run
  // it: under the conductor it would re-materialize and re-curate the whole
  // wiki once per hash-skipped PDF.
  const allSkipRepair =
    (options.onlyPdfs === undefined && !options.finalizeOnly) ||
    (options.finalizeOnly === true && options.idleFallback === true);
  if (extract && allSkipRepair && lastMaterializeResult === undefined) {
    const extractedDir = join(dir, '.state', 'extracted');
    const hasExtractions =
      existsSync(extractedDir) &&
      (await readdir(extractedDir)).some((file) => file.toLowerCase().endsWith('.json'));
    if (hasExtractions) {
      await snapshotAmendmentPages();
      await runMaterialize();
      await runSynthesisStages(null);
    }
  }
  } finally {
    // Phase 26 (vision `04` §3.2): the abort-convergence guard now wraps the
    // whole per-PDF loop + fallback region — re-hash every page written this
    // run FROM DISK so the recorded hashes always reflect the tool's own
    // final writes, even for an aborting run (Phase 19 B19).
    await rehashWrittenPagesFromDisk();
  }

  // Phase 27 (§2.1, vision `04` §1 Worker-process isolation amendment): a
  // per-PDF worker (`onlyPdfs` set) runs ONLY its selected PDFs' loop — the
  // deferred tail (validation, DOX, workspace, cross-wiki, updater, the
  // end-of-run state/metrics write) belongs to the finalize worker alone,
  // which runs exactly once after the loop. The per-PDF checkpoints inside
  // the loop already persisted this run's ingestion state and page hashes.
  if (options.onlyPdfs !== undefined) {
    return result;
  }

  // Phase 19 (B19): carry the working folds (preservedPages convergence,
  // rewrittenLinks, removedPages deletions) into the persisted state even
  // when no per-PDF checkpoint ran — otherwise a run that hash-skips every
  // PDF re-persists the pre-run map and discards the convergence folds.
  state.pageHashes = workingPageHashes;
  await writeIngestionState(dir, state);

  // Phase 5: optional synthesis after materialization and before validation.
  // Order: entities first, then topics. Document pages keep their deterministic
  // Phase 1 format and are not synthesized.
  // Phase 15 (vision `04` §1, user-ratified 2026-07-23): each stage's per-page
  // loop runs through runPool(…, { concurrency: SYNTHESIS_POOL_SIZE }). Each
  // pool task is exactly the pre-Phase-15 per-page body — strict
  // trySynthesisMode → permissive → structured-template fallback with the
  // Phase 12 reask loop inside — so per-page outcomes (synthesized counts,
  // fallbacks, attempt counts, #attemptN contexts) are byte-equivalent to the
  // sequential loop. The task RETURNS its synthesis-report entry; entries are
  // appended once per stage in original page order after the pool completes
  // (deterministic, diff-friendly regardless of completion order). Progress is
  // the aggregate `Synthesis: N/M pages complete (4 workers)` counter
  // re-emitted on each completion — identical for the TUI and the CLI; the
  // per-page preservation-failure WARNING lines are unchanged. Extraction,
  // curation, DOX, workspace, and updater stages stay sequential (§2.5).
  // Phase 16 (vision `04` §6 + Step 9, user-ratified 2026-07-25): three
  // additions ride the same pool shape. (a) PER-PAGE TRANSPORT FALLBACK: a
  // transient transport error still throwing after the client's bounded
  // retries is caught for THAT page — the page lands on the structured
  // template with report finalMode `transport-fallback`, a loud warning, and
  // a metrics.transportFailures increment; HTTP 4xx (and every other class)
  // still aborts the run. (b) OUTAGE DETECTOR: per stage, 5 consecutive
  // transport-failed pages OR more than 10% of the stage's attempted pages
  // aborts the run with the transport error (fail loud). (c) SYNTHESIS
  // RESUME: pages with a skip-eligible .state/synthesis-state.json record
  // (strict/permissive pass, matching aggregate fingerprint, not rewritten
  // by the Materializer this run) are skipped — no LLM call, no rewrite;
  // template-fallback pages are retried. Every pooled page checkpoints its
  // record as it completes (serialized queue), and skipped pages contribute
  // reconstructed report entries so the stage's ordered report is complete.
  // Phase 19 (B19): the per-PDF checkpoint persists PRE-synthesis hashes; an
  // abort between a synthesis write and the end-of-run re-hash leaves
  // recorded(template) != disk(synthesized) and false-flags tool-written
  // pages next run. Re-hash from disk in a finally so even an aborting run
  // converges what it wrote. (Definition moved above the loop; the finally
  // that invokes it wraps the loop+fallback region.)

  /**
   * Phase 26 (§2.1, vision `04` §1 + §3.2): ONE synthesis-stage invocation —
   * entity → topic → composite → comparison, pool cap 4, WITH the amendment
   * path of §2.3. Called (a) inside the per-PDF loop right after that PDF's
   * materialize, and (b) once after the all-skipped fallback materialize.
   * PER-INVOCATION state below refreshes on every call: the synthesis
   * records (fresh readSynthesisState), rewrittenThisRun (THIS invocation's
   * materialize result), the Phase 20 slug universe (the tree changed since
   * the previous PDF wrote pages), and the outage detectors. Shared
   * run-level state (counters, seams, the amendment snapshot) is captured
   * from the enclosing scope. Declared AFTER the loop that calls it —
   * function declarations hoist.
   *
   * Phase 15 (vision `04` §1, user-ratified 2026-07-23): each stage's per-page
   * loop runs through runPool(…, { concurrency: SYNTHESIS_POOL_SIZE }). Each
   * pool task is exactly the pre-Phase-15 per-page body — strict
   * trySynthesisMode → permissive → structured-template fallback with the
   * Phase 12 reask loop inside — so per-page outcomes (synthesized counts,
   * fallbacks, attempt counts, #attemptN contexts) are byte-equivalent to the
   * sequential loop. The task RETURNS its synthesis-report entry; entries are
   * appended once per stage in original page order after the pool completes
   * (deterministic, diff-friendly regardless of completion order). Progress is
   * the aggregate `Synthesis: N/M pages complete (4 workers)` counter
   * re-emitted on each completion — identical for the TUI and the CLI; the
   * per-page preservation-failure WARNING lines are unchanged. Extraction,
   * curation, DOX, workspace, and updater stages stay sequential (§2.5).
   * Phase 16 (vision `04` §6 + Step 9, user-ratified 2026-07-25): three
   * additions ride the same pool shape. (a) PER-PAGE TRANSPORT FALLBACK: a
   * transient transport error still throwing after the client's bounded
   * retries is caught for THAT page — the page lands on the structured
   * template with report finalMode `transport-fallback`, a loud warning, and
   * a metrics.transportFailures increment; HTTP 4xx (and every other class)
   * still aborts the run. (b) OUTAGE DETECTOR: per stage, 5 consecutive
   * transport-failed pages OR more than 10% of the stage's attempted pages
   * aborts the run with the transport error (fail loud). (c) SYNTHESIS
   * RESUME: pages with a skip-eligible .state/synthesis-state.json record
   * (strict/permissive pass, matching aggregate fingerprint, not rewritten
   * by the Materializer this run) are skipped — no LLM call, no rewrite;
   * template-fallback pages are retried. Every pooled page checkpoints its
   * record as it completes (serialized queue), and skipped pages contribute
   * reconstructed report entries so the stage's ordered report is complete.
   */
  async function runSynthesisStages(pdfLabel: string | null): Promise<void> {
    if (!(extract && synthesis && lastMaterializeResult)) {
      return;
    }
    result.synthesisRan = true;
    const agentsMd = loadAgentsMd(dir);
    const llmLogPath = join(dir, '.state', 'llm-calls.json');
    // Phase 20 (B20): deterministic wikilink repair rides the synthesis write
    // points — build the slug universe ONCE per run (the wiki tree is stable
    // across the stages) and repair near-miss targets conservatively.
    const slugUniverse = await buildSlugUniverse(slug, options.workspace, { language: input });
    const repairPageLinks = (markdown: string, pageLabel: string): string => {
      const { markdown: repaired, repairs, unrepairable } = repairWikilinksInMarkdown(markdown, slugUniverse);
      if (repairs.length > 0 || unrepairable.length > 0) {
        progress(`Link repair ${pageLabel}: ${repairs.length} repaired${unrepairable.length > 0 ? `, ${unrepairable.length} unrepairable` : ''}.`);
      }
      return repaired;
    };
    const runEntitySynthesis = options.synthesizeEntityFn ?? writeEntitySynthesis;
    const runEntityPermissiveSynthesis =
      options.synthesizeEntityPermissiveFn ?? writePermissiveEntitySynthesis;
    const runTopicSynthesis = options.synthesizeTopicFn ?? writeTopicSynthesis;
    const runTopicPermissiveSynthesis =
      options.synthesizeTopicPermissiveFn ?? writePermissiveTopicSynthesis;
    const poolStaggerMs = options.poolStaggerMs ?? SYNTHESIS_POOL_STAGGER_MS;

    // Phase 16 (Step 9): the resume completion memory, read once per run.
    const synthesisRecords = (await readSynthesisState(dir)).pages;
    // Pages the Materializer actually REWROTE this run must re-synthesize
    // even if a stale record matches (e.g. a skip-eligible page deleted from
    // disk was restored as the structured template — the record's page is
    // gone, so the record must not suppress re-synthesis).
    const rewrittenThisRun = new Set(lastMaterializeResult.writtenPages.map((page) => page.path));

    interface SynthesisOutcome {
      /** The report entry appended once per stage, in original page order. */
      entry: SynthesisReportEntry;
      /** Which per-stage result counter this page lands on ('patched' = Phase 26 amendment). */
      kind: 'strict' | 'permissive' | 'template' | 'transport' | 'patched';
    }

    /**
     * Phase 16 (Step 9): partition one stage's pages into resume-skipped
     * (skip-eligible record, fingerprint match, not rewritten this run) and
     * to-run. Skip decisions recompute the fingerprint with the SAME exported
     * helper the Materializer's preservation check uses, so the two gates can
     * never disagree.
     */
      const partitionStage = <P extends EntityPageData | TopicPageData | CompositePageData | ComparisonPageData>(
        pages: P[],
      ): { skipped: Map<string, SynthesisPageRecord>; toRun: P[] } => {
        const skipped = new Map<string, SynthesisPageRecord>();
        const toRun: P[] = [];
        for (const page of pages) {
          const relPath = synthesisPagePath(page);
          const record = synthesisRecords[relPath];
          if (
            isSkipEligible(record) &&
            record.dataHash === pageDataHash(page, language) &&
            !rewrittenThisRun.has(relPath)
          ) {
            skipped.set(page.slug, record);
          } else {
            toRun.push(page);
          }
        }
        return { skipped, toRun };
      };

    /**
     * Phase 16 (Step 9): a skipped page's report entry, reconstructed from
     * its record so the stage's ordered report covers every page (the record
     * carries mode + timestamp; a skipped page passed in a single recorded
     * mode, reconstructed as one attempt — the killed leg's per-attempt
     * detail does not survive an abort by definition).
     */
    const reconstructedSkipEntry = (
      pageType: 'entity' | 'topic' | 'composite' | 'comparison',
      slug: string,
      record: SynthesisPageRecord,
    ): SynthesisReportEntry => ({
      timestamp: record.synthesizedAt,
      pageType,
      slug,
      strict:
        record.mode === 'strict-synthesis' || record.mode === 'patch-amended'
          ? { attempted: true, passed: true, attempts: 1 }
          : { attempted: true, passed: false, attempts: 1 },
      permissive:
        record.mode === 'permissive-synthesis'
          ? { attempted: true, passed: true, attempts: 1 }
          : { attempted: false, passed: false },
      finalMode: record.mode,
    });

    /**
     * Phase 26 (§2.2): checkpoint one page's synthesis record with the
     * additive amendment fields — the page KIND (a kind change is a shape
     * change: not patchable) and, on a successful synthesis (strict or
     * permissive), the aggregate's evidence-key set (the amendment delta's
     * baseline). Template/transport records carry no baseline (never
     * amendment-eligible: no computable delta).
     */
    const recordSynthesisOutcome = async (
      page: EntityPageData | TopicPageData | CompositePageData | ComparisonPageData,
      pageKind: SynthesisPageKind,
      entry: SynthesisReportEntry,
    ): Promise<void> => {
      await recordSynthesisPage(dir, synthesisPagePath(page), {
        mode: entry.finalMode,
        dataHash: pageDataHash(page, language),
        synthesizedAt: entry.timestamp,
        pageKind,
        ...(entry.finalMode === 'strict-synthesis' ||
        entry.finalMode === 'permissive-synthesis' ||
        entry.finalMode === 'patch-amended'
          ? { baselineKeys: evidenceKeysFor(page) }
          : {}),
      });
    };

    // ------------------------------------------------------------------
    // Phase 26 (§2.3–§2.4): THE AMENDMENT PATH. For a page in this
    // invocation's to-run set (changed fingerprint or rewritten) that already
    // carries a same-kind, same-shape successful synthesis, the Amendment
    // Writer patches the existing page instead of re-emitting it in full —
    // output cost scales with the new evidence, never with the page.
    // ------------------------------------------------------------------

    /**
     * The kind-specific deterministic enforcement chain over a MERGED page —
     * EXACTLY the chain the kind's synthesis write points apply (frontmatter
     * re-imposition with the real `updated` and the aggregated `sources`, the
     * members block when add-member grew the composite, the `## Sources`
     * rebuild over the FULL current citation map, sparse for entities, and
     * the Phase 20 link repair outermost; the comparison bridge is re-imposed
     * deterministically too).
     */
    const enforceMergedPage = (
      mergedBody: string,
      page: EntityPageData | TopicPageData | CompositePageData | ComparisonPageData,
      kind: SynthesisPageKind,
    ): string => {
      if (kind === 'entity') {
        const entity = page as EntityPageData;
        return repairPageLinks(
          enforceSourcesSectionInMarkdown(
            enforceFrontmatterInMarkdown(
              enforceSparseInMarkdown(
                enforceAliasesInMarkdown(mergedBody, entity.title, entity.slug, entity.mergedAliases),
                entity.sparse === true,
              ),
              entity,
            ),
            buildCitationMap(entity).citationMap,
          ),
          entity.slug,
        );
      }
      if (kind === 'topic') {
        const topic = page as TopicPageData;
        return repairPageLinks(
          enforceTopicSourcesSectionInMarkdown(
            enforceTopicFrontmatterInMarkdown(
              enforceAliasesInMarkdown(mergedBody, topic.title, topic.slug),
              topic,
            ),
            buildCitationMap({ mentions: [], relationships: [], claims: topic.claims }).citationMap,
          ),
          `topic ${topic.slug}`,
        );
      }
      if (kind === 'composite') {
        const composite = page as CompositePageData;
        return repairPageLinks(
          enforceSourcesSectionInMarkdown(
            enforceCompositeFrontmatterInMarkdown(mergedBody, composite),
            buildCompositeCitationMap(composite).citationMap,
          ),
          `composite ${composite.slug}`,
        );
      }
      const comparison = page as ComparisonPageData;
      return repairPageLinks(
        enforceSourcesSectionInMarkdown(
          enforceComparisonBridgeInMarkdown(
            enforceComparisonFrontmatterInMarkdown(mergedBody, comparison),
            comparison,
          ),
          buildComparisonCitationMap(comparison).citationMap,
        ),
        `comparison ${comparison.slug}`,
      );
    };

    /** The kind's existing preservation checker (unioned check, §2.4). */
    const runPreservationCheck = (
      page: EntityPageData | TopicPageData | CompositePageData | ComparisonPageData,
      kind: SynthesisPageKind,
      writtenPage: string,
    ):
      | ReturnType<typeof checkPreservation>
      | ReturnType<typeof checkTopicPreservation>
      | ReturnType<typeof checkCompositePreservation>
      | ReturnType<typeof checkComparisonPreservation> => {
      if (kind === 'entity') {
        return checkPreservation(page as EntityPageData, writtenPage);
      }
      if (kind === 'topic') {
        return checkTopicPreservation(page as TopicPageData, writtenPage);
      }
      if (kind === 'composite') {
        return checkCompositePreservation(page as CompositePageData, writtenPage);
      }
      return checkComparisonPreservation(page as ComparisonPageData, writtenPage);
    };

    /**
     * Amendment ELIGIBILITY (per page already in a stage's to-run set): a
     * skip-eligible record of the SAME KIND with a recorded baseline, a
     * non-empty delta, a pre-materialize snapshot of the page, and no
     * curation-merge/cluster veto (gate 26.8: a survivor that absorbed a
     * page which itself carried a synthesis record is a SHAPE change — full
     * synthesis, not patch). Everything else — new pages, template/transport
     * fallbacks, shape changes, kind changes, empty deltas — takes the normal
     * full-synthesis chain.
     */
    const mergeAffectedSurvivors = new Set<string>();
    {
      const curation = lastMaterializeResult.curation;
      if (curation) {
        const preMaterializeSkipSlugs = new Set(
          [...amendmentSnapshot.keys()].map((path) => path.split('/').pop()?.replace(/\.md$/, '') ?? ''),
        );
        const vetoIfAbsorbedSynthesized = (into: string, from: string[]): void => {
          if (from.some((slug) => preMaterializeSkipSlugs.has(slug))) {
            mergeAffectedSurvivors.add(into);
          }
        };
        for (const merge of curation.entityMerges) {
          vetoIfAbsorbedSynthesized(merge.into, merge.from);
        }
        for (const merge of curation.fromSticky.entityMerges) {
          vetoIfAbsorbedSynthesized(merge.into, merge.from);
        }
        for (const merge of curation.topicMerges) {
          vetoIfAbsorbedSynthesized(merge.into, merge.from);
        }
        for (const merge of curation.fromSticky.topicMerges) {
          vetoIfAbsorbedSynthesized(merge.into, merge.from);
        }
        for (const entry of curation.autoApplied) {
          vetoIfAbsorbedSynthesized(entry.into, [entry.from]);
        }
        for (const cluster of curation.entityClusters) {
          vetoIfAbsorbedSynthesized(cluster.into, cluster.members);
        }
        for (const cluster of curation.fromSticky.entityClusters) {
          vetoIfAbsorbedSynthesized(cluster.into, cluster.members);
        }
      }
    }

    interface AmendmentPlan {
      delta: NewEvidenceDelta;
      snapshot: string;
    }

    const amendmentPlanFor = (
      page: EntityPageData | TopicPageData | CompositePageData | ComparisonPageData,
      kind: SynthesisPageKind,
    ): AmendmentPlan | null => {
      const relPath = synthesisPagePath(page);
      const record = synthesisRecords[relPath];
      if (
        !isSkipEligible(record) ||
        record.pageKind !== kind ||
        record.baselineKeys === undefined ||
        mergeAffectedSurvivors.has(page.slug)
      ) {
        return null;
      }
      const snapshot = amendmentSnapshot.get(relPath);
      if (snapshot === undefined) {
        return null;
      }
      const delta = newEvidenceFor(page, record.baselineKeys);
      if (delta.empty) {
        return null;
      }
      return { delta, snapshot };
    };

    /**
     * Best-effort output-token lookup for the amendment log: the last
     * `.state/llm-calls.json` entry whose context matches this page's
     * `amendment:<slug>` episode (never fabricated).
     */
    const amendmentOutputTokens = async (pageSlug: string): Promise<number | null> => {
      try {
        const raw = await readFile(llmLogPath, 'utf-8');
        const prefix = `amendment:${pageSlug}`;
        let last: number | null = null;
        for (const line of raw.split('\n')) {
          const trimmed = line.trim();
          if (trimmed === '') {
            continue;
          }
          try {
            const entry = JSON.parse(trimmed) as { context?: unknown; outputTokens?: unknown };
            if (
              typeof entry.context === 'string' &&
              (entry.context === prefix || entry.context.startsWith(`${prefix}#`)) &&
              typeof entry.outputTokens === 'number'
            ) {
              last = entry.outputTokens;
            }
          } catch {
            // Skip malformed lines.
          }
        }
        return last;
      } catch {
        return null;
      }
    };

    /**
     * ONE amendment EPISODE (§2.4): Amendment Writer → parse → validate →
     * apply → enforce → merged-page preservation, re-asked ≤3 total attempts
     * via `runWithFeedbackRetry` with the validator's exact errors (a JSON
     * parse failure additionally rides the Phase 16 v1.0.5 JSON corrector
     * inside the real writer). The MERGED-page preservation check runs the
     * kind's EXISTING checker over the enforced merge against the FULL
     * current pageData — equivalent to old ∪ new in the amendment-eligible
     * growth scenario (baseline ∪ new = the current key set when the
     * aggregate only grew; the aggregate may also have re-ordered, which the
     * full-data check covers exactly). Exhaustion returns null — the caller
     * falls back to the normal full-synthesis chain; the on-disk page is
     * touched only by a validated merged result. A THROWN transient
     * transport error also returns null (the chain retries the page in full
     * under the Phase 16 semantics); HTTP 4xx propagates and aborts the run.
     */
    const runAmendmentEpisode = async (args: {
      page: EntityPageData | TopicPageData | CompositePageData | ComparisonPageData;
      kind: SynthesisPageKind;
      plan: AmendmentPlan;
    }): Promise<{ mergedPage: string; entry: SynthesisReportEntry; attempts: number; opCounts: Record<string, number> } | null> => {
      const { page, kind, plan } = args;
      const relPath = synthesisPagePath(page);
      const request = buildAmendmentRequest({ pageData: page, delta: plan.delta, pageContent: plan.snapshot });
      const runAmendment = options.amendmentFn ?? writeAmendment;
      // The landed merge (holder object: assignments inside the validator
      // closure must survive TypeScript's control-flow narrowing).
      const landed: { patch: Patch | null; content: string | null } = { patch: null, content: null };
      let attemptsMade = 0;
      let lastErrors: string[] = [];
      try {
        const outcome = await runWithFeedbackRetry<string>(
          (feedback, attempt) => {
            attemptsMade = attempt;
            return runAmendment(request, agentsMd, llmLogPath, language, feedback ?? undefined, attempt);
          },
          (rawText) => {
            const parsed = parsePatch(rawText);
            if (parsed.patch === undefined) {
              lastErrors = parsed.errors;
              return { valid: false, errors: parsed.errors };
            }
            const validation = validatePatch(parsed.patch, {
              pageContent: plan.snapshot,
              pageKind: kind,
              ...(kind === 'composite'
                ? {
                    members: (page as CompositePageData).members.map((member) => ({
                      slug: member.slug,
                      title: member.title,
                    })),
                  }
                : {}),
            });
            if (!validation.valid) {
              lastErrors = validation.errors;
              return { valid: false, errors: validation.errors };
            }
            let mergedBody: string;
            try {
              mergedBody = applyPatch(plan.snapshot, parsed.patch);
            } catch (err) {
              const errors = [(err as Error).message];
              lastErrors = errors;
              return { valid: false, errors };
            }
            const enforced = enforceMergedPage(mergedBody, page, kind);
            const check = runPreservationCheck(page, kind, enforced);
            if (!check.passed) {
              const errors = preservationFeedbackErrors(check);
              lastErrors = errors;
              return { valid: false, errors };
            }
            landed.patch = parsed.patch;
            landed.content = enforced;
            return { valid: true, errors: [] };
          },
          {
            maxAttempts: SYNTHESIS_MAX_ATTEMPTS,
            label: `amendment:${page.slug}`,
            onRepair: (errors) => {
              console.warn(
                `Amendment patch failed validation for ${page.slug} (${errors[0] ?? 'unknown error'}); retrying with validator feedback.`,
              );
            },
          },
        );
        if (outcome.output === null || landed.content === null || landed.patch === null) {
          const cause = lastErrors[0] ?? 'validation-exhaustion';
          console.warn(
            `Warning: amendment for ${relPath} failed after ${outcome.attempts} attempt(s) (${cause}) — falling back to full synthesis.`,
          );
          patchFallbacksThisRun += 1;
          result.patchFallbacks = (result.patchFallbacks ?? 0) + 1;
          await appendAmendmentLogRecord(
            dir,
            {
              timestamp: new Date().toISOString(),
              page: relPath,
              pdf: pdfLabel,
              attempts: outcome.attempts,
              operations: {},
              outcome: 'fallback-full-synthesis',
              cause,
            },
            () => amendmentOutputTokens(page.slug),
          );
          return null;
        }
        const entry: SynthesisReportEntry = {
          timestamp: new Date().toISOString(),
          pageType: kind,
          slug: page.slug,
          strict: { attempted: false, passed: false },
          permissive: { attempted: false, passed: false },
          finalMode: 'patch-amended',
        };
        return {
          mergedPage: landed.content,
          entry,
          attempts: outcome.attempts,
          opCounts: countOperations(landed.patch.operations),
        };
      } catch (error) {
        // A transient transport error during the amendment call: the episode
        // ends without a patch; the page's normal full-synthesis chain runs
        // next and carries the Phase 16 per-page transport semantics. HTTP
        // 4xx and every other class rethrow (abort the run).
        if (!isTransientTransportError(error)) {
          throw error;
        }
        console.warn(
          `Warning: amendment for ${relPath} hit a transport failure after retries — falling back to full synthesis.`,
        );
        patchFallbacksThisRun += 1;
        result.patchFallbacks = (result.patchFallbacks ?? 0) + 1;
        await appendAmendmentLogRecord(
          dir,
          {
            timestamp: new Date().toISOString(),
            page: relPath,
            pdf: pdfLabel,
            attempts: Math.max(attemptsMade, 1),
            operations: {},
            outcome: 'fallback-full-synthesis',
            cause: 'transport-exhaustion',
          },
          () => amendmentOutputTokens(page.slug),
        );
        return null;
      }
    };

    /**
     * The per-page amendment hook (§2.3): returns the PATCHED outcome when a
     * validated merged page was written (page on disk, record
     * 'patch-amended' with the new baseline, amendment-log episode, metrics),
     * null when the page was not amendable or the patch failed (the caller's
     * normal strict → permissive → template chain takes over — never a
     * half-patched page).
     */
    const tryAmendPage = async (
      page: EntityPageData | TopicPageData | CompositePageData | ComparisonPageData,
      kind: SynthesisPageKind,
    ): Promise<SynthesisOutcome | null> => {
      const plan = amendmentPlanFor(page, kind);
      if (plan === null) {
        return null;
      }
      const episode = await runAmendmentEpisode({ page, kind, plan });
      if (episode === null) {
        return null;
      }
      const relPath = synthesisPagePath(page);
      await writeFile(join(dir, relPath), episode.mergedPage, 'utf-8');
      writtenPagePaths.add(relPath);
      patchedPagesThisRun += 1;
      result.patchedPages = (result.patchedPages ?? 0) + 1;
      await recordSynthesisOutcome(page, kind, episode.entry);
      await appendAmendmentLogRecord(
        dir,
        {
          timestamp: episode.entry.timestamp,
          page: relPath,
          pdf: pdfLabel,
          attempts: episode.attempts,
          operations: episode.opCounts,
          outcome: 'patched',
          cause: null,
        },
        () => amendmentOutputTokens(page.slug),
      );
      const opSummary = Object.entries(episode.opCounts)
        .map(([op, count]) => `${count} ${op}`)
        .join(', ');
      progress(`Amended ${relPath} (patch: ${opSummary}).`);
      return { kind: 'patched', entry: episode.entry };
    };

    // 1. Entity synthesis. The per-page body below is the pre-Phase-15 loop
    // body verbatim, with only the report logging inverted (the entry is
    // returned to the caller instead of appended per page) and the Phase 16
    // transport-fallback wrap around it.
    const synthesizeEntityPage = async (
      entityPage: EntityPageData,
      detector: OutageDetector,
    ): Promise<SynthesisOutcome> => {
      // Phase 16 (§2.1): which chain mode the page is in if a transport error
      // throws — recorded in the transport-fallback report entry.
      let chainPhase: 'strict' | 'permissive' = 'strict';
      try {
        // Phase 26 (§2.3): the amendment path FIRST — an existing synthesized
        // page of unchanged shape whose aggregate grew takes a patch, not a
        // full re-emit (returns null whenever the page is not amendable or
        // the patch failed; the normal chain below is the universal fallback).
        const amended = await tryAmendPage(entityPage, 'entity');
        if (amended !== null) {
          return amended;
        }
        // Strict synthesis first (readable prose that preserves exact
        // mention/relationship/claim strings), retried up to
        // SYNTHESIS_MAX_ATTEMPTS times on preservation failure (Phase 7
        // v1.1.0 bounded retry amendment — applies to every language).
        const strict = await trySynthesisMode(
          (feedback, attempt) => runEntitySynthesis(entityPage, agentsMd, llmLogPath, language, feedback ?? undefined, attempt),
          (page) => checkPreservation(entityPage, page),
          entityPage.slug,
        );
        if (strict.page !== null) {
          const folderPath = join(dir, entityPage.folder);
          // UAT 6.3 fix: re-impose the aliases frontmatter field over the
          // model-written page (deterministic; the LLM's frontmatter is not
          // trusted for the alias rule). Phase 13 (vision `02` §4.8): the
          // sparse flag is re-imposed the same way from the structured page
          // data — a model-emitted `sparse` on a non-sparse entity is removed.
          // Phase 14 (phase doc §2.3): curation-merged variant titles ride
          // along in the aliases. Phase 17 (B1 + B2, vision `05` §2 +
          // `06` §2-§3/§7): after the aliases/sparse enforcers, the COMPLETE
          // frontmatter is re-imposed from the page data (created when the
          // model omitted it; `updated` is the real write time) and the
          // `## Sources` definitions are rebuilt in resolvable basename
          // form — the model's frontmatter and definitions are never
          // trusted.
          await writeFile(
            join(folderPath, `${entityPage.slug}.md`),
            repairPageLinks(
              enforceSourcesSectionInMarkdown(
                enforceFrontmatterInMarkdown(
                  enforceSparseInMarkdown(
                    enforceAliasesInMarkdown(strict.page, entityPage.title, entityPage.slug, entityPage.mergedAliases),
                    entityPage.sparse === true,
                  ),
                  entityPage,
                ),
                buildCitationMap(entityPage).citationMap,
              ),
              entityPage.slug,
            ),
            'utf-8',
          );
          return {
            kind: 'strict',
            entry: {
              timestamp: new Date().toISOString(),
              pageType: 'entity',
              slug: entityPage.slug,
              strict: { attempted: true, passed: true, attempts: strict.attempts },
              permissive: { attempted: false, passed: false },
              finalMode: 'strict-synthesis',
            },
          };
        }

        // Fallback: permissive synthesis (prose summary + verbatim structured
        // data), also retried up to SYNTHESIS_MAX_ATTEMPTS times.
        console.warn(
          `Strict synthesis failed preservation for ${entityPage.slug} after ${strict.attempts} attempt(s). Trying permissive fallback.`,
        );
        chainPhase = 'permissive';
        const permissive = await trySynthesisMode(
          (feedback, attempt) => runEntityPermissiveSynthesis(entityPage, agentsMd, llmLogPath, language, feedback ?? undefined, attempt),
          (page) => checkPreservation(entityPage, page),
          entityPage.slug,
        );
        if (permissive.page !== null) {
          const folderPath = join(dir, entityPage.folder);
          // Phase 13: aliases + sparse re-imposed deterministically over the
          // model-written page, same as the strict write point above. Phase 14:
          // curation-merged variant titles included in the aliases. Phase 17
          // (B1 + B2): complete-frontmatter re-imposition and `## Sources`
          // normalization, same as the strict write point above.
          await writeFile(
            join(folderPath, `${entityPage.slug}.md`),
            repairPageLinks(
              enforceSourcesSectionInMarkdown(
                enforceFrontmatterInMarkdown(
                  enforceSparseInMarkdown(
                    enforceAliasesInMarkdown(permissive.page, entityPage.title, entityPage.slug, entityPage.mergedAliases),
                    entityPage.sparse === true,
                  ),
                  entityPage,
                ),
                buildCitationMap(entityPage).citationMap,
              ),
              entityPage.slug,
            ),
            'utf-8',
          );
          return {
            kind: 'permissive',
            entry: {
              timestamp: new Date().toISOString(),
              pageType: 'entity',
              slug: entityPage.slug,
              strict: { attempted: true, passed: false, attempts: strict.attempts },
              permissive: { attempted: true, passed: true, attempts: permissive.attempts },
              finalMode: 'permissive-synthesis',
            },
          };
        }

        console.warn(
          `Permissive synthesis also failed preservation for ${entityPage.slug} after ${permissive.attempts} attempt(s). Keeping structured template.`,
        );
        if (permissive.lastCheck !== null) {
          await logConflict(dir, entityPage.slug, permissive.lastCheck, 'entity');
        }
        return {
          kind: 'template',
          entry: {
            timestamp: new Date().toISOString(),
            pageType: 'entity',
            slug: entityPage.slug,
            strict: { attempted: true, passed: false, attempts: strict.attempts },
            permissive: { attempted: true, passed: false, attempts: permissive.attempts },
            finalMode: 'structured-template',
          },
        };
      } catch (error) {
        // Phase 16 (vision `04` §6, user-ratified 2026-07-25): the per-page
        // transport fallback. ONLY an exhausted transient transport error
        // (429/5xx/network/timeout after the client's bounded retries — the
        // client's own classification) is caught for THIS page: the page
        // lands on the deterministic structured template (identical to the
        // quality-exhaustion fallback), a loud warning is emitted, the report
        // records finalMode 'transport-fallback', and metrics gains a
        // transport failure. HTTP 4xx NEVER falls back — it rethrows and
        // aborts the run, as does every other error class.
        if (!isTransientTransportError(error)) {
          throw error;
        }
        // Phase 16 outage detector: past either threshold this rethrows the
        // transport error and the pool aborts the run with it (fail loud).
        recordDetectorTransportFailure(detector, error);
        transportFailuresThisRun += 1;
        console.warn(`Transport failure for ${entityPage.slug} after retries — template fallback.`);
        return {
          kind: 'transport',
          entry: {
            timestamp: new Date().toISOString(),
            pageType: 'entity',
            slug: entityPage.slug,
            strict: { attempted: true, passed: false },
            permissive:
              chainPhase === 'permissive'
                ? { attempted: true, passed: false }
                : { attempted: false, passed: false },
            finalMode: 'transport-fallback',
          },
        };
      }
    };

    const entityPages = lastMaterializeResult.entityPages;
    const entityStage = partitionStage(entityPages);
    const entityDetector = makeOutageDetector(entityStage.toRun.length);
    let entityCompleted = 0;
    const entityOutcomes = await runPool(
      entityStage.toRun,
      async (entityPage) => {
        const outcome = await synthesizeEntityPage(entityPage, entityDetector);
        if (outcome.kind !== 'transport') {
          // The chain completed — the LLM answered — so the transport is
          // healthy even when the outcome is a quality template fallback.
          recordDetectorSuccess(entityDetector);
        }
        // Phase 16 (vision `04` Step 11): per-page checkpoint — the page's
        // synthesis record is persisted as it completes (through the Phase 15
        // serialized write queue), so an abort costs only pages in flight.
        await recordSynthesisOutcome(entityPage, 'entity', outcome.entry);
        entityCompleted += 1;
        progress(
          `Synthesis: ${entityCompleted}/${entityStage.toRun.length} pages complete (${SYNTHESIS_POOL_SIZE} workers)`,
        );
        return outcome;
      },
      { concurrency: SYNTHESIS_POOL_SIZE, staggerMs: poolStaggerMs },
    );
    // Merge pooled outcomes with resume-skipped pages back into ORIGINAL page
    // order (skipped pages contribute reconstructed entries), then tally.
    const entityOutcomeBySlug = new Map(entityOutcomes.map((outcome) => [outcome.entry.slug, outcome]));
    const entityEntries: SynthesisReportEntry[] = [];
    for (const entityPage of entityPages) {
      const skippedRecord = entityStage.skipped.get(entityPage.slug);
      if (skippedRecord) {
        entityEntries.push(reconstructedSkipEntry('entity', entityPage.slug, skippedRecord));
        // Phase 26: run-level skip dedupe — a page skip-confirmed in more
        // than one per-PDF stage invocation counts once per run.
        if (!synthesisSkipCountedPages.has(synthesisPagePath(entityPage))) {
          synthesisSkipCountedPages.add(synthesisPagePath(entityPage));
          result.synthesisSkipped = (result.synthesisSkipped ?? 0) + 1;
        }
        continue;
      }
      const outcome = entityOutcomeBySlug.get(entityPage.slug);
      if (!outcome) {
        continue; // unreachable — the pool covers every non-skipped page.
      }
      entityEntries.push(outcome.entry);
      if (outcome.kind === 'strict') {
        result.synthesized = (result.synthesized ?? 0) + 1;
      } else if (outcome.kind === 'permissive') {
        result.synthesizedPermissive = (result.synthesizedPermissive ?? 0) + 1;
      } else if (outcome.kind === 'template') {
        result.synthesisConflicts = (result.synthesisConflicts ?? 0) + 1;
      }
      // 'transport' is counted in metrics.transportFailures, not in the
      // preservation-conflict counters (a different failure class).
    }
    await appendSynthesisReportEntries(dir, entityEntries);
    if (entityStage.skipped.size > 0) {
      progress(`Synthesis: ${entityStage.skipped.size} page(s) skipped (unchanged data).`);
    }

    // 2. Topic synthesis (same pooled shape as the entity stage, including
    // the Phase 16 transport-fallback wrap).
    const synthesizeTopicPage = async (
      topicPage: TopicPageData,
      detector: OutageDetector,
    ): Promise<SynthesisOutcome> => {
      let chainPhase: 'strict' | 'permissive' = 'strict';
      try {
        // Phase 26 (§2.3): the amendment path first (same rule as entities).
        const amended = await tryAmendPage(topicPage, 'topic');
        if (amended !== null) {
          return amended;
        }
        const strict = await trySynthesisMode(
          (feedback, attempt) => runTopicSynthesis(topicPage, agentsMd, llmLogPath, language, feedback ?? undefined, attempt),
          (page) => checkTopicPreservation(topicPage, page),
          `topic ${topicPage.slug}`,
        );
        if (strict.page !== null) {
          const folderPath = join(dir, topicPage.folder);
          // Phase 17 (B1 + B2, vision `05` §2 + `06` §2-§3/§7): the topic
          // equivalent of the entity enforcement — complete deterministic
          // frontmatter (created when absent; `updated` is the real write
          // time) and normalized `## Sources` definitions, composed after
          // the UAT 6.3 aliases enforcer.
          await writeFile(
            join(folderPath, `${topicPage.slug}.md`),
            repairPageLinks(
              enforceTopicSourcesSectionInMarkdown(
                enforceTopicFrontmatterInMarkdown(
                  enforceAliasesInMarkdown(strict.page, topicPage.title, topicPage.slug),
                  topicPage,
                ),
                buildCitationMap({ mentions: [], relationships: [], claims: topicPage.claims }).citationMap,
              ),
              `topic ${topicPage.slug}`,
            ),
            'utf-8',
          );
          return {
            kind: 'strict',
            entry: {
              timestamp: new Date().toISOString(),
              pageType: 'topic',
              slug: topicPage.slug,
              strict: { attempted: true, passed: true, attempts: strict.attempts },
              permissive: { attempted: false, passed: false },
              finalMode: 'strict-synthesis',
            },
          };
        }

        console.warn(
          `Strict synthesis failed preservation for topic ${topicPage.slug} after ${strict.attempts} attempt(s). Trying permissive fallback.`,
        );
        chainPhase = 'permissive';
        const permissive = await trySynthesisMode(
          (feedback, attempt) => runTopicPermissiveSynthesis(topicPage, agentsMd, llmLogPath, language, feedback ?? undefined, attempt),
          (page) => checkTopicPreservation(topicPage, page),
          `topic ${topicPage.slug}`,
        );
        if (permissive.page !== null) {
          const folderPath = join(dir, topicPage.folder);
          // Phase 17 (B1 + B2): complete-frontmatter re-imposition and
          // `## Sources` normalization, same as the strict topic write point.
          await writeFile(
            join(folderPath, `${topicPage.slug}.md`),
            repairPageLinks(
              enforceTopicSourcesSectionInMarkdown(
                enforceTopicFrontmatterInMarkdown(
                  enforceAliasesInMarkdown(permissive.page, topicPage.title, topicPage.slug),
                  topicPage,
                ),
                buildCitationMap({ mentions: [], relationships: [], claims: topicPage.claims }).citationMap,
              ),
              `topic ${topicPage.slug}`,
            ),
            'utf-8',
          );
          return {
            kind: 'permissive',
            entry: {
              timestamp: new Date().toISOString(),
              pageType: 'topic',
              slug: topicPage.slug,
              strict: { attempted: true, passed: false, attempts: strict.attempts },
              permissive: { attempted: true, passed: true, attempts: permissive.attempts },
              finalMode: 'permissive-synthesis',
            },
          };
        }

        console.warn(
          `Permissive synthesis also failed preservation for topic ${topicPage.slug} after ${permissive.attempts} attempt(s). Keeping structured template.`,
        );
        if (permissive.lastCheck !== null) {
          await logConflict(dir, topicPage.slug, permissive.lastCheck, 'topic');
        }
        return {
          kind: 'template',
          entry: {
            timestamp: new Date().toISOString(),
            pageType: 'topic',
            slug: topicPage.slug,
            strict: { attempted: true, passed: false, attempts: strict.attempts },
            permissive: { attempted: true, passed: false, attempts: permissive.attempts },
            finalMode: 'structured-template',
          },
        };
      } catch (error) {
        // Phase 16 (vision `04` §6): the per-page transport fallback — only
        // exhausted transient transport errors; 4xx and every other class
        // rethrows and aborts the run (same contract as the entity stage).
        if (!isTransientTransportError(error)) {
          throw error;
        }
        recordDetectorTransportFailure(detector, error);
        transportFailuresThisRun += 1;
        console.warn(`Transport failure for ${topicPage.slug} after retries — template fallback.`);
        return {
          kind: 'transport',
          entry: {
            timestamp: new Date().toISOString(),
            pageType: 'topic',
            slug: topicPage.slug,
            strict: { attempted: true, passed: false },
            permissive:
              chainPhase === 'permissive'
                ? { attempted: true, passed: false }
                : { attempted: false, passed: false },
            finalMode: 'transport-fallback',
          },
        };
      }
    };

    const topicPages = lastMaterializeResult.topicPages;
    const topicStage = partitionStage(topicPages);
    const topicDetector = makeOutageDetector(topicStage.toRun.length);
    let topicCompleted = 0;
    const topicOutcomes = await runPool(
      topicStage.toRun,
      async (topicPage) => {
        const outcome = await synthesizeTopicPage(topicPage, topicDetector);
        if (outcome.kind !== 'transport') {
          recordDetectorSuccess(topicDetector);
        }
        await recordSynthesisOutcome(topicPage, 'topic', outcome.entry);
        topicCompleted += 1;
        progress(
          `Synthesis: ${topicCompleted}/${topicStage.toRun.length} pages complete (${SYNTHESIS_POOL_SIZE} workers)`,
        );
        return outcome;
      },
      { concurrency: SYNTHESIS_POOL_SIZE, staggerMs: poolStaggerMs },
    );
    const topicOutcomeBySlug = new Map(topicOutcomes.map((outcome) => [outcome.entry.slug, outcome]));
    const topicEntries: SynthesisReportEntry[] = [];
    for (const topicPage of topicPages) {
      const skippedRecord = topicStage.skipped.get(topicPage.slug);
      if (skippedRecord) {
        topicEntries.push(reconstructedSkipEntry('topic', topicPage.slug, skippedRecord));
        if (!synthesisSkipCountedPages.has(synthesisPagePath(topicPage))) {
          synthesisSkipCountedPages.add(synthesisPagePath(topicPage));
          result.synthesisTopicsSkipped = (result.synthesisTopicsSkipped ?? 0) + 1;
        }
        continue;
      }
      const outcome = topicOutcomeBySlug.get(topicPage.slug);
      if (!outcome) {
        continue; // unreachable — the pool covers every non-skipped page.
      }
      topicEntries.push(outcome.entry);
      if (outcome.kind === 'strict') {
        result.synthesizedTopics = (result.synthesizedTopics ?? 0) + 1;
      } else if (outcome.kind === 'permissive') {
        result.synthesizedTopicsPermissive = (result.synthesizedTopicsPermissive ?? 0) + 1;
      } else if (outcome.kind === 'template') {
        result.topicConflicts = (result.topicConflicts ?? 0) + 1;
      }
    }
    await appendSynthesisReportEntries(dir, topicEntries);
    if (topicStage.skipped.size > 0) {
      progress(`Synthesis: ${topicStage.skipped.size} page(s) skipped (unchanged data).`);
    }

    // 3. Composite synthesis (Phase 22 gate 22.10, the five-class rollup
    // amendment): ONE rich article per composite page, mirroring the entity/
    // topic stages exactly — the same pooled shape, the same strict →
    // permissive → structured-template chain with the Phase 12 reask loop,
    // the Phase 16 transport-fallback wrap, and the per-page checkpoint.
    const runCompositeSynthesis = options.synthesizeCompositeFn ?? writeCompositeSynthesis;
    const runCompositePermissiveSynthesis =
      options.synthesizeCompositePermissiveFn ?? writePermissiveCompositeSynthesis;
    const synthesizeCompositePage = async (
      compositePage: CompositePageData,
      detector: OutageDetector,
    ): Promise<SynthesisOutcome> => {
      let chainPhase: 'strict' | 'permissive' = 'strict';
      try {
        // Phase 26 (§2.3): the amendment path first (member-anchored
        // add-evidence / add-member; same rule as the other kinds).
        const amended = await tryAmendPage(compositePage, 'composite');
        if (amended !== null) {
          return amended;
        }
        const strict = await trySynthesisMode(
          (feedback, attempt) => runCompositeSynthesis(compositePage, agentsMd, llmLogPath, language, feedback ?? undefined, attempt),
          (page) => checkCompositePreservation(compositePage, page),
          `composite ${compositePage.slug}`,
        );
        if (strict.page !== null) {
          const folderPath = join(dir, compositePage.folder);
          // Phase 22 gate 22.10 (the Phase 17/18/20 write-point enforcers,
          // as applicable to the composite shell): the COMPLETE deterministic
          // composite frontmatter (type composite, class, members block,
          // aliases union, real updated, aggregated sources — created when
          // absent) and the basename `## Sources` rebuild, with the Phase 20
          // link repair outermost. The sparse enforcer is NOT applicable
          // (sparse never applies to composites).
          await writeFile(
            join(folderPath, `${compositePage.slug}.md`),
            repairPageLinks(
              enforceSourcesSectionInMarkdown(
                enforceCompositeFrontmatterInMarkdown(strict.page, compositePage),
                buildCompositeCitationMap(compositePage).citationMap,
              ),
              `composite ${compositePage.slug}`,
            ),
            'utf-8',
          );
          return {
            kind: 'strict',
            entry: {
              timestamp: new Date().toISOString(),
              pageType: 'composite',
              slug: compositePage.slug,
              strict: { attempted: true, passed: true, attempts: strict.attempts },
              permissive: { attempted: false, passed: false },
              finalMode: 'strict-synthesis',
            },
          };
        }

        console.warn(
          `Strict synthesis failed preservation for composite ${compositePage.slug} after ${strict.attempts} attempt(s). Trying permissive fallback.`,
        );
        chainPhase = 'permissive';
        const permissive = await trySynthesisMode(
          (feedback, attempt) => runCompositePermissiveSynthesis(compositePage, agentsMd, llmLogPath, language, feedback ?? undefined, attempt),
          (page) => checkCompositePreservation(compositePage, page),
          `composite ${compositePage.slug}`,
        );
        if (permissive.page !== null) {
          const folderPath = join(dir, compositePage.folder);
          await writeFile(
            join(folderPath, `${compositePage.slug}.md`),
            repairPageLinks(
              enforceSourcesSectionInMarkdown(
                enforceCompositeFrontmatterInMarkdown(permissive.page, compositePage),
                buildCompositeCitationMap(compositePage).citationMap,
              ),
              `composite ${compositePage.slug}`,
            ),
            'utf-8',
          );
          return {
            kind: 'permissive',
            entry: {
              timestamp: new Date().toISOString(),
              pageType: 'composite',
              slug: compositePage.slug,
              strict: { attempted: true, passed: false, attempts: strict.attempts },
              permissive: { attempted: true, passed: true, attempts: permissive.attempts },
              finalMode: 'permissive-synthesis',
            },
          };
        }

        console.warn(
          `Permissive synthesis also failed preservation for composite ${compositePage.slug} after ${permissive.attempts} attempt(s). Keeping structured template.`,
        );
        if (permissive.lastCheck !== null) {
          await logConflict(dir, compositePage.slug, permissive.lastCheck, 'composite');
        }
        return {
          kind: 'template',
          entry: {
            timestamp: new Date().toISOString(),
            pageType: 'composite',
            slug: compositePage.slug,
            strict: { attempted: true, passed: false, attempts: strict.attempts },
            permissive: { attempted: true, passed: false, attempts: permissive.attempts },
            finalMode: 'structured-template',
          },
        };
      } catch (error) {
        // Phase 16 (vision `04` §6): the per-page transport fallback — only
        // exhausted transient transport errors; 4xx and every other class
        // rethrows and aborts the run (same contract as the other stages).
        if (!isTransientTransportError(error)) {
          throw error;
        }
        recordDetectorTransportFailure(detector, error);
        transportFailuresThisRun += 1;
        console.warn(`Transport failure for composite ${compositePage.slug} after retries — template fallback.`);
        return {
          kind: 'transport',
          entry: {
            timestamp: new Date().toISOString(),
            pageType: 'composite',
            slug: compositePage.slug,
            strict: { attempted: true, passed: false },
            permissive:
              chainPhase === 'permissive'
                ? { attempted: true, passed: false }
                : { attempted: false, passed: false },
            finalMode: 'transport-fallback',
          },
        };
      }
    };

    const compositePages = lastMaterializeResult.compositePages;
    const compositeStage = partitionStage(compositePages);
    const compositeDetector = makeOutageDetector(compositeStage.toRun.length);
    let compositeCompleted = 0;
    const compositeOutcomes = await runPool(
      compositeStage.toRun,
      async (compositePage) => {
        const outcome = await synthesizeCompositePage(compositePage, compositeDetector);
        if (outcome.kind !== 'transport') {
          recordDetectorSuccess(compositeDetector);
        }
        // Phase 16 (vision `04` Step 11): per-page checkpoint — the composite
        // fingerprint over { members, unioned evidence, language } drives
        // skip-eligibility on later runs (gate 22.8's resume contract).
        await recordSynthesisOutcome(compositePage, 'composite', outcome.entry);
        compositeCompleted += 1;
        progress(
          `Synthesis: ${compositeCompleted}/${compositeStage.toRun.length} pages complete (${SYNTHESIS_POOL_SIZE} workers)`,
        );
        return outcome;
      },
      { concurrency: SYNTHESIS_POOL_SIZE, staggerMs: poolStaggerMs },
    );
    const compositeOutcomeBySlug = new Map(compositeOutcomes.map((outcome) => [outcome.entry.slug, outcome]));
    const compositeEntries: SynthesisReportEntry[] = [];
    for (const compositePage of compositePages) {
      const skippedRecord = compositeStage.skipped.get(compositePage.slug);
      if (skippedRecord) {
        compositeEntries.push(reconstructedSkipEntry('composite', compositePage.slug, skippedRecord));
        if (!synthesisSkipCountedPages.has(synthesisPagePath(compositePage))) {
          synthesisSkipCountedPages.add(synthesisPagePath(compositePage));
          result.synthesisCompositesSkipped = (result.synthesisCompositesSkipped ?? 0) + 1;
        }
        continue;
      }
      const outcome = compositeOutcomeBySlug.get(compositePage.slug);
      if (!outcome) {
        continue; // unreachable — the pool covers every non-skipped page.
      }
      compositeEntries.push(outcome.entry);
      if (outcome.kind === 'strict') {
        result.synthesizedComposites = (result.synthesizedComposites ?? 0) + 1;
      } else if (outcome.kind === 'permissive') {
        result.synthesizedCompositesPermissive = (result.synthesizedCompositesPermissive ?? 0) + 1;
      } else if (outcome.kind === 'template') {
        result.compositeConflicts = (result.compositeConflicts ?? 0) + 1;
      }
    }
    await appendSynthesisReportEntries(dir, compositeEntries);
    if (compositeStage.skipped.size > 0) {
      progress(`Synthesis: ${compositeStage.skipped.size} page(s) skipped (unchanged data).`);
    }

    // 4. Comparison synthesis (Phase 23 §2.3, backlog B21): ONE rich
    // comparison article per comparison-table subject, mirroring the 22.10
    // composite stage exactly — the same pooled shape, the same strict →
    // permissive → structured-template chain with the Phase 12 reask loop
    // (the row-value preservation check's exact dropped values fed back),
    // the Phase 16 transport-fallback wrap, and the per-page checkpoint.
    const runComparisonSynthesis = options.synthesizeComparisonFn ?? writeComparisonSynthesis;
    const runComparisonPermissiveSynthesis =
      options.synthesizeComparisonPermissiveFn ?? writePermissiveComparisonSynthesis;
    const synthesizeComparisonPage = async (
      comparisonPage: ComparisonPageData,
      detector: OutageDetector,
    ): Promise<SynthesisOutcome> => {
      let chainPhase: 'strict' | 'permissive' = 'strict';
      try {
        // Phase 26 (§2.3): the amendment path first (new dated table sections
        // anchor under their exact `## Table:` headings; same rule overall).
        const amended = await tryAmendPage(comparisonPage, 'comparison');
        if (amended !== null) {
          return amended;
        }
        const strict = await trySynthesisMode(
          (feedback, attempt) => runComparisonSynthesis(comparisonPage, agentsMd, llmLogPath, language, feedback ?? undefined, attempt),
          (page) => checkComparisonPreservation(comparisonPage, page),
          `comparison ${comparisonPage.slug}`,
        );
        if (strict.page !== null) {
          const folderPath = join(dir, comparisonPage.folder);
          // Phase 23 (the 22.10 write-point enforcers, as applicable to the
          // comparison shell): the COMPLETE deterministic comparison
          // frontmatter (type comparison, aliases union, real updated,
          // aggregated sources — created when absent), the deterministic
          // `## Related comparisons in prose` bridge re-imposed (the model's
          // rendering of it is never trusted), and the basename `## Sources`
          // rebuild, with the Phase 20 link repair outermost. The sparse
          // enforcer is NOT applicable (sparse never applies to comparisons).
          await writeFile(
            join(folderPath, `${comparisonPage.slug}.md`),
            repairPageLinks(
              enforceSourcesSectionInMarkdown(
                enforceComparisonBridgeInMarkdown(
                  enforceComparisonFrontmatterInMarkdown(strict.page, comparisonPage),
                  comparisonPage,
                ),
                buildComparisonCitationMap(comparisonPage).citationMap,
              ),
              `comparison ${comparisonPage.slug}`,
            ),
            'utf-8',
          );
          return {
            kind: 'strict',
            entry: {
              timestamp: new Date().toISOString(),
              pageType: 'comparison',
              slug: comparisonPage.slug,
              strict: { attempted: true, passed: true, attempts: strict.attempts },
              permissive: { attempted: false, passed: false },
              finalMode: 'strict-synthesis',
            },
          };
        }

        console.warn(
          `Strict synthesis failed preservation for comparison ${comparisonPage.slug} after ${strict.attempts} attempt(s). Trying permissive fallback.`,
        );
        chainPhase = 'permissive';
        const permissive = await trySynthesisMode(
          (feedback, attempt) => runComparisonPermissiveSynthesis(comparisonPage, agentsMd, llmLogPath, language, feedback ?? undefined, attempt),
          (page) => checkComparisonPreservation(comparisonPage, page),
          `comparison ${comparisonPage.slug}`,
        );
        if (permissive.page !== null) {
          const folderPath = join(dir, comparisonPage.folder);
          await writeFile(
            join(folderPath, `${comparisonPage.slug}.md`),
            repairPageLinks(
              enforceSourcesSectionInMarkdown(
                enforceComparisonBridgeInMarkdown(
                  enforceComparisonFrontmatterInMarkdown(permissive.page, comparisonPage),
                  comparisonPage,
                ),
                buildComparisonCitationMap(comparisonPage).citationMap,
              ),
              `comparison ${comparisonPage.slug}`,
            ),
            'utf-8',
          );
          return {
            kind: 'permissive',
            entry: {
              timestamp: new Date().toISOString(),
              pageType: 'comparison',
              slug: comparisonPage.slug,
              strict: { attempted: true, passed: false, attempts: strict.attempts },
              permissive: { attempted: true, passed: true, attempts: permissive.attempts },
              finalMode: 'permissive-synthesis',
            },
          };
        }

        console.warn(
          `Permissive synthesis also failed preservation for comparison ${comparisonPage.slug} after ${permissive.attempts} attempt(s). Keeping structured template.`,
        );
        if (permissive.lastCheck !== null) {
          await logConflict(dir, comparisonPage.slug, permissive.lastCheck, 'comparison');
        }
        return {
          kind: 'template',
          entry: {
            timestamp: new Date().toISOString(),
            pageType: 'comparison',
            slug: comparisonPage.slug,
            strict: { attempted: true, passed: false, attempts: strict.attempts },
            permissive: { attempted: true, passed: false, attempts: permissive.attempts },
            finalMode: 'structured-template',
          },
        };
      } catch (error) {
        // Phase 16 (vision `04` §6): the per-page transport fallback — only
        // exhausted transient transport errors; 4xx and every other class
        // rethrows and aborts the run (same contract as the other stages).
        if (!isTransientTransportError(error)) {
          throw error;
        }
        recordDetectorTransportFailure(detector, error);
        transportFailuresThisRun += 1;
        console.warn(`Transport failure for comparison ${comparisonPage.slug} after retries — template fallback.`);
        return {
          kind: 'transport',
          entry: {
            timestamp: new Date().toISOString(),
            pageType: 'comparison',
            slug: comparisonPage.slug,
            strict: { attempted: true, passed: false },
            permissive:
              chainPhase === 'permissive'
                ? { attempted: true, passed: false }
                : { attempted: false, passed: false },
            finalMode: 'transport-fallback',
          },
        };
      }
    };

    const comparisonPages = lastMaterializeResult.comparisonPages;
    const comparisonStage = partitionStage(comparisonPages);
    const comparisonDetector = makeOutageDetector(comparisonStage.toRun.length);
    let comparisonCompleted = 0;
    const comparisonOutcomes = await runPool(
      comparisonStage.toRun,
      async (comparisonPage) => {
        const outcome = await synthesizeComparisonPage(comparisonPage, comparisonDetector);
        if (outcome.kind !== 'transport') {
          recordDetectorSuccess(comparisonDetector);
        }
        // Phase 16 (vision `04` Step 11): per-page checkpoint — the
        // comparison fingerprint over { subject, dated sections, bridge,
        // language } drives skip-eligibility on later runs.
        await recordSynthesisOutcome(comparisonPage, 'comparison', outcome.entry);
        comparisonCompleted += 1;
        progress(
          `Synthesis: ${comparisonCompleted}/${comparisonStage.toRun.length} pages complete (${SYNTHESIS_POOL_SIZE} workers)`,
        );
        return outcome;
      },
      { concurrency: SYNTHESIS_POOL_SIZE, staggerMs: poolStaggerMs },
    );
    const comparisonOutcomeBySlug = new Map(comparisonOutcomes.map((outcome) => [outcome.entry.slug, outcome]));
    const comparisonEntries: SynthesisReportEntry[] = [];
    for (const comparisonPage of comparisonPages) {
      const skippedRecord = comparisonStage.skipped.get(comparisonPage.slug);
      if (skippedRecord) {
        comparisonEntries.push(reconstructedSkipEntry('comparison', comparisonPage.slug, skippedRecord));
        if (!synthesisSkipCountedPages.has(synthesisPagePath(comparisonPage))) {
          synthesisSkipCountedPages.add(synthesisPagePath(comparisonPage));
          result.synthesisComparisonsSkipped = (result.synthesisComparisonsSkipped ?? 0) + 1;
        }
        continue;
      }
      const outcome = comparisonOutcomeBySlug.get(comparisonPage.slug);
      if (!outcome) {
        continue; // unreachable — the pool covers every non-skipped page.
      }
      comparisonEntries.push(outcome.entry);
      if (outcome.kind === 'strict') {
        result.synthesizedComparisons = (result.synthesizedComparisons ?? 0) + 1;
      } else if (outcome.kind === 'permissive') {
        result.synthesizedComparisonsPermissive = (result.synthesizedComparisonsPermissive ?? 0) + 1;
      } else if (outcome.kind === 'template') {
        result.comparisonConflicts = (result.comparisonConflicts ?? 0) + 1;
      }
    }
    await appendSynthesisReportEntries(dir, comparisonEntries);
    if (comparisonStage.skipped.size > 0) {
      progress(`Synthesis: ${comparisonStage.skipped.size} page(s) skipped (unchanged data).`);
    }

    // Phase 26 (§2.1): fold the final on-disk content of every page that ran
    // through this synthesis invocation into the working hash map BEFORE the
    // per-PDF checkpoint. The checkpoint's page hashes must match the actual
    // files on disk (synthesized or patched), not the pre-synthesis structured
    // template; otherwise the next PDF's Materializer sees a phantom manual-edit
    // conflict and excludes the page from synthesis.
    const pagesToRehash = [
      ...entityStage.toRun,
      ...topicStage.toRun,
      ...compositeStage.toRun,
      ...comparisonStage.toRun,
    ];
    for (const page of pagesToRehash) {
      const relPath = synthesisPagePath(page);
      const absolute = join(dir, relPath);
      if (existsSync(absolute)) {
        const content = await readFile(absolute, 'utf-8');
        workingPageHashes[relPath] = createHash('sha256').update(content).digest('hex');
        writtenPagePaths.add(relPath);
      }
    }

    // Phase 16 (vision `04` §6): below both outage thresholds the run
    // completes — with a summary warning when any page transport-fell-back.
    // Phase 26: the counter is run-level, so the warning fires once after the
    // LAST invocation of the run (idempotent message).
    if (transportFailuresThisRun > 0) {
      progress(
        `Warning: ${transportFailuresThisRun} page(s) fell back to the structured template after transport failures this run — re-run ingest to retry them.`,
      );
    }
  }

  // Phase 8 (phase doc §5.1): the compounding metrics that power the TUI
  // Ingestion Log screen. New/updated entities come from a rolling-memory
  // diff across the whole run; updated entities whose page update was
  // skipped (manual-edit conflict) are reported as conflicts, not updates.
  // Computed identically for the preliminary and the final write — the only
  // differences are the fields derived from stages that have not run yet at
  // the preliminary point (final validation counts, the full LLM cost/token
  // window, and the final wall-clock time).
  // Phase 11 (phase doc §2.6): the field set is extended additively with
  // chunk/relationship/claim/page/folder/conflict/token/wall-clock counters.
  let memoryAfterEntityCount = 0;
  const buildRunMetrics = async (): Promise<IngestionMetrics> => {
    const memoryAfter = await readFullRollingMemory(dir);
    memoryAfterEntityCount = memoryAfter?.entities.length ?? 0;
    const beforeCounts = new Map((memoryBefore?.entities ?? []).map((entity) => [entity.slug, entity.mentionCount]));
    const beforeFolders = new Set(memoryBefore?.folderStructure ?? []);
    const titleBySlug = new Map<string, string>();
    for (const page of lastMaterializeResult?.entityPages ?? []) {
      titleBySlug.set(page.slug, page.title);
    }
    const conflictsState = await readConflicts(dir);
    const conflictsAfter = conflictsState.conflicts.length;
    // Phase 11: this run's conflicts split by kind — manual-edit entries
    // carry `type: 'manual-edit'`; preservation failures carry a pageType.
    let conflictsManualEdit = 0;
    let conflictsPreservation = 0;
    for (const entry of conflictsState.conflicts) {
      if (entry.timestamp < runStartedAt) {
        continue;
      }
      if ('type' in entry && entry.type === 'manual-edit') {
        conflictsManualEdit += 1;
      } else {
        conflictsPreservation += 1;
      }
    }
    const newEntities = (memoryAfter?.entities ?? [])
      .filter((entity) => !beforeCounts.has(entity.slug))
      .map((entity) => ({
        slug: entity.slug,
        title: titleBySlug.get(entity.slug) ?? entity.slug,
        folder: entity.folder,
      }));
    const updatedEntities = (memoryAfter?.entities ?? [])
      .filter(
        (entity) =>
          beforeCounts.has(entity.slug) &&
          entity.mentionCount > (beforeCounts.get(entity.slug) ?? 0) &&
          !conflictSkippedSlugs.has(entity.slug),
      )
      .map((entity) => ({
        slug: entity.slug,
        title: titleBySlug.get(entity.slug) ?? entity.slug,
        addedMentions: entity.mentionCount - (beforeCounts.get(entity.slug) ?? 0),
      }));
    // Phase 11: pages created/updated this run by type — entity/topic pages
    // actually written by the Materializer (conflict-skips excluded) plus the
    // document pages written by this run's Layer 1 pass.
    const pagesByType: Record<string, number> = {};
    for (const written of lastMaterializeResult?.writtenPages ?? []) {
      const type = written.path.split('/')[0] === 'topics' ? 'topic' : 'entity';
      pagesByType[type] = (pagesByType[type] ?? 0) + 1;
    }
    const documentPagesWritten = result.ingested.reduce((count, source) => count + source.documentPages.length, 0);
    if (documentPagesWritten > 0) {
      pagesByType.document = documentPagesWritten;
    }
    const llmUsage = await sumLlmUsageSince(dir, runStartedAt);
    const validation = result.finalValidation ?? result.validation;
    return {
      run: runStartedAt,
      newPdfs: result.ingested
        .filter((source) => !knownSlugsAtStart.has(source.source))
        .map((source) => source.file),
      newEntities,
      updatedEntities,
      conflicts: conflictsAfter - conflictsBefore,
      totalCost: llmUsage.cost,
      chunksProcessed: documentPagesWritten,
      // Skipped chunks = the recorded document pages of hash-skipped PDFs.
      chunksSkipped: result.skipped.reduce(
        (count, sourceSlug) => count + (state.sources[sourceSlug]?.documentPages.length ?? 0),
        0,
      ),
      chunksFailed: 0,
      entitiesNew: newEntities.length,
      entitiesUpdated: updatedEntities.length,
      relationshipsExtracted,
      claimsExtracted,
      claimsByType: { ...claimsByType },
      pagesByType,
      foldersCreated: (memoryAfter?.folderStructure ?? []).filter((folder) => !beforeFolders.has(folder)).length,
      brokenLinks: validation?.links.broken.length ?? 0,
      orphanedPages: validation?.links.orphaned.length ?? 0,
      conflictsManualEdit,
      conflictsPreservation,
      totalTokens: llmUsage.inputTokens + llmUsage.outputTokens,
      wallClockMs: Date.now() - runStartMs,
      // Phase 12 (vision `04` §6): validator-feedback repairs so far this run
      // (preliminary write = pre-DOX stages; final write = the whole run).
      feedbackRepairs: reaskRepairs(),
      // Phase 14 (phase doc §2.7): keep-all curation fallbacks this run
      // (both materialize calls; 0 on a healthy run).
      curationFallbacks: curationFallbacksThisRun,
      // Phase 16 (vision `04` §6): per-page transport fallbacks this run
      // (both synthesis stages; 0 on a healthy run).
      transportFailures: transportFailuresThisRun,
      // Phase 26 (§2.5): patch-amendment counters (0 on runs without
      // amendments; the amendment-log carries the per-episode detail).
      patchedPages: patchedPagesThisRun,
      patchFallbacks: patchFallbacksThisRun,
    };
  };

  // Phase 8 (UAT crash-safe finalization fix): persist the end-of-run state
  // NOW — before the validation/DOX/workspace stages, which run a full suite
  // of LLM calls even when every PDF was skipped — so an interruption in
  // that window never leaves the run unrecorded. Both writes are auxiliary:
  // a failure warns and the ingest continues. The final writes below refresh
  // the language state and re-write the metrics with the final totalCost.
  try {
    await writeWikiLanguage(dir, { outputLanguage: languageState.outputLanguage, lastInputLanguage: input });
    await writeMetrics(dir, await buildRunMetrics());
  } catch (err) {
    progress(`Warning: could not record preliminary ingestion metrics: ${(err as Error).message}`);
  }

  // Phase 4/6 pipeline order (phase doc §3.5): content validation -> DOX
  // Writer -> final validation. The first validation covers the content pages
  // (post-materialization, post-synthesis) and runs whenever extraction was
  // requested so the TUI and CLI always report link, citation, and schema
  // health at the end of an ingest.
  if (extract) {
    const validation = await validateWiki(slug, options.workspace);
    logValidation(validation, dir);
    result.validation = validation;
  }

  // Phase 6: the DOX Writer writes index.md navigation contracts for every
  // folder and the wiki root. Runs in both extract and non-extract modes; the
  // dox options pass through so doxLlm/writeDoxIndexFn are respected either way.
  await writeDoxContracts(slug, {
    workspace: options.workspace,
    doxLlm: options.doxLlm,
    writeDoxIndexFn: options.writeDoxIndexFn,
    language,
  });
  progress('DOX contracts updated.');

  // Phase 6: final validation pass over the whole wiki, including the new DOX
  // pages. The persisted validation-report.json reflects this final pass.
  if (extract) {
    const finalValidation = await validateWiki(slug, options.workspace);
    logValidation(finalValidation, dir);
    result.finalValidation = finalValidation;
  }

  // Phase 6 (2026-07-20 amendment, per-wiki segments 2026-07-21): the
  // workspace pass tops the bottom-up chain — folder indexes -> wiki root
  // index -> workspace index. It runs at the end of every ingest and writes
  // ONLY this wiki's own segment (prose in this run's output language);
  // every other wiki's segment is preserved byte-for-byte.
  await writeWorkspaceIndex({
    workspace: options.workspace,
    wikiSlug: slug,
    doxLlm: options.doxLlm,
    writeWorkspaceIndexFn: options.writeWorkspaceIndexFn,
    writeWorkspaceProseFn: options.writeWorkspaceProseFn,
    outputLanguage: getLanguage(output).name,
    logPath: join(dir, '.state', 'llm-calls.json'),
  });
  progress('Workspace index updated.');

  // Phase 24 (phase doc §2.8, vision `04` §3.2 Step 10 amended 2026-08-09):
  // the Cross-Wiki Discovery pass runs after Layer 5 (per-wiki DOX contracts
  // + the workspace pass) and before the AGENTS.md Updater, when enabled and
  // the workspace holds ≥2 wikis. It is additive and read-only over per-wiki
  // pages; any failure is logged and the ingest continues (phase doc §6).
  if (options.crossWiki === true) {
    const runPass = options.runCrossWikiPassFn ?? runCrossWikiPass;
    try {
      const crossWiki = await runPass({
        workspace: options.workspace,
        wikiSlug: slug,
        language,
        forceCrossWiki: options.forceCrossWiki,
        logPath: join(dir, '.state', 'llm-calls.json'),
        onProgress: progress,
      });
      result.crossWiki = crossWiki;
      progress(
        crossWiki.ran
          ? `Cross-wiki discovery updated: ${crossWiki.entities ?? 0} entities, ${crossWiki.edges ?? 0} edges, ${crossWiki.clusters ?? 0} clusters.`
          : `Cross-wiki discovery skipped (${crossWiki.reason}).`,
      );
    } catch (err) {
      progress(`Warning: cross-wiki discovery pass failed (${(err as Error).message}) — the ingest is unaffected.`);
      result.crossWiki = { ran: false, reason: 'error', error: (err as Error).message };
    }
  }

  // Phase 9 (phase doc §2.3): the AGENTS.md Updater runs after the DOX
  // contracts (and the workspace pass) when explicitly opted in. It writes a
  // PROPOSAL to .state/proposed-agents.md for human review — the original
  // AGENTS.md is never overwritten automatically (gate 9.4).
  if (options.updateAgents) {
    const runPropose = options.proposeAgentsUpdateFn ?? proposeAgentsUpdate;
    await runPropose(slug, { workspace: options.workspace });
    result.agentsUpdateProposed = true;
    progress('Proposed AGENTS.md updates saved to .state/proposed-agents.md. Review and apply manually.');
  }

  // Phase 7: persist the run's input language for the next run's pre-selection
  // and slug-forking detection. The stored output language is NOT overwritten
  // by a per-run override — it stays the wiki's fixed setting (vision 04 §9.1).
  // (Also written by the crash-safe preliminary pass above; harmless refresh.)
  await writeWikiLanguage(dir, { outputLanguage: languageState.outputLanguage, lastInputLanguage: input });

  // Phase 8 (phase doc §5.1): persist the compounding metrics that power the
  // TUI Ingestion Log screen, now with the FINAL totalCost (the preliminary
  // write above ran before the DOX/workspace LLM calls). Metrics are
  // auxiliary: a failure here must never fail an otherwise-successful run.
  // Phase 11 (phase doc §2.6): also emit a compact metrics summary line so
  // the CLI and the TUI progress view both show the run's shape.
  try {
    const metrics = await buildRunMetrics();
    await writeMetrics(dir, metrics);
    progress(
      `Metrics: ${metrics.chunksProcessed} chunks, ${memoryAfterEntityCount} entities ` +
        `(${metrics.entitiesNew} new), ${metrics.relationshipsExtracted} relationships, ` +
        `${metrics.claimsExtracted} claims, $${metrics.totalCost.toFixed(4)}, ` +
        `${Math.round(metrics.wallClockMs / 1000)}s`,
    );
  } catch (err) {
    progress(`Warning: could not record ingestion metrics: ${(err as Error).message}`);
  }

  // Phase 12 (vision `04` §6 repair-rate warning): an elevated feedback-repair
  // rate means the loop may be masking a systematic prompt defect. Warn at ≥5
  // repairs in the run OR repairs above 25% of the run's logged LLM calls
  // (calls counted from `.state/llm-calls.json` entries at/after run start;
  // the ratio check is skipped when no calls were logged). Accounting is
  // auxiliary — it must never fail the run.
  try {
    const repairs = reaskRepairs();
    const llmCalls = await countLlmCallsSince(dir, runStartedAt);
    if (repairs >= 5 || (llmCalls > 0 && repairs / llmCalls > 0.25)) {
      progress(
        `Warning: ${repairs} of ${llmCalls} LLM calls this run needed validator-feedback repair — the underlying prompt may need attention.`,
      );
    }
  } catch {
    // Best-effort accounting only.
  }

  progress('Done!');
  return result;
}
