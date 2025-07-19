<?php
/**
 * ivy-frontend/includes/game.php
 *
 * Reusable component for displaying a game card
 */

require_once __DIR__ . "/fmt.php";

/**
 * Render the game card
 *
 * @param array $game The game data to render
 * @return void Outputs HTML directly
 */
function game_render($game)
{
    // Extract and sanitize game data
    $game_address = htmlspecialchars($game["address"] ?? "");
    $game_name = htmlspecialchars($game["name"] ?? "Untitled Game");
    $game_symbol = htmlspecialchars(strtoupper($game["symbol"] ?? "???"));
    $image_url = !empty($game["cover_url"])
        ? htmlspecialchars($game["cover_url"])
        : "/assets/images/placeholder.png";

    $market_cap_usd = 0;
    if (isset($game["ivy_balance"]) && is_numeric($game["ivy_balance"])) {
        $market_cap_usd = $game["mkt_cap_usd"];
    }

    $create_timestamp =
        isset($game["create_timestamp"]) &&
        is_numeric($game["create_timestamp"])
            ? (int) $game["create_timestamp"]
            : 0;

    // Skip rendering if no address
    if (empty($game_address)) {
        return;
    }
    ?>
    <a href="/game?address=<?php echo $game_address; ?>" class="border-2 border-emerald-400 overflow-hidden group h-full flex flex-col hover:bg-emerald-950/50 transition-colors">
        <div class="relative">
            <img src="<?php echo $image_url; ?>" alt="<?php echo $game_name; ?>" class="w-full aspect-[3/2] object-cover bg-zinc-800">
        </div>
        <div class="p-3 flex flex-col flex-grow">
            <div class="flex items-center justify-between mb-1">
                <h3 class="text-base font-bold truncate" title="<?php echo $game_name; ?>"><?php echo $game_name; ?></h3>
                <span class="text-xs text-emerald-400 font-bold ml-1 flex-shrink-0"><?php echo $game_symbol; ?></span>
            </div>
            <div class="flex items-center justify-between text-zinc-300 text-xs">
                <div>$<?php echo is_numeric($market_cap_usd)
                    ? fmt_number_short($market_cap_usd)
                    : "N/A"; ?> market cap</div>
                <div class="flex items-center gap-1">
                    <?php echo icon("clock", "h-3 w-3"); ?>
                    <?php echo fmt_timestamp($create_timestamp); ?>
                </div>
            </div>
            <div class="flex-grow"></div> <!-- Pushes content above bottom -->
        </div>
    </a>
    <?php
}
?>
