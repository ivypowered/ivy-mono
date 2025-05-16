import { PublicKey } from "@solana/web3.js";

// Interfaces for Jupiter API Responses
export interface JupiterOrderResponse {
    mode: string;
    swapType: string;
    router: string;
    requestId: string;
    inAmount: string;
    outAmount: string;
    otherAmountThreshold: string;
    swapMode: "ExactIn" | "ExactOut";
    slippageBps: number;
    priceImpactPct: string;
    routePlan: RoutePlan[];
    inputMint: string;
    outputMint: string;
    feeMint: string;
    feeBps: number;
    prioritizationFeeLamports: number;
    transaction: string | null;
    gasless: boolean;
    taker: string | null;
    totalTime: number;
}

export interface RoutePlan {
    percent: number;
    swapInfo: SwapInfo;
}

export interface SwapInfo {
    ammKey: string;
    feeAmount: string;
    feeMint: string;
    inAmount: string;
    inputMint: string;
    label: string;
    outAmount: string;
    outputMint: string;
}

export interface JupiterPriceResponse {
    prices: {
        [mintAddress: string]: number;
    };
}

export interface JupiterOrderOptions {
    swapMode?: "ExactIn" | "ExactOut";
    onlyDirectRoutes?: boolean;
    asLegacyTransaction?: boolean;
    maxAccounts?: number;
    minimizeSlippage?: boolean;
    excludeDexes?: string[];
    excludeRouters?: string[];
    broadcastFeeType?: "maxCap" | "normal" | "off";
    priorityFeeLamports?: number | "auto";
    useWsol?: boolean;
    taker?: string;
}

export class Jup {
    private static JUPITER_API_URL = "https://ultra-api.jup.ag";
    private static JUPITER_PRICE_API_URL = "https://fe-api.jup.ag/api/v1";

    static async fetchPrices(mints: PublicKey[]): Promise<number[]> {
        if (!mints || mints.length === 0) {
            return [];
        }

        const mintList = mints.map((mint) => mint.toBase58()).join(",");
        const url = `${this.JUPITER_PRICE_API_URL}/prices?list_address=${mintList}`;

        try {
            const response = await fetch(url, {
                method: "GET",
                headers: {
                    Accept: "application/json",
                },
            });

            if (!response.ok) {
                throw new Error(
                    `Failed to fetch Jupiter prices: ${response.status} ${response.statusText}`,
                );
            }

            const data: JupiterPriceResponse = await response.json();

            // Return prices in the same order as input mints
            return mints.map((mint) => {
                const mintStr = mint.toBase58();
                return data.prices && data.prices[mintStr]
                    ? data.prices[mintStr]
                    : 0;
            });
        } catch (error) {
            console.error("Error fetching Jupiter prices:", error);
            throw error;
        }
    }

    static async fetchOrder(
        inputMint: PublicKey,
        outputMint: PublicKey,
        amount: number | string,
        slippageBps: number,
        options?: JupiterOrderOptions,
    ): Promise<JupiterOrderResponse> {
        const params = new URLSearchParams({
            inputMint: inputMint.toBase58(),
            outputMint: outputMint.toBase58(),
            amount: amount.toString(),
            slippageBps: slippageBps.toString(),
            swapMode: options?.swapMode ?? "ExactIn",
        });

        // Add optional parameters if they are provided
        if (options?.onlyDirectRoutes !== undefined) {
            params.append(
                "onlyDirectRoutes",
                options.onlyDirectRoutes.toString(),
            );
        }

        if (options?.asLegacyTransaction !== undefined) {
            params.append(
                "asLegacyTransaction",
                options.asLegacyTransaction.toString(),
            );
        }

        if (options?.maxAccounts !== undefined) {
            params.append("maxAccounts", options.maxAccounts.toString());
        }

        if (options?.minimizeSlippage !== undefined) {
            params.append(
                "minimizeSlippage",
                options.minimizeSlippage.toString(),
            );
        }

        // Always include excludeDexes and excludeRouters params even if empty
        // This ensures Jupiter won't use their "gasless" (proprietary market maker) system
        const excludeDexes = options?.excludeDexes?.length
            ? options.excludeDexes.join(",")
            : "";
        params.append("excludeDexes", excludeDexes);

        const excludeRouters = options?.excludeRouters?.length
            ? options.excludeRouters.join(",")
            : "";
        params.append("excludeRouters", excludeRouters);

        if (options?.broadcastFeeType !== undefined) {
            params.append("broadcastFeeType", options.broadcastFeeType);
        } else {
            params.append("broadcastFeeType", "maxCap");
        }

        if (options?.priorityFeeLamports !== undefined) {
            params.append(
                "priorityFeeLamports",
                options.priorityFeeLamports.toString(),
            );
        } else {
            params.append("priorityFeeLamports", "1000000");
        }

        if (options?.useWsol !== undefined) {
            params.append("useWsol", options.useWsol.toString());
        } else {
            params.append("useWsol", "false");
        }

        // Add taker (user public key) if provided
        if (options?.taker) {
            params.append("taker", options.taker);
        }

        const url = `${this.JUPITER_API_URL}/order?${params.toString()}`;

        try {
            const response = await fetch(url, {
                method: "GET",
                headers: {
                    Accept: "application/json",
                },
            });

            if (!response.ok) {
                const errorBody = await response.text();
                console.error("Jupiter Order API Error:", errorBody);
                throw new Error(
                    `Failed to fetch Jupiter order: ${response.status} ${response.statusText}`,
                );
            }

            return await response.json();
        } catch (error) {
            console.error("Error fetching Jupiter order:", error);
            throw error;
        }
    }
}
