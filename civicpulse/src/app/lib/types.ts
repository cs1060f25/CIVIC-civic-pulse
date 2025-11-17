export type ImpactLevel = "Low" | "Medium" | "High";

export type DocumentType = "Agenda" | "Minutes" | "Staff Memo" | "Ordinance" | "Other";

export interface Attachment {
  id: string;
  title: string;
  type: DocumentType;
  pageCount?: number;
}

export interface KeywordHits {
  [keyword: string]: number;
}

export interface FeedItem {
  // Core fields (from documents table)
  id: string;
  sourceId: string;
  fileUrl: string;
  contentHash: string;
  bytesSize: number;
  createdAt: string; // ISO 8601
  
  // Metadata (from document_metadata table)
  title: string;
  entity: string; // e.g., Johnson County Planning Board
  jurisdiction: string; // e.g., Johnson County, KS
  counties: string[]; // normalized geography
  meetingDate: string | null; // ISO 8601 date (nullable if unknown)
  docTypes: DocumentType[];
  impact: ImpactLevel;
  stage?: "Work Session" | "Hearing" | "Vote" | "Adopted" | "Draft";
  topics: string[]; // normalized taxonomy tags
  
  // Search/preview data
  hits: KeywordHits;
  extractedText?: string[]; // mock paragraphs of extracted text
  pdfPreview?: string[]; // mock "pages" textual preview
  attachments: Attachment[];
  
  updatedAt: string; // ISO 8601
}

export interface UserPreferences {
  workspaceName: string;
  jurisdictions: string[]; // counties or cities
  topics: string[]; // keywords/taxonomy
  alertCadence: "Off" | "Daily" | "Weekly";
  impactThreshold: ImpactLevel;
}

export interface SavedBrief {
  id: string;
  name: string;
  description: string;
  itemIds: string[];
  createdAt: string;
  updatedAt: string;
  documentCount: number;
}

export interface AppState {
  preferences: UserPreferences | null;
  savedItemIds: string[];
  followedItemIds: string[];
  briefItemIds: string[];
  savedBriefs: SavedBrief[];
}

// API Response Types
export interface GetDocumentsResponse {
  documents: FeedItem[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface CreateDocumentRequest {
  sourceId: string;
  fileUrl: string;
  contentHash: string;
  bytesSize: number;
  title: string;
  entity: string;
  jurisdiction: string;
  counties?: string[];
  meetingDate?: string;
  docTypes?: string[];
  impact?: ImpactLevel;
  stage?: "Work Session" | "Hearing" | "Vote" | "Adopted" | "Draft";
  topics?: string[];
  keywordHits?: KeywordHits;
  extractedText?: string[];
  pdfPreview?: string[];
  attachments?: Attachment[];
}

export interface ApiError {
  error: string;
  message: string;
  fields?: Record<string, string>;
}
