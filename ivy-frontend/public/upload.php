<?php
/**
 * ivy-frontend/public/upload.php
 * Handles game upload form display, processing, and error handling.
 */

require_once __DIR__ . "/../includes/api.php";

// Initialize variables
$game_name = $game_symbol = $game_url = $game_description = "";
$errors = [];

// Get IVY info from aggregator
$ivy_info = call_aggregator("/ivy/info");

// Process form submission
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    // Collect form data
    $game_name = $_POST["game_name"] ?? "";
    $game_symbol = strtoupper($_POST["game_symbol"] ?? "");
    $game_url = $_POST["game_url"] ?? "";
    $game_description = $_POST["game_description"] ?? "";
    $initial_purchase = $_POST["initial_purchase"] ?? "0";

    // Input validation
    if (empty($game_name)) {
        $errors[] = "Game name is required";
    }

    if (
        empty($game_symbol) ||
        !preg_match('/^[A-Z0-9]{2,10}$/', $game_symbol)
    ) {
        $errors[] = "Game symbol must be 2-10 uppercase letters or numbers";
    }

    if (empty($game_url) || !filter_var($game_url, FILTER_VALIDATE_URL)) {
        $errors[] = "Valid game URL is required";
    }

    // Validate file sizes
    if (!isset($_FILES["game_icon"])) {
        $errors[] = "Game icon is required";
    } elseif ($_FILES["game_icon"]["error"] != UPLOAD_ERR_OK) {
        $errors[] = "Error uploading game icon";
    } elseif ($_FILES["game_icon"]["size"] > 2 * 1024 * 1024) {
        $errors[] = "Icon file is too large (max 2MB)";
    }

    if (!isset($_FILES["game_cover"])) {
        $errors[] = "Cover image is required";
    } elseif ($_FILES["game_cover"]["error"] != UPLOAD_ERR_OK) {
        $errors[] = "Error uploading game cover";
    } elseif ($_FILES["game_cover"]["size"] > 3 * 1024 * 1024) {
        $errors[] = "Cover file is too large (max 3MB)";
    }

    // Validate initial purchase
    if (!intval($initial_purchase) < 0) {
        $errors[] = "Initial purchase amount must be a positive number";
    }

    // If no errors, process uploads and redirect to confirmation
    if (empty($errors)) {
        try {
            // Get base64 encoded images
            $icon_base64 = base64_encode(
                file_get_contents($_FILES["game_icon"]["tmp_name"]),
            );
            $cover_base64 = base64_encode(
                file_get_contents($_FILES["game_cover"]["tmp_name"]),
            );

            // 1. Upload icon image to IPFS
            $icon_data = [
                "base64_image" => $icon_base64,
                "image_type" => $_FILES["game_icon"]["type"],
            ];
            $icon_url = call_backend("/assets/images", "POST", $icon_data);
            if ($icon_url === null) {
                throw new Exception("Failed to upload game icon");
            }

            // 2. Upload cover image to IPFS
            $cover_data = [
                "base64_image" => $cover_base64,
                "image_type" => $_FILES["game_cover"]["type"],
            ];
            $cover_url = call_backend("/assets/images", "POST", $cover_data);
            if ($cover_url === null) {
                throw new Exception("Failed to upload game cover");
            }

            // 3. Upload metadata to IPFS
            $metadata_data = [
                "name" => $game_name,
                "symbol" => $game_symbol,
                "icon_url" => $icon_url,
                "description" => $game_description,
            ];
            $metadata_url = call_backend(
                "/assets/metadata",
                "POST",
                $metadata_data,
            );
            if ($metadata_url === null) {
                throw new Exception("Failed to upload game metadata");
            }

            // 4. Fetch game seed
            $seed = call_backend("/game-seed", "POST");

            // Calculate tokens to receive
            $ivy_initial_liquidity = $ivy_info["ivy_initial_liquidity"];
            $game_initial_liquidity = $ivy_info["game_initial_liquidity"];
            $min_game_received = "0";

            if (intval($initial_purchase) > 0) {
                $tokens_amount =
                    (intval($initial_purchase) * $game_initial_liquidity) /
                    ($ivy_initial_liquidity + intval($initial_purchase));
                $min_game_received = strval(floor($tokens_amount));
            }

            // Redirect to confirmation page with GET parameters
            $redirect_params = [
                "seed" => $seed,
                "name" => $game_name,
                "symbol" => $game_symbol,
                "game_url" => $game_url,
                "icon_url" => $icon_url,
                "cover_url" => $cover_url,
                "metadata_url" => $metadata_url,
                "ivy_purchase" => $initial_purchase,
                "min_game_received" => $min_game_received,
            ];

            header(
                "Location: /upload-confirm?" .
                    http_build_query($redirect_params),
            );
            exit();
        } catch (Exception $e) {
            $errors[] = "Upload failed: " . $e->getMessage();
        }
    }
}

