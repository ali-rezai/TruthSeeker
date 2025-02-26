import { tavily } from "@tavily/core";
import { Service, ServiceType, type IAgentRuntime } from "@elizaos/core";
import Exa from "exa-js";
import { elizaLogger } from "@elizaos/core";

export type TavilyClient = ReturnType<typeof tavily>; // declaring manually because original package does not export its types
export type ExaClient = Exa;

export enum SearchProvider {
    TAVILY = "tavily",
    EXA = "exa",
    PERPLEXITY = "perplexity",
    SERPER = "serper",
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

    get client(): TavilyClient {
        return this.client;
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

// Perplexity search provider implementation
export class PerplexityProvider implements ISearchProvider {
    name = SearchProvider.PERPLEXITY;
    private client: any = null;
    private apiKey: string;
    private rateLimiter = new RateLimiter(5); // 5 requests per second

    constructor(apiKey: string) {
        if (!apiKey) {
            elizaLogger.warn("PERPLEXITY_API_KEY is not set, Perplexity search will not be available");
            return;
        }
        this.apiKey = apiKey;
        this.client = true; // Just a flag to indicate the provider is available
        elizaLogger.info("Initialized Perplexity search provider");
    }

    isAvailable(): boolean {
        return !!this.client;
    }

    async search(query: string, options?: any): Promise<any> {
        if (!this.isAvailable()) {
            throw new Error("Perplexity client is not initialized. Make sure PERPLEXITY_API_KEY is set.");
        }

        try {
            elizaLogger.debug(`Scheduling Perplexity search for: "${query}" (with rate limiting)`);
            // Use rate limiter for Perplexity API calls
            const response = await this.rateLimiter.schedule(async () => {
                elizaLogger.debug(`Executing Perplexity search for: "${query}"`);

                const requestOptions = {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: options?.model || "sonar",
                        messages: [
                            {
                                role: "system",
                                content: options?.systemPrompt || "Be precise and concise. Provide factual information with sources."
                            },
                            {
                                role: "user",
                                content: query
                            }
                        ],
                        max_tokens: options?.maxTokens || 500,
                        temperature: options?.temperature || 0.2,
                        top_p: options?.topP || 0.9,
                        return_related_questions: options?.returnRelatedQuestions || false,
                        search_recency_filter: options?.recencyFilter || null,
                        stream: false
                    })
                };

                const fetchResponse = await fetch('https://api.perplexity.ai/chat/completions', requestOptions);
                if (!fetchResponse.ok) {
                    throw new Error(`Perplexity API error: ${fetchResponse.status} ${fetchResponse.statusText}`);
                }

                const result = await fetchResponse.json();
                elizaLogger.debug(`Perplexity search completed for: "${query}"`);
                return result;
            });

            // Format the response to match the expected structure
            const formattedResults = response.citations ? response.citations.map((url, index) => ({
                title: `Result ${index + 1}`,
                url: url,
                content: response.choices[0].message.content,
                score: 1.0 - (index * 0.1), // Simple scoring based on citation order
                source: SearchProvider.PERPLEXITY
            })) : [];

            return {
                results: formattedResults,
                answer: response.choices[0].message.content,
                citations: response.citations || [],
                provider: SearchProvider.PERPLEXITY,
                raw: response
            };
        } catch (error) {
            elizaLogger.error(`Perplexity search error for "${query}":`, error);
            throw error;
        }
    }
}

// Serper.dev search provider implementation
export class SerperProvider implements ISearchProvider {
    name = SearchProvider.SERPER;
    private client: any = null;
    private apiKey: string;
    private rateLimiter = new RateLimiter(5); // 5 requests per second

    constructor(apiKey: string) {
        if (!apiKey) {
            elizaLogger.warn("SERPER_API_KEY is not set, Serper.dev search will not be available");
            return;
        }
        this.apiKey = apiKey;
        this.client = true; // Just a flag to indicate the provider is available
        elizaLogger.info("Initialized Serper.dev search provider");
    }

    isAvailable(): boolean {
        return !!this.client;
    }

