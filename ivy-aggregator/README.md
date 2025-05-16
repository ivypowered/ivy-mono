# ivy-aggregator
An aggregator written in Rust for Ivy. Unlike `ivy-backend`, which is stateless, `ivy-aggregator`
implements a function `f(events) = state`. It exposes its own HTTP API, which can be called by the frontend
in order to:

1. Retrieve a list of games, sorted either by a hot algorithm, recency of creation, or market cap;
2. Retrieve a chart for each game, denominated in IVY;
3. Retrieve a chart for the Ivy curve, denominated in USDC;
4. Search for a game by name, prioritized in order of exact matches, prefix matches, and inclusion;
5. Retrieve global statistics: total game market cap in IVY, total game count, 24 hr global volume in IVY;
6. Retrieve basic game metadata via address: name, symbol, game URL, cover URL, metadata URL, market cap;
