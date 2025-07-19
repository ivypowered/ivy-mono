<?php
/**
 * ivy-frontend/public/about_new.php
 * The new About page for Ivy: Web3 games, radically simplified.
 */

require_once __DIR__ . "/../includes/api.php";
require_once __DIR__ . "/../includes/fmt.php";

// Example stats (replace with real data as needed)
$global_info = [
    "games_listed" => 0,
    "tvl" => 0,
    "volume_24h" => 0,
];

$title = "ivy | about";
$description =
    "Web3 games, radically simplified. Build, play, and earn with Ivy.";
require_once __DIR__ . "/../includes/header.php";
?>

<main class="pt-8" style="background-image: url('/assets/images/ivy-background.webp');">
    <div class="mx-auto max-w-7xl px-6">
        <!-- Hero Section -->
        <section class="pt-20 pb-60 mb-20 text-center">
            <h1 class="mb-6 text-5xl font-bold leading-tight">
                <span class="bg-emerald-400 text-emerald-950 px-3">ivy</span>
                — web3 games, radically simplified
            </h1>
            <p class="mx-auto mb-10 max-w-2xl text-xl text-zinc-300">
                Ivy is the easiest way to build, launch, and play Web3 games. For the first time, anyone can create a blockchain-powered game in a weekend—no smart contracts, no complex SDKs, no lock-in.
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
    </div>
</main>

<main class="pb-8">
    <div class="mx-auto max-w-7xl px-6">
        <!-- Value Proposition Section -->
        <section class="mb-24">
            <div class="mb-10 text-center">
                <h2 class="text-3xl font-bold mb-4">why ivy?</h2>
                <p class="mx-auto max-w-2xl text-zinc-300">
                    Web3 gaming has been too complex for too long. Ivy changes that by reducing blockchain integration to its essentials: deposits, withdrawals, and wallet authentication. No more wrestling with smart contracts or proprietary SDKs—just a simple REST API that works with any engine, any language, anywhere.
                </p>
            </div>
            <div class="grid gap-8 md:grid-cols-3">
                <div class="border-2 border-emerald-400 p-6 flex flex-col items-center text-center">
                    <div class="mb-4 bg-emerald-400 p-4 rounded-none">
                        <?php echo icon(
                            "gamepad-2",
                            "h-10 w-10 text-emerald-950"
                        ); ?>
                    </div>
                    <h3 class="text-xl font-bold mb-2">for developers</h3>
                    <p class="text-zinc-300">
                        Build and launch a Web3 game in hours, not months. Ivy’s minimal, language-agnostic API means you can use any engine or stack—no blockchain expertise required. Focus on your game, not the infrastructure.
                    </p>
                </div>
                <div class="border-2 border-emerald-400 p-6 flex flex-col items-center text-center">
                    <div class="mb-4 bg-emerald-400 p-4 rounded-none">
                        <?php echo icon(
                            "coins",
                            "h-10 w-10 text-emerald-950"
                        ); ?>
                    </div>
                    <h3 class="text-xl font-bold mb-2">for players</h3>
                    <p class="text-zinc-300">
                        Discover, play, and earn in a new generation of games. Every game on Ivy has its own token—earn by playing, spend on in-game items, or trade for real value. Your progress, your rewards, your wallet.
                    </p>
                </div>
                <div class="border-2 border-emerald-400 p-6 flex flex-col items-center text-center">
                    <div class="mb-4 bg-emerald-400 p-4 rounded-none">
                        <?php echo icon(
                            "trending-up",
                            "h-10 w-10 text-emerald-950"
                        ); ?>
                    </div>
                    <h3 class="text-xl font-bold mb-2">for investors</h3>
                    <p class="text-zinc-300">
                        Ivy is the first platform to make Web3 gaming accessible to indie developers at scale. Our marketplace and token launchpad create real, sustainable value—50% of all trading fees go to creators, 50% are burned, driving long-term scarcity and growth.
                    </p>
                </div>
            </div>
        </section>

        <!-- How It Works Section -->
        <section class="mb-40">
            <div class="mb-10 text-center">
                <h2 class="text-3xl font-bold mb-4">how it works</h2>
            </div>
            <div class="grid gap-8 md:grid-cols-3">
                <div class="border-2 border-emerald-400 p-6 flex flex-col items-center text-center">
                    <div class="mb-4 bg-emerald-400 p-4 rounded-none">
                        <?php echo icon(
                            "upload-cloud",
                            "h-10 w-10 text-emerald-950"
                        ); ?>
                    </div>
                    <h3 class="text-xl font-bold mb-2">upload your game</h3>
                    <p class="text-zinc-300">
                        Export your HTML5 game and submit its URL. No complex integration, no gatekeeping—just launch.
                    </p>
                </div>
                <div class="border-2 border-emerald-400 p-6 flex flex-col items-center text-center">
                    <div class="mb-4 bg-emerald-400 p-4 rounded-none">
                        <?php echo icon("key", "h-10 w-10 text-emerald-950"); ?>
                    </div>
                    <h3 class="text-xl font-bold mb-2">add web3 in minutes</h3>
                    <p class="text-zinc-300">
                        Use Ivy’s REST API for deposits, withdrawals, and wallet authentication. No smart contracts, no blockchain headaches.
                    </p>
                </div>
                <div class="border-2 border-emerald-400 p-6 flex flex-col items-center text-center">
                    <div class="mb-4 bg-emerald-400 p-4 rounded-none">
                        <?php echo icon("zap", "h-10 w-10 text-emerald-950"); ?>
                    </div>
                    <h3 class="text-xl font-bold mb-2">launch & grow</h3>
                    <p class="text-zinc-300">
                        Instantly list on the Ivy Marketplace. Your game gets its own token, tradable by players along a bonding curve. Earn as your community grows.
                    </p>
                </div>
            </div>
        </section>

        <!-- CTA Section -->
        <section class="mb-8">
            <div class="border-4 border-emerald-400 p-10 text-center">
                <h2 class="text-3xl font-bold mb-4">ready to build the future of gaming?</h2>
                <p class="mx-auto mb-8 max-w-2xl text-zinc-300">
                    Whether you’re a developer, player, or investor, Ivy is your gateway to the next era of gaming. Join us and help shape a world where anyone can build, play, and earn.
                </p>
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

<?php require_once __DIR__ . "/../includes/footer.php"; ?>