// Process error parameters if needed
if (isset($_GET["error"])) {
    $errorParam = urldecode($_GET["error"]);
    $errors = explode("|", $errorParam);
} elseif (isset($_GET["errors"]) && is_array($_GET["errors"])) {
    $errors = array_map("urldecode", $_GET["errors"]);
}

$title = "ivy | upload";
$description = "Upload your game to Ivy: the gamecoin launchpad";
require_once __DIR__ . "/../includes/header.php";
?>

<main class="py-8">
    <div class="mx-auto max-w-6xl px-6">
        <!-- Header -->
        <h1 class="text-3xl font-bold mb-8 text-center">Upload Your Game</h1>

        <?php if (!empty($errors)): ?>
            <div class="border-2 border-red-400 bg-red-950/50 p-4 mb-8">
                <p class="text-red-400 font-bold">Please fix the following errors:</p>
                <ul class="list-disc ml-6 mt-2">
                    <?php foreach ($errors as $error): ?>
                        <li class="text-red-400"><?php echo htmlspecialchars(
                            $error,
                        ); ?></li>
                    <?php endforeach; ?>
                </ul>
            </div>
        <?php endif; ?>

        <!-- Form -->
        <form id="uploadForm" method="POST" action="/upload" enctype="multipart/form-data" class="border-4 border-emerald-400 p-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Left Column -->
                <div class="space-y-6">
                    <!-- Game Name -->
                    <div>
                        <label for="game_name" class="block mb-2 font-bold">Game Name</label>
                        <input type="text" id="game_name" name="game_name"
                            value="<?php echo htmlspecialchars($game_name); ?>"
                            class="w-full bg-emerald-950 border-2 border-emerald-400 p-3"
                            placeholder="Enter game name" required>
                        <p class="text-sm text-emerald-400 mt-1">Choose a unique and descriptive name</p>
                    </div>

                    <!-- Game Symbol -->
                    <div>
                        <label for="game_symbol" class="block mb-2 font-bold">Game Symbol</label>
                        <input type="text" id="game_symbol" name="game_symbol"
                            value="<?php echo htmlspecialchars(
                                $game_symbol,
                            ); ?>"
                            class="w-full bg-emerald-950 border-2 border-emerald-400 p-3 uppercase"
                            placeholder="GAME" maxlength="10" minlength="2" pattern="[A-Z0-9]{2,10}"
                            title="Must be 2-10 uppercase letters or numbers" required
                            oninput="this.value = this.value.toUpperCase()">
                        <p class="text-sm text-emerald-400 mt-1">2-10 characters, uppercase letters and numbers only</p>
                    </div>

                    <!-- Game URL -->
                    <div>
                        <label for="game_url" class="block mb-2 font-bold">Game URL</label>
                        <input type="url" id="game_url" name="game_url"
                            value="<?php echo htmlspecialchars($game_url); ?>"
                            class="w-full bg-emerald-950 border-2 border-emerald-400 p-3"
                            placeholder="https://yourgame.com" required>
                        <p class="text-sm text-emerald-400 mt-1">URL to your game that will be loaded in an iframe</p>
                    </div>

                    <!-- Initial Purchase Amount -->
                    <div>
                        <label for="initial_purchase" class="block mb-2 font-bold">Initial Purchase (IVY)</label>
                        <input type="number" id="initial_purchase" name="initial_purchase"
                            class="w-full bg-emerald-950 border-2 border-emerald-400 p-3"
                            placeholder="0" min="0" step="1">
                        <p class="text-sm text-emerald-400 mt-1">Amount of IVY to invest; leave blank if unsure.</p>

                        <!-- Results display -->
                        <div class="mt-3 p-3 bg-emerald-950/50 border border-emerald-400/30">
                            <p>You will receive: <span id="tokens_received" class="font-bold">0</span> tokens</p>
                            <p>This is <span id="percentage_supply" class="font-bold">0%</span> of total supply</p>
                        </div>
                    </div>
                </div>

                <!-- Right Column -->
                <div class="space-y-6">
                    <!-- Full Description -->
                    <div>
                        <label for="game_description" class="block mb-2 font-bold">Full Description</label>
                        <textarea id="game_description" name="game_description" rows="6"
                            class="w-full bg-emerald-950 border-2 border-emerald-400 p-3"
                            placeholder="Detailed description of your game..."><?php echo htmlspecialchars(
                                $game_description,
                            ); ?></textarea>
                        <p class="text-sm text-emerald-400 mt-1">Full description displayed on your game's detail page</p>
                    </div>

                    <!-- Game Icon -->
                    <div>
                        <label for="game_icon" class="block mb-2 font-bold">Game Icon <span class="text-red-500">*</span></label>
                        <div id="icon-dropzone" class="border-2 border-dashed border-emerald-400 p-4 text-center h-40 flex flex-col items-center justify-center relative cursor-pointer hover:border-emerald-300">
                            <div id="icon-placeholder" class="flex flex-col items-center pointer-events-none">
                                <?php echo icon(
                                    "image-plus",
                                    "h-10 w-10 text-emerald-400 mb-2",
                                ); ?>
                                <p class="mb-1 font-medium">Upload Game Icon</p>
                                <p class="text-sm text-emerald-400">Square format</p>
                            </div>
                            <img id="icon-preview" src="#" alt="Game icon preview" class="hidden h-32 w-32 object-contain"/>
                            <input type="file" id="game_icon" name="game_icon"
                                accept="image/*"
                                class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                aria-label="Upload Game Icon" required>
                        </div>
                        <p id="icon-filename" class="text-xs text-gray-400 mt-1 truncate"></p>
                        <p class="text-sm text-emerald-400 mt-1">Displayed as your game's icon (max. 2MB)</p>
                    </div>

                    <!-- Cover Image -->
                    <div>
                        <label for="game_cover" class="block mb-2 font-bold">Cover Image <span class="text-red-500">*</span></label>
                        <div id="cover-dropzone" class="border-2 border-dashed border-emerald-400 p-4 text-center h-40 flex flex-col items-center justify-center relative cursor-pointer hover:border-emerald-300">
                            <div id="cover-placeholder" class="flex flex-col items-center pointer-events-none">
                                <?php echo icon(
                                    "image-plus",
                                    "h-10 w-10 text-emerald-400 mb-2",
                                ); ?>
                                <p class="mb-1 font-medium">Upload Cover Image</p>
                                <p class="text-sm text-emerald-400">3:2 ratio recommended</p>
                            </div>
                            <img id="cover-preview" src="#" alt="Game cover preview" class="hidden max-h-32 max-w-full object-contain"/>
                            <input type="file" id="game_cover" name="game_cover"
                                accept="image/*"
                                class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                aria-label="Upload Cover Image" required>
                        </div>
                        <p id="cover-filename" class="text-xs text-gray-400 mt-1 truncate"></p>
                        <p class="text-sm text-emerald-400 mt-1">Displayed on game listings (max. 3MB)</p>
                    </div>
                </div>
            </div>

            <!-- Submit Button -->
            <div class="flex justify-center mt-6 pt-6 border-t-2 border-emerald-400/30">
                <button id="submitButton" type="submit"
                        class="px-8 py-3 font-bold text-lg flex items-center gap-2
                               bg-emerald-400 hover:bg-emerald-300 text-emerald-950 cursor-pointer
                               disabled:bg-emerald-400/50 disabled:cursor-not-allowed disabled:hover:bg-emerald-400/50"
                        disabled>
                    <?php echo icon("upload", "h-5 w-5"); ?>
                    Upload Game
                </button>
            </div>
        </form>
    </div>

    <script>
        // Image preview functionality
        function setupImagePreview(inputId, placeholderId, previewId, filenameId, dropzoneId) {
            const input = document.getElementById(inputId);
            const placeholder = document.getElementById(placeholderId);
            const preview = document.getElementById(previewId);
            const filename = document.getElementById(filenameId);
            const dropzone = document.getElementById(dropzoneId);

            if (!input || !placeholder || !preview || !filename || !dropzone) return;

            input.addEventListener('change', function(event) {
                const file = event.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        placeholder.classList.add('hidden');
                        preview.src = e.target.result;
                        preview.classList.remove('hidden');
                        dropzone.classList.add('border-emerald-300');

                        // Display filename and size
                        const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
                        filename.textContent = `Selected: ${file.name} (${fileSizeMB} MB)`;

                        // Check form validity after file selection
                        checkFormValidity();
                    }
                    reader.readAsDataURL(file);
                } else {
                    placeholder.classList.remove('hidden');
                    preview.classList.add('hidden');
                    preview.src = '#';
                    filename.textContent = '';
                    dropzone.classList.remove('border-emerald-300');

                    // Check form validity after file removal
                    checkFormValidity();
                }
            });
        }

        // Function to check all required fields and enable/disable submit button
        function checkFormValidity() {
            const form = document.getElementById('uploadForm');
            const submitButton = document.getElementById('submitButton');

            // Just set the disabled attribute, Tailwind will handle the styling
            submitButton.disabled = !form.checkValidity();
        }

        // Initialize previews
        setupImagePreview('game_icon', 'icon-placeholder', 'icon-preview', 'icon-filename', 'icon-dropzone');
        setupImagePreview('game_cover', 'cover-placeholder', 'cover-preview', 'cover-filename', 'cover-dropzone');

        // Add event listeners to all required form fields
        document.querySelectorAll('#uploadForm input[required], #uploadForm textarea[required]').forEach(element => {
            element.addEventListener('input', checkFormValidity);
            element.addEventListener('change', checkFormValidity);
        });

        // Check form validity on page load
        document.addEventListener('DOMContentLoaded', checkFormValidity);

        // Add calculation for initial purchase
        document.addEventListener('DOMContentLoaded', function() {
            const initialPurchaseInput = document.getElementById('initial_purchase');
            const tokensReceived = document.getElementById('tokens_received');
            const percentageSupply = document.getElementById('percentage_supply');

            // Get the values from PHP
            const ivyInitialLiquidity = <?php echo $ivy_info[
                "ivy_initial_liquidity"
            ]; ?>;
            const gameInitialLiquidity = <?php echo $ivy_info[
                "game_initial_liquidity"
            ]; ?>;

            // Update calculation when input changes
            initialPurchaseInput.addEventListener('input', updateTokenCalculation);
            initialPurchaseInput.addEventListener('change', updateTokenCalculation);

            function updateTokenCalculation() {
                const purchaseAmount = parseFloat(initialPurchaseInput.value) || 0;

                // Calculate tokens received using the formula
                let tokensAmount = 0;
                let percentage = 0;

                if (purchaseAmount > 0 && ivyInitialLiquidity > 0 && gameInitialLiquidity > 0) {
                    tokensAmount = (purchaseAmount * gameInitialLiquidity) / (ivyInitialLiquidity + purchaseAmount);
                    percentage = (tokensAmount / gameInitialLiquidity) * 100;
                }

                // Round to nearest integer and format
                tokensReceived.textContent = Math.round(tokensAmount).toLocaleString();
                percentageSupply.textContent = percentage.toFixed(2) + '%';
            }

            // Initial calculation
            updateTokenCalculation();
        });
    </script>
</main>

<?php require_once __DIR__ . "/../includes/footer.php"; ?>
