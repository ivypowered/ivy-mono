import { PublicKey } from "@solana/web3.js";

// Interfaces for Jupiter API Responses
export interface JupiterPriceResponse {
    prices: {
        [mintAddress: string]: number;
    };
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

// Lite API: GET /swap/v1/quote response
export interface JupiterQuoteResponse {
    inputMint: string;
    inAmount: string;
    outputMint: string;
    outAmount: string;
    otherAmountThreshold: string;
    swapMode: "ExactIn" | "ExactOut";
    slippageBps: number;
    priceImpactPct: string;
    routePlan: RoutePlan[];
    contextSlot?: number;
    timeTaken?: number;
    platformFee?: unknown;
}

// Lite API: POST /swap/v1/swap response
export interface JupiterSwapResponse {
    swapTransaction: string;
    lastValidBlockHeight: number;
    prioritizationFeeLamports?: number;
}

export interface JupiterQuoteOptions {
    swapMode?: "ExactIn" | "ExactOut";
    onlyDirectRoutes?: boolean;
    asLegacyTransaction?: boolean;
    maxAccounts?: number;
    dexes?: string[];
    excludeDexes?: string[];
    restrictIntermediateTokens?: boolean; // default true
    dynamicSlippage?: boolean;
}

export interface JupiterBuildSwapOptions {
    wrapAndUnwrapSol?: boolean; // default true by API, we'll default to false to match earlier useWSOL=false behavior
    asLegacyTransaction?: boolean; // must match quote if used
    destinationTokenAccount?: string;
    dynamicComputeUnitLimit?: boolean; // recommended true
    skipUserAccountsRpcCalls?: boolean;
    computeUnitPriceMicroLamports?: number;
    blockhashSlotsToExpiry?: number;
    // prioritizationFeeLamports?: object; // optional (Jup supports object form), omit for now
}

export class Jup {
    // Lite API base
    private static JUPITER_LITE_API_URL = "https://lite-api.jup.ag";
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

    // Lite API: GET /swap/v1/quote
    static async fetchQuote(
        inputMint: PublicKey,
        outputMint: PublicKey,
        amount: number | string,
        slippageBps: number,
        options?: JupiterQuoteOptions,
    ): Promise<JupiterQuoteResponse> {
        const params = new URLSearchParams({
            inputMint: inputMint.toBase58(),
            outputMint: outputMint.toBase58(),
            amount: amount.toString(),
            slippageBps: slippageBps.toString(),
            swapMode: options?.swapMode ?? "ExactIn",
        });

        if (options?.onlyDirectRoutes !== undefined) {
            params.append("onlyDirectRoutes", String(options.onlyDirectRoutes));
        }
        if (options?.asLegacyTransaction !== undefined) {
            params.append(
                "asLegacyTransaction",
                String(options.asLegacyTransaction),
            );
        }
        if (options?.maxAccounts !== undefined) {
            params.append("maxAccounts", String(options.maxAccounts));
        }
        if (options?.restrictIntermediateTokens !== undefined) {
            params.append(
                "restrictIntermediateTokens",
                String(options.restrictIntermediateTokens),
            );
        }
        if (options?.dynamicSlippage !== undefined) {
            params.append("dynamicSlippage", String(options.dynamicSlippage));
        }
        if (options?.dexes?.length) {
            params.append("dexes", options.dexes.join(","));
        }
        if (options?.excludeDexes?.length) {
            params.append("excludeDexes", options.excludeDexes.join(","));
        }

        const url = `${this.JUPITER_LITE_API_URL}/swap/v1/quote?${params.toString()}`;

        try {
            const response = await fetch(url, {
                method: "GET",
                headers: {
                    Accept: "application/json",
                },
            });

            if (!response.ok) {
                const errorBody = await response.text();
                console.error("Jupiter Quote API Error:", errorBody);
                throw new Error(
                    `Failed to fetch Jupiter quote: ${response.status} ${response.statusText}`,
                );
            }

            return (await response.json()) as JupiterQuoteResponse;
        } catch (error) {
            console.error("Error fetching Jupiter quote:", error);
            throw error;
        }
    }

    // Lite API: POST /swap/v1/swap
    static async buildSwap(
        userPublicKey: PublicKey,
        quoteResponse: JupiterQuoteResponse,
        options?: JupiterBuildSwapOptions,
    ): Promise<JupiterSwapResponse> {
        const url = `${this.JUPITER_LITE_API_URL}/swap/v1/swap`;
        const body: Record<string, unknown> = {
            userPublicKey: userPublicKey.toBase58(),
            quoteResponse,
        };
        if (options?.wrapAndUnwrapSol) {
            body.wrapAndUnwrapSol = options.wrapAndUnwrapSol;
        }
        if (options?.asLegacyTransaction) {
            body.asLegacyTransaction = options.asLegacyTransaction;
        }
        if (options?.dynamicComputeUnitLimit) {
            body.dynamicComputeUnitLimit = options.dynamicComputeUnitLimit;
        }
        if (options?.skipUserAccountsRpcCalls) {
            body.skipUserAccountsRpcCalls = options.skipUserAccountsRpcCalls;
        }

        if (options?.destinationTokenAccount) {
            body.destinationTokenAccount = options.destinationTokenAccount;
        }
        if (options?.computeUnitPriceMicroLamports !== undefined) {
            body.computeUnitPriceMicroLamports =
                options.computeUnitPriceMicroLamports;
        }
        if (options?.blockhashSlotsToExpiry !== undefined) {
            body.blockhashSlotsToExpiry = options.blockhashSlotsToExpiry;
        }

        try {
            const resp = await fetch(url, {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
            });

            if (!resp.ok) {
                const errorBody = await resp.text();
                console.error("Jupiter Swap API Error:", errorBody);
                throw new Error(
                    `Failed to build Jupiter swap: ${resp.status} ${resp.statusText}`,
                );
            }

            return (await resp.json()) as JupiterSwapResponse;
        } catch (error) {
            console.error("Error building Jupiter swap:", error);
            throw error;
        }
    }
}
