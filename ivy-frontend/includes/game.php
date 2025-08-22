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

    // Get description and cap at 280 chars
    $description = $game["description"] ?? "";
    if (strlen($description) > 280) {
        $description = substr($description, 0, 277) . "...";
    }
    $description = htmlspecialchars($description);

    $image_url = !empty($game["icon_url"])
        ? htmlspecialchars($game["icon_url"])
        : "/assets/images/placeholder.png";

    $market_cap_usd = $game["mkt_cap_usd"];

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
    <div class="group relative">
        <a href="/game?address=<?php echo $game_address; ?>" class="block">
            <div class="flex h-fit w-full overflow-hidden border-2 p-3 group-hover:border-emerald-400 border-transparent hover:bg-emerald-950/30 max-h-[300px] gap-3">
                <!-- Image on the left -->
                <div class="aspect-square relative min-w-[128px] self-start">
                    <img
                        src="<?php echo $image_url; ?>"
                        alt="<?php echo $game_name; ?>"
                        loading="lazy"
                        width="128"
                        height="128"
                        class="h-32 w-32 object-cover bg-zinc-800"
                    >
                </div>

                <!-- Content on the right -->
                <div class="flex-1 grid h-fit gap-2">
                    <!-- Metadata section (created at and market cap) -->
                    <div class="space-y-1 pb-1">
                        <!-- Created info and timestamp -->
                        <div class="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                            created <?php echo fmt_timestamp(
                                $create_timestamp,
                            ); ?>
                        </div>

                        <!-- Market cap -->
                        <div class="flex gap-1 text-xs text-emerald-400 font-semibold">
                            market cap: $<?php echo is_numeric($market_cap_usd)
                                ? fmt_number_short($market_cap_usd)
                                : "N/A"; ?>
                        </div>
                    </div>

                    <!-- Game name, symbol and description on same line -->
                    <div>
                        <p class="text-sm text-zinc-300">
                            <span class="font-extrabold">
                                <?php echo $game_name; ?>
                                (<?php echo $game_symbol; ?>)<?php if (!empty($description)): ?>:<?php endif; ?>
                            </span>
                            <?php if (!empty($description)): ?>
                                <?php echo $description; ?>
                            <?php endif; ?>
                        </p>
                    </div>
                </div>
            </div>
        </a>
    </div>
    <?php
}
?>
