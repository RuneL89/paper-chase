import { readFileSync, existsSync } from 'fs';
import path from 'path';
import {
  type LLMConfig,
  type LLMCallOptions,
  type LLMResponse,
  type LLMCallRecord,
  DEFAULT_LLM_CONFIG,
  estimateCost,
  estimateTokens,
} from './types.js';
import { CLIError } from '../errors.js';
import type { ProgressReporter } from '../progress/types.js';
import { NoOpReporter } from '../progress/types.js';

export type { LLMConfig, LLMCallRecord, LLMResponse, LLMCallOptions };

export function loadLLMConfig(workspace: string): LLMConfig {
  const configPath = path.join(workspace, '.kimi-code', 'config.json');
  if (!existsSync(configPath)) {
    return { ...DEFAULT_LLM_CONFIG };
  }

  try {
    const parsed = JSON.parse(readFileSync(configPath, 'utf-8')) as Record<string, unknown>;
    const llm = parsed.llm as Record<string, unknown> | undefined;
    if (!llm || llm.enabled === false) {
      return { ...DEFAULT_LLM_CONFIG };
    }

    const provider = String(llm.provider ?? 'test');
    if (!isKnownProvider(provider)) {
      return { ...DEFAULT_LLM_CONFIG };
    }

    return {
      provider,
      model: String(llm.model ?? 'unknown'),
      apiKey: llm.apiKey ? String(llm.apiKey) : undefined,
      baseUrl: llm.baseUrl ? String(llm.baseUrl) : undefined,
      enabled: true,
      maxRetries: typeof llm.maxRetries === 'number' ? llm.maxRetries : DEFAULT_LLM_CONFIG.maxRetries,
      baseDelay: typeof llm.baseDelay === 'number' ? llm.baseDelay : DEFAULT_LLM_CONFIG.baseDelay,
      concurrency: typeof llm.concurrency === 'number' ? llm.concurrency : DEFAULT_LLM_CONFIG.concurrency,
      maxRollingMemoryTokens: typeof llm.maxRollingMemoryTokens === 'number' ? llm.maxRollingMemoryTokens : DEFAULT_LLM_CONFIG.maxRollingMemoryTokens,
    };
  } catch {
    return { ...DEFAULT_LLM_CONFIG };
  }
}

function isKnownProvider(value: string): value is LLMConfig['provider'] {
  return ['openai', 'anthropic', 'openai-compatible', 'kimi', 'test'].includes(value);
}

export class LLMClient {
  private config: LLMConfig;
  private fetchFn: typeof fetch;
  private records: LLMCallRecord[] = [];
  private reporter: ProgressReporter;
  private callCounter = 0;

  constructor(config: LLMConfig, fetchFn?: typeof fetch, reporter?: ProgressReporter) {
    this.config = config;
    this.fetchFn = fetchFn ?? globalThis.fetch;
    this.reporter = reporter ?? new NoOpReporter();
  }

