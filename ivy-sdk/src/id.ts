import { Keypair } from "@solana/web3.js";

/// Functions for deposit/withdrawal IDs
export class Id {
    static generate(amountRaw: string): Uint8Array {
        const id = Keypair.generate().secretKey.slice(0, 32);
        const view = new DataView(id.buffer, id.byteOffset, id.byteLength);
        view.setBigUint64(24, BigInt(amountRaw), true);
        return id;
    }
    static extractRawAmount(id: Uint8Array): string {
        if (!(id instanceof Uint8Array)) {
            throw new Error("Could not extract amount: id is not Uint8Array");
        }
        if (id.length !== 32) {
            throw new Error("Could not extract amount: incorrect id length");
        }
        const view = new DataView(id.buffer, id.byteOffset, id.byteLength);
        return String(view.getBigUint64(24, true));
    }
}
