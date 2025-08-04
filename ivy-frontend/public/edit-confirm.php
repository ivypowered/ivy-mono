<?php
/**
 * ivy-frontend/public/edit-confirm.php
 *
 * Handles game edit confirmation and transaction creation with diff visualization.
 */

require_once __DIR__ . "/../includes/api.php";

// Initialize error array
$errors = [];

// Variables that will store the game data
$game_address = $game_name = $game_symbol = "";
$owner_address = $new_owner_address = "";
$original_withdraw_authority = $new_withdraw_authority = "";
$original_game_url = $new_game_url = "";
$original_cover_url = $new_cover_url = "";
$original_metadata_url = $new_metadata_url = "";
$transaction_data = [];

// Check if the required GET params are present
$required_params = [
    "game",
    "name",
    "symbol",
    "owner",
    "new_owner",
    "original_withdraw_authority",
    "new_withdraw_authority",
    "original_game_url",
    "new_game_url",
    "original_cover_url",
    "new_cover_url",
    "original_metadata_url",
    "new_metadata_url",
];

foreach ($required_params as $param) {
    if (!isset($_GET[$param])) {
        $errors[] = "Missing required parameter: $param";
    }
}

// Only proceed if we have all required parameters
if (empty($errors)) {
    // Get parameters from URL
    $game_address = $_GET["game"];
    $game_name = $_GET["name"];
    $game_symbol = $_GET["symbol"];
    $owner_address = $_GET["owner"];
    $new_owner_address = $_GET["new_owner"];
    $original_withdraw_authority = $_GET["original_withdraw_authority"];
    $new_withdraw_authority = $_GET["new_withdraw_authority"];
    $original_game_url = $_GET["original_game_url"];
    $new_game_url = $_GET["new_game_url"];
    $original_cover_url = $_GET["original_cover_url"];
    $new_cover_url = $_GET["new_cover_url"];
    $original_metadata_url = $_GET["original_metadata_url"];
    $new_metadata_url = $_GET["new_metadata_url"];

    // Determine what fields have changed
    $owner_changed = $owner_address !== $new_owner_address;
    $withdraw_authority_changed =
        $original_withdraw_authority !== $new_withdraw_authority;
    $game_url_changed = $original_game_url !== $new_game_url;
    $cover_url_changed = $original_cover_url !== $new_cover_url;
    $metadata_changed = $original_metadata_url !== $new_metadata_url;

    // Track if any changes were made at all
    $has_changes =
        $owner_changed ||
        $withdraw_authority_changed ||
        $game_url_changed ||
        $cover_url_changed ||
        $metadata_changed;

    if (!$has_changes) {
        $errors[] =
            "No changes detected. Please make at least one change before saving.";
    } else {
        try {
            // Create the game edit transaction with only the new values
            $edit_data = [
                "game" => $game_address,
                "owner" => $owner_address,
                "new_owner" => $new_owner_address,
                "new_withdraw_authority" => $new_withdraw_authority,
                "game_url" => $new_game_url,
                "cover_url" => $new_cover_url,
                "metadata_url" => $new_metadata_url,
            ];

            $edit_response = call_backend("/tx/game/edit", "POST", $edit_data);

            if ($edit_response === null) {
                throw new Exception("Failed to create edit transaction");
            }

            // Set the transaction data
            $transaction_data = [
                "tx" => $edit_response,
                "returnUrl" => "/edit-done",
                "returnParams" => [
                    "gameAddress" => $game_address,
                ],
            ];
        } catch (Exception $e) {
            $errors[] = "Transaction creation failed: " . $e->getMessage();
        }
    }
}

$title = "ivy | edit confirmation";
$description = "Confirm your edits to your game on Ivy: the gamecoin launchpad";
require_once __DIR__ . "/../includes/header.php";
?>

