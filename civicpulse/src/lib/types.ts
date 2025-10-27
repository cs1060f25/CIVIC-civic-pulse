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
  id: string;
  entity: string; // e.g., Johnson County Planning Board
  title: string;
  meetingDate: string; // ISO date
  attachments: Attachment[];
  jurisdiction: string; // e.g., Johnson County, KS
  counties: string[]; // normalized geography
  hits: KeywordHits;
  impact: ImpactLevel;
  stage?: "Work Session" | "Hearing" | "Vote" | "Adopted" | "Draft";
  updatedAt: string; // ISO
  docTypes: DocumentType[];
  topics: string[]; // normalized taxonomy tags
  extractedText?: string[]; // mock paragraphs of extracted text
  pdfPreview?: string[]; // mock "pages" textual preview
}

export interface UserPreferences {
  workspaceName: string;
  jurisdictions: string[]; // counties or cities
  topics: string[]; // keywords/taxonomy
  alertCadence: "Off" | "Daily" | "Weekly";
  impactThreshold: ImpactLevel;
}

export interface AppState {
  preferences: UserPreferences | null;
  savedItemIds: string[];
  followedItemIds: string[];
  briefItemIds: string[];
}
