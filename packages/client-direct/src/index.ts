import {
    composeContext,
    elizaLogger,
    generateMessageResponse,
    ModelClass,
    ServiceType,
    settings,
    State,
    stringToUuid,
    type Client,
    type IAgentRuntime,
    type Plugin,
} from "@elizaos/core";
import bodyParser from "body-parser";
import cors from "cors";
import express from "express";
import { createApiRouter } from "./api.ts";
import { createVerifiableLogApiRouter } from "./verifiable-log-api.ts";
import { aggregatorTemplate, decisionTemplate, queryTemplate } from "./templates.ts";

export class DirectClient {
    public app: express.Application;
    private agents: Map<string, IAgentRuntime>; // container management
    private server: any; // Store server instance
    private verifications: Map<string, any>; // Store for in-progress verifications
    public startAgent: Function; // Store startAgent functor
    public loadCharacterTryPath: Function; // Store loadCharacterTryPath functor
    public jsonToCharacter: Function; // Store jsonToCharacter functor

    constructor() {
        elizaLogger.log("DirectClient constructor");
        this.app = express();
        this.app.use(cors());
        this.agents = new Map();
        this.verifications = new Map(); // Initialize the verifications map

        this.app.use(bodyParser.json());

        const apiRouter = createApiRouter(this.agents, this);
        this.app.use(apiRouter);

        const apiLogRouter = createVerifiableLogApiRouter(this.agents);
        this.app.use(apiLogRouter);

        this.app.post("/:agentId/verify-claim", async (req, res) => {
            const agentId = req.params.agentId;
            const roomId = stringToUuid("default-room");
            const userId = stringToUuid("user");
            const claim = req.body.claim;

            let runtime = this.agents.get(agentId);
            if (!runtime) {
                runtime = Array.from(this.agents.values()).find(
                    (a) => a.character.name.toLowerCase() === agentId.toLowerCase()
                );
            }

            if (!runtime) {
                res.status(404).send("Agent not found");
                return;
            }

            await runtime.ensureConnection(userId, roomId, null, null, "direct");

            const state = await runtime.composeState({
                content: { text: "" },
                userId,
                roomId,
                agentId: runtime.agentId
            }, {
                agentName: runtime.character.name,
                claim,
            })

            const result = await blueRedAggregate(runtime, state);
            const attestation = await generateAttestation(runtime, JSON.stringify(result));
            res.json({ attestation, result });
        })

        this.app.post("/:agentId/verify-claim-frontend", async (req, res) => {
            const agentId = req.params.agentId;
            const roomId = stringToUuid("default-room");
            const userId = stringToUuid("user");
            const claim = req.body.claim;

            let runtime = this.agents.get(agentId);
            if (!runtime) {
                runtime = Array.from(this.agents.values()).find(
                    (a) => a.character.name.toLowerCase() === agentId.toLowerCase()
                );
            }

            if (!runtime) {
                res.status(404).send("Agent not found");
                return;
            }

            await runtime.ensureConnection(userId, roomId, null, null, "direct");

            const state = await runtime.composeState({
                content: { text: "" },
                userId,
                roomId,
                agentId: runtime.agentId
            }, {
                agentName: runtime.character.name,
                claim,
            })

            // Initialize the verification state
            const verificationId = stringToUuid(Date.now().toString());
            this.verifications.set(verificationId, {
                state,
                runtime,
                logs: [],
                completed: false,
                result: null,
                lastUpdated: Date.now()
            });

            // Start the verification process in the background
            this.runVerification(verificationId);

            // Return the verification ID immediately
            res.json({ verificationId });
        });

        this.app.get("/:agentId/verify-claim-frontend-status/:verificationId", (req, res) => {
            const verificationId = req.params.verificationId;
            const verification = this.verifications.get(verificationId);

            if (!verification) {
                res.status(404).send("Verification not found");
                return;
            }

            // Return the current status
            res.json({
                completed: verification.completed,
                logs: verification.logs,
                result: verification.result
            });

            // Clear logs after sending them
            verification.logs = [];
        });
    }

    // agent/src/index.ts:startAgent calls this
    public registerAgent(runtime: IAgentRuntime) {
        // register any plugin endpoints?
        // but once and only once
        this.agents.set(runtime.agentId, runtime);
    }

    public unregisterAgent(runtime: IAgentRuntime) {
        this.agents.delete(runtime.agentId);
    }

