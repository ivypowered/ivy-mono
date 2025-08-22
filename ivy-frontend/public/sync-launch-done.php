<?php
/**
 * ivy-frontend/public/sync-launch-done.php
 * Handles sync launch completion and result display.
 */

if ($_SERVER["REQUEST_METHOD"] !== "GET") {
    header("Location: sync-launch");
    exit();
}

$status = $_GET["status"] ?? "";
$signature = $_GET["signature"] ?? "";
$wallet = $_GET["wallet"] ?? "";
$error = $_GET["error"] ?? "";
$sync_address = $_GET["syncAddress"] ?? null;
$sync_mint = $_GET["syncMint"] ?? null;

$explorer_link = $signature
    ? "https://solscan.io/tx/" . urlencode($signature)
    : null;
$sync_explorer_link = $sync_address
    ? "https://solscan.io/address/" . urlencode($sync_address)
    : null;
$mint_explorer_link = $sync_mint
    ? "https://solscan.io/token/" . urlencode($sync_mint)
    : null;

$sync_result = "in unknown state";
if ($status === "success") {
    $sync_result = "completed";
} else {
    $sync_result = "failed";
}
$title = "ivy | sync launch $sync_result";
$description = "View the results of your synced game launch on Ivy";
require_once __DIR__ . "/../includes/header.php";
?>

