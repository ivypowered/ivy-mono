<?php
/**
 * ivy-frontend/public/about.php
 * Provides an about page for the service
 */

// Include API
require_once __DIR__ . "/../includes/api.php";
require_once __DIR__ . "/../includes/fmt.php";

// Get global info from aggregator
$global_info = call_aggregator("/global-info");

// Include header
require_once __DIR__ . "/../includes/header.php";
?>

<main class="py-8">
    <div class="mx-auto max-w-7xl px-6">
        <!-- Hero Section -->
        <section class="mt-20 mb-40 text-center">
                <h1 class="mb-6 text-5xl font-bold leading-tight">
                    <span class="bg-emerald-400 text-emerald-950 px-3">ivy</span>
                    — where games come to life
                </h1>
                <p class="mx-auto mb-10 max-w-2xl text-xl text-zinc-300">
                    A home for web games and their digital economies. Play, earn, buy, and sell, all in one place.
                </p>
                <div class="mb-8 flex flex-wrap justify-center gap-6">
                    <div class="border-2 border-emerald-400 p-6 min-w-[200px]">
                        <div class="text-sm text-emerald-400">games listed</div>
                        <div class="text-3xl font-bold"><?php echo number_format(
                            $global_info["games_listed"]
                        ); ?></div>
                    </div>
                    <div class="border-2 border-emerald-400 p-6 min-w-[200px]">
                        <div class="text-sm text-emerald-400">total value locked</div>
                        <div class="text-3xl font-bold">$<?php echo fmt_number_short(
                            $global_info["tvl"]
                        ); ?></div>
                    </div>
                    <div class="border-2 border-emerald-400 p-6 min-w-[200px]">
                        <div class="text-sm text-emerald-400">24h volume</div>
                        <div class="text-3xl font-bold">$<?php echo fmt_number_short(
                            $global_info["volume_24h"]
                        ); ?></div>
                    </div>
                </div>
        </section>

        <!-- How It Works Section -->
        <section class="mb-40">
            <div class="mb-10 text-center">
                <h2 class="text-3xl font-bold mb-4">how ivy works</h2>
            </div>

            <div class="grid gap-8 md:grid-cols-3">
                <div class="border-2 border-emerald-400 p-6 flex flex-col items-center text-center">
                    <div class="mb-4 bg-emerald-400 p-4 rounded-none">
                        <?php echo icon(
                            "gamepad-2",
                            "h-10 w-10 text-emerald-950"
                        ); ?>
                    </div>
                    <h3 class="text-xl font-bold mb-2">anyone can upload</h3>
                    <p class="text-zinc-300">Export your HTML5 game and submit its URL - that's all you need to publish a game on Ivy. No complex integration needed.</p>
                </div>

                <div class="border-2 border-emerald-400 p-6 flex flex-col items-center text-center">
                    <div class="mb-4 bg-emerald-400 p-4 rounded-none">
                        <?php echo icon(
                            "coins",
                            "h-10 w-10 text-emerald-950"
                        ); ?>
                    </div>
                    <h3 class="text-xl font-bold mb-2">each game has a currency</h3>
                    <p class="text-zinc-300">Each game has its own digital currency. Earn it by playing and spend it on in-game items. Buy and sell game currency for real-world value.</p>
                </div>

                <div class="border-2 border-emerald-400 p-6 flex flex-col items-center text-center">
                    <div class="mb-4 bg-emerald-400 p-4 rounded-none">
                        <?php echo icon(
                            "piggy-bank",
                            "h-10 w-10 text-emerald-950"
                        ); ?>
                    </div>
                    <h3 class="text-xl font-bold mb-2">creators earn</h3>
                    <p class="text-zinc-300">Developers earn 50% of all transaction fees when players trade game currencies; the other 50% is converted to IVY and burned.</p>
                </div>
            </div>
        </section>

        <!-- CTA Section -->
        <section class="mb-8">
            <div class="border-4 border-emerald-400 p-10 text-center">
                <h2 class="text-3xl font-bold mb-4">enter the future of gaming</h2>
                <p class="mx-auto mb-8 max-w-2xl text-zinc-300">Join other creators and players in the Ivy ecosystem today.</p>
                <div class="flex flex-wrap justify-center gap-4">
                    <a href="/upload" class="rounded-none bg-emerald-400 text-emerald-950 hover:bg-emerald-300 font-bold px-8 py-3 text-lg w-full sm:w-auto">
                        upload your game
                    </a>
                    <a href="/" class="rounded-none border-2 border-emerald-400 text-emerald-400 hover:bg-emerald-400 hover:text-emerald-950 font-bold px-8 py-3 text-lg w-full sm:w-auto">
                        start playing
                    </a>
                </div>
            </div>
        </section>
    </div>
</main>

<?php require_once __DIR__ . "/../includes/footer.php";
?>
