import { tavily } from "@tavily/core";
import { Service, ServiceType, type IAgentRuntime } from "@elizaos/core";
import Exa from "exa-js";
import { elizaLogger } from "@elizaos/core";

export type TavilyClient = ReturnType<typeof tavily>; // declaring manually because original package does not export its types
export type ExaClient = Exa;

export enum SearchProvider {
    TAVILY = "tavily",
    EXA = "exa",
    BOTH = "both" // default
}

// Rate limiter for Exa API (5 requests per second)
class ExaRateLimiter {
    private queue: Array<{
        resolve: (value: any) => void;
        reject: (reason?: any) => void;
        fn: () => Promise<any>;
    }> = [];
    private processing = false;
    private lastRequestTime = 0;
    private readonly minTimeBetweenRequests = 200; // 200ms = 5 requests per second

    async schedule<T>(fn: () => Promise<T>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            this.queue.push({ resolve, reject, fn });
            this.processQueue();
        });
    }

    private async processQueue() {
        if (this.processing || this.queue.length === 0) return;

        this.processing = true;

        try {
            const now = Date.now();
            const timeToWait = Math.max(0, this.lastRequestTime + this.minTimeBetweenRequests - now);

            if (timeToWait > 0) {
                await new Promise(resolve => setTimeout(resolve, timeToWait));
            }

            const { resolve, reject, fn } = this.queue.shift();

            this.lastRequestTime = Date.now();

            try {
                const result = await fn();
                resolve(result);
            } catch (error) {
                reject(error);
            }
        } finally {
            this.processing = false;
            if (this.queue.length > 0) {
                this.processQueue();
            }
        }
    }
}

export class TavilyService extends Service {
    public tavilyClient: TavilyClient;
    public exaClient: ExaClient | null = null;
    private exaRateLimiter = new ExaRateLimiter();

    async initialize(_runtime: IAgentRuntime): Promise<void> {
        const tavilyApiKey = _runtime.getSetting("TAVILY_API_KEY") as string;
        if (!tavilyApiKey) {
            throw new Error("TAVILY_API_KEY is not set");
        }
        this.tavilyClient = tavily({ apiKey: tavilyApiKey });

        // Initialize Exa client if API key is available
        const exaApiKey = _runtime.getSetting("EXA_API_KEY") as string;
        if (exaApiKey) {
            elizaLogger.info("Initializing Exa search client");
            this.exaClient = new Exa(exaApiKey);
        } else {
            elizaLogger.warn("EXA_API_KEY is not set, Exa search will not be available");
        }
    }

    getInstance() {
        return TavilyService.getInstance();
    }

    static get serviceType() {
        return ServiceType.WEB_SEARCH;
    }

    async search(
        query: string,
        options?: any,
    ): Promise<any> {
        // Determine which search provider to use
        const provider = options?.provider || SearchProvider.BOTH;
        elizaLogger.debug(`Search request with provider: ${provider} for query: "${query}"`);

        try {
            let tavilyResponse = null;
            let exaResponse = null;

            // Use Tavily if requested
            if (provider === SearchProvider.TAVILY || provider === SearchProvider.BOTH) {
                elizaLogger.debug(`Executing Tavily search for: "${query}"`);
                tavilyResponse = await this.tavilyClient.search(query, {
                    includeAnswer: options?.includeAnswer || true,
                    maxResults: options?.limit || 3,
                    topic: options?.type || "general",
                    searchDepth: options?.searchDepth || "basic",
                    includeImages: options?.includeImages || false,
                    days: options?.days || 3,
                });
                elizaLogger.debug(`Tavily search completed for: "${query}"`);
            }

            // Use Exa if requested and available
            if ((provider === SearchProvider.EXA || provider === SearchProvider.BOTH) && this.exaClient) {
                try {
                    elizaLogger.debug(`Scheduling Exa search for: "${query}" (with rate limiting)`);
                    // Use rate limiter for Exa API calls
                    exaResponse = await this.exaRateLimiter.schedule(async () => {
                        elizaLogger.debug(`Executing Exa search for: "${query}"`);
                        const response = await this.exaClient.searchAndContents(
                            query,
                            {
                                type: options?.exaType || "auto",
                                text: {
                                    maxCharacters: options?.maxCharacters || 1000
                                },
                                numResults: options?.exaLimit || 3
                            }
                        );
                        elizaLogger.debug(`Exa search completed for: "${query}"`);
                        return response;
                    });
                } catch (exaError) {
                    elizaLogger.error(`Exa search error for "${query}":`, exaError);
                    // If only Exa was requested but failed, throw the error
                    if (provider === SearchProvider.EXA) {
                        throw exaError;
                    }
                    // Otherwise continue with just Tavily results
                }
            } else if (provider === SearchProvider.EXA && !this.exaClient) {
                throw new Error("Exa client is not initialized. Make sure EXA_API_KEY is set.");
            }

            // Return results based on what was requested and what succeeded
            if (provider === SearchProvider.BOTH && tavilyResponse && exaResponse) {
                // Combine results if both were requested and succeeded
                elizaLogger.debug(`Returning combined results for: "${query}"`);
                return {
                    tavily: tavilyResponse,
                    exa: exaResponse,
                    provider: SearchProvider.BOTH,
                    // Provide a combined results array for easier consumption
                    combinedResults: [
                        ...(tavilyResponse.results || []).map((result: any) => ({
                            ...result,
                            source: 'tavily'
                        })),
                        ...(exaResponse.results?.map((result: any) => ({
                            title: result.title,
                            url: result.url,
                            content: result.text || result.content,
                            score: result.relevance_score,
                            source: 'exa'
                        })) || [])
                    ]
                };
            } else if (provider === SearchProvider.TAVILY || (provider === SearchProvider.BOTH && !exaResponse)) {
                // Return just Tavily results
                elizaLogger.debug(`Returning Tavily-only results for: "${query}"`);
                return {
                    ...tavilyResponse,
                    provider: SearchProvider.TAVILY
                };
            } else if (provider === SearchProvider.EXA) {
                // Return just Exa results
                elizaLogger.debug(`Returning Exa-only results for: "${query}"`);
                return {
                    ...exaResponse,
                    provider: SearchProvider.EXA
                };
            }

            // Fallback case
            elizaLogger.debug(`Returning fallback results for: "${query}"`);
            return tavilyResponse || exaResponse;
        } catch (error) {
            elizaLogger.error(`Web search error for "${query}":`, error);
            throw error;
        }
    }

    // Dedicated method for Tavily search
    async searchTavily(
        query: string,
        options?: any,
    ): Promise<any> {
        return this.search(query, { ...options, provider: SearchProvider.TAVILY });
    }

    // Dedicated method for Exa search
    async searchExa(
        query: string,
        options?: any,
    ): Promise<any> {
        return this.search(query, { ...options, provider: SearchProvider.EXA });
    }
}

export default TavilyService;
