<?php
/**
 * ivy-frontend/public/404.php
 *
 * Custom 404 error page
 */

$title = "ivy | 404";
$description = "We can't find this page on Ivy, where games come to life";
require_once __DIR__ . "/../includes/header.php";
?>

<main class="py-16 flex-grow">
    <div class="mx-auto max-w-2xl px-6 text-center">
        <div class="mb-8">
            <div class="inline-block bg-emerald-400 text-emerald-950 px-4 py-2 text-6xl font-bold">404</div>
        </div>

        <h1 class="text-2xl font-bold mb-6 text-emerald-400">Page Not Found</h1>

        <p class="mb-8 text-zinc-300">The page you're looking for doesn't exist or has been moved.</p>

        <div class="flex justify-center gap-4">
            <a href="/" class="rounded-none border-2 border-emerald-400 text-emerald-400 hover:bg-emerald-400 hover:text-emerald-950 font-bold px-6 py-3">
                Back to Home
            </a>
        </div>
    </div>
</main>

<?php require_once __DIR__ . "/../includes/footer.php";
?>
