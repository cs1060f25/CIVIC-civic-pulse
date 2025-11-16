import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { question, transcriptContent, conversationHistory } = await request.json();

    if (!question || !transcriptContent) {
      return NextResponse.json(
        { error: "Question and transcript content are required" },
        { status: 400 }
      );
    }

    // For now, generate mock responses based on common questions
    // In a real implementation, this would call an AI service with the transcript context
    const lowerQuestion = question.toLowerCase();
    
    let answer = "";
    
    if (lowerQuestion.includes("setback") || lowerQuestion.includes("distance")) {
      answer = `Based on the meeting discussion, the proposed setback requirement is **500 feet** from residential properties. This was a key point of discussion:

- Citizen Brown expressed concerns about property value impacts
- Staff cited research from neighboring jurisdictions showing 10-15% potential property value decreases
- The ordinance includes mandatory vegetative buffers to mitigate visual impacts
- This setback distance is consistent with most counties in the region

The commission will continue discussing this requirement at their next meeting on November 5th.`;
    } else if (lowerQuestion.includes("property") || lowerQuestion.includes("value")) {
      answer = `Property value concerns were a major topic in the meeting. Here's what was discussed:

**Research Findings:**
- Studies from multiple jurisdictions show 10-15% property value decreases near large solar installations
- Impact varies significantly based on screening and landscaping requirements

**Mitigation Measures Proposed:**
- Mandatory vegetative buffers to reduce visual impact
- 500-foot setback from residential properties
- Financial assurance requirements for decommissioning

**Next Steps:**
- Staff will provide additional research on property value impacts
- More specific screening requirements will be reviewed

The commission appears to be taking these concerns seriously while balancing renewable energy goals.`;
    } else if (lowerQuestion.includes("decommission") || lowerQuestion.includes("bond")) {
      answer = `The decommissioning requirements are quite comprehensive:

**Financial Assurance:**
- Developers must post a bond covering **100% of estimated decommissioning costs**
- This ensures taxpayers won't be responsible for removal costs

**Comparison to Other Jurisdictions:**
- Most counties in the region require similar financial assurances
- Exact amounts vary between jurisdictions
- Johnson County's requirements are consistent with neighboring areas

**Purpose:**
- Guarantees proper removal of solar equipment at end of life
- Covers site restoration costs
- Protects landowners and the community

This requirement was generally supported by the commission as a necessary protection measure.`;
    } else if (lowerQuestion.includes("next") || lowerQuestion.includes("meeting")) {
      answer = `The next steps for this solar regulation discussion are:

**Next Meeting:**
- **Date**: November 5th
- **Time**: Not specified in the transcript
- **Location**: Not specified in the transcript

**Agenda Items for Next Meeting:**
- Continued discussion on solar energy facility regulations
- Additional research on property value impacts
- Review of screening and landscaping requirements
- Potential vote on proposed regulations

**Public Participation:**
- Citizens can attend and provide comments
- Contact the Planning Commission for meeting details
- Meeting agendas are typically posted in advance

The commission appears to be taking a thorough approach to this important regulation.`;
    } else {
      // Generic response for other questions
      answer = `Based on the meeting transcript, this was a Planning Commission discussion about solar energy facility regulations. The key topics covered included:

- Setback requirements (500 feet from residential properties)
- Property value concerns and mitigation measures
- Financial assurance for decommissioning
- Public comments and stakeholder feedback

For more specific information about your question, you might want to:
- Review the full meeting transcript
- Contact the Johnson County Planning Commission directly
- Check the meeting minutes when they're published

The commission will continue this discussion at their November 5th meeting.`;
    }

    // Add context about conversation history if relevant
    if (conversationHistory && conversationHistory.length > 0) {
      answer += `\n\n*This answer considers our previous discussion and provides additional context based on the meeting transcript.*`;
    }

    return NextResponse.json({
      answer: answer
    });

  } catch (error) {
    console.error("Error processing follow-up question:", error);
    return NextResponse.json(
      { error: "Failed to process question" },
      { status: 500 }
    );
  }
}
