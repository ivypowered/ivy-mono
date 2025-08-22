<?php
/**
 * ivy-frontend/public/game.php
 *
 * Displays the game or sync interface for a given asset `address`.
 */

require_once __DIR__ . "/../includes/api.php";

$address = isset($_GET["address"]) ? $_GET["address"] : null;
$error_message = null;
$asset_base64 = null;
$asset_type = null;
$name = "Error";
$symbol = "ERR";

// Validate address
if (!$address) {
    $error_message = "Asset address is required";
} else {
    try {
        // Call the aggregator API to get the asset data
        $response = call_aggregator("/assets/{$address}");

        if ($response === null) {
            $error_message =
                "Could not load asset data. The asset may not exist or the service is temporarily unavailable.";
        } else {
            // Determine asset type from the response
            $asset_type = isset($response["kind"]) ? $response["kind"] : null;
            $asset_data = isset($response["asset"]) ? $response["asset"] : null;

            if (!$asset_type || !$asset_data) {
                $error_message = "Invalid asset response format";
            } else {
                // Extract name and symbol from the asset data
                if (isset($asset_data["name"])) {
                    $name = $asset_data["name"];
                }
                if (isset($asset_data["symbol"])) {
                    $symbol = $asset_data["symbol"];
                }

                // Encode the asset data as base64
                $asset_base64 = base64_encode(json_encode($asset_data));
            }
        }
    } catch (Exception $e) {
        $error_message = "Could not load asset: " . $e->getMessage();
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
        <h1 class="text-red-400 font-bold text-xl mb-4">Asset Not Available</h1>
        <p class="text-white mb-6"><?php echo htmlspecialchars(
            $error_message,
        ); ?></p>
        <a href="/" class="inline-block rounded-none bg-emerald-400 text-emerald-950 hover:bg-emerald-300 font-bold px-6 py-3">
            Return to Home
        </a>
    </div>
<?php else: ?>
    <!-- Asset mount point -->
    <div
        id="<?= $asset_type === "game" ? "ivy-game" : "ivy-sync" ?>"
        data-info="<?php echo htmlspecialchars($asset_base64); ?>"
    >
        <!-- Skeleton -->
        <div id="asset-skeleton">

        </div>
        <style>
            #asset-skeleton {
                height: 1430px;
            }
            @media (min-width: 1024px) {
                #asset-skeleton {
                    height: 895px;
                }
            }
        </style>
    </div>
<?php endif; ?>

<?php require_once __DIR__ . "/../includes/footer.php"; ?>
