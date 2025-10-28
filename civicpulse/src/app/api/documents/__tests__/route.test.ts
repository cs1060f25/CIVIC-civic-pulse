import { NextRequest } from "next/server";
import { GET, POST } from "../route";
import { getDb } from "@/lib/db";

// Mock the database module
jest.mock("@/lib/db");

const mockDb = {
  prepare: jest.fn(),
  transaction: jest.fn(),
  pragma: jest.fn(),
  close: jest.fn(),
};

const mockGetDb = getDb as jest.MockedFunction<typeof getDb>;

describe("GET /api/documents", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDb.mockReturnValue(mockDb as any);
  });

  describe("Basic Queries", () => {
    it("should return all documents with default pagination", async () => {
      const mockDocuments = [
        {
          id: "doc-1",
          source_id: "test_source",
          file_url: "https://test.com/doc.pdf",
          content_hash: "hash123",
          bytes_size: 1000,
          created_at: "2025-10-27T00:00:00Z",
          title: "Test Document",
          entity: "Test Entity",
          jurisdiction: "Test County, KS",
          counties: '["Test"]',
          meeting_date: "2025-10-27",
          doc_types: '["Agenda"]',
          impact: "Medium",
          stage: "Draft",
          topics: '["test"]',
          keyword_hits: '{"test": 1}',
          extracted_text: '[]',
          pdf_preview: '[]',
          attachments: '[]',
          updated_at: "2025-10-27T00:00:00Z",
        },
      ];

      mockDb.prepare.mockReturnValueOnce({
        get: jest.fn().mockReturnValue({ total: 1 }),
      } as any);

      mockDb.prepare.mockReturnValueOnce({
        all: jest.fn().mockReturnValue(mockDocuments),
      } as any);

      const request = new NextRequest("http://localhost:3000/api/documents");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.documents).toHaveLength(1);
      expect(data.pagination.total).toBe(1);
      expect(data.pagination.limit).toBe(50);
      expect(data.pagination.offset).toBe(0);
    });

    it("should handle pagination parameters", async () => {
      mockDb.prepare.mockReturnValueOnce({
        get: jest.fn().mockReturnValue({ total: 100 }),
      } as any);

      mockDb.prepare.mockReturnValueOnce({
        all: jest.fn().mockReturnValue([]),
      } as any);

      const request = new NextRequest(
        "http://localhost:3000/api/documents?limit=10&offset=20"
      );
      const response = await GET(request);
      const data = await response.json();

      expect(data.pagination.limit).toBe(10);
      expect(data.pagination.offset).toBe(20);
      expect(data.pagination.hasMore).toBe(true);
    });

    it("should enforce max limit of 100", async () => {
      mockDb.prepare.mockReturnValueOnce({
        get: jest.fn().mockReturnValue({ total: 200 }),
      } as any);

      mockDb.prepare.mockReturnValueOnce({
        all: jest.fn().mockReturnValue([]),
      } as any);

      const request = new NextRequest(
        "http://localhost:3000/api/documents?limit=500"
      );
      const response = await GET(request);
      const data = await response.json();

      expect(data.pagination.limit).toBe(100);
    });
  });

  describe("Filtering", () => {
    it("should filter by document types", async () => {
      mockDb.prepare.mockReturnValueOnce({
        get: jest.fn().mockReturnValue({ total: 1 }),
      } as any);

      mockDb.prepare.mockReturnValueOnce({
        all: jest.fn().mockReturnValue([]),
      } as any);

      const request = new NextRequest(
        "http://localhost:3000/api/documents?docTypes=Agenda,Minutes"
      );
      await GET(request);

      const prepareCall = mockDb.prepare.mock.calls[1];
      expect(prepareCall[0]).toContain("m.doc_types LIKE ?");
    });

    it("should filter by counties", async () => {
      mockDb.prepare.mockReturnValueOnce({
        get: jest.fn().mockReturnValue({ total: 1 }),
      } as any);

      mockDb.prepare.mockReturnValueOnce({
        all: jest.fn().mockReturnValue([]),
      } as any);

      const request = new NextRequest(
        "http://localhost:3000/api/documents?counties=Johnson,Sedgwick"
      );
      await GET(request);

      const prepareCall = mockDb.prepare.mock.calls[1];
      expect(prepareCall[0]).toContain("m.counties LIKE ?");
    });

    it("should filter by impact level", async () => {
      mockDb.prepare.mockReturnValueOnce({
        get: jest.fn().mockReturnValue({ total: 1 }),
      } as any);

      mockDb.prepare.mockReturnValueOnce({
        all: jest.fn().mockReturnValue([]),
      } as any);

      const request = new NextRequest(
        "http://localhost:3000/api/documents?impact=High,Medium"
      );
      await GET(request);

      const prepareCall = mockDb.prepare.mock.calls[1];
      expect(prepareCall[0]).toContain("m.impact IN");
    });

    it("should filter by stage", async () => {
      mockDb.prepare.mockReturnValueOnce({
        get: jest.fn().mockReturnValue({ total: 1 }),
      } as any);

      mockDb.prepare.mockReturnValueOnce({
        all: jest.fn().mockReturnValue([]),
      } as any);

      const request = new NextRequest(
        "http://localhost:3000/api/documents?stage=Hearing,Vote"
      );
      await GET(request);

      const prepareCall = mockDb.prepare.mock.calls[1];
      expect(prepareCall[0]).toContain("m.stage IN");
    });

    it("should filter by topics", async () => {
      mockDb.prepare.mockReturnValueOnce({
        get: jest.fn().mockReturnValue({ total: 1 }),
      } as any);

      mockDb.prepare.mockReturnValueOnce({
        all: jest.fn().mockReturnValue([]),
      } as any);

      const request = new NextRequest(
        "http://localhost:3000/api/documents?topics=zoning,education"
      );
      await GET(request);

      const prepareCall = mockDb.prepare.mock.calls[1];
      expect(prepareCall[0]).toContain("m.topics LIKE ?");
    });
  });

  describe("Date Filtering", () => {
    it("should filter by date range", async () => {
      mockDb.prepare.mockReturnValueOnce({
        get: jest.fn().mockReturnValue({ total: 1 }),
      } as any);

      mockDb.prepare.mockReturnValueOnce({
        all: jest.fn().mockReturnValue([]),
      } as any);

      const request = new NextRequest(
        "http://localhost:3000/api/documents?meetingDateFrom=2025-10-01&meetingDateTo=2025-10-31"
      );
      await GET(request);

      const prepareCall = mockDb.prepare.mock.calls[1];
      expect(prepareCall[0]).toContain("m.meeting_date >=");
      expect(prepareCall[0]).toContain("m.meeting_date <=");
    });

    it("should filter by daysBack", async () => {
      mockDb.prepare.mockReturnValueOnce({
        get: jest.fn().mockReturnValue({ total: 1 }),
      } as any);

      mockDb.prepare.mockReturnValueOnce({
        all: jest.fn().mockReturnValue([]),
      } as any);

      const request = new NextRequest(
        "http://localhost:3000/api/documents?daysBack=30"
      );
      await GET(request);

      const prepareCall = mockDb.prepare.mock.calls[1];
      expect(prepareCall[0]).toContain("m.meeting_date >=");
    });
  });

  describe("Text Search", () => {
    it("should search across multiple fields", async () => {
      mockDb.prepare.mockReturnValueOnce({
        get: jest.fn().mockReturnValue({ total: 1 }),
      } as any);

      mockDb.prepare.mockReturnValueOnce({
        all: jest.fn().mockReturnValue([]),
      } as any);

      const request = new NextRequest(
        "http://localhost:3000/api/documents?query=solar"
      );
      await GET(request);

      const prepareCall = mockDb.prepare.mock.calls[1];
      expect(prepareCall[0]).toContain("m.title LIKE ?");
      expect(prepareCall[0]).toContain("m.entity LIKE ?");
      expect(prepareCall[0]).toContain("m.topics LIKE ?");
    });
  });

  describe("Sorting", () => {
    it("should sort by meeting date descending by default", async () => {
      mockDb.prepare.mockReturnValueOnce({
        get: jest.fn().mockReturnValue({ total: 1 }),
      } as any);

      mockDb.prepare.mockReturnValueOnce({
        all: jest.fn().mockReturnValue([]),
      } as any);

      const request = new NextRequest("http://localhost:3000/api/documents");
      await GET(request);

      const prepareCall = mockDb.prepare.mock.calls[1];
      expect(prepareCall[0]).toContain("ORDER BY m.meeting_date DESC");
    });

    it("should sort by createdAt ascending", async () => {
      mockDb.prepare.mockReturnValueOnce({
        get: jest.fn().mockReturnValue({ total: 1 }),
      } as any);

      mockDb.prepare.mockReturnValueOnce({
        all: jest.fn().mockReturnValue([]),
      } as any);

      const request = new NextRequest(
        "http://localhost:3000/api/documents?sortBy=createdAt&sortOrder=asc"
      );
      await GET(request);

      const prepareCall = mockDb.prepare.mock.calls[1];
      expect(prepareCall[0]).toContain("ORDER BY d.created_at ASC");
    });
  });

  describe("Error Handling", () => {
    it("should handle database errors gracefully", async () => {
      mockDb.prepare.mockImplementation(() => {
        throw new Error("Database connection failed");
      });

      const request = new NextRequest("http://localhost:3000/api/documents");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });
  });

  describe("JSON Field Parsing", () => {
    it("should parse JSON fields correctly", async () => {
      const mockDocument = {
        id: "doc-1",
        source_id: "test",
        file_url: "https://test.com/doc.pdf",
        content_hash: "hash123",
        bytes_size: 1000,
        created_at: "2025-10-27T00:00:00Z",
        title: "Test",
        entity: "Test Entity",
        jurisdiction: "Test County",
        counties: '["Johnson", "Sedgwick"]',
        meeting_date: "2025-10-27",
        doc_types: '["Agenda", "Minutes"]',
        impact: "High",
        stage: "Hearing",
        topics: '["zoning", "education"]',
        keyword_hits: '{"solar": 5, "zoning": 3}',
        extracted_text: '["Text 1", "Text 2"]',
        pdf_preview: '["Page 1"]',
        attachments: '[{"id":"a1","title":"Agenda","type":"Agenda"}]',
        updated_at: "2025-10-27T00:00:00Z",
      };

      mockDb.prepare.mockReturnValueOnce({
        get: jest.fn().mockReturnValue({ total: 1 }),
      } as any);

      mockDb.prepare.mockReturnValueOnce({
        all: jest.fn().mockReturnValue([mockDocument]),
      } as any);

      const request = new NextRequest("http://localhost:3000/api/documents");
      const response = await GET(request);
      const data = await response.json();

      expect(data.documents[0].counties).toEqual(["Johnson", "Sedgwick"]);
      expect(data.documents[0].docTypes).toEqual(["Agenda", "Minutes"]);
      expect(data.documents[0].topics).toEqual(["zoning", "education"]);
      expect(data.documents[0].hits).toEqual({ solar: 5, zoning: 3 });
    });

    it("should handle malformed JSON gracefully", async () => {
      const mockDocument = {
        id: "doc-1",
        source_id: "test",
        file_url: "https://test.com/doc.pdf",
        content_hash: "hash123",
        bytes_size: 1000,
        created_at: "2025-10-27T00:00:00Z",
        title: "Test",
        entity: "Test Entity",
        jurisdiction: "Test County",
        counties: "invalid json",
        meeting_date: "2025-10-27",
        doc_types: "invalid",
        impact: "High",
        stage: null,
        topics: null,
        keyword_hits: null,
        extracted_text: null,
        pdf_preview: null,
        attachments: null,
        updated_at: "2025-10-27T00:00:00Z",
      };

      mockDb.prepare.mockReturnValueOnce({
        get: jest.fn().mockReturnValue({ total: 1 }),
      } as any);

      mockDb.prepare.mockReturnValueOnce({
        all: jest.fn().mockReturnValue([mockDocument]),
      } as any);

      const request = new NextRequest("http://localhost:3000/api/documents");
      const response = await GET(request);
      const data = await response.json();

      expect(data.documents[0].counties).toEqual([]);
      expect(data.documents[0].hits).toEqual({});
    });
  });
});

