import { ed25519 } from "@noble/curves/ed25519";
import type { WalletName } from "@solana/wallet-adapter-base";
import {
    BaseSignInMessageSignerWalletAdapter,
    isVersionedTransaction,
    WalletNotConnectedError,
    WalletReadyState,
} from "@solana/wallet-adapter-base";
import { type SolanaSignInOutput } from "@solana/wallet-standard-features";
import type {
    Transaction,
    TransactionVersion,
    VersionedTransaction,
} from "@solana/web3.js";
import { Keypair } from "@solana/web3.js";

export const KeypairWalletName =
    "Keypair Wallet" as WalletName<"Keypair Wallet">;

const STORAGE_KEY = "ivy:keypair-wallet-adapter";

/**
 * This keypair wallet adapter allows you to use a specific keypair as a wallet.
 * The keypair is stored persistently in browser localStorage.
 */
export class KeypairWalletAdapter extends BaseSignInMessageSignerWalletAdapter {
    name = KeypairWalletName;
    url = "https://github.com/anza-xyz/wallet-adapter#usage";
    icon =
        "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzQiIGhlaWdodD0iMzAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0zNCAxMC42djIuN2wtOS41IDE2LjVoLTQuNmw2LTEwLjVhMi4xIDIuMSAwIDEgMCAyLTMuNGw0LjgtOC4zYTQgNCAwIDAgMSAxLjMgM1ptLTQuMyAxOS4xaC0uNmw0LjktOC40djQuMmMwIDIuMy0yIDQuMy00LjMgNC4zWm0yLTI4LjRjLS4zLS44LTEtMS4zLTItMS4zaC0xLjlsLTIuNCA0LjNIMzBsMS43LTNabS0zIDVoLTQuNkwxMC42IDI5LjhoNC43TDI4LjggNi40Wk0xOC43IDBoNC42bC0yLjUgNC4zaC00LjZMMTguNiAwWk0xNSA2LjRoNC42TDYgMjkuOEg0LjJjLS44IDAtMS43LS4zLTIuNC0uOEwxNSA2LjRaTTE0IDBIOS40TDcgNC4zaDQuNkwxNCAwWm0tMy42IDYuNEg1LjdMMCAxNi4ydjhMMTAuMyA2LjRaTTQuMyAwaC40TDAgOC4ydi00QzAgMiAxLjkgMCA0LjMgMFoiIGZpbGw9IiM5OTQ1RkYiLz48L3N2Zz4=";
    supportedTransactionVersions: ReadonlySet<TransactionVersion> = new Set([
        "legacy",
        0,
    ]);

    private _keypair: Keypair | null = null;
    private _connected = false;

    constructor() {
        super();
        this._loadStoredKeypair();
    }

    private _loadStoredKeypair(): void {
        if (typeof window === "undefined" || !window.localStorage) {
            return;
        }
        try {
            const stored = window.localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const secretKey = Uint8Array.from(JSON.parse(stored));
                this._keypair = Keypair.fromSecretKey(secretKey);
            }
        } catch (error) {
            console.error("Failed to load stored keypair:", error);
            // Clear invalid data
            window.localStorage.removeItem(STORAGE_KEY);
        }
    }

    setKeypair(k: Keypair): void {
        this._keypair = k;
        if (typeof window === "undefined" || !window.localStorage) {
            return;
        }
        // Store as JSON array for persistence
        window.localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(Array.from(k.secretKey)),
        );
    }

    get connecting() {
        return false;
    }

    get publicKey() {
        return this._connected && this._keypair
            ? this._keypair.publicKey
            : null;
    }

    get readyState() {
        return WalletReadyState.Loadable;
    }

    async connect(): Promise<void> {
        if (!this._keypair) {
            throw new Error("No keypair available. Call setKeypair() first.");
        }

        this._connected = true;
        this.emit("connect", this._keypair.publicKey);
    }

    async disconnect(): Promise<void> {
        if (typeof window !== "undefined" && window.localStorage) {
            window.localStorage.removeItem(STORAGE_KEY);
        }
        this._keypair = null;
        this._connected = false;
        this.emit("disconnect");
    }

    async signTransaction<T extends Transaction | VersionedTransaction>(
        transaction: T,
    ): Promise<T> {
        if (!this._connected || !this._keypair)
            throw new WalletNotConnectedError();

        if (isVersionedTransaction(transaction)) {
            transaction.sign([this._keypair]);
        } else {
            transaction.partialSign(this._keypair);
        }

        return transaction;
    }

    async signMessage(message: Uint8Array): Promise<Uint8Array> {
        if (!this._connected || !this._keypair)
            throw new WalletNotConnectedError();

        return ed25519.sign(message, this._keypair.secretKey.slice(0, 32));
    }

    async signIn(): Promise<SolanaSignInOutput> {
        throw new Error("signIn not supported by this adapter");
    }
}
