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
Please respond in the following way with at least ${MIN_QUERIES} queries and at most ${MAX_QUERIES} queries:
\`\`\`json
["query1", "query2", "query3", ...]
\`\`\`
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
To use "depends" as a decision, the thing it depends on must NOT be provided inside the claim itself. Otherwise since you have the data already you HAVE to make a decision.

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
Respond in the following way:
\`\`\`json
{
    reason: "string (it must include your though process and the full reasoning behind the decision in detail)",
    decision: "true" | "false" | "depends" | "unknown"
}
\`\`\`
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
The Blue team just went to query data relating to it and then made a decision based on those.
The Red team went to query data assuming the claim was false and then made a decision based on those.
Your job is to take the results from both teams and make a final decision.

Care about the smallest of details both in the claims and in the information you have gathered.
To use "depends" as a decision, the thing it depends on must NOT be provided inside the claim itself. Otherwise since you have the data already you HAVE to make a decision.

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
Respond in the following way:
\`\`\`json
{
    reason: "string (it must include your though process and the full reasoning behind the decision in detail)",
    decision: "true" | "false" | "depends" | "unknown"
}
\`\`\`
`;
}
