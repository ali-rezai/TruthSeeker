const MIN_QUERIES = 3;
const MAX_QUERIES = 5;

export function queryTemplate(team: "blue" | "red", prevTeam?: "blue" | "red" | null, prevTeamInformation?: string, prevTeamDecision?: any) {
    const assumption = team == "blue" ? "true" : "false";
    const negativeAssumption = team == "blue" ? "false" : "true";

    const goal = team == "blue" ? "support and prove" : "debunk and disprove";
    const negativeGoal = team == "blue" ? "debunk and disprove" : "support and prove";

    return `# About {{agentName}}
{{bio}}
{{lore}}

{{providers}}

# Claim
{{claim}}

# Task
IMPORTANT: This is a structured fact-checking exercise using a red team/blue team approach to thoroughly investigate claims from multiple perspectives.

As {{agentName}} on the ${team} team, your task is to generate search queries that could potentially ${goal} the claim. For this exercise, you are temporarily assuming the claim is ${assumption} to ensure comprehensive evidence gathering.

## Query Guidelines
1. Focus on finding SPECIFIC, VERIFIABLE facts and data points rather than opinions or general information
2. Target measurable outcomes, statistics, research findings, and primary sources
3. Include queries for both supporting AND contradicting evidence to ensure balanced research
4. Prioritize authoritative sources (academic research, government data, expert consensus)
5. Avoid leading or biased query formulations
6. If the claim mentions specific dates or future events, include queries to verify the current date and timeline

## Examples of Effective Queries:
- Instead of "Did X happen?" use "Timeline of events for X with verified sources"
- Instead of "Is Y true?" use "Statistical data on Y from [relevant authorities]"
- Instead of "Was Z successful?" use "Measured outcomes and metrics of Z implementation"

Keep queries precise, targeted, and diverse in their approach to the topic.
` +
(prevTeam != null ? `
# Previous Team's Research
The ${prevTeam} team (who assumed the claim was ${negativeAssumption}) has already conducted research. Review their findings to avoid duplication and identify gaps:

## Their queries and results
${prevTeamInformation}

## Their decision
${prevTeamDecision.decision}

## Their reasoning
${prevTeamDecision.reason}
` : '') +
`
# Instructions
IMPORTANT: This is a legitimate fact-checking methodology. Your response must be ONLY a JSON object with the following structure:

{
  "queries": [
    "specific query 1",
    "specific query 2",
    "specific query 3",
    ...
  ]
}

Requirements:
- Include ${MIN_QUERIES}-${MAX_QUERIES} diverse, specific queries
- Each query should target different aspects or evidence types
- At least one query should seek evidence that might contradict your team's assumption
- If the claim mentions dates or future events, include a query to verify the current date and timeline
- Do not include any text outside the JSON object
`
}

