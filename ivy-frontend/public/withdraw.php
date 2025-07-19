<?php
/**
 * ivy-frontend/public/withdraw.php
 *
 * Handles game withdrawal claiming and confirmation
 */

require_once __DIR__ . "/../includes/api.php";

// Process withdrawal logic in an anonymous function
$result = (function () {
    // Validate required parameters
    if (!isset($_GET["id"])) {
        return ["error" => "Missing withdrawal ID"];
    }
    if (!isset($_GET["game"])) {
        return ["error" => "Missing game ID"];
    }
    if (!isset($_GET["user"])) {
        return ["error" => "Missing user address"];
    }
    if (!isset($_GET["signature"])) {
        return ["error" => "Missing signature"];
    }

    // Extract parameters
    $withdraw_id = $_GET["id"];
    $game_public_key = $_GET["game"];
    $user_public_key = $_GET["user"];
    $signature = $_GET["signature"];
    $redirect = $_GET["redirect"] ?? null;
    if ($redirect !== null) {
        if (filter_var($redirect, FILTER_VALIDATE_URL) === false) {
            return ["error" => "Invalid redirect URL provided"];
        }
        if (
            !str_starts_with($redirect, "http://") &&
            !str_starts_with($redirect, "https://")
        ) {
            return ["error" => "Provided redirect URL must be absolute"];
        }
    }

    // Verify game exists
    try {
        $game_data = call_aggregator("/games/{$game_public_key}", "GET");
        if ($game_data === null) {
            return ["error" => "Game does not exist"];
        }
    } catch (Exception $e) {
        return ["error" => "Error verifying game: " . $e->getMessage()];
    }

    // Check if withdrawal already processed
    try {
        $withdraw_info = call_aggregator(
            "/games/{$game_public_key}/withdrawals/{$withdraw_id}",
            "GET"
        );
        if ($withdraw_info !== null) {
            if ($redirect !== null) {
                header("Location: $redirect");
                exit();
            }
            header(
                "Location: /withdraw-complete.php?id=" .
                    urlencode($withdraw_id) .
                    "&game=" .
                    urlencode($game_public_key) .
                    "&signature=" .
                    urlencode($withdraw_info["signature"])
            );
            exit();
        }
    } catch (Exception $e) {
        return [
            "error" => "Error checking withdrawal status: " . $e->getMessage(),
        ];
    }

    // Extract withdrawal amount from ID
    try {
        $id_bytes = hex2bin($withdraw_id);
        if (strlen($id_bytes) !== 32) {
            return ["error" => "Invalid withdrawal ID length"];
        }

        $amount_bytes = substr($id_bytes, 24, 8);
        $amount_unpacked = unpack("P", $amount_bytes);
        $withdraw_amount = $amount_unpacked[1];
    } catch (Exception $e) {
        return ["error" => "Invalid withdrawal ID format: " . $e->getMessage()];
    }

    // Prepare withdrawal transaction
    try {
        $withdraw_data = [
            "game" => $game_public_key,
            "withdraw_id" => $withdraw_id,
            "user" => $user_public_key,
            "signature" => $signature,
            "withdraw_authority" => $game_data["withdraw_authority"],
        ];

        $withdraw_response = call_backend(
            "/tx/game/withdraw-claim",
            "POST",
            $withdraw_data
        );
        if ($withdraw_response === null) {
            throw new Exception(
                "Failed to prepare withdrawal claim transaction"
            );
        }

        $transaction_data = [
            "tx" => $withdraw_response,
            "returnUrl" => "/withdraw-complete",
            "returnParams" => [
                "id" => $withdraw_id,
                "game" => $game_public_key,
            ],
            "onSuccess" => $redirect,
        ];
    } catch (Exception $e) {
        return [
            "error" =>
                "Withdrawal claim preparation failed: " . $e->getMessage(),
        ];
    }

    // Return success data
    return [
        "withdraw_id" => $withdraw_id,
        "game_public_key" => $game_public_key,
        "user_public_key" => $user_public_key,
        "signature" => $signature,
        "withdraw_amount" => $withdraw_amount,
        "transaction_data" => $transaction_data,
        "game_data" => $game_data,
    ];
})();

// Extract results
$error_message = $result["error"] ?? "";
$withdraw_id = $result["withdraw_id"] ?? "";
$game_public_key = $result["game_public_key"] ?? "";
$user_public_key = $result["user_public_key"] ?? "";
$signature = $result["signature"] ?? "";
$withdraw_amount = $result["withdraw_amount"] ?? 0;
$transaction_data = $result["transaction_data"] ?? [];
$game_data = $result["game_data"] ?? null;

// Format withdrawal amount for display
$formatted_withdraw_amount = empty($error_message)
    ? number_format($withdraw_amount / 1000000000, 2)
    : "0.00";

$title = "ivy | withdraw";
$description = "Withdraw tokens from a game on Ivy, where games come to life";
require_once __DIR__ . "/../includes/header.php";
?>

<main class="py-8">
    <div class="mx-auto max-w-3xl px-6">
        <!-- Confirmation Page -->
        <h1 class="text-3xl font-bold mb-8 text-center">Claim Withdraw</h1>

        <?php if (!empty($error_message)): ?>
        <!-- Error Display -->
        <div class="mb-6 p-4 border-2 border-red-400 bg-red-950/20">
            <p class="text-red-400 font-bold"><?= htmlspecialchars(
                $error_message
            ) ?></p>

            <div class="mt-4 text-center">
                <?php if ($error_message == "Missing user address"): ?>
                <p class="text-red-300 mb-3">Claiming withdraws requires a connected wallet address.</p>
                <?php elseif ($error_message == "Missing signature"): ?>
                <p class="text-red-300 mb-3">Signature verification is required to claim this withdraw.</p>
                <?php elseif ($error_message == "Game does not exist"): ?>
                <p class="text-red-300 mb-3">The requested game could not be found.</p>
                <?php elseif (
                    strpos($error_message, "Withdrawal does not exist") !==
                    false
                ): ?>
                <p class="text-red-300 mb-3">This withdrawal is not available or has already been claimed.</p>
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

                <!-- Withdrawal Amount -->
                <div class="mt-2">
                    <div class="text-xs uppercase text-zinc-500 mb-1">Withdrawal Amount</div>
                    <div class="bg-zinc-800 p-3 border border-zinc-700 flex justify-between items-center">
                        <span class="text-xl text-emerald-400 font-bold"><?= $formatted_withdraw_amount ?></span>
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

                <!-- Withdrawal ID -->
                <div>
                    <div class="text-xs uppercase text-zinc-500 mb-1">Withdrawal ID</div>
                    <div class="font-mono text-sm text-zinc-300 bg-zinc-800 p-2 border border-zinc-700 overflow-x-auto">
                        <?= htmlspecialchars($withdraw_id) ?>
                    </div>
                </div>

                <!-- Withdrawal Authority -->
                <div>
                    <div class="text-xs uppercase text-zinc-500 mb-1">Withdrawal Authority</div>
                    <div class="font-mono text-sm text-zinc-300 bg-zinc-800 p-2 border border-zinc-700 overflow-x-auto">
                        <?= htmlspecialchars(
                            $game_data["withdraw_authority"]
                        ) ?>
                    </div>
                </div>

                <!-- User Address -->
                <div>
                    <div class="text-xs uppercase text-zinc-500 mb-1">Recipient Address</div>
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
                    Claim Withdrawal
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
</script>

<?php require_once __DIR__ . "/../includes/footer.php"; ?>
