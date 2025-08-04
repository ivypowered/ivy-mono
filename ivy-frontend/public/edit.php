<?php
/**
 * Game edit page for publishers to update their game information.
 */

// Check if game address is provided
$game_address = $_GET["address"] ?? "";
if (empty($game_address)) {
    require_once __DIR__ . "/404.php";
    exit();
}

require_once __DIR__ . "/../includes/api.php";

// Initialize variables
$game = null;
$errors = [];
$original_icon_url = "";
$original_cover_url = "";
$original_metadata_url = "";

// Fetch initial game data
try {
    $game_data = call_aggregator("games/{$game_address}");

    // Validate core fields
    if (
        !isset($game_data["name"]) ||
        !isset($game_data["symbol"]) ||
        !isset($game_data["mint"]) ||
        !isset($game_data["owner"]) ||
        !isset($game_data["metadata_url"])
    ) {
        throw new Exception("Core game data missing from API response");
    }

    // Store original URLs
    $original_icon_url = "";
    $original_cover_url = $game_data["cover_url"] ?? "";
    $original_metadata_url = $game_data["metadata_url"];

    // Set form field values
    $game = [
        "name" => $game_data["name"],
        "symbol" => $game_data["symbol"],
        "mint" => $game_data["mint"],
        "owner" => $game_data["owner"],
        "withdraw_authority" => $game_data["withdraw_authority"] ?? "",
        "game_url" => $game_data["game_url"] ?? "",
        "icon_url" => $original_icon_url,
        "cover_url" => $original_cover_url,
        "metadata_url" => $original_metadata_url,
        "full_description" => "Loading...", // Will be fetched via JS
    ];

    // Generate placeholder images if needed
    if (empty($game["icon_url"]) && !empty($game["symbol"])) {
        $game["icon_url"] =
            "https://placehold.co/200x200/3f3f46/10b981?text=" .
            urlencode($game["symbol"]) .
            "&font=montserrat";
    }
    if (empty($game["cover_url"]) && !empty($game["name"])) {
        $game["cover_url"] =
            "https://placehold.co/1200x630/3f3f46/10b981?text=" .
            urlencode($game["name"]) .
            "&font=montserrat";
    }
} catch (Exception $e) {
    $errors[] = "Failed to fetch game data: " . $e->getMessage();
    $game = null;
}

