# ivy-frontend

A frontend for Ivy, written in PHP with some React widgets. Relies on `ivy-backend` and `ivy-aggregator`.

## API

This repository provides a frontend API for Ivy, written in PHP and with support from an SQL backend to provide transaction idempotency. The endpoints are listed here:

### Proxied to Aggregator (/api/games, /api/ivy)

- `GET /api/games` - (AGG) List games with optional filtering and pagination
    - `limit`: Maximum number of games to return (default: 20)
    - `offset`: Number of games to skip (default: 0)
    - `sort`: Sort order - "recent", "top", or "hot" (default: "recent")
    - `q`: Optional search query for game names
- `GET /api/games/count` - (AGG) Get total number of games
- `GET /api/games/{address}` - (AGG) Returns basic game information
- `GET /api/games/{address}/items` - (AGG) Returns all items of a game
    - `limit`: Maximum number of items to return (default: 20)
    - `offset`: Number of items to skip (default: 0)
    - `q`: Optional search query for item names
- `GET /api/games/{address}/achievements` - (AGG) Returns all achievements of a game
    - `limit`: Maximum number of achievements to return (default: 20)
    - `offset`: Number of achievements to skip (default: 0)
    - `q`: Optional search query for achievement names
- `GET /api/games/{address}/deposits/{id_hex}` - (AGG) Returns the status of a deposit
- `GET /api/games/{address}/swap/estimate` - (AGG) Estimates output amount for game token swap
    - `input_amount`: Amount of input tokens as u64
    - `is_buy`: Boolean indicating if this is a buy (true) or sell (false)
- `GET /api/games/{address}/charts/{kind}` - (AGG) Get chart data for a specific game
    - `limit`: Maximum number of candles to return (default: 100)
    - `offset`: Number of candles to skip (default: 0)
- `GET /api/ivy/price` - (AGG) Get current ivy token price
- `GET /api/ivy/swap/estimate` - (AGG) Estimates output amount for IVY token swap
    - `input_amount`: Amount of input tokens as u64
    - `is_buy`: Boolean indicating if this is a buy (true) or sell (false)
- `GET /api/ivy/charts/{kind}` - (AGG) Get chart data for IVY token
    - `limit`: Maximum number of candles to return (default: 100)
    - `offset`: Number of candles to skip (default: 0)

### Native endpoints

- `GET /api/profiles/{user}` - Get all the game profiles of a user from the blockchain (for each game: what's their balance, what items do they have, what achievements do they have). This calls the backend API but then calls the aggregator API to fill in game, item, achievement metadata
- `GET /api/profiles/{user}/game/{game}` - Same as above, but filtered to a specific game :)
- `POST /api/item/issue` - `{ item, game, user, amount, item_authority_key, id }` - Issues an item to the given user in an idempotent transaction with key `id`.
- `POST /api/item/disable-issuance` - `{ item, game, item_authority_key, id }` - Disables issuance of an item, permanently preventing it from being minted, in an idempotent transaction with key `id`.
- `POST /api/achievement/grant` - `{ achievement, game, user, achievement_authority_key, id }` - Grants an achievement to the given user in an idempotent transaction with key `id`.
- `POST /api/achievement/disable-granting` - `{ achievement, game, achievement_authority_key, id }` - Disables granting of an achievement, permanently preventing it from being awarded, in an idempotent transaction with key `id`.
- `POST /api/debit` - `{ game, amount, user, treasury_authority_key, id }` - Debits game tokens to `user`, in an idempotent transaction with key `id`.
