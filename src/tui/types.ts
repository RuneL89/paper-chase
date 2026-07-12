export type TuiScreen =
  | 'welcome'
  | 'workspace'
  | 'dashboard'
  | 'wiki-detail'
  | 'llm-config'
  | 'create-wiki'
  | 'progress'
  | 'result';

export interface WikiSummary {
  slug: string;
  title: string;
  description: string;
  status: string;
  sourceCount: number;
  documentCount: number;
  entityCount: number;
  topicCount: number;
  rawCount: number;
}
