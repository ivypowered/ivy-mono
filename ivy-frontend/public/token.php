<?php
/**
 * ivy-frontend/public/token.php
 *
 * Displays the IVY token swap interface.
 */

// Call backend API to get the creation timestamp of the IVY world
require_once __DIR__ . "/../includes/api.php";

$has_error = false;
$error_message = "";

try {
    $ivy_info = call_aggregator("/ivy/info");
    $ivy_info_base64 = base64_encode(json_encode($ivy_info));
} catch (Exception $e) {
    $has_error = true;
    $error_message = $e->getMessage();
}

// Include the header
$title = "ivy | token";
$description = "Trade IVY, the native token of the Ivy protocol";
require_once __DIR__ . "/../includes/header.php";
?>

<?php if ($has_error): ?>
    <div class="mx-auto max-w-7xl px-6 py-8">
        <div class="border-2 border-red-400 bg-red-950/50 p-6 mb-8 text-center">
            <p class="text-red-400 font-bold text-xl mb-2">Token Interface Error</p>
            <p class="text-red-200"><?php echo htmlspecialchars(
                $error_message
            ); ?></p>
        </div>
    </div>
<?php endif; ?>

<div id="ivy-token" <?php echo !$has_error
    ? 'data-info="' . htmlspecialchars($ivy_info_base64) . '"'
    : ""; ?>>

        <!-- Skeleton -->
        <div id="game-skeleton">

        </div>
        <style>
            #game-skeleton {
                height: 1143px;
            }
            @media (min-width: 1024px) {
                #game-skeleton {
                    height: 616px;
                }
            }
        </style>
    </div>

<?php require_once __DIR__ . "/../includes/footer.php"; ?>
