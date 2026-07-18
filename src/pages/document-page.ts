export interface DocumentPageClaim {
  text: string;
  type: string;
  entities: string[];
  page: number;
}

export interface DocumentPageData {
  title: string;
  slug: string;
  folder: string;
  wiki: string;
  source: string;
  pages: string;
  extractedText: string;
  entitySlugs: string[];
  slugToTitle: Record<string, string>;
  claims: DocumentPageClaim[];
}
