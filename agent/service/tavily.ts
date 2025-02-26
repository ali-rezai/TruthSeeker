import { tavily } from "@tavily/core";
import { Service, ServiceType, type IAgentRuntime } from "@elizaos/core";
import Exa from "exa-js";

export type TavilyClient = ReturnType<typeof tavily>; // declaring manually because original package does not export its types
export type ExaClient = Exa;

export enum SearchProvider {
    TAVILY = "tavily",
    EXA = "exa",
    BOTH = "both" // default
}

export class TavilyService extends Service {
    public tavilyClient: TavilyClient;
    public exaClient: ExaClient | null = null;

    async initialize(_runtime: IAgentRuntime): Promise<void> {
        const tavilyApiKey = _runtime.getSetting("TAVILY_API_KEY") as string;
        if (!tavilyApiKey) {
            throw new Error("TAVILY_API_KEY is not set");
        }
        this.tavilyClient = tavily({ apiKey: tavilyApiKey });

        // Initialize Exa client if API key is available
        const exaApiKey = _runtime.getSetting("EXA_API_KEY") as string;
        if (exaApiKey) {
            this.exaClient = new Exa(exaApiKey);
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

        try {
            let tavilyResponse = null;
            let exaResponse = null;

            // Use Tavily if requested
            if (provider === SearchProvider.TAVILY || provider === SearchProvider.BOTH) {
                tavilyResponse = await this.tavilyClient.search(query, {
                    includeAnswer: options?.includeAnswer || true,
                    maxResults: options?.limit || 3,
                    topic: options?.type || "general",
                    searchDepth: options?.searchDepth || "basic",
                    includeImages: options?.includeImages || false,
                    days: options?.days || 3,
                });
            }

            // Use Exa if requested and available
            if ((provider === SearchProvider.EXA || provider === SearchProvider.BOTH) && this.exaClient) {
                try {
                    exaResponse = await this.exaClient.searchAndContents(
                        query,
                        {
                            type: options?.exaType || "auto",
                            text: {
                                maxCharacters: options?.maxCharacters || 1000
                            },
                            numResults: options?.exaLimit || 3
                        }
                    );
                } catch (exaError) {
                    console.error("Exa search error:", exaError);
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
                return {
                    ...tavilyResponse,
                    provider: SearchProvider.TAVILY
                };
            } else if (provider === SearchProvider.EXA) {
                // Return just Exa results
                return {
                    ...exaResponse,
                    provider: SearchProvider.EXA
                };
            }

            // Fallback case
            return tavilyResponse || exaResponse;
        } catch (error) {
            console.error("Web search error:", error);
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
