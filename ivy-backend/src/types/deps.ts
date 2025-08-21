import { AddressLookupTableAccount, Connection } from "@solana/web3.js";
import { Cache } from "../utils/cache";
import { PriorityFee } from "../priority-fee";

export interface AppCache {
    blockhash: Cache<{ blockhash: string; lastValidBlockHeight: number }>;
    slot: Cache<number>;
    worldAlt: Cache<{ data: Buffer; alt: AddressLookupTableAccount }>;
}

export interface Deps {
    connection: Connection;
    cache: AppCache;
    priorityFeeService: PriorityFee | null;
}
