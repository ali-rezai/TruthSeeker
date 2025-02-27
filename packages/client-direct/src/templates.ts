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
So your task is to generate search queries that will help ${goal} the claim.
Your queries should be designed to gather factual information and data that can be used to ${goal} the claim.

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
Your response must be a JSON object with the following fields:
1. queries: ["query1", "query2", "query3", ...] (must have at least ${MIN_QUERIES} queries and at most ${MAX_QUERIES} queries)
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

Care about the smallest of details both in the claims and in the information you have gathered.
If your decision would change depending on something that is not provided in the claim but is key to your decision, use "depends" as your decision.
Do not rely on "implied" data in the claim. If something is missing from the claim, it is missing do not make assumptions.

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
2. decision: "true" | "false" | "depends" | "unknown"
3. additional_queries: ["query1", "query2", "query3", ...] (This field is optional. If you'd like to look deeper into something that you found out or need more information and want to query more data to make a better more informed decision you can include additional queries here.)
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

Care about the smallest of details both in the claims and in the information you have gathered.
If your decision would change depending on something that is not provided in the claim but is key to your decision, use "depends" as your decision.
Do not rely on "implied" data in the claim. If something is missing from the claim, it is missing do not make assumptions.

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
1. reason: string (it must include your though process and the full reasoning behind the decision in detail. Do not mention the blue and red team you can claim their work as your own.)
2. decision: "true" | "false" | "depends" | "unknown"
3. confidence: number (0-100) (the confidence in your decision as a percentage)
`;
}
