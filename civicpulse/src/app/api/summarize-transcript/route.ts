import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { transcriptContent, userTopics } = await request.json();

    if (!transcriptContent || !Array.isArray(transcriptContent)) {
      return NextResponse.json(
        { error: "Valid transcript content is required" },
        { status: 400 }
      );
    }

    // For now, generate a mock summary
    // In a real implementation, this would call an AI service like OpenAI
    const hasTopics = userTopics && userTopics.length > 0;
    
    let mockSummary = `# Meeting Summary\n\n## Key Takeaways\n\n- The Planning Commission discussed proposed solar energy facility regulations\n- Public comments focused on setback requirements and property value concerns\n- Staff presented research from neighboring jurisdictions\n- Financial assurance requirements were reviewed\n\n## Main Discussion Points\n\n### Solar Facility Regulations\n- **Setback Requirements**: Proposed 500-foot setback from residential properties\n- **Visual Impact**: Citizens expressed concerns about property values (10-15% potential decrease)\n- **Mitigation Measures**: Mandatory vegetative buffers included in proposal\n- **Financial Assurance**: 100% bond required for decommissioning costs\n\n### Public Feedback\n- Mixed sentiment with specific concerns about visual impacts\n- Support for the financial assurance mechanism\n- Request for more screening requirements\n\n### Next Steps\n- Continued discussion at November 5th meeting\n- Staff to provide additional research on property value impacts\n- Review of screening and landscaping requirements`;

    // Add topic relevance if user has topics configured
    if (hasTopics) {
      mockSummary += `\n\n## Relevance to Your Topics\n\n`;
      if (userTopics.includes('solar zoning') || userTopics.includes('renewable energy')) {
        mockSummary += `**Solar Energy & Zoning**: This meeting directly addresses solar facility siting regulations, setback requirements, and zoning considerations for utility-scale solar projects.\n\n`;
      }
      if (userTopics.includes('land use')) {
        mockSummary += `**Land Use**: The discussion covers important land use planning aspects including buffer requirements, property value impacts, and decommissioning planning.\n\n`;
      }
      mockSummary += `This meeting provides valuable insights into local government approaches to renewable energy regulation and land use planning.`;
    }

    // Simulate potential AI service unavailability
    const fallback = Math.random() > 0.7; // 30% chance of fallback for demo
    
    if (fallback) {
      return NextResponse.json({
        summary: mockSummary,
        fallback: true,
        error: "AI service temporarily unavailable"
      });
    }

    return NextResponse.json({
      summary: mockSummary,
      fallback: false
    });

  } catch (error) {
    console.error("Error summarizing transcript:", error);
    return NextResponse.json(
      { error: "Failed to summarize transcript" },
      { status: 500 }
    );
  }
}
