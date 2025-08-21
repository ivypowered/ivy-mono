import { PublicKey } from "@solana/web3.js";
import { SwapToken } from "../swap/swapTypes";
import Decimal from "decimal.js-light";
import { Api } from "@/lib/api";

export async function fetchBalance(
    user: PublicKey,
    token: SwapToken,
): Promise<Decimal> {
    const b = await Api.getTokenBalance(user, new PublicKey(token.mint));
    return new Decimal(b).div(new Decimal(10).pow(token.decimals));
}

export function fromRaw(s: string): Decimal {
    return new Decimal(s).div(new Decimal(1_000_000_000));
}