// Handle form submission
if ($_SERVER["REQUEST_METHOD"] == "POST" && $game !== null) {
    // Extract form data
    $submitted_game_url = $_POST["game_url"] ?? "";
    $submitted_full_description = $_POST["full_description"] ?? "";
    $submitted_new_owner = $_POST["new_owner"] ?? $game["owner"];
    $submitted_new_withdraw_authority =
        $_POST["new_withdraw_authority"] ?? $game["withdraw_authority"];
    if (strlen(trim($submitted_new_withdraw_authority)) === 0) {
        $submitted_new_withdraw_authority = "11111111111111111111111111111111";
    }
    $submitted_metadata_icon_url = $_POST["metadata_icon_url"] ?? "";

    // Read change flags
    $icon_changed = ($_POST["icon_changed"] ?? "0") === "1";
    $cover_changed = ($_POST["cover_changed"] ?? "0") === "1";
    $description_changed = ($_POST["description_changed"] ?? "0") === "1";
    $metadata_needs_update = ($_POST["metadata_needs_update"] ?? "0") === "1";

    // Initialize with original values
    $new_icon_url = $original_icon_url;
    $new_cover_url = $original_cover_url;
    $new_metadata_url = $original_metadata_url;

    // Validate inputs
    if (
        empty($submitted_game_url) ||
        !filter_var($submitted_game_url, FILTER_VALIDATE_URL)
    ) {
        $errors[] = "Valid game URL is required";
    }

    // Process file uploads if no errors so far
    if (empty($errors)) {
        try {
            // Upload icon if changed
            if (
                $icon_changed &&
                isset($_FILES["game_icon"]) &&
                $_FILES["game_icon"]["error"] == UPLOAD_ERR_OK
            ) {
                if ($_FILES["game_icon"]["size"] > 2 * 1024 * 1024) {
                    throw new Exception("Icon file is too large (max 2MB)");
                }
                $icon_base64 = base64_encode(
                    file_get_contents($_FILES["game_icon"]["tmp_name"]),
                );
                $icon_data = [
                    "base64_image" => $icon_base64,
                    "image_type" => $_FILES["game_icon"]["type"],
                ];
                $uploaded_icon_url = call_backend(
                    "/assets/images",
                    "POST",
                    $icon_data,
                );
                if ($uploaded_icon_url === null) {
                    throw new Exception("Failed to upload game icon");
                }
                $new_icon_url = $uploaded_icon_url;
            } elseif ($icon_changed) {
                throw new Exception(
                    "Game icon was marked as changed, but no valid file was uploaded",
                );
            }

            // Upload cover if changed
            if (
                $cover_changed &&
                isset($_FILES["game_cover"]) &&
                $_FILES["game_cover"]["error"] == UPLOAD_ERR_OK
            ) {
                if ($_FILES["game_cover"]["size"] > 3 * 1024 * 1024) {
                    throw new Exception("Cover file is too large (max 3MB)");
                }
                $cover_base64 = base64_encode(
                    file_get_contents($_FILES["game_cover"]["tmp_name"]),
                );
                $cover_data = [
                    "base64_image" => $cover_base64,
                    "image_type" => $_FILES["game_cover"]["type"],
                ];
                $uploaded_cover_url = call_backend(
                    "/assets/images",
                    "POST",
                    $cover_data,
                );
                if ($uploaded_cover_url === null) {
                    throw new Exception("Failed to upload game cover");
                }
                $new_cover_url = $uploaded_cover_url;
            } elseif ($cover_changed) {
                throw new Exception(
                    "Game cover was marked as changed, but no valid file was uploaded",
                );
            }

            // Update metadata if needed
            if ($metadata_needs_update) {
                // Use client-provided metadata icon URL if icon hasn't been changed
                if (
                    empty($new_icon_url) &&
                    !empty($submitted_metadata_icon_url)
                ) {
                    $new_icon_url = $submitted_metadata_icon_url;
                }

                if (empty($new_icon_url)) {
                    throw new Exception(
                        "No icon URL available for metadata. Please upload an icon image.",
                    );
                }

                $metadata_data = [
                    "name" => $game["name"],
                    "symbol" => $game["symbol"],
                    "icon_url" => $new_icon_url,
                    "description" => $submitted_full_description,
                ];
                $uploaded_metadata_url = call_backend(
                    "/assets/metadata",
                    "POST",
                    $metadata_data,
                );
                if ($uploaded_metadata_url === null) {
                    throw new Exception("Failed to upload game metadata");
                }
                $new_metadata_url = $uploaded_metadata_url;
            }

            // Redirect to confirmation page with both original and new values
            $redirect_params = [
                "game" => $game_address,
                "name" => $game["name"],
                "symbol" => $game["symbol"],
                "owner" => $game["owner"],
                "new_owner" => $submitted_new_owner,
                "original_withdraw_authority" => $game["withdraw_authority"],
                "new_withdraw_authority" => $submitted_new_withdraw_authority,
                "original_game_url" => $game["game_url"],
                "new_game_url" => $submitted_game_url,
                "original_cover_url" => $original_cover_url,
                "new_cover_url" => $new_cover_url,
                "original_metadata_url" => $original_metadata_url,
                "new_metadata_url" => $new_metadata_url,
            ];

            header(
                "Location: /edit-confirm?" . http_build_query($redirect_params),
            );
            exit();
        } catch (Exception $e) {
            $errors[] = "Update failed: " . $e->getMessage();
        }
    }

    // Update form data for redisplay if there were errors
    if (!empty($errors)) {
        $game["game_url"] = $submitted_game_url;
        $game["full_description"] = $submitted_full_description;
        $game["owner"] = $submitted_new_owner;
        $game["withdraw_authority"] = $submitted_new_withdraw_authority;
    }
}