describe("POST /api/documents", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDb.mockReturnValue(mockDb as any);
  });

  describe("Valid Requests", () => {
    it("should create a document with all fields", async () => {
      const validDocument = {
        sourceId: "test_source",
        fileUrl: "https://test.com/doc.pdf",
        contentHash: "unique-hash-123",
        bytesSize: 5000,
        title: "Test Document",
        entity: "Test Entity",
        jurisdiction: "Test County, KS",
        counties: ["Test"],
        meetingDate: "2025-10-27",
        docTypes: ["Agenda"],
        impact: "Medium",
        stage: "Draft",
        topics: ["test"],
        keywordHits: { test: 1 },
        extractedText: ["Sample text"],
        pdfPreview: ["Page 1"],
        attachments: [{ id: "a1", title: "Agenda", type: "Agenda" }],
      };

      // Mock duplicate check - no existing document
      const mockGet = jest.fn().mockReturnValue(undefined);
      const duplicateCheckStmt = { get: mockGet };
      mockDb.prepare.mockReturnValueOnce(duplicateCheckStmt as any);

      // Mock transaction
      const mockTransaction = jest.fn((cb) => () => cb());
      mockDb.transaction.mockImplementation(mockTransaction);

      // Mock inserts (inside transaction)
      const insertDocStmt = { run: jest.fn() };
      const insertMetaStmt = { run: jest.fn() };
      mockDb.prepare.mockReturnValueOnce(insertDocStmt as any);
      mockDb.prepare.mockReturnValueOnce(insertMetaStmt as any);

      // Mock fetch of created document
      const selectStmt = { get: jest.fn().mockReturnValue({
          id: "new-id",
          source_id: "test_source",
          file_url: "https://test.com/doc.pdf",
          content_hash: "unique-hash-123",
          bytes_size: 5000,
          created_at: "2025-10-27T00:00:00Z",
          title: "Test Document",
          entity: "Test Entity",
          jurisdiction: "Test County, KS",
          counties: '["Test"]',
          meeting_date: "2025-10-27",
          doc_types: '["Agenda"]',
          impact: "Medium",
          stage: "Draft",
          topics: '["test"]',
          keyword_hits: '{"test":1}',
          extracted_text: '["Sample text"]',
          pdf_preview: '["Page 1"]',
          attachments: '[{"id":"a1","title":"Agenda","type":"Agenda"}]',
          updated_at: "2025-10-27T00:00:00Z",
        }) };
      mockDb.prepare.mockReturnValueOnce(selectStmt as any);

      const request = new NextRequest("http://localhost:3000/api/documents", {
        method: "POST",
        body: JSON.stringify(validDocument),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.id).toBeDefined();
      expect(data.title).toBe("Test Document");
    });

    it("should create a document with only required fields", async () => {
      const minimalDocument = {
        sourceId: "test_source",
        fileUrl: "https://test.com/doc.pdf",
        contentHash: "unique-hash-456",
        bytesSize: 1000,
        title: "Minimal Document",
        entity: "Test Entity",
        jurisdiction: "Test County, KS",
      };

      const mockGet2 = jest.fn().mockReturnValue(undefined);
      const duplicateCheckStmt = { get: mockGet2 };
      mockDb.prepare.mockReturnValueOnce(duplicateCheckStmt as any);

      const mockTransaction = jest.fn((cb) => () => cb());
      mockDb.transaction.mockImplementation(mockTransaction);

      const insertDocStmt = { run: jest.fn() };
      const insertMetaStmt = { run: jest.fn() };
      mockDb.prepare.mockReturnValueOnce(insertDocStmt as any);
      mockDb.prepare.mockReturnValueOnce(insertMetaStmt as any);

      const selectStmt = { get: jest.fn().mockReturnValue({
          id: "new-id",
          source_id: "test_source",
          file_url: "https://test.com/doc.pdf",
          content_hash: "unique-hash-456",
          bytes_size: 1000,
          created_at: "2025-10-27T00:00:00Z",
          title: "Minimal Document",
          entity: "Test Entity",
          jurisdiction: "Test County, KS",
          counties: "[]",
          meeting_date: null,
          doc_types: "[]",
          impact: "Low",
          stage: null,
          topics: "[]",
          keyword_hits: "{}",
          extracted_text: "[]",
          pdf_preview: "[]",
          attachments: "[]",
          updated_at: "2025-10-27T00:00:00Z",
        }) };
      mockDb.prepare.mockReturnValueOnce(selectStmt as any);

      const request = new NextRequest("http://localhost:3000/api/documents", {
        method: "POST",
        body: JSON.stringify(minimalDocument),
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
    });
  });

  describe("Validation", () => {
    it("should reject request with missing sourceId", async () => {
      const invalidDocument = {
        fileUrl: "https://test.com/doc.pdf",
        contentHash: "hash123",
        bytesSize: 1000,
        title: "Test",
        entity: "Test Entity",
        jurisdiction: "Test County",
      };

      const request = new NextRequest("http://localhost:3000/api/documents", {
        method: "POST",
        body: JSON.stringify(invalidDocument),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("VALIDATION_ERROR");
      expect(data.fields.sourceId).toBe("Required");
    });

    it("should reject request with missing title", async () => {
      const invalidDocument = {
        sourceId: "test",
        fileUrl: "https://test.com/doc.pdf",
        contentHash: "hash123",
        bytesSize: 1000,
        entity: "Test Entity",
        jurisdiction: "Test County",
      };

      const request = new NextRequest("http://localhost:3000/api/documents", {
        method: "POST",
        body: JSON.stringify(invalidDocument),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("VALIDATION_ERROR");
    });

    it("should reject request with multiple missing fields", async () => {
      const invalidDocument = {
        sourceId: "test",
      };

      const request = new NextRequest("http://localhost:3000/api/documents", {
        method: "POST",
        body: JSON.stringify(invalidDocument),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.fields).toBeDefined();
      expect(Object.keys(data.fields).length).toBeGreaterThan(1);
    });
  });

  describe("Duplicate Detection", () => {
    it("should reject duplicate content_hash", async () => {
      const duplicateCheckStmt = { get: jest.fn().mockReturnValue({
          id: "existing-doc-id",
        }) };
      mockDb.prepare.mockReturnValueOnce(duplicateCheckStmt as any);

      const duplicateDocument = {
        sourceId: "test",
        fileUrl: "https://test.com/doc.pdf",
        contentHash: "existing-hash",
        bytesSize: 1000,
        title: "Duplicate",
        entity: "Test Entity",
        jurisdiction: "Test County",
      };

      const request = new NextRequest("http://localhost:3000/api/documents", {
        method: "POST",
        body: JSON.stringify(duplicateDocument),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe("DUPLICATE_DOCUMENT");
      expect(data.existingDocumentId).toBe("existing-doc-id");
      expect(data.contentHash).toBe("existing-hash");
    });
  });

  describe("Error Handling", () => {
    it("should handle database errors", async () => {
      mockDb.prepare.mockImplementation(() => {
        throw new Error("Database error");
      });

      const validDocument = {
        sourceId: "test",
        fileUrl: "https://test.com/doc.pdf",
        contentHash: "hash123",
        bytesSize: 1000,
        title: "Test",
        entity: "Test Entity",
        jurisdiction: "Test County",
      };

      const request = new NextRequest("http://localhost:3000/api/documents", {
        method: "POST",
        body: JSON.stringify(validDocument),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });

    it("should handle invalid JSON", async () => {
      const request = new NextRequest("http://localhost:3000/api/documents", {
        method: "POST",
        body: "invalid json",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
    });
  });
});