  /**
   * Returns true when the LLM is configured and enabled.
   * When false, callers should fall back to local-only processing.
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Sends a text prompt to the configured LLM provider.
   * Only text prompts are accepted; raw PDF buffers are rejected.
   */
  async call(prompt: string, options?: LLMCallOptions): Promise<LLMResponse> {
    if (typeof prompt !== 'string') {
      throw new Error(
        'LLM prompts must be strings. Raw PDFs or binary data must never be transmitted to a remote LLM.',
      );
    }

    const id = this.nextCallId();
    const agent = detectAgentFromPrompt(prompt);
    const estimatedTokens = estimateTokens(prompt);
    const promptSummary = prompt.slice(0, 200).replace(/\s+/g, ' ');

    this.reporter.emit({
      type: 'llm-call-start',
      timestamp: Date.now(),
      id,
      agent,
      provider: this.config.provider,
      model: this.config.model,
      estimatedTokens,
      promptSummary,
    });

    let response: LLMResponse | undefined;
    let status: 'success' | 'error' = 'success';
    let errorMessage: string | undefined;
    try {
      if (!this.config.enabled) {
        throw new CLIError(
          'LLM is not configured or enabled. Configure an LLM with "llm-wiki-cli configure-llm" or set provider to "test".',
        );
      }

      if (this.config.provider === 'test') {
        response = this.mockResponse(prompt, options?.maxTokens ?? 1024);
      } else {
        const maxTokens = options?.maxTokens ?? 1024;
        const temperature = options?.temperature ?? 0.2;
        response = await this.remoteCall(prompt, maxTokens, temperature, options?.verbose ?? false, id, agent, options);
      }

      this.records.push(this.toRecord(response));
      return response;
    } catch (error) {
      status = 'error';
      errorMessage = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      this.reporter.emit({
        type: 'llm-call-end',
        timestamp: Date.now(),
        id,
        provider: this.config.provider,
        model: response?.model ?? this.config.model,
        estimatedTokens: response?.estimatedTokens ?? estimatedTokens,
        estimatedCost: response?.estimatedCost ?? 0,
        status,
        error: errorMessage,
      });
    }
  }

  private nextCallId(): string {
    return `llm-${++this.callCounter}`;
  }

  private mockResponse(prompt: string, maxTokens: number): LLMResponse {
    const tokens = estimateTokens(prompt) + maxTokens;
    const text = generateMockResponse(prompt);
    return {
      provider: this.config.provider,
      model: this.config.model,
      text,
      estimatedTokens: tokens,
      estimatedCost: estimateCost(this.config.provider, this.config.model, tokens),
    };
  }