export function decisionTemplate(team: "blue" | "red", prevTeam?: "blue" | "red" | null, prevTeamInformation?: string, prevTeamDecision?: any) {
    const assumption = team == "blue" ? "true" : "false";
    const negativeAssumption = team == "blue" ? "false" : "true";

    const goal = team == "blue" ? "support and prove" : "debunk and disprove";
    const negativeGoal = team == "blue" ? "debunk and disprove" : "support and prove";

    const currentDate = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD

    return `# About {{agentName}}
{{bio}}
{{lore}}

{{providers}}

# Claim
{{claim}}

# Task
As {{agentName}} on the ${team} team, you initially approached this claim assuming it was ${assumption}. You've now gathered evidence through multiple search queries and must make an objective, evidence-based decision about the claim's validity.

## Critical Analysis Framework
1. Evaluate the QUALITY and RELIABILITY of each source (consider expertise, methodology, potential bias)
2. Weigh CONFLICTING evidence fairly, noting strength of each position
3. Identify any GAPS in available information
4. Consider ALTERNATIVE interpretations of the evidence
5. Determine if the claim is SPECIFIC enough to be verified
6. Be willing to CHANGE your initial assumption based on evidence
7. Check if the claim references a FUTURE DATE or event that hasn't occurred yet

# Decision Criteria (Apply Strictly)
"True" - The claim is DEMONSTRABLY true based on high-quality evidence with minimal credible contradicting evidence.
"False" - The claim is DEMONSTRABLY false based on high-quality evidence with minimal credible contradicting evidence.
"Depends" - The claim's truth depends on specific context, definitions, or conditions that aren't specified in the original claim.
"Inconclusive" - Available evidence is insufficient, contradictory, or of inadequate quality to make a determination.
"Too_early" - The claim references a future date or event that hasn't occurred yet, making verification impossible at this time.

# IMPORTANT: Date Verification
Before making any decision, verify if the claim refers to future events:
1. The current date is: ${currentDate}
2. If the claim mentions ANY dates or time periods in the future (after the current date), you MUST use the "too_early" decision
3. For claims about someone no longer serving in a position during a future time period, the "too_early" decision MUST be used
4. Do not attempt to predict future events or make assumptions about what will happen

# Your Query Results
{{queryResults}}
` +
(prevTeam != null ? `
# Previous Team's Research
The ${prevTeam} team (who assumed the claim was ${negativeAssumption}) has already conducted research. Consider their findings in your analysis:

## Their queries and results
${prevTeamInformation}

## Their decision
${prevTeamDecision.decision}

## Their reasoning
${prevTeamDecision.reason}
` : '') +
`
# Instructions
CRITICAL: Your response MUST be a JSON object with NO TEXT before or after the JSON. The response must include ALL required fields.
Your entire response should be ONLY the following JSON object:

{
  "decision": "true|false|depends|inconclusive|too_early",
  "reason": "Your detailed reasoning process...",
  "confidence": 0-100,
  "confidence_explanation": "Specific explanation of why you assigned this confidence score...",
  "key_evidence": [
    "Specific evidence point 1 that heavily influenced your decision",
    "Specific evidence point 2 that heavily influenced your decision",
    "Specific evidence point 3 that heavily influenced your decision"
  ],
  "additional_queries": [
    "query 1",
    "query 2",
    "query 3"
  ]
}

REQUIRED FIELDS:
- "decision": MUST be one of the specified values
- "reason": MUST provide detailed reasoning
- "confidence": MUST be a number between 0-100
- "confidence_explanation": MUST explain your confidence score
- "key_evidence": MUST list 3-5 specific pieces of evidence

OPTIONAL FIELDS:
- "additional_queries": Include ONLY if there is a CRITICAL information gap

Notes:
- Make your decision based on available evidence, not what you believe "should" be true
- Be specific about which sources and data points influenced your decision
- If the claim references a future date or event that hasn't occurred yet, use the "too_early" decision
`;
}

