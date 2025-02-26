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

// Base interface for search providers
export interface ISearchProvider {
    name: string;
    isAvailable(): boolean;
    search(query: string, options?: any): Promise<any>;
}

// Rate limiter for API calls
class RateLimiter {
    private queue: Array<{
        resolve: (value: any) => void;
        reject: (reason?: any) => void;
        fn: () => Promise<any>;
    }> = [];
    private processing = false;
    private lastRequestTime = 0;
    private readonly minTimeBetweenRequests: number;

    constructor(requestsPerSecond: number = 5) {
        this.minTimeBetweenRequests = 1000 / requestsPerSecond;
    }

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

// Tavily search provider implementation
export class TavilyProvider implements ISearchProvider {
    name = SearchProvider.TAVILY;
    private client: TavilyClient;

    constructor(apiKey: string) {
        if (!apiKey) {
            elizaLogger.warn("TAVILY_API_KEY is not set, Tavily search will not be available");
            return;
        }
        this.client = tavily({ apiKey });
        elizaLogger.info("Initialized Tavily search provider");
    }

    isAvailable(): boolean {
        return !!this.client;
    }

    async search(query: string, options?: any): Promise<any> {
        if (!this.isAvailable()) {
            throw new Error("Tavily client is not initialized. Make sure TAVILY_API_KEY is set.");
        }

        elizaLogger.debug(`Executing Tavily search for: "${query}"`);
        const response = await this.client.search(query, {
            includeAnswer: options?.includeAnswer || true,
            maxResults: options?.limit || 3,
            topic: options?.type || "general",
            searchDepth: options?.searchDepth || "basic",
            includeImages: options?.includeImages || false,
            days: options?.days || 3,
        });
        elizaLogger.debug(`Tavily search completed for: "${query}"`);

        return {
            ...response,
            provider: SearchProvider.TAVILY
        };
    }
}

// Exa search provider implementation
export class ExaProvider implements ISearchProvider {
    name = SearchProvider.EXA;
    private client: ExaClient | null = null;
    private rateLimiter = new RateLimiter(5); // 5 requests per second

    constructor(apiKey: string) {
        if (!apiKey) {
            elizaLogger.warn("EXA_API_KEY is not set, Exa search will not be available");
            return;
        }
        this.client = new Exa(apiKey);
        elizaLogger.info("Initialized Exa search provider");
    }

    isAvailable(): boolean {
        return !!this.client;
    }

    async search(query: string, options?: any): Promise<any> {
        if (!this.isAvailable()) {
            throw new Error("Exa client is not initialized. Make sure EXA_API_KEY is set.");
        }

        try {
            elizaLogger.debug(`Scheduling Exa search for: "${query}" (with rate limiting)`);
            // Use rate limiter for Exa API calls
            const response = await this.rateLimiter.schedule(async () => {
                elizaLogger.debug(`Executing Exa search for: "${query}"`);
                const result = await this.client.searchAndContents(
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
                return result;
            });

            return {
                ...response,
                provider: SearchProvider.EXA
            };
        } catch (error) {
            elizaLogger.error(`Exa search error for "${query}":`, error);
            throw error;
        }
    }
}

export class WebSearchService extends Service {
    private providers: Map<string, ISearchProvider> = new Map();

    async initialize(runtime: IAgentRuntime): Promise<void> {
        // Initialize Tavily provider
        const tavilyApiKey = runtime.getSetting("TAVILY_API_KEY") as string;
        if (tavilyApiKey) {
            const tavilyProvider = new TavilyProvider(tavilyApiKey);
            if (tavilyProvider.isAvailable()) {
                this.providers.set(SearchProvider.TAVILY, tavilyProvider);
            }
        }

        // Initialize Exa provider
        const exaApiKey = runtime.getSetting("EXA_API_KEY") as string;
        if (exaApiKey) {
            const exaProvider = new ExaProvider(exaApiKey);
            if (exaProvider.isAvailable()) {
                this.providers.set(SearchProvider.EXA, exaProvider);
            }
        }

        // For backward compatibility
        this.tavilyClient = this.providers.has(SearchProvider.TAVILY)
            ? (this.providers.get(SearchProvider.TAVILY) as TavilyProvider).client
            : null;

        this.exaClient = this.providers.has(SearchProvider.EXA)
            ? (this.providers.get(SearchProvider.EXA) as ExaProvider).client
            : null;
    }

    getInstance() {
        return WebSearchService.getInstance();
    }

    static get serviceType() {
        return ServiceType.WEB_SEARCH;
    }

    // Method to register a new search provider
    registerProvider(provider: ISearchProvider): void {
        if (provider.isAvailable()) {
            this.providers.set(provider.name, provider);
            elizaLogger.info(`Registered search provider: ${provider.name}`);
        } else {
            elizaLogger.warn(`Failed to register unavailable search provider: ${provider.name}`);
        }
    }

    // For backward compatibility
    public tavilyClient: TavilyClient;
    public exaClient: ExaClient | null = null;

    async search(
        query: string,
        options?: any,
    ): Promise<any> {
        // Determine which search provider to use
        const provider = options?.provider || SearchProvider.BOTH;
        elizaLogger.debug(`Search request with provider: ${provider} for query: "${query}"`);

        try {
            // If a specific provider is requested
            if (provider !== SearchProvider.BOTH) {
                if (this.providers.has(provider)) {
                    return await this.providers.get(provider).search(query, options);
                } else {
                    throw new Error(`Requested search provider '${provider}' is not available`);
                }
            }

            // If BOTH is requested, try all available providers
            const results = {};
            const combinedResults = [];
            let availableProviders = 0;

            for (const [name, providerInstance] of this.providers.entries()) {
                try {
                    const providerResult = await providerInstance.search(query, options);
                    results[name] = providerResult;
                    availableProviders++;

                    // Add to combined results
                    if (providerResult.results) {
                        const formattedResults = providerResult.results.map(result => ({
                            ...result,
                            title: result.title,
                            url: result.url,
                            content: result.text || result.content,
                            score: result.relevance_score || result.score,
                            source: name
                        }));
                        combinedResults.push(...formattedResults);
                    }
                } catch (error) {
                    elizaLogger.error(`Error with provider ${name}:`, error);
                }
            }

            if (availableProviders === 0) {
                throw new Error("No search providers are available");
            }

            // Return combined results
            return {
                ...results,
                provider: SearchProvider.BOTH,
                combinedResults
            };
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

export default WebSearchService;