  private async remoteCall(
    prompt: string,
    maxTokens: number,
    temperature: number,
    verbose: boolean,
    id: string,
    agent: string,
    options?: LLMCallOptions,
  ): Promise<LLMResponse> {
    const maxRetries = this.config.maxRetries ?? 3;
    const baseDelay = this.config.baseDelay ?? 1000;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.providerCall(prompt, maxTokens, temperature, verbose, options);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt === maxRetries) {
          break;
        }
        this.reporter.emit({
          type: 'llm-call-retry',
          timestamp: Date.now(),
          id,
          agent,
          attempt: attempt + 1,
          error: lastError.message,
        });
        const delay = this.calculateDelay(attempt, baseDelay, undefined);
        await this.sleep(delay);
      }
    }

    throw lastError ?? new Error('LLM remote call failed after retries');
  }

  private async providerCall(
    prompt: string,
    maxTokens: number,
    temperature: number,
    verbose: boolean,
    options?: LLMCallOptions,
  ): Promise<LLMResponse> {
    const estimatedTokens = estimateTokens(prompt) + maxTokens;

    if (this.config.provider === 'anthropic') {
      return this.anthropicCall(prompt, maxTokens, temperature, estimatedTokens, verbose, options);
    }

    if (this.config.provider === 'kimi') {
      return this.kimiCall(prompt, maxTokens, temperature, estimatedTokens, verbose, options);
    }

    return this.openaiCompatibleCall(prompt, maxTokens, temperature, estimatedTokens, verbose, options);
  }

  private calculateDelay(attempt: number, baseDelay: number, retryAfter: number | undefined): number {
    if (retryAfter !== undefined && retryAfter > 0) {
      return retryAfter * 1000;
    }
    const exponential = baseDelay * 2 ** attempt;
    const jitter = Math.random() * exponential;
    return Math.min(exponential + jitter, 30000); // cap at 30 seconds
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async openaiCompatibleCall(
    prompt: string,
    maxTokens: number,
    temperature: number,
    estimatedTokens: number,
    verbose: boolean,
    options?: LLMCallOptions,
  ): Promise<LLMResponse> {
    const baseUrl = this.config.baseUrl ?? 'https://api.openai.com/v1';
    const url = `${baseUrl}/chat/completions`;
    const model = options?.model ?? this.config.model;

    const response = await this.fetchFn(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM request failed: ${response.status} ${await response.text()}`);
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { total_tokens?: number };
    };
    if (verbose) {
      console.log('[LLM verbose] Raw response:', JSON.stringify(data, null, 2));
    }
    const text = data.choices?.[0]?.message?.content ?? '';
    const tokens = data.usage?.total_tokens ?? estimatedTokens;

    return {
      provider: this.config.provider,
      model,
      text,
      estimatedTokens: tokens,
      estimatedCost: estimateCost(this.config.provider, model, tokens),
    };
  }

  private async anthropicCall(
    prompt: string,
    maxTokens: number,
    temperature: number,
    estimatedTokens: number,
    verbose: boolean,
    options?: LLMCallOptions,
  ): Promise<LLMResponse> {
    const baseUrl = this.config.baseUrl ?? 'https://api.anthropic.com/v1';
    const url = `${baseUrl}/messages`;
    const model = options?.model ?? this.config.model;

    const response = await this.fetchFn(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM request failed: ${response.status} ${await response.text()}`);
    }

    const data = (await response.json()) as {
      content?: { type?: string; text?: string }[];
      usage?: {
        input_tokens?: number;
        cache_creation_input_tokens?: number;
        cache_read_input_tokens?: number;
        output_tokens?: number;
      };
    };
    if (verbose) {
      console.log('[LLM verbose] Raw response:', JSON.stringify(data, null, 2));
    }
    const text =
      data.content?.find((block) => block.type === 'text')?.text ??
      data.content?.[0]?.text ??
      '';
    const inputTokens = data.usage?.input_tokens ?? 0;
    const cacheCreationTokens = data.usage?.cache_creation_input_tokens ?? 0;
    const cacheReadTokens = data.usage?.cache_read_input_tokens ?? 0;
    const outputTokens = data.usage?.output_tokens ?? 0;
    const tokens =
      inputTokens + cacheCreationTokens + cacheReadTokens + outputTokens || estimatedTokens;

    return {
      provider: this.config.provider,
      model,
      text,
      estimatedTokens: tokens,
      estimatedCost: estimateCost(this.config.provider, model, tokens),
    };
  }

  private async kimiCall(
    prompt: string,
    maxTokens: number,
    temperature: number,
    estimatedTokens: number,
    verbose: boolean,
    options?: LLMCallOptions,
  ): Promise<LLMResponse> {
    const baseUrl = this.config.baseUrl ?? 'https://api.kimi.com/coding';
    const url = `${baseUrl}/v1/messages`;
    const model = options?.model ?? this.config.model;

    const body: Record<string, unknown> = {
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
    };
    if (options?.temperature !== undefined) {
      body.temperature = options.temperature;
    } else if (options?.thinking === undefined) {
      body.temperature = temperature;
    }
    if (options?.thinking) {
      body.thinking = options.thinking;
    }

    const response = await this.fetchFn(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`LLM request failed: ${response.status} ${await response.text()}`);
    }

    const data = (await response.json()) as {
      content?: { type?: string; text?: string }[];
      usage?: {
        input_tokens?: number;
        cache_creation_input_tokens?: number;
        cache_read_input_tokens?: number;
        output_tokens?: number;
      };
    };
    if (verbose) {
      console.log('[LLM verbose] Raw response:', JSON.stringify(data, null, 2));
    }
    const text =
      data.content?.find((block) => block.type === 'text')?.text ??
      data.content?.[0]?.text ??
      '';
    const inputTokens = data.usage?.input_tokens ?? 0;
    const cacheCreationTokens = data.usage?.cache_creation_input_tokens ?? 0;
    const cacheReadTokens = data.usage?.cache_read_input_tokens ?? 0;
    const outputTokens = data.usage?.output_tokens ?? 0;
    const tokens =
      inputTokens + cacheCreationTokens + cacheReadTokens + outputTokens || estimatedTokens;

    return {
      provider: this.config.provider,
      model,
      text,
      estimatedTokens: tokens,
      estimatedCost: estimateCost(this.config.provider, model, tokens),
    };
  }

  toRecord(response: LLMResponse): LLMCallRecord {
    return {
      provider: response.provider,
      model: response.model,
      estimatedTokens: response.estimatedTokens,
      estimatedCost: response.estimatedCost,
    };
  }

  getRecords(): LLMCallRecord[] {
    return [...this.records];
  }
}

