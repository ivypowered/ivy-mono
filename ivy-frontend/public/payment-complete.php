<?php
/**
 * payment-complete.php
 *
 * Payment completion page shown after transaction is processed
 * Requires global $variant variable to be set to either "deposit" or "burn"
 */

if (!isset($variant) || !in_array($variant, ["deposit", "burn"])) {
    throw new Exception(
        "Invalid or missing \$variant. Must be 'deposit' or 'burn'."
    );
}

// Check for the required parameters
if (!isset($_GET["id"]) || !isset($_GET["game"])) {
    header("Location: /");
    exit();
}

require_once __DIR__ . "/../includes/api.php";

// Get parameters from the request
$payment_id = $_GET["id"] ?? "";
$game_public_key = $_GET["game"] ?? "";
$signature = $_GET["signature"] ?? "";
$status = isset($_GET["signature"]) ? "success" : "error";
$error = $_GET["error"] ?? "";

$variant_display = ucfirst($variant);

// Fetch game data for display purposes
$game_data = null;
try {
    if (!empty($game_public_key)) {
        $game_data = call_aggregator("/games/{$game_public_key}", "GET");
    }
} catch (Exception $e) {
    // If game data fetch fails, continue anyway - it's not critical
}

// Get payment details if available
$payment_info = null;
if ($status === "success" && !empty($payment_id) && !empty($game_public_key)) {
    try {
        $payment_info = call_backend(
            "/games/{$game_public_key}/{$variant}s/{$payment_id}",
            "GET"
        );
    } catch (Exception $e) {
        // If payment info fetch fails, continue anyway
    }
}

// Generate explorer link
$explorer_link = $signature
    ? "https://solscan.io/tx/" . urlencode($signature)
    : null;

// Extract the payment amount from the ID (last 8 bytes as little endian u64)
$payment_amount = 0;
try {
    $id_bytes = hex2bin($payment_id);
    if (strlen($id_bytes) === 32) {
        $amount_bytes = substr($id_bytes, 24, 8);
        $amount_unpacked = unpack("P", $amount_bytes);
        $payment_amount = $amount_unpacked[1];
    }
} catch (Exception $e) {
    // Invalid payment ID, continue with zero amount
}

// Format payment amount for display
$formatted_payment_amount = number_format($payment_amount / 1000000000, 2);

// Header
$title = "ivy | $variant";
$description = "The result of your $variant action on Ivy";
require_once __DIR__ . "/../includes/header.php";
?>

