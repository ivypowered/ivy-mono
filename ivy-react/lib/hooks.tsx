import { SwapToken } from "@/components/swap/swapTypes";
import { useState, useEffect } from "react";

export function useTokens(): SwapToken[] | undefined {
    const [tokens, setTokens] = useState<SwapToken[] | undefined>(undefined);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    useEffect(() => {
        let isMounted = true;

        const fetchTokens = async () => {
            if (isLoading) return;

            setIsLoading(true);

            try {
                const response = await fetch(
                    "https://tokens.jup.ag/tokens?tags=verified",
                );
                const result = await response.json();

                if (!isMounted) return;

                if (typeof result !== "object" || !(result instanceof Array)) {
                    throw new Error("token req result not array");
                }

                const tokens: SwapToken[] = [];

                for (const item of result) {
                    if (typeof item !== "object" || !item) continue;
                    const token = item as {
                        address?: unknown;
                        name?: unknown;
                        symbol?: unknown;
                        decimals?: unknown;
                        logoURI?: unknown;
                    };

                    if (typeof token.address !== "string") continue;
                    if (typeof token.name !== "string") continue;
                    if (typeof token.symbol !== "string") continue;
                    if (typeof token.decimals !== "number") continue;
                    if (typeof token.logoURI !== "string") continue;

                    const t = {
                        name: token.name,
                        symbol: token.symbol,
                        icon: token.logoURI,
                        decimals: token.decimals,
                        mint: token.address,
                    };

                    // Store in map instead of using the set function
                    tokens.push(t);
                }

                // Sort tokens by symbol
                tokens.sort((a, b) => a.symbol.localeCompare(b.symbol));

                setTokens(tokens);
            } catch (err) {
                if (isMounted) {
                    console.error("can't fetch token list", err);
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        fetchTokens();

        // Cleanup function
        return () => {
            isMounted = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return tokens;
}