    async search(query: string, options?: any): Promise<any> {
        if (!this.isAvailable()) {
            throw new Error("Serper.dev client is not initialized. Make sure SERPER_API_KEY is set.");
        }

        try {
            elizaLogger.debug(`Scheduling Serper.dev search for: "${query}" (with rate limiting)`);
            // Use rate limiter for Serper.dev API calls
            const response = await this.rateLimiter.schedule(async () => {
                elizaLogger.debug(`Executing Serper.dev search for: "${query}"`);

                const myHeaders = new Headers();
                myHeaders.append("X-API-KEY", this.apiKey);
                myHeaders.append("Content-Type", "application/json");

                const requestOptions = {
                    method: "POST",
                    headers: myHeaders,
                    body: JSON.stringify({
                        q: query,
                        gl: options?.gl || "us",
                        hl: options?.hl || "en",
                        autocorrect: options?.autocorrect !== undefined ? options.autocorrect : true,
                        page: options?.page || 1,
                        type: options?.type || "search"
                    })
                };

                const fetchResponse = await fetch("https://google.serper.dev/search", requestOptions);
                if (!fetchResponse.ok) {
                    throw new Error(`Serper.dev API error: ${fetchResponse.status} ${fetchResponse.statusText}`);
                }

                const result = await fetchResponse.json();
                elizaLogger.debug(`Serper.dev search completed for: "${query}"`);
                return result;
            });

            // Format the response to match the expected structure
            const formattedResults = [];

            // Add organic results
            if (response.organic && response.organic.length > 0) {
                response.organic.forEach((item, index) => {
                    formattedResults.push({
                        title: item.title,
                        url: item.link,
                        content: item.snippet,
                        score: 1.0 - (index * 0.05), // Simple scoring based on position
                        source: SearchProvider.SERPER
                    });
                });
            }

            // Add knowledge graph if available
            if (response.knowledgeGraph) {
                formattedResults.push({
                    title: response.knowledgeGraph.title || "Knowledge Graph",
                    url: response.knowledgeGraph.descriptionLink || "",
                    content: response.knowledgeGraph.description || "",
                    score: 1.0, // Give knowledge graph high score
                    source: SearchProvider.SERPER
                });
            }

            // Add people also ask if available
            if (response.peopleAlsoAsk && response.peopleAlsoAsk.length > 0) {
                response.peopleAlsoAsk.forEach((item, index) => {
                    formattedResults.push({
                        title: item.question,
                        url: item.link,
                        content: item.snippet,
                        score: 0.8 - (index * 0.05), // Lower score than organic results
                        source: SearchProvider.SERPER
                    });
                });
            }

            return {
                results: formattedResults,
                provider: SearchProvider.SERPER,
                raw: response
            };
        } catch (error) {
            elizaLogger.error(`Serper.dev search error for "${query}":`, error);
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

        // Initialize Perplexity provider
        const perplexityApiKey = runtime.getSetting("PERPLEXITY_API_KEY") as string;
        if (perplexityApiKey) {
            const perplexityProvider = new PerplexityProvider(perplexityApiKey);
            if (perplexityProvider.isAvailable()) {
                this.providers.set(SearchProvider.PERPLEXITY, perplexityProvider);
            }
        }

        // Initialize Serper.dev provider
        const serperApiKey = runtime.getSetting("SERPER_API_KEY") as string;
        if (serperApiKey) {
            const serperProvider = new SerperProvider(serperApiKey);
            if (serperProvider.isAvailable()) {
                this.providers.set(SearchProvider.SERPER, serperProvider);
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
            const usedProviders = [];

            for (const [name, providerInstance] of this.providers.entries()) {
                try {
                    const providerResult = await providerInstance.search(query, options);
                    results[name] = providerResult;
                    availableProviders++;
                    usedProviders.push(name);

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

            // In the WebSearchService.search method, add debug logging for the usedProviders array
            elizaLogger.debug(`Used providers for "${query}": ${usedProviders.join(', ')}`);

            // Return combined results with list of used providers
            return {
                ...results,
                provider: SearchProvider.BOTH,
                usedProviders: usedProviders,
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

    // Dedicated method for Perplexity search
    async searchPerplexity(
        query: string,
        options?: any,
    ): Promise<any> {
        return this.search(query, { ...options, provider: SearchProvider.PERPLEXITY });
    }

    // Dedicated method for Serper.dev search
    async searchSerper(
        query: string,
        options?: any,
    ): Promise<any> {
        return this.search(query, { ...options, provider: SearchProvider.SERPER });
    }
}

export default WebSearchService;