<main class="py-8">
    <div class="mx-auto max-w-3xl px-6">
        <?php if ($status === "success" && $signature): ?>
            <div class="text-center mb-8">
                <div class="inline-flex items-center justify-center w-20 h-20 bg-emerald-400/20 rounded-full mb-4">
                    <?php echo icon(
                        "circle-check",
                        "h-12 w-12 text-emerald-400"
                    ); ?>
                </div>
                <h1 class="text-3xl font-bold mb-2"><?= $variant_display ?> Successful</h1>
                <p class="text-xl mb-8">Your <?= $variant ?> has been processed</p>
            </div>

            <div class="border-4 border-emerald-400 p-6 mb-8">
                <!-- Game info if available -->
                <?php if ($game_data): ?>
                <div class="flex items-center gap-3 mb-6 pb-4 border-b border-emerald-400/30">
                    <!-- Game Icon -->
                    <div class="w-12 h-12 border-2 border-emerald-400 flex items-center justify-center bg-emerald-950">
                        <img
                            src="/placeholder.svg"
                            alt="Game icon"
                            class="w-full h-full object-cover"
                            data-metadata-url="<?= htmlspecialchars(
                                $game_data["metadata_url"]
                            ) ?>"
                            id="game-icon"
                        />
                    </div>

                    <!-- Game Name and Symbol -->
                    <div>
                        <h2 class="text-xl font-bold text-white">
                            <?= htmlspecialchars($game_data["name"]) ?>
                        </h2>
                        <span class="text-emerald-400 font-bold">
                            <?= htmlspecialchars($game_data["symbol"]) ?>
                        </span>
                    </div>
                </div>
                <?php endif; ?>

                <h2 class="text-xl font-bold mb-4">Transaction Details</h2>
                <div class="space-y-3">
                    <div class="flex justify-between border-b border-emerald-400/30 pb-2">
                        <span class="text-emerald-400">Status:</span>
                        <span class="font-bold">Confirmed</span>
                    </div>

                    <div class="flex justify-between border-b border-emerald-400/30 pb-2">
                        <span class="text-emerald-400">Amount:</span>
                        <span class="font-bold">
                            <?= $formatted_payment_amount ?>
                            <?= $game_data
                                ? htmlspecialchars($game_data["symbol"])
                                : "" ?>
                        </span>
                    </div>

                    <div class="flex justify-between border-b border-emerald-400/30 pb-2">
                        <span class="text-emerald-400"><?= $variant_display ?> ID:</span>
                        <div class="text-right">
                            <span class="font-mono text-sm truncate max-w-[150px] xs:max-w-[200px] sm:max-w-[350px] block">
                                <?= htmlspecialchars($payment_id) ?>
                            </span>
                        </div>
                    </div>

                    <div class="flex justify-between border-b border-emerald-400/30 pb-2">
                        <span class="text-emerald-400">Signature:</span>
                        <div class="text-right">
                            <span class="font-mono text-sm truncate max-w-[150px] xs:max-w-[200px] sm:max-w-[350px] block">
                                <?= htmlspecialchars($signature) ?>
                            </span>
                            <?php if ($explorer_link): ?>
                            <a href="<?= $explorer_link ?>" target="_blank" class="text-emerald-400 text-xs hover:underline">
                                View on Explorer <?php echo icon(
                                    "external-link",
                                    "h-3 w-3 inline"
                                ); ?>
                            </a>
                            <?php endif; ?>
                        </div>
                    </div>

                    <div class="flex justify-between border-b border-emerald-400/30 pb-2">
                        <span class="text-emerald-400">Timestamp:</span>
                        <span><?= date("Y-m-d H:i:s") ?></span>
                    </div>
                </div>

                <div class="mt-6 bg-emerald-950/50 p-4 border border-emerald-400/50">
                    <h3 class="font-bold mb-2">What happens next?</h3>
                    <p>Your <?= $variant ?> has been confirmed on the Solana blockchain. You can now return to the game and continue playing.</p>
                </div>
            </div>

            <div class="flex justify-center space-x-4">
                <a href="#" onclick="window.close(); return false;" class="border-2 border-emerald-400 px-6 py-3 font-bold hover:bg-emerald-400/20">
                    Close Tab
                </a>
            </div>

        <?php else: ?>
            <div class="text-center mb-8">
                <div class="inline-flex items-center justify-center w-20 h-20 bg-red-400/20 rounded-full mb-4">
                    <?php echo icon("circle-x", "h-12 w-12 text-red-400"); ?>
                </div>
                <h1 class="text-3xl font-bold mb-2"><?= $variant_display ?> Failed</h1>
                <p class="text-xl mb-8">We couldn't complete your <?= $variant ?></p>
            </div>

            <div class="border-4 border-red-400 p-6 mb-8">
                <h2 class="text-xl font-bold mb-4">Error Details</h2>
                <div class="bg-red-950/50 p-4 mb-6 border border-red-400/50">
                    <p class="font-bold text-red-400 mb-1">Error message:</p>
                    <p><?= nl2br(
                        htmlspecialchars(
                            $error ?:
                            "Unknown error occurred during {$variant} processing"
                        )
                    ) ?></p>
                </div>

                <div class="bg-neutral-900/50 p-4">
                    <h3 class="font-bold mb-2">What to do next?</h3>
                    <ul class="list-disc ml-5 space-y-1">
                        <li>Check your wallet's token balance</li>
                        <li>Make sure your wallet is properly connected</li>
                        <li>Try making the <?= $variant ?> again</li>
                    </ul>
                </div>
            </div>

            <div class="flex justify-center space-x-4">
                <a href="/<?= $variant ?>.php?id=<?= urlencode(
    $payment_id
) ?>&game=<?= urlencode(
    $game_public_key
) ?>" class="bg-emerald-400 text-emerald-950 px-6 py-3 font-bold hover:bg-emerald-300 transition-colors">
                    Try Again
                </a>
                <a href="#" onclick="window.close(); return false;" class="border-2 border-emerald-400 px-6 py-3 font-bold hover:bg-emerald-400/20">
                    Close Tab
                </a>
            </div>
        <?php endif; ?>
    </div>
</main>

<script>
document.addEventListener('DOMContentLoaded', function() {
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