<main class="py-8">
    <div class="mx-auto max-w-3xl px-6">
        <!-- Confirmation Page -->
        <h1 class="text-3xl font-bold mb-8 text-center">Confirm Game Update</h1>

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
                <div class="mt-4">
                    <a href="/edit?address=<?= urlencode(
                        $game_address,
                    ) ?>" class="inline-flex items-center justify-center px-4 py-2 bg-emerald-400 text-emerald-950 hover:bg-emerald-300">
                        <?php echo icon("arrow-left", "h-4 w-4 mr-2"); ?>
                        Back to edit form
                    </a>
                </div>
            </div>
        <?php else: ?>
            <div class="border-2 border-emerald-400 bg-zinc-900 mb-8">
                <!-- Game Header -->
                <div class="p-4 border-b-2 border-emerald-400 bg-zinc-800">
                    <div class="flex justify-between items-center">
                        <div>
                            <h2 class="text-xl font-bold"><?= htmlspecialchars(
                                $game_name,
                            ) ?></h2>
                            <div class="text-sm text-zinc-400"><?= htmlspecialchars(
                                $game_symbol,
                            ) ?></div>
                        </div>
                        <div class="font-mono text-xs text-zinc-400 truncate ml-4">
                            <?= htmlspecialchars($game_address) ?>
                        </div>
                    </div>
                </div>

                <!-- Changes -->
                <div class="p-4">
                    <?php if (!$has_changes): ?>
                        <div class="p-4 bg-zinc-800 border-2 border-zinc-600 text-center">
                            <p class="text-zinc-400">No changes detected</p>
                        </div>
                    <?php else: ?>
                        <!-- Cover Image Changes -->
                        <?php if ($cover_url_changed): ?>
                        <div class="mb-6 border-2 border-zinc-700">
                            <div class="bg-zinc-800 p-2 border-b border-zinc-700 text-xs uppercase font-bold">Cover Image</div>
                            <div class="grid grid-cols-2 gap-0">
                                <div class="p-2 border-r border-zinc-700">
                                    <div class="text-xs text-zinc-400 mb-1 font-bold">BEFORE:</div>
                                    <div class="h-32 bg-zinc-900 overflow-hidden">
                                        <img src="<?= htmlspecialchars(
                                            $original_cover_url,
                                        ) ?>"
                                             alt="Original cover"
                                             class="w-full h-full object-cover opacity-70">
                                    </div>
                                </div>
                                <div class="p-2">
                                    <div class="text-xs text-emerald-400 mb-1 font-bold">AFTER:</div>
                                    <div class="h-32 border border-emerald-400 overflow-hidden">
                                        <img src="<?= htmlspecialchars(
                                            $new_cover_url,
                                        ) ?>"
                                             alt="New cover"
                                             class="w-full h-full object-cover">
                                    </div>
                                </div>
                            </div>
                        </div>
                        <?php endif; ?>

                        <!-- Game URL -->
                        <?php if ($game_url_changed): ?>
                        <div class="mb-6 border-2 border-zinc-700">
                            <div class="bg-zinc-800 p-2 border-b border-zinc-700 text-xs uppercase font-bold">Game URL</div>
                            <div class="grid grid-cols-1">
                                <div class="p-2 border-b border-zinc-700">
                                    <div class="text-xs text-zinc-400 mb-1 font-bold">BEFORE:</div>
                                    <div class="font-mono text-sm text-zinc-500 break-all"><?= htmlspecialchars(
                                        $original_game_url,
                                    ) ?></div>
                                </div>
                                <div class="p-2 bg-zinc-800/50">
                                    <div class="text-xs text-emerald-400 mb-1 font-bold">AFTER:</div>
                                    <div class="font-mono text-sm text-emerald-400 break-all"><?= htmlspecialchars(
                                        $new_game_url,
                                    ) ?></div>
                                </div>
                            </div>
                        </div>
                        <?php endif; ?>

                        <!-- Owner Address -->
                        <?php if ($owner_changed): ?>
                        <div class="mb-6 border-2 border-zinc-700">
                            <div class="bg-zinc-800 p-2 border-b border-zinc-700 text-xs uppercase font-bold">Owner Address</div>
                            <div class="grid grid-cols-1">
                                <div class="p-2 border-b border-zinc-700">
                                    <div class="text-xs text-zinc-400 mb-1 font-bold">BEFORE:</div>
                                    <div class="font-mono text-sm text-zinc-500 break-all"><?= htmlspecialchars(
                                        $owner_address,
                                    ) ?></div>
                                </div>
                                <div class="p-2 bg-zinc-800/50">
                                    <div class="text-xs text-emerald-400 mb-1 font-bold">AFTER:</div>
                                    <div class="font-mono text-sm text-emerald-400 break-all"><?= htmlspecialchars(
                                        $new_owner_address,
                                    ) ?></div>
                                </div>
                            </div>
                        </div>
                        <?php endif; ?>

                        <!-- Withdraw Authority -->
                        <?php if ($withdraw_authority_changed): ?>
                        <div class="mb-6 border-2 border-zinc-700">
                            <div class="bg-zinc-800 p-2 border-b border-zinc-700 text-xs uppercase font-bold">Withdraw Authority</div>
                            <div class="grid grid-cols-1">
                                <div class="p-2 border-b border-zinc-700">
                                    <div class="text-xs text-zinc-400 mb-1 font-bold">BEFORE:</div>
                                    <div class="font-mono text-sm text-zinc-500 break-all">
                                        <?= htmlspecialchars(
                                            $original_withdraw_authority ===
                                            "11111111111111111111111111111111"
                                                ? "None"
                                                : $original_withdraw_authority,
                                        ) ?>
                                    </div>
                                </div>
                                <div class="p-2 bg-zinc-800/50">
                                    <div class="text-xs text-emerald-400 mb-1 font-bold">AFTER:</div>
                                    <div class="font-mono text-sm text-emerald-400 break-all">
                                        <?= htmlspecialchars(
                                            $new_withdraw_authority ===
                                            "11111111111111111111111111111111"
                                                ? "None"
                                                : $new_withdraw_authority,
                                        ) ?>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <?php endif; ?>

                        <!-- Metadata URL -->
                        <?php if ($metadata_changed): ?>
                        <div class="mb-6 border-2 border-zinc-700">
                            <div class="bg-zinc-800 p-2 border-b border-zinc-700 text-xs uppercase font-bold">Metadata URL</div>
                            <div class="grid grid-cols-1">
                                <div class="p-2 border-b border-zinc-700">
                                    <div class="text-xs text-zinc-400 mb-1 font-bold">BEFORE:</div>
                                    <div class="font-mono text-sm text-zinc-500 break-all"><?= htmlspecialchars(
                                        $original_metadata_url,
                                    ) ?></div>
                                </div>
                                <div class="p-2 bg-zinc-800/50">
                                    <div class="text-xs text-emerald-400 mb-1 font-bold">AFTER:</div>
                                    <div class="font-mono text-sm text-emerald-400 break-all"><?= htmlspecialchars(
                                        $new_metadata_url,
                                    ) ?></div>
                                </div>
                            </div>
                        </div>
                        <?php endif; ?>
                    <?php endif; ?>

                    <!-- Transaction Button -->
                    <button
                        id="tx-button"
                        class="bg-emerald-400 text-emerald-950 px-8 py-3 font-bold text-lg hover:bg-emerald-300 w-full cursor-pointer disabled:cursor-default disabled:opacity-50 disabled:pointer-events-none border-2 border-emerald-400"
                        data-transaction="<?= base64_encode(
                            json_encode($transaction_data),
                        ) ?>"
                    >
                        Initializing...
                    </button>
                </div>
            </div>

            <div class="text-center">
                <a href="/edit?address=<?= urlencode(
                    $game_address,
                ) ?>" class="flex items-center justify-center text-emerald-400 hover:text-emerald-300 text-sm">
                    <?php echo icon("arrow-left", "h-4 w-4 mr-1"); ?>
                    Back to edit form
                </a>
            </div>
        <?php endif; ?>
    </div>
</main>

<?php require_once __DIR__ . "/../includes/footer.php"; ?>