$title = "ivy | edit";
$description = "Edit your game on Ivy: the gamecoin launchpad";
require_once __DIR__ . "/../includes/header.php";
?>

<!-- Top navigation bar -->
<div class="sticky top-0 z-[1] bg-zinc-900 border-b-2 border-zinc-700">
    <div class="max-w-7xl mx-auto px-6">
        <div class="flex justify-between items-center py-4">
            <div class="flex items-center gap-4">
                <a href="/game?address=<?= urlencode(
                    $game_address,
                ) ?>" class="rounded-none border-2 border-emerald-400 text-emerald-400 hover:bg-emerald-400 hover:text-emerald-950 p-2 flex items-center h-10 w-10 justify-center">
                    <?= icon("arrow-left", "h-5 w-5") ?>
                </a>
                <h1 class="text-xl font-bold">Edit Game</h1>
            </div>
            <div>
                <button id="saveChangesButton" type="button" class="rounded-none border-2 border-emerald-400 text-emerald-400 hover:bg-emerald-400 hover:text-emerald-950 px-4 py-2 flex items-center gap-2 font-bold text-sm h-10 disabled:opacity-50 disabled:cursor-not-allowed" <?= $game
                    ? ""
                    : "disabled" ?>>
                    <?= icon("check", "h-5 w-5") ?>
                    <span class="hidden sm:inline">Save Changes</span>
                    <span class="sm:hidden">Save</span>
                </button>
            </div>
        </div>
    </div>
</div>