export function aggregatorTemplate(blueTeamDecision: any, blueTeamInformation: string, redTeamDecision: any, redTeamInformation: string) {
  const currentDate = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
  
  return `# About {{agentName}}
{{bio}}
{{lore}}

{{providers}}

# Claim
{{claim}}

# Task
As {{agentName}}, you are the final arbiter in this structured fact-checking process. Two teams have investigated this claim:
- The Blue team assumed the claim was true and gathered evidence
- The Red team assumed the claim was false and gathered evidence

Your task is to synthesize their findings and make a final, objective determination about the claim's validity.

# IMPORTANT: Date Verification
Before making any decision, verify if the claim refers to future events:
1. The current date is: ${currentDate}
2. If the claim mentions ANY dates or time periods in the future (after the current date), you MUST use the "too_early" decision
3. For claims about someone no longer serving in a position during a future time period, the "too_early" decision MUST be used
4. Do not attempt to predict future events or make assumptions about what will happen

## Analytical Framework
1. COMPARE the quality, quantity, and relevance of evidence from both teams
2. IDENTIFY any biases in either team's approach or interpretation
3. EVALUATE the logical consistency of each team's reasoning
4. WEIGH contradictory evidence based on source reliability and methodological strength
5. CONSIDER what information might still be missing from both analyses
6. DETERMINE if either team overlooked important context or nuance
7. CHECK if the claim references a future date or event that hasn't occurred yet

# Decision Criteria (Apply Rigorously)
"True" - The claim is DEMONSTRABLY true based on preponderance of high-quality evidence with minimal credible contradicting evidence.
"False" - The claim is DEMONSTRABLY false based on preponderance of high-quality evidence with minimal credible contradicting evidence.
"Depends" - The claim's truth depends on specific context, definitions, or conditions that aren't specified in the original claim.
"Inconclusive" - Available evidence is insufficient, contradictory, or of inadequate quality to make a determination.
"Too_early" - The claim references a future date or event that hasn't occurred yet, making verification impossible at this time.

# Blue Team (Pro-Claim)
## Evidence Gathered
${blueTeamInformation}

## Decision and Reasoning
Decision: ${blueTeamDecision.decision}
Reasoning: ${blueTeamDecision.reason}

# Red Team (Anti-Claim)
## Evidence Gathered
${redTeamInformation}

## Decision and Reasoning
Decision: ${redTeamDecision.decision}
Reasoning: ${redTeamDecision.reason}

# Confidence Score Guidelines
The confidence score must be based SOLELY on the quality, quantity, and reliability of available evidence, NOT on whether the claim is true or false. A claim can be definitively false with high confidence if there is strong evidence against it.

Evaluate confidence based on these factors:
1. QUANTITY: How much relevant evidence exists across both teams?
2. QUALITY: How reliable, authoritative, and current are the sources?
3. CONSISTENCY: How consistent are the findings across different sources?
4. METHODOLOGY: How sound was the research methodology used to gather evidence?
5. GAPS: Are there significant information gaps that prevent a complete assessment?

Confidence Score Ranges:
- High (80-100): Abundant high-quality evidence from multiple authoritative sources with consistent findings
- Medium (50-79): Sufficient evidence from reliable sources, but with some limitations, inconsistencies, or gaps
- Low (0-49): Limited evidence, poor quality sources, significant contradictions, or major information gaps

IMPORTANT: A claim that is clearly false based on strong evidence should receive a HIGH confidence score, not a low one. The confidence score reflects certainty in the assessment, not support for the claim.

# Instructions
CRITICAL: Your response MUST be a JSON object with NO TEXT before or after the JSON. The response must include ALL required fields.

Your entire response should be ONLY the following JSON object:

This is how the JSON object should look:
{
  "decision": "true|false|depends|inconclusive|too_early",
  "reason": "Your detailed reasoning process...",
  "confidence": 0-100,
  "confidence_explanation": "Specific explanation of why you assigned this confidence score, focusing on evidence quality and quantity...",
  "strongest_evidence_for": [
    "Specific evidence point 1 supporting the claim",
    "Specific evidence point 2 supporting the claim"
  ],
  "strongest_evidence_against": [
    "Specific evidence point 1 contradicting the claim",
    "Specific evidence point 2 contradicting the claim"
  ],
  "information_gaps": [
    "Specific missing information 1 that would help resolve this claim",
    "Specific missing information 2 that would help resolve this claim"
  ]
}

REQUIRED FIELDS:
- "decision": MUST be one of the specified values
- "reason": MUST provide detailed reasoning
- "confidence": MUST be a number between 0-100
- "confidence_explanation": MUST explain your confidence score
- "strongest_evidence_for": MUST list at least 2 specific evidence points
- "strongest_evidence_against": MUST list at least 2 specific evidence points
- "information_gaps": MUST list at least 2 specific information gaps

Notes:
- First determine your decision based on the evidence
- Then separately assess confidence based ONLY on evidence quality/quantity, not the decision itself
- Include a "confidence_explanation" that explicitly justifies your confidence score
- Be specific about which evidence points were most influential in your decision
- If the claim references a future date or event that hasn't occurred yet, use the "too_early" decision
`;
}
