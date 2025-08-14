"use client";

import { useEffect, useState } from "react";
import { SwapToken } from "./swapTypes";
import { PublicKey } from "@solana/web3.js";
import { infinitely } from "@/lib/utils";
import { Decimal } from "decimal.js-light";
import { DECIMAL_ZERO } from "@/lib/constants";

export function useBalance(
    user: PublicKey | undefined,
    token: SwapToken,
    refreshKey: number,
    reloadKey: number,
    fetchBalance: (user: PublicKey, token: SwapToken) => Promise<Decimal>,
): [Decimal | undefined, (b: Decimal) => void] {
    const [balance, setBalance] = useState<Decimal | undefined>(undefined);

    // Use loading state only when user/token changes or reload
    // is requested; on regular refreshes, perform refresh
    // transparently :)
    useEffect(() => {
        setBalance(undefined);
    }, [user, token, reloadKey]);

    // Effect that run whenever anything refreshes
    useEffect(() => {
        if (!user) {
            setBalance(DECIMAL_ZERO);
            return;
        }
        let active = true;
        // retry infinitely w/ exp. backoff until inactive
        infinitely(
            /* f */ () => fetchBalance(user, token),
            /* desc */ "fetch " + token.symbol + " balance",
            /* continue_ */ () => active,
        ).then((b) => active && setBalance(b));
        return () => {
            active = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, token, reloadKey, refreshKey]);

    return [balance, setBalance];
}
