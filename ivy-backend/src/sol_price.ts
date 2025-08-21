import { HermesClient } from "@pythnetwork/hermes-client";

const SOL_PYTH_ID =
    "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";
// Rate-limit: 30 requests per 10 seconds, very generous!
const HERMES = new HermesClient("https://hermes.pyth.network", {});

export class SolPrice {
    // Get the latest price of SOL, in USD.
    static async get(): Promise<number> {
        const priceUpdates = await HERMES.getLatestPriceUpdates([SOL_PYTH_ID]);
        if (!priceUpdates.parsed || !priceUpdates.parsed.length) {
            throw new Error(
                "parsed price updates not in returned data from Pyth",
            );
        }
        const priceRaw = priceUpdates.parsed[0].price.price;
        const price = parseInt(priceRaw) / 100_000_000;
        return price;
    }
}

SolPrice.get();
