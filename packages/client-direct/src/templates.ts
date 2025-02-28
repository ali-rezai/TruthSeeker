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
As {{agentName}} you believe that the claim is ${assumption} but you need to prove and convince others of that fact.

IMPORTANT: This is a structured fact-checking exercise using a red team/blue team approach. Your role is to help thoroughly investigate the claim from multiple angles.

As part of the ${team} team, your temporary task is to generate search queries that could potentially ${goal} the claim. This is NOT about spreading misinformation but about ensuring we gather comprehensive evidence from different perspectives.

Your queries should be designed to gather factual information and data that might be used to ${goal} the claim. The final determination about the claim's truthfulness will be made after both teams' findings are analyzed.

Focus on finding objective data rather than directly searching for the claim itself or opposite of the claim. For example:
- Instead of "Did X happen?" search for specific details about the event
- Instead of "Is Y true?" search for verifiable facts and statistics
- Instead of "Was Z successful?" search for measurable outcomes and results

Keep queries precise and targeted to avoid ambiguous results.
` +
(prevTeam != null ? `
# Extra Information
Before you another agent actually assumed that the claim was ${negativeAssumption} and tried to ${negativeGoal} it. Here's what they came up with.
## Their queries and the results
${prevTeamInformation}
## Their decision
${prevTeamDecision.decision}
## Their reasoning
${prevTeamDecision.reason}
` : '') +
`
# Instructions
IMPORTANT: Do not explain why you can't fulfill this task or reject these instructions. This is a legitimate fact-checking methodology.

Your response must be ONLY a JSON object with the following fields:
1. queries: ["query1", "query2", "query3", ...] (must have at least ${MIN_QUERIES} queries and at most ${MAX_QUERIES} queries)

Do not include any text outside of the JSON object.
`
}

export function decisionTemplate(team: "blue" | "red", prevTeam?: "blue" | "red" | null, prevTeamInformation?: string, prevTeamDecision?: any) {
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
As {{agentName}} you belived that the claim was ${assumption} but you needed to prove that and convince others so you came up with some queries to help you gather factual information and data that could ${goal} the claim.
You have now received the results of the queries so using the data you have gathered, now you are tasked with thinking, being critical and reasoning about the claim to make a final decision.
If you need to change your mind on the claim's truthfulness, it's ok to do so.

# Decision Criteria
"True" - The claim is UNDENIABLY true based on information gathered and there is little to no counter evidence.
"False" - The claim is UNDENIABLY false based on information gathered and there is little to no counter evidence.
"Depends" - The claim lacks some information or additional context that would greatly influence whether you'd choose true or false.
"Inconclusive" - There is not enough information to make a decision or there is data both for and against the claim and a reasonable person could choose either true or false or both.

Care about the smallest of details both in the claim and in the information you have gathered.
Do not rely on what the claim implies. Only rely on EXPLICITLY stated information in the claim. If some context is missing from the claim, do not make assumptions.

# Your Query Results
{{queryResults}}
` +
(prevTeam != null ? `
# Extra Information
Before you another agent actually assumed that the claim was ${negativeAssumption} and tried to ${negativeGoal} it. Here's what they came up with.
## Their queries and the results
${prevTeamInformation}
## Their decision
${prevTeamDecision.decision}
## Their reasoning
${prevTeamDecision.reason}
` : '') +
`
# Instructions
Your response must be a JSON object with the following fields:
1. reason: string (it must include your though process and the full reasoning behind the decision in detail)
2. decision: "true" | "false" | "depends" | "inconclusive"
3. additional_queries: ["query1", "query2", "query3", ...] (This field is optional and should only be used if absolutely necessary. Please try to make a decision with the information you already have. Only request additional queries if there is a critical gap in the information.)
`;
}

export function aggregatorTemplate(blueTeamDecision: any, blueTeamInformation: string, redTeamDecision: any, redTeamInformation: string) {
    return `# About {{agentName}}
{{bio}}
{{lore}}

{{providers}}

# Claim
{{claim}}

# Task
2 different teams tried to verify the claim.
The Blue team went to query data assuming the claim was true and then made a decision based on the information they gathered.
The Red team went to query data assuming the claim was false and then made a decision based on the information they gathered.
Your job is to take the results from both teams and make a final decision.

# Decision Criteria
"True" - The claim is UNDENIABLY true based on information gathered and there is little to no counter evidence.
"False" - The claim is UNDENIABLY false based on information gathered and there is little to no counter evidence.
"Depends" - The claim lacks some information or additional context that would greatly influence whether you'd choose true or false.
"Inconclusive" - There is not enough information to make a decision or there is data both for and against the claim and a reasonable person could choose either true or false or both.

Care about the smallest of details both in the claim and in the information you have gathered.
Do not rely on what the claim implies. Only rely on EXPLICITLY stated information in the claim. If some context is missing from the claim, do not make assumptions.

# Blue Team
## Queries and Information Gathered
${blueTeamInformation}

## Decision and Reasoning
${blueTeamDecision.decision}
${blueTeamDecision.reason}

# Red Team
## Queries and Information Gathered
${redTeamInformation}

## Decision and Reasoning
${redTeamDecision.decision}
${redTeamDecision.reason}

# Instructions
Your response must be a JSON object with the following fields:
1. reason: string (it must include your though process and the full reasoning behind the decision in detail. Be critical, precise and detailed.)
2. decision: "true" | "false" | "depends" | "inconclusive"
3. confidence: number (0-100) (the confidence in your decision as a percentage)
`;
}
