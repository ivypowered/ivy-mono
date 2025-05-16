<?php
/**
 * ivy-frontend/public/deposit.php
 *
 * Handles game deposit processing and confirmation
 */

require_once __DIR__ . "/../includes/api.php";

// Variables to store deposit data
$deposit_id = "";
$game_public_key = "";
$deposit_amount = 0;
$transaction_data = [];
$game_data = null;
$error_message = "";

// Check if we have all necessary parameters
if (!isset($_GET["id"])) {
    $error_message = "Missing deposit ID";
} elseif (!isset($_GET["game"])) {
    $error_message = "Missing game ID";
} elseif (!isset($_GET["user"])) {
    $error_message = "Missing user address";
} else {
    // Get the deposit ID, game, and user from the request
    $deposit_id = $_GET["id"];
    $game_public_key = $_GET["game"];
    $user_public_key = $_GET["user"];

    // First, verify the game exists
    try {
        $game_data = call_aggregator("/games/{$game_public_key}", "GET");

        if ($game_data === null) {
            $error_message = "Game does not exist";
        } else {
            // Step 1: Check if this deposit has already been processed
            try {
                $deposit_info = call_aggregator(
                    "/games/{$game_public_key}/deposits/{$deposit_id}",
                    "GET"
                );

                // Step 2: If deposit info exists, redirect to completion page
                if ($deposit_info !== null) {
                    header(
                        "Location: /deposit-complete?id=" .
                            urlencode($deposit_id) .
                            "&signature=" .
                            urlencode($deposit_info["signature"]) .
                            "&game=" .
                            urlencode($game_public_key)
                    );
                    exit();
                }
            } catch (Exception $e) {
                // If there's an error checking deposit status, continue and try to create the deposit
            }

            // Step 3: Extract the deposit amount from the ID (last 8 bytes as little endian u64)
            try {
                $id_bytes = hex2bin($deposit_id);
                if (strlen($id_bytes) === 32) {
                    $amount_bytes = substr($id_bytes, 24, 8);
                    $amount_unpacked = unpack("P", $amount_bytes);
                    $deposit_amount = $amount_unpacked[1];
                } else {
                    $error_message = "Invalid deposit ID length";
                }
            } catch (Exception $e) {
                $error_message =
                    "Invalid deposit ID format: " . $e->getMessage();
            }

            // If no errors so far, prepare the transaction
            if (empty($error_message)) {
                try {
                    // Prepare deposit completion transaction
                    $deposit_data = [
                        "game" => $game_public_key,
                        "deposit_id" => $deposit_id,
                        "user" => $user_public_key,
                    ];

                    $deposit_response = call_backend(
                        "/tx/game/deposit-complete",
                        "POST",
                        $deposit_data
                    );

                    if ($deposit_response === null) {
                        throw new Exception(
                            "Failed to prepare deposit transaction"
                        );
                    }

                    // Set transaction data
                    $transaction_data = [
                        "tx" => $deposit_response,
                        "returnUrl" => "/deposit-complete",
                        "returnParams" => [
                            "id" => $deposit_id,
                            "game" => $game_public_key,
                        ],
                    ];
                } catch (Exception $e) {
                    $error_message =
                        "Deposit preparation failed: " . $e->getMessage();
                }
            }
        }
    } catch (Exception $e) {
        $error_message = "Error verifying game: " . $e->getMessage();
    }
}

// Format deposit amount for display (only if we have valid deposit data)
$formatted_deposit_amount = empty($error_message)
    ? number_format($deposit_amount / 1000000000, 2)
    : "0.00";

require_once __DIR__ . "/../includes/header.php";
?>