function generateMockResponse(prompt: string): string {
  if (prompt.includes('You are the StructureAnalyst agent')) {
    return JSON.stringify({
      headings: [],
      sections: [],
      boundaries: [],
      pageRange: '1',
      boundaryType: 'page',
      readingOrderFlags: [],
    });
  }

  if (prompt.includes('You are the EntityExtractor agent')) {
    return JSON.stringify({
      entities: [
        {
          name: 'Acme Corporation',
          canonical: 'acme-corporation',
          aliases: ['Acme Corp'],
          type: 'organization',
          count: 2,
          mentions: [{ page: 1, context: 'Acme Corporation appears in the document.' }],
          confidence: 0.8,
          description: 'A multinational conglomerate used as a sample entity for testing.',
        },
      ],
    });
  }

  if (prompt.includes('You are the RelationshipExtractor agent')) {
    const entityNames = parseEntityNamesFromPrompt(prompt);
    const relationships = [];
    if (entityNames.length >= 2) {
      relationships.push({
        subject: entityNames[0],
        predicate: 'is related to',
        object: entityNames[1],
        evidence: 'Both appear in the same document context.',
        pages: '1',
      });
    } else if (entityNames.length === 1) {
      relationships.push({
        subject: entityNames[0],
        predicate: 'is mentioned in',
        object: entityNames[0],
        evidence: 'Appears in the document context.',
        pages: '1',
      });
    }
    return JSON.stringify({ relationships });
  }

  if (prompt.includes('You are the EvidenceCollector agent')) {
    const claims = parseClaimsFromEvidencePrompt(prompt);
    return JSON.stringify({ claims, tables: [], figures: [] });
  }

  if (prompt.includes('You are the PagePlanner agent')) {
    const chunkIds = parseChunkIdsFromPagePlannerPrompt(prompt);
    const entityNames = parseEntityNamesFromPrompt(prompt);
    const hasScanned = /scanned pages: \d+/.test(prompt) && !/- scanned pages: 0/.test(prompt);
    const topicNames = inferTopicNamesFromEvidencePrompt(prompt);

    const pages: Record<string, unknown>[] = chunkIds.map((id) => ({
      pageType: 'document',
      title: `Document chunk ${id}`,
      fileName: `${id}.md`,
      folder: 'documents',
      tags: ['document'],
      citations: [],
      wikilinks: [],
      related: [],
    }));

    const folderPlacements: Record<string, unknown>[] = [
      {
        folder: 'documents',
        title: 'Documents',
        description: 'Document chunks extracted from the source PDFs.',
        pageTypes: ['document'],
        children: [],
      },
      {
        folder: 'sources',
        title: 'Sources',
        description: 'Catalog pages for each source PDF.',
        pageTypes: ['source'],
        children: [],
      },
      {
        folder: 'topics',
        title: 'Topics',
        description: 'Recurring themes and concepts.',
        pageTypes: ['topic'],
        children: [],
      },
    ];

    if (entityNames.length > 0) {
      folderPlacements.push({
        folder: 'entities',
        title: 'Entities',
        description: 'People, organizations, and other named entities mentioned in the corpus.',
        pageTypes: ['entity'],
        children: ['organizations'],
      });
      const entityTaxonomy = {
        subFolders: [
          { slug: 'organizations', title: 'Organizations', description: 'Organizations and companies.' },
        ],
        assignments: {} as Record<string, string>,
      };
      for (const name of entityNames.slice(0, 1)) {
        const safeName = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        entityTaxonomy.assignments[safeName] = 'organizations';
        pages.push({
          pageType: 'entity',
          title: `Entity: ${name}`,
          fileName: `${safeName}.md`,
          folder: 'entities/organizations',
          tags: ['entity', 'organization'],
          citations: [],
          wikilinks: [],
          related: [],
        });
      }
      for (const name of topicNames) {
        const safeName = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        pages.push({
          pageType: 'topic',
          title: `Topic: ${name}`,
          fileName: `${safeName}.md`,
          folder: 'topics',
          tags: ['topic'],
          citations: [],
          wikilinks: [],
          related: entityNames.slice(0, 1).map((n) => {
            const entityFile = n.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
            return `entities/organizations/${entityFile}.md`;
          }),
        });
      }
      return JSON.stringify({
        pages,
        folderPlacements,
        entityTaxonomy,
        wikilinks: [],
        citations: [],
        discovery: {
          existingDocument: false,
          newEntities: entityNames.length > 0,
          newTopics: topicNames.length > 0,
          hasTablesFigures: false,
          rawPages: hasScanned,
          newPageType: false,
        },
      });
    }

    for (const name of topicNames) {
      const safeName = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      pages.push({
        pageType: 'topic',
        title: `Topic: ${name}`,
        fileName: `${safeName}.md`,
        folder: 'topics',
        tags: ['topic'],
        citations: [],
        wikilinks: [],
        related: [],
      });
    }

    if (hasScanned) {
      folderPlacements.push({
        folder: 'raw',
        title: 'Raw Fragments',
        description: 'Scanned or unparseable pages preserved as raw fragments.',
        pageTypes: ['raw'],
        children: [],
      });
    }

    return JSON.stringify({
      pages,
      folderPlacements,
      wikilinks: [],
      citations: [],
      discovery: {
        existingDocument: false,
        newEntities: entityNames.length > 0,
        newTopics: topicNames.length > 0,
        hasTablesFigures: false,
        rawPages: hasScanned,
        newPageType: false,
      },
    });
  }

  if (prompt.includes('You are the Critic agent')) {
    return JSON.stringify({
      approved: true,
      issues: [],
      confidence: 'high',
      checks: [],
      blockingIssues: [],
    });
  }

  if (prompt.includes('You are the ChunkWriter agent')) {
    const chunks = parseChunksFromChunkWriterPrompt(prompt);
    const sourceFile = parseSourceFileFromChunkWriterPrompt(prompt);
    const sourceName = path.basename(sourceFile);
    const wikiTitle = parseWikiTitleFromChunkWriterPrompt(prompt) ?? 'Wiki';
    const pages = chunks.map((chunk) => {
      const detail = chunk.content || 'No extracted content.';
      const hasTable = /\bQ1\b/.test(detail) && /\bQ2\b/.test(detail) && /\bQ3\b/.test(detail);
      const tableSection = hasTable
        ? '\n\n## Tables\n\n| Quarter | Revenue |\n|---------|---------|\n| Q1      | $10000  |\n| Q2      | $15000  |\n| Q3      | $12000  |'
        : '';
      const body = `## Synthesis\n\nKey claims extracted from the chunk. [^src1]\n\n## Preserved Extracted Detail\n\n${detail}${tableSection}\n\nSee also [[Source: ${sourceName}]] and [[${wikiTitle} Index]].`;
      return {
        filePath: `documents/${chunk.id}.md`,
        frontmatter: {
          title: `Synthesized chunk ${chunk.id}`,
          type: 'document',
          confidence: 'high',
          tags: ['document'],
          sources: [
            {
              id: 'src1',
              file: sourceFile,
              pages: chunk.pageRange || '1',
              extracted: new Date().toISOString(),
              label: 'Sample PDF',
            },
          ],
        },
        body,
        citations: [{ claim: 'Key claims extracted from the chunk.', sources: ['src1'] }],
      };
    });
    return JSON.stringify({ pages });
  }

  if (prompt.includes('You are the EntityTopicPageWriter agent')) {
    const entityNames = parseEntityNamesFromEntityTopicPrompt(prompt);
    const topicNames = parseTopicNamesFromEntityTopicPrompt(prompt);
    return JSON.stringify({
      entities: entityNames.map((name) => ({
        name,
        body: `# Entity: ${name}\n\nA sample entity body for testing.`,
      })),
      topics: topicNames.map((name) => ({
        name,
        body: `# Topic: ${name}\n\nA sample topic body for testing.`,
      })),
    });
  }

  if (prompt.includes('You are the EntityCritic agent')) {
    const entityNames = parseEntityNamesFromCriticPrompt(prompt);
    return JSON.stringify({
      approvedEntities: entityNames,
      rejectedEntities: [],
      issues: [],
    });
  }

  if (prompt.includes('You are the ChunkingPlanner agent')) {
    return JSON.stringify({
      splitBoundary: 'page',
      reason: 'Deterministic test provider recommends page-based splitting.',
      issues: [],
    });
  }

  if (prompt.includes('You are an expert wiki architect')) {
    const slugMatch = prompt.match(/Wiki slug: ([^\n]+)/);
    const titleMatch = prompt.match(/Wiki title: ([^\n]+)/);
    const descriptionMatch = prompt.match(/Wiki description: ([^\n]+)/);
    const samplingMatch = prompt.match(/Sampling strategy: ([^\n]+)/);
    const slug = slugMatch?.[1].trim() ?? 'wiki';
    const title = titleMatch?.[1].trim() ?? 'Wiki';
    const description = descriptionMatch?.[1].trim() ?? '';
    const sampling = samplingMatch?.[1].trim() ?? 'unknown';
    return [
      '## Purpose and Scope',
      '',
      description || `This wiki collects and synthesizes source documents for "${title}".`,
      '',
      '## Folder Structure',
      '',
      '- `raw/` — source PDFs.',
      '- `documents/` — document chunk pages.',
      '- `sources/` — source provenance pages.',
      '- `entities/<subfolder>/` — entity pages grouped by taxonomy.',
      '- `topics/` — topic pages.',
      '- `raw/` — unparseable or scanned fragments.',
      '',
      '## Page Types',
      '',
      '| Type | Purpose | Required frontmatter |',
      '|------|---------|----------------------|',
      '| `index` | Wiki-level or folder-level contract | `title`, `type`, `updated`, `wiki` |',
      '| `document` | A chunk or full PDF page | `title`, `type`, `tags`, `sources`, `confidence` |',
      '| `source` | Catalog page for one raw PDF | `title`, `type`, `file`, `ingested`, `warnings` |',
      '| `topic` | Recurring theme or concept | `title`, `type`, `tags`, `related` |',
      '| `entity` | Person, organization, product, or location | `title`, `type`, `tags`, `mentions` |',
      '| `raw` | Failed or malformed extraction fragment | `title`, `type`, `source`, `reason`, `raw_fragment` |',
      '',
      '## Naming Conventions',
      '',
      `- Wiki folder: \`wikis/${slug}\``,
      '- Source PDFs: `wikis/<slug>/raw/<pdf-slug>.pdf`',
      '- Source pages: `sources/<pdf-slug>.md`',
      '- Document pages: `documents/<pdf-slug>-part-NNN.md`',
      '- Topic pages: `topics/<topic-slug>.md`',
      '- Entity pages: `entities/<subfolder>/<entity-slug>.md`',
      '- Raw pages: `raw/<pdf-slug>-page-NNN.md`',
      '',
      '## Citation Rules',
      '',
      'Document pages use inline footnote citations of the form `[^srcN]`. Each `[^srcN]` maps to a `sources` frontmatter entry.',
      '',
      '## Content Rules',
      '',
      '- The LLM writes all markdown content; deterministic code only extracts, validates, and orchestrates.',
      '- No extracted page, table, figure, or named entity may be silently dropped.',
      '- Preserve extracted text, tables, and figure descriptions in the document body.',
      '- Place LLM-written synthesis at the top of document pages, followed by preserved detail.',
      '- Use wikilinks (`[[Page Title]]`) to connect related pages.',
      '',
      '## Special Instructions',
      '',
      `The sampling strategy for this corpus is ${sampling}.`,
      '',
      '## Workflows',
      '',
      '1. `init` creates the wiki folder and this skeleton guide.',
      '2. `sample` analyzes the corpus using the detected sampling strategy, produces the folder structure, and refines this guide.',
      '3. `ingest` processes every PDF in `raw/` and generates or updates pages.',
      '4. `status` reports source counts, generated pages, and lint warnings.',
      '',
      '## Lint / Quality Rules',
      '',
      '- YAML frontmatter must be valid and include all required fields for the page type.',
      '- Every `[^srcN]` citation in the body must map to a `sources` frontmatter entry.',
      '- Broken wikilinks are flagged in `lint/report.json`.',
      '- Scanned or unparseable pages become `raw` pages with a reason.',
      '',
      '## Authority Matrix',
      '',
      '| Role | Authority |',
      '|------|-----------|',
      '| User (human) | High-level purpose, PDF curation, structural approval, when to run commands. |',
      '| LLM Orchestrator | Folder structure, page content, entities, links, citations. |',
      '| Local deterministic code | Extraction, hashing, validation, orchestration, file I/O. |',
      '| Critic | Whether LLM output is good enough to commit. |',
      '',
    ].join('\n');
  }

  return 'This is a test LLM response.';
}

