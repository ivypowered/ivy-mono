<?php
if ($_SERVER["REQUEST_METHOD"] !== "GET") {
    header("Location: upload");
    exit();
}

$status = $_GET["status"] ?? "";
$signature = $_GET["signature"] ?? "";
$wallet = $_GET["wallet"] ?? "";
$error = $_GET["error"] ?? "";
$game_address = $_GET["gameAddress"] ?? null;

$explorer_link = $signature
    ? "https://solscan.io/tx/" . urlencode($signature)
    : null;
$game_explorer_link = $game_address
    ? "https://solscan.io/address/" . urlencode($game_address)
    : null;

$upload_result = "in unknown state";
if ($status === "success") {
    $upload_result = "completed";
} else {
    $upload_result = "failed";
}
$title = "ivy | upload $upload_result";
$description =
    "View the results of your game upload on Ivy: the gamecoin launchpad";
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
                <h1 class="text-3xl font-bold mb-2">Game Upload Successful</h1>
                <p class="text-xl mb-8">Your game has been registered on Ivy</p>
            </div>

            <div class="border-4 border-emerald-400 p-6 mb-8">
                <h2 class="text-xl font-bold mb-4">Transaction Details</h2>
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

                    <div class="flex justify-between border-b border-emerald-400/30 pb-2">
                        <span class="text-emerald-400">Timestamp:</span>
                        <span><?= date("Y-m-d H:i:s") ?></span>
                    </div>
                </div>

                <div class="mt-6 bg-emerald-950/50 p-4 border border-emerald-400/50">
                    <h3 class="font-bold mb-2">What happens next?</h3>
                    <p>Your game is now registered on the Solana blockchain and will be available on Ivy.</p>
                </div>
            </div>

            <div class="flex justify-center space-x-4">
                <a href="/game?address=<?php echo $game_address; ?>" class="border-2 border-emerald-400 px-6 py-3 font-bold hover:bg-emerald-400/20">Go to Dashboard</a>
            </div>

        <?php else: ?>
            <div class="text-center mb-8">
                <div class="inline-flex items-center justify-center w-20 h-20 bg-red-400/20 rounded-full mb-4">
                    <?php echo icon("circle-x", "h-12 w-12 text-red-400"); ?>
                </div>
                <h1 class="text-3xl font-bold mb-2">Game Upload Failed</h1>
                <p class="text-xl mb-8">We couldn't complete your game upload</p>
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
                        <li>Check your wallet's SOL balance</li>
                        <li>Make sure your wallet is properly connected</li>
                        <li>Try uploading your game again</li>
                    </ul>
                </div>
            </div>

            <div class="flex justify-center space-x-4">
                <a href="upload.php" class="bg-emerald-400 text-emerald-950 px-6 py-3 font-bold hover:bg-emerald-300 transition-colors">Try Again</a>
            </div>
        <?php endif; ?>
    </div>
</main>

<?php require_once __DIR__ . "/../includes/footer.php"; ?>
