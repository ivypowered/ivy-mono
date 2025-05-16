import {
    AddressLookupTableAccount,
    BlockhashWithExpiryBlockHeight,
    Connection,
} from "@solana/web3.js";
import { World } from "ivy-sdk";
import { getReasonablePriorityFee } from "../util";

// Interval constants for cache updates
const UPDATE_INTERVAL_S = 2;
const FEE_UPDATE_INTERVAL_S = 60;

// Retry function to attempt fetching data multiple times
async function retry(fn: () => Promise<void>, n: number) {
    for (let i = 0; i < n; i++) {
        try {
            await fn();
            break;
        } catch (_) {}
    }
}

/// Returns the current Unix timestamp in seconds.
function now() {
    return Math.floor(new Date().getTime() / 1_000);
}

/// Returns the number of seconds elapsed since the given timestamp
function elapsedSince(timestamp: number) {
    return Math.max(0, now() - timestamp);
}

export class Cache {
    private feeCache = 0;
    private blockhashCache: BlockhashWithExpiryBlockHeight = {
        blockhash: "",
        lastValidBlockHeight: 0,
    };
    private slotCache = 0;
    private lastBlockhashUpdated = 0;
    private lastSlotUpdated = 0;
    private lastFeeUpdated = 0;
    private readonly connection: Connection;
    private gameAltCache: AddressLookupTableAccount | undefined = undefined;

    constructor(connection: Connection) {
        this.connection = connection;
    }

    // Fetches or returns cached priority fee
    async getReasonablePriorityFee(): Promise<number> {
        if (this.lastFeeUpdated === 0) {
            // Never fetched before, must return fresh data
            this.feeCache = await getReasonablePriorityFee(this.connection);
            this.lastFeeUpdated = now();
            return this.feeCache;
        }
        if (elapsedSince(this.lastFeeUpdated) < FEE_UPDATE_INTERVAL_S) {
            // Return cached data if it was recently updated
            return this.feeCache;
        }
        // Work with stale data, update in background
        this.lastFeeUpdated = now();
        retry(async () => {
            this.feeCache = await getReasonablePriorityFee(this.connection);
        }, 3);
        return this.feeCache;
    }

    // Fetches or returns cached blockhash
    async getLatestBlockhash(): Promise<BlockhashWithExpiryBlockHeight> {
        if (this.lastBlockhashUpdated === 0) {
            // Never fetched before, must return fresh data
            this.lastBlockhashUpdated = now();
            this.blockhashCache = await this.connection.getLatestBlockhash();
            return this.blockhashCache;
        }
        if (elapsedSince(this.lastBlockhashUpdated) < UPDATE_INTERVAL_S) {
            // Return cached data if it was recently updated
            return this.blockhashCache;
        }
        // Work with stale data, update in background
        this.lastBlockhashUpdated = now();
        retry(async () => {
            this.blockhashCache = await this.connection.getLatestBlockhash();
        }, 3);
        return this.blockhashCache;
    }

    // Fetches or returns cached slot
    async getSlot(): Promise<number> {
        if (this.lastSlotUpdated === 0) {
            // Never fetched before, must return fresh data
            this.lastSlotUpdated = now();
            this.slotCache = await this.connection.getSlot();
            return this.slotCache;
        }
        if (elapsedSince(this.lastSlotUpdated) < UPDATE_INTERVAL_S) {
            // Return cached data if it was recently updated
            return this.slotCache;
        }
        // Work with stale data, update in background
        this.lastSlotUpdated = now();
        retry(async () => {
            this.slotCache = await this.connection.getSlot();
        }, 3);
        return this.slotCache;
    }

    // Fetches or returns cached game alt address lookup table
    async getGameAlt(): Promise<AddressLookupTableAccount> {
        if (this.gameAltCache) return this.gameAltCache;

        // Must return fresh data
        const world = await World.loadState(this.connection);
        const gameAlt = (
            await this.connection.getAddressLookupTable(world.game_alt)
        ).value;
        if (!gameAlt) throw new Error("Can't find game alt");

        this.gameAltCache = gameAlt;
        return gameAlt;
    }
}