<main class="max-w-7xl mx-auto px-6 pb-8">
    <!-- Error display -->
    <?php if (!empty($errors)): ?>
        <div class="border-2 border-red-400 bg-red-950/50 p-4 my-6 rounded-none">
            <p class="text-red-400 font-bold">Please fix the following errors:</p>
            <ul class="list-disc ml-6 mt-2">
                <?php foreach ($errors as $error): ?>
                    <li class="text-red-400"><?= htmlspecialchars(
                        $error,
                    ) ?></li>
                <?php endforeach; ?>
            </ul>
        </div>
    <?php endif; ?>

    <?php if ($game): ?>
    <!-- Edit form -->
    <form id="editForm" method="POST" action="/edit?address=<?= urlencode(
        $game_address,
    ) ?>" enctype="multipart/form-data">
        <!-- Hidden fields to track changes -->
        <input type="hidden" name="icon_changed" id="icon_changed" value="0">
        <input type="hidden" name="cover_changed" id="cover_changed" value="0">
        <input type="hidden" name="description_changed" id="description_changed" value="0">
        <input type="hidden" name="metadata_needs_update" id="metadata_needs_update" value="0">
        <input type="hidden" name="metadata_icon_url" id="metadata_icon_url" value="">

        <div class="grid grid-cols-1 md:grid-cols-7 gap-8 pt-8">
            <!-- Left Column - Basic Game Info & Description -->
            <div class="md:col-span-4 space-y-8">
                <!-- Basic Information Card -->
                <div class="p-6 border-4 border-emerald-400 bg-zinc-950 rounded-none">
                    <h2 class="text-xl font-bold mb-6 flex items-center gap-2">
                        <?= icon("info", "h-5 w-5 text-emerald-400") ?>
                        Basic Information
                    </h2>

                    <div class="space-y-4">
                        <!-- Game Name (Readonly) -->
                        <div>
                            <label class="block mb-2 font-bold">Game Name</label>
                            <div class="flex items-center w-full bg-zinc-800 border-2 border-zinc-700 p-3 rounded-none text-zinc-300">
                                <?= htmlspecialchars($game["name"]) ?>
                            </div>
                            <p class="text-xs text-zinc-500 mt-1">Name cannot be changed after creation</p>
                        </div>

                        <!-- Game Symbol (Readonly) -->
                        <div>
                            <label class="block mb-2 font-bold">Game Symbol</label>
                            <div class="flex items-center w-full bg-zinc-800 border-2 border-zinc-700 p-3 rounded-none text-zinc-300">
                                <?= htmlspecialchars($game["symbol"]) ?>
                            </div>
                            <p class="text-xs text-zinc-500 mt-1">Symbol cannot be changed after creation</p>
                        </div>

                        <!-- Game Mint (Readonly) -->
                        <div>
                            <label class="block mb-2 font-bold">Game Mint</label>
                            <div class="flex items-stretch">
                                <input type="text" class="flex-grow bg-zinc-800 border-2 border-r-0 border-zinc-700 p-3 focus:outline-none font-mono text-sm rounded-none text-zinc-300" value="<?= htmlspecialchars(
                                    $game["mint"],
                                ) ?>" readonly>
                                <a href="https://solscan.io/token/<?= htmlspecialchars(
                                    $game["mint"],
                                ) ?>?cluster=devnet" target="_blank" rel="noopener noreferrer" class="flex items-center justify-center rounded-none bg-emerald-400 text-emerald-950 px-3 hover:bg-emerald-300 transition-colors duration-200 border-y-2 border-r-2 border-emerald-400" title="View on Solscan (Devnet)">
                                    <?= icon("external-link", "h-5 w-5") ?>
                                </a>
                            </div>
                            <p class="text-xs text-zinc-500 mt-1">The game's token mint address</p>
                        </div>

                        <!-- Game URL (Editable) -->
                        <div>
                            <label for="game_url" class="block mb-2 font-bold">Game URL <span class="text-red-500">*</span></label>
                            <input type="url" id="game_url" name="game_url" class="w-full bg-zinc-900 border-2 border-emerald-400 p-3 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 rounded-none" value="<?= htmlspecialchars(
                                $game["game_url"] ?? "",
                            ) ?>" placeholder="https://yourgame.com" required>
                            <p class="text-xs text-zinc-500 mt-1">URL to your playable game (loaded in iframe)</p>
                        </div>
                    </div>
                </div>

                <!-- Game Description Card -->
                <div id="description" class="p-6 border-4 border-emerald-400 bg-zinc-950 rounded-none">
                    <h2 class="text-xl font-bold mb-6 flex items-center gap-2">
                        <?= icon("list", "h-5 w-5 text-emerald-400") ?>
                        Game Description
                    </h2>

                    <div>
                        <label for="full_description" class="block mb-2 font-bold">Description</label>
                        <textarea id="full_description" name="full_description" rows="8" class="w-full bg-zinc-900 border-2 border-emerald-400 p-3 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 rounded-none disabled:bg-zinc-800 disabled:text-zinc-500 disabled:border-zinc-700" placeholder="Detailed description of your game..." disabled><?= htmlspecialchars(
                            $game["full_description"],
                        ) ?></textarea>
                        <p class="text-xs text-zinc-500 mt-1">Description displayed on your game's detail page (optional)</p>
                    </div>
                </div>
            </div>

            <!-- Right Column - Access, Assets & Submit -->
            <div class="md:col-span-3 space-y-8">
                <!-- Access Management Card -->
                <div id="addresses" class="p-6 border-4 border-emerald-400 bg-zinc-950 rounded-none">
                    <h2 class="text-xl font-bold mb-6 flex items-center gap-2">
                        <?= icon("lock", "h-5 w-5 text-emerald-400") ?>
                        Access Management
                    </h2>

                    <div class="space-y-4">
                        <!-- Owner Address (Editable) -->
                        <div>
                            <label for="new_owner" class="block mb-2 font-bold">Owner Address <span class="text-red-500">*</span></label>
                            <input type="text" id="new_owner" name="new_owner" class="w-full bg-zinc-900 border-2 border-emerald-400 p-3 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 font-mono text-sm rounded-none" value="<?= htmlspecialchars(
                                $game["owner"],
                            ) ?>" required>
                            <p class="text-xs text-zinc-500 mt-1">Account that will own this game and can make edits.</p>
                        </div>

                        <!-- Withdraw Authority (Editable) -->
                        <div>
                            <label for="new_withdraw_authority" class="block mb-2 font-bold">Withdraw Authority <span class="text-zinc-500">(Optional)</span></label>
                            <input type="text" id="new_withdraw_authority" name="new_withdraw_authority" class="w-full bg-zinc-900 border-2 border-emerald-400 p-3 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 font-mono text-sm rounded-none" value="<?= htmlspecialchars(
                                $game["withdraw_authority"] ===
                                "11111111111111111111111111111111"
                                    ? ""
                                    : $game["withdraw_authority"],
                            ) ?>">
                            <p class="text-xs text-zinc-500 mt-1">Account that can sign withdraw claims. Leave blank if unused.</p>
                        </div>
                    </div>
                </div>

                <!-- Game Assets Card -->
                <div id="assets" class="p-6 border-4 border-emerald-400 bg-zinc-950 rounded-none">
                    <h2 class="text-xl font-bold mb-6 flex items-center gap-2">
                        <?= icon("image", "h-5 w-5 text-emerald-400") ?>
                        Game Assets
                    </h2>

                    <div class="space-y-6">
                        <!-- Game Icon -->
                        <div>
                            <label class="block mb-2 font-bold">Game Icon</label>
                            <div class="relative">
                                <label for="game_icon" class="block cursor-pointer">
                                    <div class="mb-3 w-32 h-32 mx-auto border-2 border-emerald-400 bg-zinc-800 flex items-center justify-center overflow-hidden hover:border-emerald-300 rounded-none">
                                        <img id="game_icon_preview" src="<?= htmlspecialchars(
                                            $game["icon_url"],
                                        ) ?>" alt="Game icon preview" class="w-full h-full object-cover hover:opacity-80">
                                    </div>
                                </label>
                                <input type="file" id="game_icon" name="game_icon" accept="image/png, image/jpeg, image/gif, image/webp" class="hidden">
                                <div class="text-center">
                                    <button type="button" onclick="document.getElementById('game_icon').click()" class="text-emerald-400 hover:text-emerald-300 font-bold text-sm">Update Icon</button>
                                    <p class="text-xs text-zinc-500 mt-1">Square format, max 2MB (PNG, JPG, WebP).</p>
                                    <p id="icon-filename" class="text-xs text-gray-400 mt-1 truncate"></p>
                                </div>
                            </div>
                        </div>

                        <!-- Cover Image -->
                        <div>
                            <label class="block mb-2 font-bold">Cover Image</label>
                            <div class="relative">
                                <label for="game_cover" class="block cursor-pointer">
                                    <div class="mb-3 h-48 mx-auto border-2 border-emerald-400 bg-zinc-800 flex items-center justify-center overflow-hidden hover:border-emerald-300 rounded-none">
                                        <img id="game_cover_preview" src="<?= htmlspecialchars(
                                            $game["cover_url"],
                                        ) ?>" alt="Game cover preview" class="w-full h-full object-cover hover:opacity-80">
                                    </div>
                                </label>
                                <input type="file" id="game_cover" name="game_cover" accept="image/png, image/jpeg, image/gif, image/webp" class="hidden">
                                <div class="text-center">
                                    <button type="button" onclick="document.getElementById('game_cover').click()" class="text-emerald-400 hover:text-emerald-300 font-bold text-sm">Update Cover</button>
                                    <p class="text-xs text-zinc-500 mt-1">Recommend 16:9, max 3MB (PNG, JPG, WebP).</p>
                                    <p id="cover-filename" class="text-xs text-gray-400 mt-1 truncate"></p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </form>
    <?php else: ?>
        <!-- Error state display -->
        <div class="text-center py-8">
            <div class="inline-flex items-center justify-center w-20 h-20 bg-red-400/20 rounded-full mb-4">
                <?php echo icon("circle-x", "h-12 w-12 text-red-400"); ?>
            </div>
            <h1 class="text-3xl font-bold mb-2">Game Not Found or Error</h1>
            <p class="text-xl mb-8">We couldn't fetch the necessary data for the game with address <code class="text-sm bg-zinc-700 px-1 py-0.5 rounded"><?= htmlspecialchars(
                $game_address,
            ) ?></code>.</p>
            <div class="flex justify-center">
                <a href="/" class="bg-emerald-400 text-emerald-950 px-6 py-3 font-bold hover:bg-emerald-300 rounded-none">Return to Home</a>
            </div>
        </div>
    <?php endif; ?>
