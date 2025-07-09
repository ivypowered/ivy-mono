import { WebMetadata } from "@/import/ivy-sdk";
import { IVY_MINT_B58 } from "./constants";
import { PublicKey } from "@solana/web3.js";

// Game object from `ivy-aggregator`;
// properties that we don't use are commented out
export interface GameObject {
    name: string;
    symbol: string;
    // short_desc: string;
    address: string;
    owner: string;
    swap_alt: string;
    game_url: string;
    // cover_url: string;
    metadata_url: string;
    create_timestamp: number;
    // ivy_balance: string;
    // game_balance: string;
    // starting_ivy_balance: string;
    comment_buf_index: number;
    last_price_usd: number;
    mkt_cap_usd: number;
    change_pct_24h: number;
    metadata_override?: WebMetadata;
    mint_override?: string;
}

export interface IvyInfo {
    create_timestamp: number;
    ivy_price: number;
    ivy_mkt_cap: number;
    ivy_change_24h: number;
}

export function createIvyGame(info: IvyInfo): GameObject {
    if (typeof info !== "object") {
        throw new Error("incorrect IVY info passed: " + info);
    }
    if (typeof info.create_timestamp !== "number") {
        throw new Error("can't find create_timestamp in passed Ivy info");
    }
    if (typeof info.ivy_price !== "number") {
        throw new Error("passed ivy price is not number");
    }
    return {
        name: "Ivy",
        symbol: "IVY",
        address: IVY_MINT_B58,
        owner: PublicKey.default.toBase58(),
        game_url: "",
        metadata_url: "",
        metadata_override: {
            image: "/assets/images/ivy-icon.svg",
        },
        mint_override: IVY_MINT_B58,
        create_timestamp: info.create_timestamp,
        last_price_usd: info.ivy_price,
        mkt_cap_usd: info.ivy_mkt_cap,
        comment_buf_index: 0,
        change_pct_24h: info.ivy_change_24h,
        // random keypair - doesn't matter, we don't use ALT for world swaps
        swap_alt: "584X8XG1MECnf62SCAKqXD8qsmRWs4HMjMte34kg97xq",
    };
}
