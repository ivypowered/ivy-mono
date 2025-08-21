import fs from "fs";
import path from "path";
import { Keypair } from "@solana/web3.js";

export const getOrCreateKeypair = (keypairPath?: string): Keypair => {
    if (keypairPath) {
        const resolvedPath = path.resolve(keypairPath);
        if (!fs.existsSync(resolvedPath)) {
            console.error(`Keypair file not found: ${resolvedPath}`);
            process.exit(1);
        }
        const keypairData = JSON.parse(fs.readFileSync(resolvedPath, "utf-8"));
        const keypair = Keypair.fromSecretKey(new Uint8Array(keypairData));
        console.log(`Using provided keypair: ${keypair.publicKey.toString()}`);
        return keypair;
    } else {
        const keypair = Keypair.generate();
        console.log(`Generated new keypair: ${keypair.publicKey.toString()}`);
        return keypair;
    }
};
