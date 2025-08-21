<?php
/**
 * ivy-frontend/public/sync-launch-confirm.php
 * Handles sync launch confirmation and transaction creation.
 */

require_once __DIR__ . "/../includes/api.php";

// Initialize error array
$errors = [];

// Variables that will store the sync data
$sync_seed = "";
$pump_mint = $game_name = $game_symbol = $game_url = "";
$sync_address = $sync_mint = $icon_url = $short_desc = $metadata_url = "";
$transaction_data = [];

// Check if the required GET params are present
$required_params = [
    "seed",
    "pump_mint",
    "name",
    "symbol",
    "game_url",
    "icon_url",
    "short_desc",
    "metadata_url",
];

foreach ($required_params as $param) {
    if (!isset($_GET[$param])) {
        $errors[] = "Missing required parameter: $param";
    }
}

// Only proceed if we have all required parameters
if (empty($errors)) {
    // Get parameters from URL
    $sync_seed = $_GET["seed"];
    $pump_mint = $_GET["pump_mint"];
    $game_name = $_GET["name"];
    $game_symbol = $_GET["symbol"];
    $game_url = $_GET["game_url"];
    $icon_url = $_GET["icon_url"];
    $short_desc = $_GET["short_desc"];
    $metadata_url = $_GET["metadata_url"];

    if (empty($errors)) {
        try {
            // Create the sync
            $sync_data = [
                "pump_mint" => $pump_mint,
                "seed" => $sync_seed,
                "name" => $game_name,
                "symbol" => $game_symbol,
                "icon_url" => $icon_url,
                "game_url" => $game_url,
                "short_desc" => $short_desc,
                "metadata_url" => $metadata_url,
            ];

            $sync_response = call_backend(
                "/tx/sync/create",
                "POST",
                $sync_data,
            );

            if ($sync_response === null) {
                throw new Exception("Failed to create sync transaction");
            }

            // Set the sync address and transaction data
            $sync_address = $sync_response["sync_address"];
            $sync_mint = $sync_response["sync_mint"];
            $transaction_data = [
                "tx" => $sync_response["tx"],
                "returnUrl" => "/sync-launch-done",
                "returnParams" => [
                    "syncAddress" => $sync_response["sync_address"],
                    "syncMint" => $sync_response["sync_mint"],
                ],
            ];
        } catch (Exception $e) {
            $errors[] = "Transaction creation failed: " . $e->getMessage();
        }
    }
}

$title = "ivy | sync launch confirmation";
$description = "Confirm the sync of your game to a Pump.fun token on Ivy";
require_once __DIR__ . "/../includes/header.php";
?>

<main class="py-8">
    <div class="mx-auto max-w-3xl px-6">
        <!-- Confirmation Page -->
        <h1 class="text-3xl font-bold mb-8 text-center">Confirm Sync Launch</h1>

        <?php if (!empty($errors)): ?>
            <div class="border-2 border-red-400 bg-red-950/50 p-4 mb-8">
                <p class="text-red-400 font-bold">The following errors occurred:</p>
                <ul class="list-disc ml-6 mt-2">
                    <?php foreach ($errors as $error): ?>
                        <li class="text-red-400"><?php echo htmlspecialchars(
                            $error,
                        ); ?></li>
                    <?php endforeach; ?>
                </ul>
            </div>
        <?php else: ?>
            <div class="border-2 border-emerald-400 bg-zinc-900">
                <!-- Game Details -->
                <div class="p-4 flex flex-col gap-4">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-3">
                            <!-- Game Icon -->
                            <div class="w-12 h-12 border-2 border-emerald-400 flex items-center justify-center bg-emerald-950">
                                <img src="<?= htmlspecialchars(
                                    $icon_url,
                                ) ?>" alt="Game icon" class="w-full h-full object-cover">
                            </div>

                            <!-- Game Name and Symbol -->
                            <div>
                                <h1 class="text-2xl font-bold text-white"><?= htmlspecialchars(
                                    $game_name,
                                ) ?></h1>
                                <span class="text-emerald-400 font-bold"><?= htmlspecialchars(
                                    $game_symbol,
                                ) ?></span>
                            </div>
                        </div>
                    </div>

                    <!-- Sync Info Banner -->
                    <div class="bg-blue-950/50 border border-blue-400 p-3">
                        <div class="flex items-center gap-2">
                            <?php echo icon("link", "h-4 w-4 text-blue-400"); ?>
                            <span class="text-blue-400 font-bold">Synced Game</span>
                        </div>
                        <p class="text-sm text-blue-300 mt-1">This game will use an existing Pump.fun token as its currency</p>
                    </div>

                    <!-- Pump.fun Token Address -->
                    <div>
                        <div class="text-xs uppercase text-zinc-500 mb-1">Pump.fun Token Address</div>
                        <div class="font-mono text-sm text-zinc-300 bg-zinc-800 p-2 border border-zinc-700 overflow-x-auto">
                            <?= htmlspecialchars($pump_mint) ?>
                        </div>
                    </div>

                    <!-- Short Description -->
                    <div>
                        <div class="text-xs uppercase text-zinc-500 mb-1">Short Description</div>
                        <div class="text-sm text-zinc-300 bg-zinc-800 p-2 border border-zinc-700">
                            <?= htmlspecialchars($short_desc) ?>
                        </div>
                    </div>

                    <!-- Game URL -->
                    <div>
                        <div class="text-xs uppercase text-zinc-500 mb-1">Game URL</div>
                        <div class="font-mono text-sm text-zinc-300 bg-zinc-800 p-2 border border-zinc-700 overflow-x-auto">
                            <a href="<?= htmlspecialchars(
                                $game_url,
                            ) ?>" target="_blank" class="text-emerald-400 hover:underline flex items-center gap-1">
                                <?= htmlspecialchars($game_url) ?>
                                <?php echo icon(
                                    "external-link",
                                    "h-3 w-3 inline-block ml-1",
                                ); ?>
                            </a>
                        </div>
                    </div>

                    <!-- Sync Address -->
                    <div>
                        <div class="text-xs uppercase text-zinc-500 mb-1">Sync Data Address</div>
                        <div class="font-mono text-sm text-zinc-300 bg-zinc-800 p-2 border border-zinc-700 overflow-x-auto">
                            <?= htmlspecialchars($sync_address) ?>
                        </div>
                    </div>

                    <!-- Sync Mint -->
                    <div>
                        <div class="text-xs uppercase text-zinc-500 mb-1">Sync Mint Address</div>
                        <div class="font-mono text-sm text-zinc-300 bg-zinc-800 p-2 border border-zinc-700 overflow-x-auto">
                            <?= htmlspecialchars($sync_mint) ?>
                        </div>
                    </div>

                    <!-- Transaction Button -->
                    <button
                        id="tx-button"
                        class="bg-emerald-400 text-emerald-950 px-8 py-3 font-bold text-lg hover:bg-emerald-300 w-full cursor-pointer disabled:cursor-default disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
                        data-transaction="<?= base64_encode(
                            json_encode($transaction_data),
                        ) ?>"
                    >
                        <?php echo icon("link", "h-5 w-5"); ?>
                        <span>Initializing...</span>
                    </button>
                </div>
            </div>
        <?php endif; ?>
    </div>
</main>

<?php require_once __DIR__ . "/../includes/footer.php"; ?>
