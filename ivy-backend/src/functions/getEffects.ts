import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import {
    Connection,
    PublicKey,
    VersionedTransactionResponse,
} from "@solana/web3.js";
import {
    decodeEvent,
    Game,
    IVY_MINT_B58,
    IVY_PROGRAM_ID,
    USDC_MINT_B58,
} from "ivy-sdk";

class Reader {
    private b: Buffer;
    private offset: number;
    constructor(b: Buffer) {
        this.b = b;
        this.offset = 0;
    }
    /// Reads the exact bytes specified in `required`
    /// from the input stream, or returns false.
    readEqual(required: Buffer): boolean {
        if (
            !this.b
                .subarray(this.offset, this.offset + required.length)
                .equals(required)
        ) {
            return false;
        }
        this.offset += required.length;
        return true;
    }
    /// Reads a Solana public key from the input stream,
    /// or returns null.
    readPublicKey(): PublicKey | null {
        const a = this.b.subarray(this.offset, this.offset + 32);
        if (a.length !== 32) {
            return null;
        }
        this.offset += 32;
        return new PublicKey(a);
    }
    /// Reads a uint64 as a BigInt from the input stream,
    /// or returns null.
    readUint64LE(): BigInt | null {
        if (this.b.length - this.offset < 8) {
            return null;
        }
        const r = this.b.readBigUint64LE(this.offset);
        this.offset += 8;
        return r;
    }
}

const JUPITER_AGGREGATOR_V6 = new PublicKey(
    "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
);
const JUP_SWAP_EVENT_PFX = Buffer.from(
    "E445A52E51CB9A1D40C6CDE8260871E2",
    "hex",
);

const GET_EFFECTS_INITIAL_DELAY = 250;
const GET_EFFECTS_MAX_DELAY = 1000;

/// Fetches the effects for a transaction with the Ivy program,
/// the Jupiter program, or both.
/// If `lastValidBlockHeight` is provided, will
/// retry until expiry; otherwise, will only try once.
export async function getEffects(
    connection: Connection,
    signature: string,
    inputMint: PublicKey,
    outputMint: PublicKey,
    lastValidBlockHeight?: number,
): Promise<{ inputRaw: string; outputRaw: string }> {
    if (bs58.decode(signature).length !== 64) {
        throw new Error("invalid signature");
    }
    let tx: VersionedTransactionResponse;
    let delay = GET_EFFECTS_INITIAL_DELAY;
    while (true) {
        const [txMaybe, blockHeight] = await Promise.all([
            connection.getTransaction(signature, {
                commitment: "confirmed",
                maxSupportedTransactionVersion: 0,
            }),
            connection.getBlockHeight(),
        ]);
        if (txMaybe !== null && txMaybe.meta?.innerInstructions) {
            tx = txMaybe;
            break;
        }
        if (!lastValidBlockHeight) {
            throw new Error("Transaction not found");
        }
        if (blockHeight > lastValidBlockHeight) {
            throw new Error("Transaction expired (block height exceeded)");
        }
        await new Promise((res) => setTimeout(res, delay));
        delay = Math.min(delay * 1.4, GET_EFFECTS_MAX_DELAY);
    }
    if (tx.meta?.err) {
        throw new Error("Transaction failed: " + tx.meta.err.toString());
    }
    const jupIndex = tx.transaction.message.staticAccountKeys.findIndex((x) => {
        x.equals(JUPITER_AGGREGATOR_V6);
    });
    const ivyIndex = tx.transaction.message.staticAccountKeys.findIndex((x) =>
        x.equals(IVY_PROGRAM_ID),
    );
    const absDelta: Record<string, string> = {};
    const inputMintB58 = inputMint.toBase58();
    const outputMintB58 = outputMint.toBase58();
    let found = false;
    // All event logs are done via self-CPI.
    for (const cpi of tx.meta?.innerInstructions || []) {
        for (const ins of cpi.instructions) {
            const data = bs58.decode(ins.data);
            if (ins.programIdIndex === ivyIndex) {
                const ivyEvt = decodeEvent(data);
                if (!ivyEvt) {
                    // not an Ivy event
                    continue;
                }
                const name = ivyEvt.name;
                if (name == "gameSwapEvent") {
                    // GAME/IVY pool
                    const { game, ivyAmount, gameAmount } = ivyEvt.data;
                    const gameMint = Game.deriveMint(game);
                    absDelta[IVY_MINT_B58] ||= ivyAmount.toString();
                    absDelta[gameMint.toBase58()] ||= gameAmount.toString();
                } else if (name == "worldSwapEvent") {
                    // IVY/USDC pool
                    const { usdcAmount, ivyAmount } = ivyEvt.data;
                    absDelta[IVY_MINT_B58] ||= ivyAmount.toString();
                    absDelta[USDC_MINT_B58] ||= usdcAmount.toString();
                }
                continue;
            }
            if (jupIndex >= 0 && ins.programIdIndex !== jupIndex) {
                // we know the jup index, and the given ins does not have it
                continue;
            }
            // we don't know the jup index. this does not mean that it does not
            // exist: the Jupiter program might be passed to the tx via an ALT,
            // in this case we cannot know its index without fetching ALTs
            // from the blockchain (another RPC request). so, we will just try
            // to deserialize all data as a jupiter swap event
            const r = new Reader(data);
            if (!r.readEqual(JUP_SWAP_EVENT_PFX)) {
                // Not a jupiter swap event
                continue;
            }
            if (!r.readPublicKey()) continue; // amm
            const inputMint = r.readPublicKey();
            if (!inputMint) continue;
            const inputAmountRaw = r.readUint64LE();
            if (!inputAmountRaw) continue;
            const outputMint = r.readPublicKey();
            if (!outputMint) continue;
            const outputAmountRaw = r.readUint64LE();
            if (!outputAmountRaw) continue;
            absDelta[inputMint.toBase58()] ||= inputAmountRaw.toString();
            absDelta[outputMint.toBase58()] ||= outputAmountRaw.toString();
            if (absDelta[inputMintB58] && absDelta[outputMintB58]) {
                found = true;
                break;
            }
        }
        if (found) {
            break;
        }
    }
    const inputRaw = absDelta[inputMintB58];
    const outputRaw = absDelta[outputMintB58];
    if (!inputRaw) {
        throw new Error("getEffects: can't find input amount");
    }
    if (!outputRaw) {
        throw new Error("getEffects: can't find output amount");
    }
    return { inputRaw, outputRaw };
}
