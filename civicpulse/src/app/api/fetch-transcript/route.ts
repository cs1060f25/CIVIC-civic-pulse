import { NextRequest, NextResponse } from "next/server";

interface TranscriptData {
  title: string;
  date: string;
  speakers: string[];
  content: string[];
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "Valid URL is required" },
        { status: 400 }
      );
    }

    // For now, return mock transcript data
    // In a real implementation, this would fetch from the municipal transcript service
    const mockTranscript: TranscriptData = {
      title: "Johnson County Planning Commission Meeting",
      date: new Date().toLocaleDateString(),
      speakers: ["Chair Smith", "Director Johnson", "Citizen Brown", "Commissioner Davis"],
      content: [
        "Chair Smith: Good morning everyone, welcome to the Johnson County Planning Commission meeting for October 15, 2024.",
        "Director Johnson: Thank you Madam Chair. The first item on our agenda today is the proposed solar energy facility regulations.",
        "Director Johnson: Staff has been working on these regulations for the past six months, incorporating feedback from various stakeholders.",
        "Citizen Brown: I'd like to speak about the proposed setback requirements. I live adjacent to the area being considered for solar development.",
        "Citizen Brown: The 500-foot setback seems reasonable, but I'm concerned about the visual impact on property values.",
        "Commissioner Davis: Thank you for your comments. Could you elaborate on your specific concerns about property values?",
        "Citizen Brown: Based on research from other counties, properties near large solar installations have seen 10-15% decreases in value.",
        "Director Johnson: We've reviewed studies from multiple jurisdictions, and the impact varies significantly based on screening and landscaping requirements.",
        "Director Johnson: Our proposed ordinance includes mandatory vegetative buffers that would mitigate many of the visual impacts.",
        "Chair Smith: Are there any other public comments on this item?",
        "Commissioner Davis: I have a question about the decommissioning requirements. Is there a financial assurance mechanism?",
        "Director Johnson: Yes, the ordinance requires developers to post a bond covering 100% of estimated decommissioning costs.",
        "Commissioner Davis: That seems appropriate. How does this compare to neighboring counties?",
        "Director Johnson: Most counties in the region require similar financial assurances, though the exact amounts vary.",
        "Chair Smith: Thank you all for your input. We will continue this discussion at our next meeting on November 5th.",
        "Chair Smith: The meeting is now adjourned."
      ]
    };

    return NextResponse.json({
      transcript: mockTranscript
    });

  } catch (error) {
    console.error("Error fetching transcript:", error);
    return NextResponse.json(
      { error: "Failed to fetch transcript" },
      { status: 500 }
    );
  }
}