function parseChunkIdsFromPagePlannerPrompt(prompt: string): string[] {
  const ids: string[] = [];
  const regex = /## Chunk boundaries\n([\s\S]*?)(?=\n## |$)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(prompt)) !== null) {
    const block = match[1];
    const itemRegex = /^- ([^:]+):/gm;
    let item: RegExpExecArray | null;
    while ((item = itemRegex.exec(block)) !== null) {
      ids.push(item[1].trim());
    }
  }
  return [...new Set(ids)];
}

function parseChunkIdsFromChunkWriterPrompt(prompt: string): string[] {
  const ids: string[] = [];
  const regex = /### Chunk ([^\s—]+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(prompt)) !== null) {
    ids.push(match[1].trim());
  }
  return ids.length > 0 ? ids : ['part-001'];
}

function parseChunksFromChunkWriterPrompt(prompt: string): { id: string; pageRange: string; content: string }[] {
  const chunks: { id: string; pageRange: string; content: string }[] = [];
  const regex = /### Chunk ([^\s—]+) — pages ([^\n]+)\n([\s\S]*?)(?=\n### Chunk |\n## JSON schema|$)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(prompt)) !== null) {
    chunks.push({
      id: match[1].trim(),
      pageRange: match[2].trim(),
      content: match[3].trim(),
    });
  }
  return chunks;
}