<main class="py-8">
    <div class="mx-auto max-w-3xl px-6">
        <!-- Confirmation Page -->
        <h1 class="text-3xl font-bold mb-8 text-center">Confirm Deposit</h1>

        <?php if (!empty($error_message)): ?>
        <!-- Error Display -->
        <div class="mb-6 p-4 border-2 border-red-400 bg-red-950/20">
            <p class="text-red-400 font-bold"><?= htmlspecialchars(
                $error_message
            ) ?></p>

            <div class="mt-4 text-center">
                <?php if ($error_message == "Missing user address"): ?>
                <p class="text-red-300 mb-3">Deposit requires a connected wallet address.</p>
                <?php elseif ($error_message == "Game does not exist"): ?>
                <p class="text-red-300 mb-3">The requested game could not be found.</p>
                <?php endif; ?>

                <a href="/" class="inline-flex items-center justify-center border-2 border-emerald-400 text-emerald-400 hover:bg-emerald-400 hover:text-emerald-950 px-6 py-2 font-bold rounded-none">
                    <?php echo icon("home", "h-4 w-4 mr-2"); ?>
                    Return to Homepage
                </a>
            </div>
        </div>
        <?php endif; ?>

        <?php if (empty($error_message)): ?>
        <div class="border-2 border-emerald-400 bg-zinc-900">
            <!-- Game Details -->
            <div class="p-4 flex flex-col gap-4">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <!-- Game Icon -->
                        <div class="w-12 h-12 border-2 border-emerald-400 flex items-center justify-center bg-emerald-950">
                            <?php if (
                                $game_data &&
                                isset($game_data["icon_url"])
                            ): ?>
                            <img
                                src="<?= htmlspecialchars(
                                    $game_data["icon_url"]
                                ) ?>"
                                alt="Game icon"
                                class="w-full h-full object-cover"
                            />
                            <?php elseif (
                                $game_data &&
                                isset($game_data["metadata_url"])
                            ): ?>
                            <img
                                src="/placeholder.svg"
                                alt="Game icon"
                                class="w-full h-full object-cover"
                                data-metadata-url="<?= htmlspecialchars(
                                    $game_data["metadata_url"]
                                ) ?>"
                                id="game-icon"
                            />
                            <?php else: ?>
                            <img
                                src="/placeholder.svg"
                                alt="Game icon"
                                class="w-full h-full object-cover"
                            />
                            <?php endif; ?>
                        </div>

                        <!-- Game Name and Symbol -->
                        <div>
                            <h1 class="text-2xl font-bold text-white">
                                <?= htmlspecialchars($game_data["name"]) ?>
                            </h1>
                            <span class="text-emerald-400 font-bold">
                                <?= isset($game_data["symbol"])
                                    ? htmlspecialchars($game_data["symbol"])
                                    : "???" ?>
                            </span>
                        </div>
                    </div>
                </div>

                <!-- Deposit Amount -->
                <div class="mt-2">
                    <div class="text-xs uppercase text-zinc-500 mb-1">Deposit Amount</div>
                    <div class="bg-zinc-800 p-3 border border-zinc-700 flex justify-between items-center">
                        <span class="text-xl text-emerald-400 font-bold"><?= $formatted_deposit_amount ?></span>
                        <span class="text-emerald-300 font-bold"><?= isset(
                            $game_data["symbol"]
                        )
                            ? $game_data["symbol"]
                            : "tokens" ?></span>
                    </div>
                </div>

                <!-- Game Address -->
                <div>
                    <div class="text-xs uppercase text-zinc-500 mb-1">Game Address</div>
                    <div class="font-mono text-sm text-zinc-300 bg-zinc-800 p-2 border border-zinc-700 overflow-x-auto">
                        <?= htmlspecialchars($game_public_key) ?>
                    </div>
                </div>

                <!-- Deposit ID -->
                <div>
                    <div class="text-xs uppercase text-zinc-500 mb-1">Deposit ID</div>
                    <div class="font-mono text-sm text-zinc-300 bg-zinc-800 p-2 border border-zinc-700 overflow-x-auto">
                        <?= htmlspecialchars($deposit_id) ?>
                    </div>
                </div>

                <!-- User Address -->
                <div>
                    <div class="text-xs uppercase text-zinc-500 mb-1">From Address</div>
                    <div class="font-mono text-sm text-zinc-300 bg-zinc-800 p-2 border border-zinc-700 overflow-x-auto">
                        <?= htmlspecialchars($user_public_key) ?>
                    </div>
                </div>

                <!-- Transaction Button -->
                <?php if (!empty($transaction_data)): ?>
                <button
                    id="tx-button"
                    class="bg-emerald-400 text-emerald-950 px-8 py-3 font-bold text-lg hover:bg-emerald-300 w-full cursor-pointer disabled:cursor-default disabled:opacity-50 disabled:pointer-events-none rounded-none border-2 border-emerald-400 mt-4"
                    data-transaction="<?= base64_encode(
                        json_encode($transaction_data)
                    ) ?>"
                >
                    Confirm Deposit
                </button>
                <?php else: ?>
                <!-- Processing indicator -->
                <button
                    disabled
                    class="bg-emerald-400 text-emerald-950 px-8 py-3 font-bold text-lg w-full cursor-default opacity-50 pointer-events-none rounded-none border-2 border-emerald-400 mt-4"
                >
                    <span class="inline-block animate-pulse">Processing...</span>
                </button>
                <?php endif; ?>
            </div>
        </div>
        <?php endif; ?>
    </div>
</main>

<div id="tx-widget"></div>

<script>
document.addEventListener('DOMContentLoaded', function() {
    // Handle game icon loading from metadata
    const gameIcon = document.getElementById('game-icon');
    if (gameIcon && gameIcon.dataset.metadataUrl) {
        fetch(gameIcon.dataset.metadataUrl)
            .then(response => response.json())
            .then(metadata => {
                if (metadata.image) {
                    gameIcon.src = metadata.image;
                }
            })
            .catch(error => {
                console.error('Error loading game metadata:', error);
            });
    }
});
</script>

<?php require_once __DIR__ . "/../includes/footer.php"; ?>
