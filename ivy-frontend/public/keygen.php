<?php
/**
 * ivy-frontend/public/keygen.php
 *
 * Simple public/private key generator utility.
 */

$title = "ivy | keygen";
$description = "Generate a Solana keypair on Ivy, where games come to life";
require_once __DIR__ . "/../includes/header.php";
require_once __DIR__ . "/../includes/icon.php";
?>

<main class="py-8">
    <div class="mx-auto max-w-4xl px-6">
        <h1 class="text-3xl font-bold mb-2 text-white">Keygen</h1>

        <div class="border-b-2 border-emerald-400 mb-8"></div>

        <div id="key-display" class="mb-6">
            <div class="mb-6">
                <h2 class="text-xl font-bold text-emerald-400 mb-2">Public Key</h2>
                <div class="bg-zinc-900/70 border-2 border-zinc-700 p-4 rounded-none overflow-x-auto">
                    <code id="public-key" class="font-mono text-zinc-300 break-all"></code>
                </div>
            </div>

            <div class="mb-6">
                <h2 class="text-xl font-bold text-emerald-400 mb-2">Private Key</h2>
                <div class="bg-zinc-900/70 border-2 border-zinc-700 p-4 rounded-none overflow-x-auto">
                    <code id="private-key" class="font-mono text-zinc-300 break-all"></code>
                </div>
            </div>
        </div>

        <p class="text-zinc-300 mb-6">All keypairs are generated on your computer and are not sent over the Internet.</p>

        <button id="generate-btn" class="rounded-none bg-emerald-400 text-emerald-950 px-6 py-3 font-bold text-lg hover:bg-emerald-300 flex items-center gap-2">
            <?php echo icon("key", "h-5 w-5"); ?>
            Generate
        </button>
    </div>
</main>

<script>
    document.getElementById('generate-btn').addEventListener('click', () => {
        const { public, private } = window.keygen();
        document.getElementById('public-key').textContent = public;
        document.getElementById('private-key').textContent = private;
    });
</script>

<?php require_once __DIR__ . "/../includes/footer.php"; ?>