    public start(port: number) {
        this.server = this.app.listen(port, () => {
            elizaLogger.success(
                `REST API bound to 0.0.0.0:${port}. If running locally, access it at http://localhost:${port}.`
            );
        });

        // Handle graceful shutdown
        const gracefulShutdown = () => {
            elizaLogger.log("Received shutdown signal, closing server...");
            this.server.close(() => {
                elizaLogger.success("Server closed successfully");
                process.exit(0);
            });

            // Force close after 5 seconds if server hasn't closed
            setTimeout(() => {
                elizaLogger.error(
                    "Could not close connections in time, forcefully shutting down"
                );
                process.exit(1);
            }, 5000);
        };

        // Handle different shutdown signals
        process.on("SIGTERM", gracefulShutdown);
        process.on("SIGINT", gracefulShutdown);
    }

    public async stop() {
        if (this.server) {
            this.server.close(() => {
                elizaLogger.success("Server stopped");
            });
        }
    }

    async runVerification(verificationId) {
        const verification = this.verifications.get(verificationId);
        if (!verification) return;

        const { state, runtime } = verification;

        // Log function that updates the verification state
        const logMessage = (team, message) => {
            elizaLogger.info(message);
            const current = this.verifications.get(verificationId);
            if (current) {
                current.logs.push(`[${team}] ${message}`);
                current.lastUpdated = Date.now();
                this.verifications.set(verificationId, current);
            }
        };

        try {
            const result = await blueRedAggregate(runtime, state, logMessage);
            verification.result = result;
            verification.completed = true;
        } catch (error) {
            verification.logs.push(`[final] Error: ${error.message}`);
            verification.completed = true;
        }

        this.cleanupVerification(verificationId);
    }

    cleanupVerification(verificationId: string) {
        setTimeout(() => {
            this.verifications.delete(verificationId);
        }, 5000)
    }
}

export const DirectClientInterface: Client = {
    name: 'direct',
    config: {},
    start: async (_runtime: IAgentRuntime) => {
        elizaLogger.log("DirectClientInterface start");
        const client = new DirectClient();
        const serverPort = Number.parseInt(settings.SERVER_PORT || "3000");
        client.start(serverPort);
        return client;
    },
    // stop: async (_runtime: IAgentRuntime, client?: Client) => {
    //     if (client instanceof DirectClient) {
    //         client.stop();
    //     }
    // },
};

const directPlugin: Plugin = {
    name: "direct",
    description: "Direct client",
    clients: [DirectClientInterface],
};
export default directPlugin;

async function blueRedAggregate(runtime: IAgentRuntime, state: State, logMessage: LogFunction = defaultLogFunction) {
    const { information: blueTeamInformation, decision: blueTeamDecision } = await doTeam(runtime, state, "blue", undefined, undefined, logMessage);
    const { information: redTeamInformation, decision: redTeamDecision } = await doTeam(runtime, state, "red", blueTeamInformation, blueTeamDecision, logMessage);
    return await aggregateTeams(runtime, state, blueTeamInformation, blueTeamDecision, redTeamInformation, redTeamDecision, logMessage);
}

async function doTeam(runtime: IAgentRuntime, state: State, team: "blue" | "red", prevTeamInformation?: string, prevTeamDecision?: any, logMessage: LogFunction = defaultLogFunction): Promise<{information: string, decision: any}> {
    // Generate queries
    const queryContext = composeContext({
        state,
        template: queryTemplate(team, prevTeamDecision ? (team == "blue" ? "red" : "blue") : null, prevTeamInformation, prevTeamDecision),
    });
    
    const queries = (await generateMessageResponse({
        runtime: runtime,
        context: queryContext,
        modelClass: ModelClass.LARGE,
    }) as any).queries as string[];

    if (!queries) {
        throw new Error("Error: No queries generated");
    }

    logMessage(team, `Generated ${team} team queries: ${queries.join(', ')}`);

    const webSearchService = runtime.getService(ServiceType.WEB_SEARCH) as any;
    const availableProviders = Array.from(webSearchService.providers?.keys() || []);
    logMessage(team, `Available search providers: ${availableProviders.join(', ') || 'none'}`);

    // Get Results using all available providers
    logMessage(team, "Searching for information...");
    const queryResults = await doWebSearch(queries, team, webSearchService, logMessage);
    logMessage(team, `Completed ${team} team query searches`);

    // Reason
    state["queryResults"] = queryResults.map(r => `## Query\n${r.query}\n## Result\n${r.text}\n\n`).join("\n");

    logMessage(team, `Starting ${team} team decision making process`);
    let decisionTries = 0;

    let decision = null;
    while (decisionTries < 5) {
        const decisionContext = composeContext({
            state,
            template: decisionTemplate(team, prevTeamDecision ? (team == "blue" ? "red" : "blue") : null, prevTeamInformation, prevTeamDecision),
        });

        decision = await generateMessageResponse({
            runtime: runtime,
            context: decisionContext,
            modelClass: ModelClass.LARGE,
        });

        if (decision.additional_queries && (decision.additional_queries as string[]).length > 0) {
            logMessage(team, `${team} team decided to make additional queries: ${(decision.additional_queries as string[]).join(', ')}`);
            const additionalQueryResults = await doWebSearch(decision.additional_queries as string[], team, webSearchService, logMessage);
            state["queryResults"] += "\n" + additionalQueryResults.map(r => `## Query\n${r.query}\n## Result\n${r.text}\n\n`).join("\n");
        } else {
            break;
        }
        decisionTries++;
    }

    logMessage(team, `${team} team decision completed`);

    // Update verification with the result
    return { decision, information: state["queryResults"] as string };
}

