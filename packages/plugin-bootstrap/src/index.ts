import type { Plugin } from "@elizaos/core";
import { timeProvider } from "./providers/time.ts";

export * as actions from "./actions";
export * as evaluators from "./evaluators";
export * as providers from "./providers";

export const bootstrapPlugin: Plugin = {
    name: "bootstrap",
    description: "Agent bootstrap with basic actions and evaluators",
    actions: [],
    evaluators: [],
    providers: [timeProvider],
};
export default bootstrapPlugin;
