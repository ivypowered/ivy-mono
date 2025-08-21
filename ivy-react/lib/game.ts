// Game object from `ivy-aggregator`;
// properties that we don't use are commented out
export interface GameObject {
    name: string;
    symbol: string;
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
    last_price_usd: number;
    mkt_cap_usd: number;
    change_pct_24h: number;
}
