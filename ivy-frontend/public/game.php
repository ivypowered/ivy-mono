<?php
/**
 * ivy-frontend/public/game.php
 *
 * Displays the game interface for a given `address`.
 */

require_once __DIR__ . "/../includes/api.php";

$address = isset($_GET["address"]) ? $_GET["address"] : null;
$error_message = null;
$game_base64 = null;
$name = "Error";
$symbol = "ERR";

// Validate address
if (!$address) {
    $error_message = "Game address is required";
} else {
    try {
        // Call the aggregator API to get the game data
        $game_data = call_aggregator("/games/{$address}");
        if (isset($game_data["name"])) {
            $name = $game_data["name"];
        }
        if (isset($game_data["symbol"])) {
            $symbol = $game_data["symbol"];
        }

        if ($game_data === null) {
            $error_message =
                "Could not load game data. The game may not exist or the service is temporarily unavailable.";
        } else {
            // Encode the game data as base64
            $game_base64 = base64_encode(json_encode($game_data));
        }
    } catch (Exception $e) {
        $error_message = "Could not load game: " . $e->getMessage();
    }
}

// Include the header
$title = "ivy | $name ($symbol)";
$description = "Trade $symbol on Ivy: the gamecoin launchpad";
require_once __DIR__ . "/../includes/header.php";
?>

<?php if ($error_message): ?>
    <!-- Error Message -->
    <div class="border-2 border-red-400 bg-red-950/50 p-8 mb-8 text-center max-w-3xl mx-auto">
        <h1 class="text-red-400 font-bold text-xl mb-4">Game Not Available</h1>
        <p class="text-white mb-6"><?php echo htmlspecialchars(
            $error_message,
        ); ?></p>
        <a href="/" class="inline-block rounded-none bg-emerald-400 text-emerald-950 hover:bg-emerald-300 font-bold px-6 py-3">
            Return to Home
        </a>
    </div>
<?php else: ?>
    <!-- Game mount point with no wrappers -->
    <div id="ivy-game" data-game="<?php echo htmlspecialchars(
        $game_base64,
    ); ?>">
        <!-- Skeleton -->
        <div id="game-skeleton">

        </div>
        <style>
            #game-skeleton {
                height: 1143px;
            }
            @media (min-width: 1024px) {
                #game-skeleton {
                    height: 616px;
                }
            }
        </style>
    </div>
<?php endif; ?>

<?php require_once __DIR__ . "/../includes/footer.php"; ?>
