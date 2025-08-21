<?php
/**
 * ivy-frontend/public/launch-confirm.php
 * Handles gamecoin launch confirmation and transaction creation.
 */

require_once __DIR__ . "/../includes/api.php";

// Initialize error array
$errors = [];

// Variables that will store the gamecoin data
$game_seed = "";
$game_name = $game_symbol = $game_url = "";
$game_address = $icon_url = $short_desc = $metadata_url = "";
$ivy_purchase = $min_game_received = "";
$transaction_data = [];

// Check if the required GET params are present
$required_params = [
    "seed",
    "name",
    "symbol",
    "game_url",
    "icon_url",
    "short_desc",
    "metadata_url",
    "ivy_purchase",
    "min_game_received",
];

foreach ($required_params as $param) {
    if (!isset($_GET[$param])) {
        $errors[] = "Missing required parameter: $param";
    }
}

// Only proceed if we have all required parameters
if (empty($errors)) {
    // Get parameters from URL
    $game_seed = $_GET["seed"];
    $game_name = $_GET["name"];
    $game_symbol = $_GET["symbol"];
    $game_url = $_GET["game_url"];
    $icon_url = $_GET["icon_url"];
    $short_desc = $_GET["short_desc"];
    $metadata_url = $_GET["metadata_url"];
    $ivy_purchase = $_GET["ivy_purchase"];
    $min_game_received = $_GET["min_game_received"];

    if (empty($errors)) {
        try {
            // Create the gamecoin
            $game_data = [
                "seed" => $game_seed,
                "name" => $game_name,
                "symbol" => $game_symbol,
                "icon_url" => $icon_url,
                "game_url" => $game_url,
                "short_desc" => $short_desc,
                "metadata_url" => $metadata_url,
                "ivy_purchase" => $ivy_purchase,
                "min_game_received" => $min_game_received,
            ];

            $game_response = call_backend(
                "/tx/game/create",
                "POST",
                $game_data,
            );

            if ($game_response === null) {
                throw new Exception("Failed to create gamecoin transaction");
            }

            // Set the gamecoin address and transaction data
            $game_address = $game_response["address"];
            $transaction_data = [
                "tx" => $game_response["tx"],
                "returnUrl" => "/launch-done",
                "returnParams" => [
                    "gameAddress" => $game_response["address"],
                ],
            ];
        } catch (Exception $e) {
            $errors[] = "Transaction creation failed: " . $e->getMessage();
        }
    }
}

$title = "ivy | launch confirmation";
$description = "Confirm the upload of your gamecoin on Ivy";
require_once __DIR__ . "/../includes/header.php";
?>

<main class="py-8">
    <div class="mx-auto max-w-3xl px-6">
        <!-- Confirmation Page -->
        <h1 class="text-3xl font-bold mb-8 text-center">Confirm Launch</h1>

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
                <!-- Gamecoin Details -->
                <div class="p-4 flex flex-col gap-4">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-3">
                            <!-- Gamecoin Icon -->
                            <div class="w-12 h-12 border-2 border-emerald-400 flex items-center justify-center bg-emerald-950">
                                <img src="<?= htmlspecialchars(
                                    $icon_url,
                                ) ?>" alt="Gamecoin icon" class="w-full h-full object-cover">
                            </div>

                            <!-- Gamecoin Name and Symbol -->
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

                    <!-- Initial Purchase -->
                    <?php if (floatval($ivy_purchase) > 0): ?>
                    <div>
                        <div class="text-xs uppercase text-zinc-500 mb-1">Initial Investment</div>
                        <div class="flex items-center gap-3 bg-zinc-800 p-2 border border-zinc-700">
                            <div class="flex-1">
                                <div class="font-bold"><?= htmlspecialchars(
                                    $ivy_purchase,
                                ) ?> IVY</div>
                                <div class="text-sm text-zinc-400">You will receive at least <?= htmlspecialchars(
                                    $min_game_received,
                                ) ?> <?= htmlspecialchars(
     $game_symbol,
 ) ?> tokens</div>
                            </div>
                        </div>
                    </div>
                    <?php endif; ?>

                    <!-- Gamecoin Address -->
                    <div>
                        <div class="text-xs uppercase text-zinc-500 mb-1">Data Address</div>
                        <div class="font-mono text-sm text-zinc-300 bg-zinc-800 p-2 border border-zinc-700 overflow-x-auto">
                            <?= htmlspecialchars($game_address) ?>
                        </div>
                    </div>

                    <!-- Transaction Button -->
                    <button
                        id="tx-button"
                        class="bg-emerald-400 text-emerald-950 px-8 py-3 font-bold text-lg hover:bg-emerald-300 w-full cursor-pointer disabled:cursor-default disabled:opacity-50 disabled:pointer-events-none"
                        data-transaction="<?= base64_encode(
                            json_encode($transaction_data),
                        ) ?>"
                    >
                        Initializing...
                    </button>
                </div>
            </div>
        <?php endif; ?>
    </div>
</main>

<?php require_once __DIR__ . "/../includes/footer.php"; ?>