function parseSourceFileFromChunkWriterPrompt(prompt: string): string {
  const match = prompt.match(/## Source PDF\n[\s\S]*?- file: ([^\n]+)/);
  return match?.[1].trim() ?? 'wikis/test/raw/sample.pdf';
}

function parseWikiTitleFromChunkWriterPrompt(prompt: string): string | undefined {
  const match = prompt.match(/## Wiki\n[\s\S]*?- title: ([^\n]+)/);
  return match?.[1].trim();
}

function parseClaimsFromEvidencePrompt(prompt: string): { text: string; evidence: string; pages: string }[] {
  const blockMatch = prompt.match(/## Chunk text\n([\s\S]*?)$/);
  if (!blockMatch) return [];
  const claims: { text: string; evidence: string; pages: string }[] = [];
  const chunkRegex = /### Chunk ([^\s—]+) — pages ([^\n]+)\n([\s\S]*?)(?=\n### Chunk |$)/g;
  let match: RegExpExecArray | null;
  while ((match = chunkRegex.exec(blockMatch[1])) !== null) {
    const pageRange = match[2].trim();
    const content = match[3].trim();
    const sentences = content.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 10);
    for (const sentence of sentences.slice(0, 3)) {
      const clean = sentence.replace(/\s+/g, ' ').trim();
      if (clean.length > 0) {
        claims.push({ text: clean, evidence: clean, pages: pageRange });
      }
    }
  }
  return claims.length > 0 ? claims : [];
}

function parseEvidenceSummaryClaims(prompt: string): { text: string; pages: string }[] {
  const blockMatch = prompt.match(/## Evidence summary\n([\s\S]*?)(?=\n## |$)/);
  if (!blockMatch) return [];
  const claims: { text: string; pages: string }[] = [];
  const lineRegex = /^- (.+) \(([^)]+)\)$/gm;
  let match: RegExpExecArray | null;
  while ((match = lineRegex.exec(blockMatch[1])) !== null) {
    claims.push({ text: match[1].trim(), pages: match[2].trim() });
  }
  return claims;
}

function inferTopicNamesFromEvidencePrompt(prompt: string): string[] {
  const topics = new Set<string>();
  if (/\brevenue\b/i.test(prompt)) topics.add('Revenue');
  if (/\bmarket\b/i.test(prompt)) topics.add('Market');
  if (/\bexpansion\b/i.test(prompt)) topics.add('Expansion');
  if (topics.size === 0 && /\w/.test(prompt)) topics.add('Business Overview');
  return Array.from(topics);
}

function parseEntityNamesFromPrompt(prompt: string): string[] {
  const names: string[] = [];
  const regex = /## Entities\n([\s\S]*?)(?=\n## |$)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(prompt)) !== null) {
    const block = match[1];
    const lineRegex = /^- ([^(]+)/gm;
    let line: RegExpExecArray | null;
    while ((line = lineRegex.exec(block)) !== null) {
      names.push(line[1].trim());
    }
  }
  return names.length > 0 ? names : ['Sample Entity'];
}

function parseEntityNamesFromEntityTopicPrompt(prompt: string): string[] {
  const names: string[] = [];
  const regex = /### Entity: ([^\n]+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(prompt)) !== null) {
    names.push(match[1].trim());
  }
  return names;
}

function parseTopicNamesFromEntityTopicPrompt(prompt: string): string[] {
  const names: string[] = [];
  const regex = /### Topic: ([^\n]+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(prompt)) !== null) {
    names.push(match[1].trim());
  }
  return names;
}

export function createLLMClient(workspace: string, fetchFn?: typeof fetch, reporter?: ProgressReporter): LLMClient {
  return new LLMClient(loadLLMConfig(workspace), fetchFn, reporter);
}

export { estimateCost, estimateTokens };

function parseEntityNamesFromCriticPrompt(prompt: string): string[] {
  const names: string[] = [];
  const regex = /## Candidate entities\n([\s\S]*?)(?=\n## |$)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(prompt)) !== null) {
    const block = match[1];
    const lineRegex = /^- ([^(]+)/gm;
    let line: RegExpExecArray | null;
    while ((line = lineRegex.exec(block)) !== null) {
      names.push(line[1].trim());
    }
  }
  return names;
}

function detectAgentFromPrompt(prompt: string): string {
  const match = prompt.match(/You are the ([A-Za-z]+) agent/);
  return match?.[1] ?? 'unknown';
}