</main>

<script>
document.addEventListener('DOMContentLoaded', function() {
    const gameData = <?= $game !== null
        ? json_encode([
            "metadata_url" => $game["metadata_url"] ?? null,
            "original_icon_url" => $original_icon_url,
            "original_cover_url" => $original_cover_url,
        ])
        : "null" ?>;

    let originalDescription = '';
    let formModified = false; // Track if any changes have been made

    // Core elements
    const editForm = document.getElementById('editForm');
    const saveButton = document.getElementById('saveChangesButton');
    const charCounter = document.getElementById('short-desc-counter');
    const fullDescTextarea = document.getElementById('full_description');
    const iconInput = document.getElementById('game_icon');
    const iconPreview = document.getElementById('game_icon_preview');
    const iconFilename = document.getElementById('icon-filename');
    const coverInput = document.getElementById('game_cover');
    const coverPreview = document.getElementById('game_cover_preview');
    const coverFilename = document.getElementById('cover-filename');
    const metadataIconUrlInput = document.getElementById('metadata_icon_url');

    // Initial values to compare against
    const initialValues = {};

    // Hidden tracking fields
    const iconChangedInput = document.getElementById('icon_changed');
    const coverChangedInput = document.getElementById('cover_changed');
    const descriptionChangedInput = document.getElementById('description_changed');
    const metadataNeedsUpdateInput = document.getElementById('metadata_needs_update');

    // Disable save button initially
    if (saveButton) {
        saveButton.disabled = true;
    }

    // Store initial values for comparison
    function storeInitialValues() {
        if (editForm) {
            const inputs = editForm.querySelectorAll('input, textarea');
            inputs.forEach(input => {
                if (input.type !== 'file' && input.type !== 'hidden') {
                    initialValues[input.id] = input.value;
                }
            });
        }
    }

    // Check if form has been modified
    function checkFormModified() {
        let modified = false;

        // Check text inputs and textareas
        if (editForm) {
            const inputs = editForm.querySelectorAll('input, textarea');
            inputs.forEach(input => {
                if (input.type !== 'file' && input.type !== 'hidden') {
                    if (initialValues[input.id] !== input.value) {
                        modified = true;
                    }
                }
            });
        }

        // Check if images changed
        if (iconChangedInput && iconChangedInput.value === "1") {
            modified = true;
        }
        if (coverChangedInput && coverChangedInput.value === "1") {
            modified = true;
        }
        if (descriptionChangedInput && descriptionChangedInput.value === "1") {
            modified = true;
        }

        // Update button state
        formModified = modified;
        if (saveButton) {
            saveButton.disabled = !formModified;
        }
    }

    // Fetch description from metadata
    async function fetchDescription() {
        if (!gameData || !gameData.metadata_url || !fullDescTextarea) return;

        try {
            const response = await fetch(gameData.metadata_url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const metadata = await response.json();
            if (metadata && typeof metadata.description === 'string') {
                originalDescription = metadata.description;
                fullDescTextarea.value = originalDescription;

                // Update icon if needed and store for later use
                const metaIconUrl = metadata.image || metadata.icon_url;
                if (metaIconUrl) {
                    // Store the metadata icon URL in hidden field
                    if (metadataIconUrlInput) {
                        metadataIconUrlInput.value = metaIconUrl;
                    }

                    // Update icon preview if different from what we already have
                    if (iconPreview && gameData.original_icon_url !== metaIconUrl) {
                        iconPreview.src = metaIconUrl;
                    }
                }

                // Store initial values once description is loaded
                storeInitialValues();
            } else {
                throw new Error('Description missing in metadata');
            }
            fullDescTextarea.disabled = false;
        } catch (error) {
            console.error("Error fetching description:", error);
            fullDescTextarea.value = 'Error fetching description from ' + gameData.metadata_url;
            originalDescription = 'ERROR_FETCHING';
            fullDescTextarea.disabled = false;

            // Still store initial values even if there's an error
            storeInitialValues();
        }
    }

    // Set up image handling
    function setupImageHandling(inputElem, previewElem, filenameElem, changedInput, requiresMetadataUpdate) {
        if (!inputElem || !previewElem || !filenameElem || !changedInput) return;

        inputElem.addEventListener('change', function() {
            const file = this.files[0];
            if (file) {
                // Validate file type and size
                if (!['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(file.type)) {
                    alert('Invalid file type. Please select a PNG, JPG, GIF, or WebP file.');
                    this.value = '';
                    filenameElem.textContent = 'Invalid file type selected.';
                    return;
                }

                const maxSizeMB = inputElem.id === 'game_icon' ? 2 : 3;
                if (file.size > maxSizeMB * 1024 * 1024) {
                    alert(`File is too large. Maximum size is ${maxSizeMB}MB.`);
                    this.value = '';
                    filenameElem.textContent = `File too large (max ${maxSizeMB}MB).`;
                    return;
                }

                const reader = new FileReader();
                reader.onload = function(e) {
                    previewElem.src = e.target.result;
                    const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
                    filenameElem.textContent = `New: ${file.name} (${fileSizeMB} MB)`;
                    changedInput.value = "1";
                    if (requiresMetadataUpdate && metadataNeedsUpdateInput) {
                        metadataNeedsUpdateInput.value = "1";
                    }
                    checkFormModified();
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Track description changes
    function checkDescriptionChange() {
        if (!fullDescTextarea || !descriptionChangedInput || !metadataNeedsUpdateInput) return;

        const currentDescription = fullDescTextarea.value;
        if (originalDescription !== 'ERROR_FETCHING' && currentDescription !== originalDescription) {
            descriptionChangedInput.value = "1";
            metadataNeedsUpdateInput.value = "1";
        } else {
            descriptionChangedInput.value = "0";
            if (iconChangedInput.value === "0") {
                metadataNeedsUpdateInput.value = "0";
            }
        }
        checkFormModified();
    }

    // Initialize functionality
    if (gameData) {
        // Start async operations
        fetchDescription();

        // Set up image handlers
        setupImageHandling(iconInput, iconPreview, iconFilename, iconChangedInput, true);
        setupImageHandling(coverInput, coverPreview, coverFilename, coverChangedInput, false);

        // Track description changes
        if (fullDescTextarea) {
            fullDescTextarea.addEventListener('input', checkDescriptionChange);
        }

        // Add change listeners to all editable fields
        const editableFields = editForm.querySelectorAll('input[type="text"], input[type="url"], textarea');
        editableFields.forEach(field => {
            field.addEventListener('input', checkFormModified);
        });

        // Handle form submission
        if (saveButton && editForm) {
            saveButton.addEventListener('click', function() {
                checkDescriptionChange();

                if (editForm.checkValidity()) {
                    editForm.submit();
                } else {
                    editForm.reportValidity();
                }
            });
        }
    } else if (saveButton) {
        saveButton.disabled = true;
    }
});
</script>

<?php require_once __DIR__ . "/../includes/footer.php"; ?>
