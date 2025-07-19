import { SwapToken } from "@/components/swap/swapTypes";
import { useState, useEffect } from "react";
import { IVY_MINT_B58 } from "./constants";

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
                let end: SwapToken | null = null;

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
                        name: token.name.trim(),
                        symbol: token.symbol.trim(),
                        icon: token.logoURI.trim(),
                        decimals: token.decimals,
                        mint: token.address,
                    };

                    if (t.symbol === "Fartcoin") {
                        // ew token, put it at the end
                        if (end) {
                            continue;
                        }
                        end = t;
                        tokens.push({
                            name: "Ivy",
                            symbol: "IVY",
                            icon: "/assets/images/ivy-icon.svg",
                            decimals: 9,
                            mint: IVY_MINT_B58,
                        });
                        continue;
                    }

                    // require token to have name, symbol, logo
                    if (!t.name || !t.symbol || !t.icon) {
                        continue;
                    }

                    // filter out sanctum automated
                    if (t.name.includes("(Sanctum Automated)")) {
                        continue;
                    }

                    // filter out non-ascii tokens (probably some meme thing)
                    // and tokens that don't begin with a letter
                    if (!/^[A-Za-z][\x20-\x7E]*$/.test(t.symbol)) {
                        continue;
                    }

                    // Store in map instead of using the set function
                    tokens.push(t);
                }

                if (end) {
                    tokens.push(end);
                }
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
