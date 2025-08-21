<?php
/**
 * ivy-frontend/public/sync-launch.php
 * Handles sync (pump.fun game) launch form display, processing, and error handling.
 */

require_once __DIR__ . "/../includes/api.php";

// Initialize variables
$pump_mint = $game_name = $game_symbol = $game_url = $game_description = $short_desc =
    "";
$errors = [];

// Process form submission
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    // Collect form data
    $pump_mint = trim($_POST["pump_mint"] ?? "");
    $game_name = $_POST["game_name"] ?? "";
    $game_symbol = strtoupper($_POST["game_symbol"] ?? "");
    $game_url = $_POST["game_url"] ?? "";
    $game_description = $_POST["game_description"] ?? "";

    // Generate short description (first 128 chars or 125 chars + "...")
    if (strlen($game_description) <= 128) {
        $short_desc = $game_description;
    } else {
        $short_desc = substr($game_description, 0, 125) . "...";
    }

    // Input validation
    if (empty($pump_mint)) {
        $errors[] = "Pump.fun mint address is required";
    } elseif (!preg_match('/^[1-9A-HJ-NP-Za-km-z]{32,44}$/', $pump_mint)) {
        $errors[] = "Invalid Solana address format for Pump.fun mint";
    }

    if (empty($game_name)) {
        $errors[] = "Game name is required";
    }

    if (
        empty($game_symbol) ||
        !preg_match('/^[A-Z0-9]{2,10}$/', $game_symbol)
    ) {
        $errors[] = "Game symbol must be 2-10 uppercase letters or numbers";
    }

    if (empty($game_url)) {
        $errors[] = "Game URL is required";
    }

    // Validate short description
    if (empty($short_desc)) {
        $errors[] = "Short description is required";
    }

    // Validate file sizes
    if (!isset($_FILES["game_icon"])) {
        $errors[] = "Game icon is required";
    } elseif ($_FILES["game_icon"]["error"] != UPLOAD_ERR_OK) {
        $errors[] = "Error uploading game icon";
    } elseif ($_FILES["game_icon"]["size"] > 2 * 1024 * 1024) {
        $errors[] = "Icon file is too large (max 2MB)";
    }

    // If no errors, process uploads and redirect to confirmation
    if (empty($errors)) {
        try {
            // Get base64 encoded images
            $icon_base64 = base64_encode(
                file_get_contents($_FILES["game_icon"]["tmp_name"]),
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

            // 2. Upload metadata to IPFS
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

            // 3. Fetch sync seed
            $seed = call_backend("/sync-seed", "POST");

            // Redirect to confirmation page with GET parameters
            $redirect_params = [
                "seed" => $seed,
                "pump_mint" => $pump_mint,
                "name" => $game_name,
                "symbol" => $game_symbol,
                "game_url" => $game_url,
                "icon_url" => $icon_url,
                "short_desc" => $short_desc,
                "metadata_url" => $metadata_url,
            ];

            header(
                "Location: /sync-launch-confirm?" .
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

$title = "ivy | sync launch";
$description = "Launch your game synced to a Pump.fun token on Ivy";
require_once __DIR__ . "/../includes/header.php";
?>

<main class="py-8">
    <div class="mx-auto max-w-2xl px-6">
        <!-- Header -->
        <h1 class="text-3xl font-bold mb-2 text-center">Launch Synced Game</h1>
        <p class="text-center text-zinc-400 mb-8">Connect your game to an existing Pump.fun token</p>

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

        <!-- Info Box -->
        <div class="border-2 border-blue-400 bg-blue-950/50 p-4 mb-6">
            <div class="flex items-start gap-2">
                <?php echo icon("info", "h-5 w-5 text-blue-400 mt-0.5"); ?>
                <div class="text-sm">
                    <p class="font-bold text-blue-400 mb-1">What is a Synced Game?</p>
                    <p class="text-blue-300">A synced game uses an existing Pump.fun token as its currency. Players can use the Pump.fun token directly in your game, creating a unified economy.</p>
                </div>
            </div>
        </div>

        <!-- Form -->
        <form id="uploadForm" method="POST" action="/sync-launch" enctype="multipart/form-data" class="border-4 border-emerald-400 p-6">
            <div class="space-y-6">
                <!-- Pump.fun Mint Address -->
                <div>
                    <label for="pump_mint" class="block mb-2 font-bold">
                        Pump.fun Token Address <span class="text-red-500">*</span>
                    </label>
                    <input type="text" id="pump_mint" name="pump_mint"
                        value="<?php echo htmlspecialchars($pump_mint); ?>"
                        class="w-full bg-emerald-950 border-2 border-emerald-400 p-3 font-mono text-sm"
                        placeholder="Enter Pump.fun token mint address (e.g., 7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr)"
                        pattern="[1-9A-HJ-NP-Za-km-z]{32,44}"
                        title="Must be a valid Solana address" required>
                    <p class="text-xs text-zinc-400 mt-1">The mint address of the Pump.fun token you want to sync with</p>
                </div>

                <!-- Name and Symbol in two-column layout -->
                <div>
                    <label for="game_name" class="block mb-2 font-bold">Game Name <span class="text-red-500">*</span></label>
                    <input type="text" id="game_name" name="game_name"
                        value="<?php echo htmlspecialchars($game_name); ?>"
                        class="w-full bg-emerald-950 border-2 border-emerald-400 p-3"
                        placeholder="Enter game name" required>
                </div>

                <div>
                    <label for="game_symbol" class="block mb-2 font-bold">Game Symbol <span class="text-red-500">*</span></label>
                    <input type="text" id="game_symbol" name="game_symbol"
                        value="<?php echo htmlspecialchars($game_symbol); ?>"
                        class="w-full bg-emerald-950 border-2 border-emerald-400 p-3 uppercase"
                        placeholder="GAME" maxlength="10" minlength="2" pattern="[A-Z0-9]{2,10}"
                        title="Must be 2-10 uppercase letters or numbers" required
                        oninput="this.value = this.value.toUpperCase()">
                    <p class="text-xs text-zinc-400 mt-1">This is your game's identifier, separate from the Pump.fun token symbol</p>
                </div>

                <!-- URL -->
                <div>
                    <label for="game_url" class="block mb-2 font-bold">Game URL <span class="text-red-500">*</span></label>
                    <input type="url" id="game_url" name="game_url"
                        value="<?php echo htmlspecialchars($game_url); ?>"
                        class="w-full bg-emerald-950 border-2 border-emerald-400 p-3"
                        placeholder="https://yourgame.com" required>
                </div>

                <!-- Description -->
                <div>
                    <label for="game_description" class="block mb-2 font-bold">Description</label>
                    <textarea id="game_description" name="game_description" rows="4"
                        class="w-full bg-emerald-950 border-2 border-emerald-400 p-3"
                        placeholder="Describe your game and how it uses the Pump.fun token..."><?php echo htmlspecialchars(
                            $game_description,
                        ); ?></textarea>
                </div>

                <!-- Icon -->
                <div>
                    <label for="game_icon" class="block mb-2 font-bold">Game Icon <span class="text-red-500">*</span></label>
                    <div id="icon-dropzone" class="border-2 border-dashed border-emerald-400 p-4 text-center h-40 flex flex-col items-center justify-center relative cursor-pointer hover:border-emerald-300">
                        <div id="icon-placeholder" class="flex flex-col items-center pointer-events-none">
                            <?php echo icon(
                                "image-plus",
                                "h-10 w-10 text-emerald-400 mb-2",
                            ); ?>
                            <p class="mb-1 font-medium">Upload Game Icon</p>
                        </div>
                        <img id="icon-preview" src="#" alt="Game icon preview" class="hidden h-32 w-32 object-contain"/>
                        <input type="file" id="game_icon" name="game_icon"
                            accept="image/*"
                            class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            aria-label="Upload Game Icon" required>
                    </div>
                    <p id="icon-filename" class="text-xs text-gray-400 mt-1 truncate"></p>
                </div>
            </div>

            <!-- Submit Button -->
            <div class="flex justify-center mt-6 pt-6 border-t-2 border-emerald-400/30">
                <button id="submitButton" type="submit"
                        class="px-8 py-3 font-bold text-lg flex items-center gap-2
                               bg-emerald-400 hover:bg-emerald-300 text-emerald-950 cursor-pointer
                               disabled:bg-emerald-400/50 disabled:cursor-not-allowed disabled:hover:bg-emerald-400/50"
                        disabled>
                    <?php echo icon("link", "h-5 w-5"); ?>
                    Sync Game to Token
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

        // Add event listeners to all required form fields
        document.querySelectorAll('#uploadForm input[required], #uploadForm textarea[required]').forEach(element => {
            element.addEventListener('input', checkFormValidity);
            element.addEventListener('change', checkFormValidity);
        });

        // Check form validity on page load
        document.addEventListener('DOMContentLoaded', checkFormValidity);
    </script>
</main>

<?php require_once __DIR__ . "/../includes/footer.php"; ?>
