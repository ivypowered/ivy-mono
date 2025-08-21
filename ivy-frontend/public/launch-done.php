<?php
/**
 * ivy-frontend/public/launch-done.php
 * Handles gamecoin launch completion and result display.
 */

if ($_SERVER["REQUEST_METHOD"] !== "GET") {
    header("Location: /upload");
    exit();
}

$status = isset($_GET["status"]) ? $_GET["status"] : "";
$signature = isset($_GET["signature"]) ? $_GET["signature"] : "";
$wallet = isset($_GET["wallet"]) ? $_GET["wallet"] : "";
$error = isset($_GET["error"]) ? $_GET["error"] : "";
$game_address = isset($_GET["gameAddress"]) ? $_GET["gameAddress"] : null;

$explorer_link = $signature ? "https://solscan.io/tx/" . urlencode($signature) : null;
$game_explorer_link = $game_address ? "https://solscan.io/address/" . urlencode($game_address) : null;

$upload_result = "in unknown state";
if ($status === "success") {
    $upload_result = "completed";
} else {
    $upload_result = "failed";
}
$title = "ivy | launch $upload_result";
$description = "View the results of your gamecoin launch on Ivy";
require_once __DIR__ . "/../includes/header.php";

session_start(); // Start session to set the last launched game
?>

<main class="py-8">
    <div class="mx-auto max-w-3xl px-6">
        <?php if ($status === "success" && $signature): ?>
            <div class="text-center mb-8">
                <div class="inline-flex items-center justify-center w-20 h-20 bg-emerald-400/20 rounded-full mb-4">
                    <?php echo icon("circle-check", "h-12 w-12 text-emerald-400"); ?>
                </div>
                <h1 class="text-3xl font-bold mb-2">Launch Successful</h1>
                <p class="text-xl mb-8">Your gamecoin has been launched on Ivy</p>
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
                            <span class="font-mono text-sm truncate max-w-[150px] xs:max-w-[200px] sm:max-w-[350px] block"><?= htmlspecialchars($signature) ?></span>
                            <?php if ($explorer_link): ?>
                                <a href="<?= $explorer_link ?>" target="_blank" class="text-emerald-400 text-xs hover:underline">
                                    View on Explorer <?php echo icon("external-link", "h-3 w-3 inline"); ?>
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
                    <p>Your gamecoin is now launched on the Solana blockchain and will be available on Ivy.</p>
                </div>
            </div>

            <div class="flex justify-center space-x-4">
                <a href="/game?address=<?php echo htmlspecialchars($game_address); ?>" class="border-2 border-emerald-400 px-6 py-3 font-bold hover:bg-emerald-400/20">Go to Dashboard</a>
            </div>

            <?php
            // Set the last launched game in session for global notification
            if ($game_address) {
                $_SESSION['last_launched_game'] = [
                    'name' => 'Your Game', // Replace with actual game name if available from API or form
                    'icon_url' => 'https://img.itch.zone/aW1nLzIyNjUyNDQxLnBuZw==/300x240%23c/B7NkuX.png', // Replace with actual icon if available
                    'address' => $game_address
                ];
            }
            ?>

        <?php else: ?>
            <div class="text-center mb-8">
                <div class="inline-flex items-center justify-center w-20 h-20 bg-red-400/20 rounded-full mb-4">
                    <?php echo icon("circle-x", "h-12 w-12 text-red-400"); ?>
                </div>
                <h1 class="text-3xl font-bold mb-2">Launch Failed</h1>
                <p class="text-xl mb-8">We couldn't complete your gamecoin launch</p>
            </div>

            <div class="border-4 border-red-400 p-6 mb-8">
                <h2 class="text-xl font-bold mb-4">Error Details</h2>
                <div class="bg-red-950/50 p-4 mb-6 border border-red-400/50">
                    <p class="font-bold text-red-400 mb-1">Error message:</p>
                    <p><?= nl2br(htmlspecialchars($error ?: "Unknown error occurred during transaction processing")) ?></p>
                </div>

                <div class="bg-neutral-900/50 p-4">
                    <h3 class="font-bold mb-2">What to do next?</h3>
                    <ul class="list-disc ml-5 space-y-1">
                        <li>Ensure your wallet has at least 0.04 SOL for network fees</li>
                        <li>Make sure your wallet is properly connected</li>
                        <li>Try launching your gamecoin again</li>
                    </ul>
                </div>
            </div>

            <div class="flex justify-center space-x-4">
                <a href="/upload" class="bg-emerald-400 text-emerald-950 px-6 py-3 font-bold hover:bg-emerald-300 transition-colors">Try Again</a>
            </div>
        <?php endif; ?>
    </div>
</main>

<?php require_once __DIR__ . "/../includes/footer.php"; ?>