<main class="py-8">
    <div class="mx-auto max-w-3xl px-6">
        <?php if ($status === "success" && $signature): ?>
            <div class="text-center mb-8">
                <div class="inline-flex items-center justify-center w-20 h-20 bg-emerald-400/20 rounded-full mb-4">
                    <?php echo icon(
                        "circle-check",
                        "h-12 w-12 text-emerald-400",
                    ); ?>
                </div>
                <h1 class="text-3xl font-bold mb-2">Sync Launch Successful</h1>
                <p class="text-xl mb-8">Your game has been synced to the Pump.fun token</p>
            </div>

            <div class="border-4 border-emerald-400 p-6 mb-8">
                <h2 class="text-xl font-bold mb-4 flex items-center gap-2">
                    <?php echo icon("link", "h-5 w-5 text-emerald-400"); ?>
                    Transaction Details
                </h2>
                <div class="space-y-3">
                    <div class="flex justify-between border-b border-emerald-400/30 pb-2">
                        <span class="text-emerald-400">Status:</span>
                        <span class="font-bold">Confirmed</span>
                    </div>

                    <div class="flex justify-between border-b border-emerald-400/30 pb-2">
                        <span class="text-emerald-400">Signature:</span>
                        <div class="text-right">
                            <span class="font-mono text-sm truncate max-w-[150px] xs:max-w-[200px] sm:max-w-[350px] block"><?= htmlspecialchars(
                                $signature,
                            ) ?></span>
                            <?php if ($explorer_link): ?>
                            <a href="<?= $explorer_link ?>" target="_blank" class="text-emerald-400 text-xs hover:underline">
                                View on Explorer <?php echo icon(
                                    "external-link",
                                    "h-3 w-3 inline",
                                ); ?>
                            </a>
                            <?php endif; ?>
                        </div>
                    </div>

                    <?php if ($sync_address): ?>
                    <div class="flex justify-between border-b border-emerald-400/30 pb-2">
                        <span class="text-emerald-400">Sync Address:</span>
                        <div class="text-right">
                            <span class="font-mono text-sm truncate max-w-[150px] xs:max-w-[200px] sm:max-w-[350px] block"><?= htmlspecialchars(
                                $sync_address,
                            ) ?></span>
                            <?php if ($sync_explorer_link): ?>
                            <a href="<?= $sync_explorer_link ?>" target="_blank" class="text-emerald-400 text-xs hover:underline">
                                View on Explorer <?php echo icon(
                                    "external-link",
                                    "h-3 w-3 inline",
                                ); ?>
                            </a>
                            <?php endif; ?>
                        </div>
                    </div>
                    <?php endif; ?>

                    <?php if ($sync_mint): ?>
                    <div class="flex justify-between border-b border-emerald-400/30 pb-2">
                        <span class="text-emerald-400">Sync Mint:</span>
                        <div class="text-right">
                            <span class="font-mono text-sm truncate max-w-[150px] xs:max-w-[200px] sm:max-w-[350px] block"><?= htmlspecialchars(
                                $sync_mint,
                            ) ?></span>
                            <?php if ($mint_explorer_link): ?>
                            <a href="<?= $mint_explorer_link ?>" target="_blank" class="text-emerald-400 text-xs hover:underline">
                                View on Explorer <?php echo icon(
                                    "external-link",
                                    "h-3 w-3 inline",
                                ); ?>
                            </a>
                            <?php endif; ?>
                        </div>
                    </div>
                    <?php endif; ?>

                    <div class="flex justify-between border-b border-emerald-400/30 pb-2">
                        <span class="text-emerald-400">Timestamp:</span>
                        <span><?= date("Y-m-d H:i:s") ?></span>
                    </div>
                </div>

                <div class="mt-6 bg-emerald-950/50 p-4 border border-emerald-400/50">
                    <h3 class="font-bold mb-2">What happens next?</h3>
                    <p class="mb-2">Your game is now synced to the Pump.fun token on the Solana blockchain.</p>
                    <ul class="list-disc ml-5 space-y-1 text-sm">
                        <li>Players can use the Pump.fun token directly in your game</li>
                        <li>The game economy is tied to the token's market value</li>
                        <li>Token holders can participate in your game ecosystem</li>
                    </ul>
                </div>
            </div>

            <div class="flex justify-center space-x-4">
                <?php if ($sync_address): ?>
                <a href="/game?address=<?php echo $sync_address; ?>" class="border-2 border-emerald-400 px-6 py-3 font-bold hover:bg-emerald-400/20">View Sync Details</a>
                <?php endif; ?>
                <a href="/" class="bg-emerald-400 text-emerald-950 px-6 py-3 font-bold hover:bg-emerald-300">Go Home</a>
            </div>

        <?php else: ?>
            <div class="text-center mb-8">
                <div class="inline-flex items-center justify-center w-20 h-20 bg-red-400/20 rounded-full mb-4">
                    <?php echo icon("circle-x", "h-12 w-12 text-red-400"); ?>
                </div>
                <h1 class="text-3xl font-bold mb-2">Sync Launch Failed</h1>
                <p class="text-xl mb-8">We couldn't complete your sync launch</p>
            </div>

            <div class="border-4 border-red-400 p-6 mb-8">
                <h2 class="text-xl font-bold mb-4">Error Details</h2>
                <div class="bg-red-950/50 p-4 mb-6 border border-red-400/50">
                    <p class="font-bold text-red-400 mb-1">Error message:</p>
                    <p><?= nl2br(
                        htmlspecialchars(
                            $error ?:
                            "Unknown error occurred during transaction processing",
                        ),
                    ) ?></p>
                </div>

                <div class="bg-neutral-900/50 p-4">
                    <h3 class="font-bold mb-2">What to do next?</h3>
                    <ul class="list-disc ml-5 space-y-1">
                        <li>Verify the Pump.fun token address is correct</li>
                        <li>Ensure your wallet has at least 0.04 SOL for network fees</li>
                        <li>Make sure your wallet is properly connected</li>
                        <li>Check that the token hasn't already been synced</li>
                        <li>Try launching your sync again</li>
                    </ul>
                </div>
            </div>

            <div class="flex justify-center space-x-4">
                <a href="/sync-launch" class="bg-emerald-400 text-emerald-950 px-6 py-3 font-bold hover:bg-emerald-300 transition-colors">Try Again</a>
            </div>
        <?php endif; ?>
    </div>
</main>

<?php require_once __DIR__ . "/../includes/footer.php"; ?>
