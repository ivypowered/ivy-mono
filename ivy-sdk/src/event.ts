import { ivy_program, IVY_PROGRAM_ID, zt2str } from "./interface";
import { BN } from "@coral-xyz/anchor";
import { base64, bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import {
    ConfirmedSignatureInfo,
    Connection,
    PublicKey,
    SignaturesForAddressOptions,
    VersionedTransactionResponse,
} from "@solana/web3.js";

/// Anchor's event instruction discriminator
const EVENT_IX_TAG: BigInt = BigInt("0x1d9acb512ea545e4");
/// The maximum # of signatures that can be requested
/// at a time from `getSignaturesForAddress`.
const MAX_SIGNATURES_PER_REQUEST = 1000;

/// An event
export interface Event {
    name: string;
    data: Record<string, any>;
    signature: string;
    timestamp: number;
}

/// Returns signature infos for a program in chronological order.
async function getSignatureInfos(
    connection: Connection,
    program_id: PublicKey,
    after: string | undefined | null,
): Promise<ConfirmedSignatureInfo[]> {
    const limit = MAX_SIGNATURES_PER_REQUEST;
    const opts: SignaturesForAddressOptions = {
        limit,
        until: after || undefined,
    };

    /// Signatures in reverse chronological order
    const sigs_reversed: ConfirmedSignatureInfo[] = [];

    while (true) {
        try {
            const sigs = await connection.getSignaturesForAddress(
                program_id,
                opts,
                "confirmed",
            );

            // Add only valid signatures
            for (const sig of sigs) {
                if (sig.err || !sig.blockTime) {
                    continue;
                }
                sigs_reversed.push(sig);
            }

            // If we got fewer signatures than requested, we've reached the end
            if (sigs.length < limit) {
                break;
            }

            // Set the 'before' option to the last signature for the next batch
            opts.before = sigs[sigs.length - 1].signature;
        } catch (err) {
            throw new Error(`Failed to get signatures: ${err}`);
        }
    }

    return sigs_reversed.reverse();
}

/// Try to decode an Ivy event from the given
/// CPI instruction data, throwing if there is an error
/// in decoding, or returning `null` if the provided
/// data does not represent an Ivy event.
export function decodeEvent(
    data: Buffer,
): { name: string; data: Record<string, any> } | null {
    if (data.length < 16) {
        return null;
    }
    if (data.readBigUInt64LE(0) != EVENT_IX_TAG) {
        // not an event
        return null;
    }
    const evt = ivy_program.coder.events.decode(
        base64.encode(data.subarray(8)),
    );
    if (!evt) {
        throw new Error("failed to decode event: undefined");
    }
    const evt_data = evt.data;
    if (typeof evt_data !== "object") {
        throw new Error("failed to decode event data: not object");
    }
    return {
        name: evt.name,
        data: evt_data,
    };
}

/// Returns program events in chronological order.
export async function getEvents(
    connection: Connection,
    after: string | undefined | null,
    max_concurrent_requests: number,
    use_batch: boolean,
): Promise<Event[]> {
    // Get signature infos for the Ivy program
    const sig_infos = await getSignatureInfos(
        connection,
        IVY_PROGRAM_ID,
        after,
    );

    // Extract just the signatures
    const signatures = sig_infos.map((info) => info.signature);

    // Retrieve transactions, either in batch or individually based on parameters
    let transactions: (VersionedTransactionResponse | null)[] = [];
    // Process in chunks to respect RPS limit
    for (let i = 0; i < signatures.length; i += max_concurrent_requests) {
        const chunk = signatures.slice(i, i + max_concurrent_requests);
        let chunk_txs: (VersionedTransactionResponse | null)[];
        if (use_batch) {
            chunk_txs = await connection.getTransactions(chunk, {
                commitment: "confirmed",
                maxSupportedTransactionVersion: 0,
            });
        } else {
            chunk_txs = await Promise.all(
                chunk.map((tx) =>
                    connection.getTransaction(tx, {
                        commitment: "confirmed",
                        maxSupportedTransactionVersion: 0,
                    }),
                ),
            );
        }
        transactions.push(...chunk_txs);
    }
    for (let i = 0; i < transactions.length; i++) {
        if (!transactions[i]) {
            throw new Error("can't retrieve tx: " + signatures[i]);
        }
    }
    const txs = transactions as VersionedTransactionResponse[];

    const events: Event[] = [];
    for (let i = 0; i < txs.length; i++) {
        // Fetch basic tx information
        const tx = txs[i];
        const signature = signatures[i];
        const timestamp = tx.blockTime;
        if (!timestamp) {
            throw new Error("can't find timestamp for tx " + signature);
        }

        // Find Ivy program key index in the transaction
        const program_key_index =
            tx.transaction.message.staticAccountKeys.findIndex((key) =>
                key.equals(IVY_PROGRAM_ID),
            );
        if (program_key_index === -1) {
            throw new Error(
                "tx doesn't contain Ivy program, but" +
                    " we only retrieved transactions with the Ivy program",
            );
        }

        // Process CPI invocations
        const cpi_invocations = tx.meta?.innerInstructions;
        if (!cpi_invocations) {
            continue;
        }
        for (const cpi of cpi_invocations) {
            for (const ins of cpi.instructions) {
                if (ins.programIdIndex !== program_key_index) {
                    // Not our program
                    continue;
                }

                const data = bs58.decode(ins.data);
                const evt = decodeEvent(data);
                if (!evt) {
                    // Not an event
                    continue;
                }

                for (const key in evt.data) {
                    const val = evt.data[key];
                    if (val instanceof BN) {
                        evt.data[key] = val.toString();
                    }
                    if (val instanceof PublicKey) {
                        evt.data[key] = val.toBase58();
                    }
                    // deserialize arrays as zero-terminated strings
                    // unless they're of length 32, in which case we
                    // treat them as bytes32
                    //
                    // this is hacky and should probably be changed at
                    // some later date :)
                    if (val instanceof Array && val.length !== 32) {
                        evt.data[key] = zt2str(val);
                    }
                }
                events.push({
                    name: evt.name,
                    data: evt.data,
                    signature,
                    timestamp,
                });
            }
        }
    }
    return events;
}
