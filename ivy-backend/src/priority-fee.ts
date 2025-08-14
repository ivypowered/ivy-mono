const PRIORITY_FEE_BETA = 0.7;
const DEFAULT_PRIORITY_FEE = 30_000;
const MAX_PRIORITY_FEE = 999_999;

type PriorityFeeEntry = {
    priorityFee: number;
    lastUpdated: number;
    newestTx: string;
    newestTxUpdated: number;
};

function now(): number {
    return Math.floor(new Date().getTime() / 1000);
}

// Try to get Helius's recommended priority fee for the given transaction.
async function getRecommendedPriorityFee(
    heliusRpcUrl: string,
    txBase64: string,
): Promise<number> {
    const response = await fetch(heliusRpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            jsonrpc: "2.0",
            id: "1",
            method: "getPriorityFeeEstimate",
            params: [
                {
                    transaction: txBase64,
                    options: {
                        priorityLevel: "High",
                        includeVote: true,
                        transactionEncoding: "base64",
                    },
                },
            ],
        }),
    });
    const result = await response.json();
    if (result.error) {
        throw new Error(
            `Fee estimation failed: ${JSON.stringify(result.error)}`,
        );
    }
    const estimate = result.result.priorityFeeEstimate;
    if (typeof estimate !== "number") {
        throw new Error(`Fee estimation failed: got ${JSON.stringify(result)}`);
    }
    return estimate;
}

export class PriorityFee {
    private map: Record<string, PriorityFeeEntry>;
    private heliusRpcUrl: string;
    constructor(heliusRpcUrl: string) {
        this.map = {};
        this.heliusRpcUrl = heliusRpcUrl;
    }
    provide(name: string, txBase64: string) {
        if (!this.map[name]) {
            this.map[name] = {
                priorityFee: DEFAULT_PRIORITY_FEE,
                lastUpdated: 0,
                newestTx: txBase64,
                newestTxUpdated: now(),
            };
            return;
        }
        const entry = this.map[name];
        entry.newestTx = txBase64;
        entry.newestTxUpdated = now();
    }
    getFor(name: string): number {
        const entry: PriorityFeeEntry | undefined = this.map[name];
        if (!entry) {
            return DEFAULT_PRIORITY_FEE;
        }
        return entry.priorityFee;
    }
    async run() {
        while (true) {
            const rightNow = now();
            let minUpdated = Infinity;
            let minEntry: PriorityFeeEntry | null = null;
            for (const insName in this.map) {
                const entry = this.map[insName];
                if (rightNow - entry.newestTxUpdated > 60) {
                    // too old, no chance of updating
                    continue;
                }
                if (entry.lastUpdated >= entry.newestTxUpdated) {
                    // already updated with data from newest tx
                    continue;
                }
                if (entry.lastUpdated < minUpdated) {
                    minUpdated = entry.lastUpdated;
                    minEntry = entry;
                }
            }
            if (minEntry) {
                // Update min entry
                try {
                    const newFee = Math.min(
                        MAX_PRIORITY_FEE,
                        await getRecommendedPriorityFee(
                            this.heliusRpcUrl,
                            minEntry.newestTx,
                        ),
                    );
                    minEntry.priorityFee = Math.floor(
                        PRIORITY_FEE_BETA * minEntry.priorityFee +
                            (1 - PRIORITY_FEE_BETA) * newFee,
                    );
                    minEntry.lastUpdated = now();
                } catch (e) {
                    console.error("can't update minimum entry:", e);
                }
            }
            // wait 2 seconds
            await new Promise((res) => setTimeout(res, 2_000));
        }
    }
}