async function aggregateTeams(runtime: IAgentRuntime, state: State, blueTeamInformation: string, blueTeamDecision: any, redTeamInformation: string, redTeamDecision: any, logMessage: LogFunction = defaultLogFunction) {
    logMessage("final", `Starting final aggregation for claim: "${state.claim}"`);

    const aggregatorContext = composeContext({
        state,
        template: aggregatorTemplate(blueTeamDecision, blueTeamInformation, redTeamDecision, redTeamInformation),
    });

    logMessage("final", "Processing team decisions and evidence...");
    const aggregationResult = await generateMessageResponse({
        runtime: runtime,
        context: aggregatorContext,
        modelClass: ModelClass.LARGE,
    });

    logMessage("final", "Claim verification completed successfully");
    return aggregationResult;
}

async function doWebSearch(queries: string[], team: "blue" | "red", webSearchService: any, logMessage: LogFunction = defaultLogFunction): Promise<{query: string, text: string}[]> {
    let promises = [];
    for (const query of queries) {
        promises.push(new Promise(async (resolve, reject) => {
            try {
                logMessage(team, `Executing ${team} team query: "${query}"`);

                // Use all available providers
                const searchResponse = await webSearchService.search(query, {
                    tavily: {
                        includeAnswer: true,  
                    }
                });

                logMessage(team, `Search completed for "${query}" using provider(s): ${
                    searchResponse.usedProviders && searchResponse.usedProviders.length > 0
                        ? searchResponse.usedProviders.join(', ')
                        : searchResponse.provider
                }`);

                elizaLogger.debug(`Search response details: provider=${searchResponse.provider}, usedProviders=${JSON.stringify(searchResponse.usedProviders || [])}`);

                if (searchResponse) {
                    // Handle combined results from multiple providers
                    if (searchResponse.provider === "all" && searchResponse.combinedResults) {
                        const providerNames = searchResponse.usedProviders.join(', ');
                        logMessage(team, `Got results from providers (${providerNames}) for "${query}"`);

                        resolve({
                            query,
                            text: (searchResponse.tavily?.answer ? `##### Result from tavily #####\n${searchResponse.tavily.answer}\n` : "") +
                                searchResponse.combinedResults.map(r =>
                                    `##### Result from ${r.source} | Title: ${r.title} #####\n${r.content?.substring(0, 500)}...`
                                ).join("\n"),
                        });
                    }
                    // Handle single provider results
                    else if (searchResponse.results?.length) {
                        logMessage(team, `Got results from ${searchResponse.provider} for "${query}" (${searchResponse.results.length} results)`);

                        resolve({
                            query,
                            text: (searchResponse.answer ? `##### Results #####\n${searchResponse.answer}\n\n` : "") +
                                searchResponse.results.map(r =>
                                    `${r.title}: ${r.content?.substring(0, 500) || r.text?.substring(0, 500)}...`
                                ).join("\n\n"),
                        });
                    }
                    else {
                        logMessage(team, `No relevant results found for "${query}"`);

                        resolve({
                            query,
                            text: "NO RESULTS FOUND",
                        });
                    }
                } else {
                    logMessage(team, `Search failed or returned no data for "${query}"`);

                    resolve({
                        query,
                        text: "NO RESULTS FOUND"
                    });
                }
            } catch (error) {
                logMessage(team, `Error during search for "${query}": ${error.message}`);

                resolve({
                    query,
                    text: "ERROR DURING SEARCH"
                });
            }
        }));
    }
    return await Promise.all(promises);
}

async function generateAttestation(runtime: IAgentRuntime, info: string) {
    const remoteAttestationProvider = runtime.getService("TEE" as ServiceType) as any;
    const attestation = await (remoteAttestationProvider as any).generateAttestation(info);
    return attestation;
}


type LogFunction = (team: "blue" | "red" | "final", message: string) => void;
function defaultLogFunction(team: "blue" | "red" | "final", message: string) {
    elizaLogger.info(message);
}
