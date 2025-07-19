<?php
/**
 * ivy-frontend/public/about_new.php
 * A refreshed about page for Ivy, capturing the unique value proposition
 * for game players, developers, and investors.
 */

// Include API
require_once __DIR__ . "/../includes/api.php";
require_once __DIR__ . "/../includes/fmt.php";

// Get global info from aggregator (assuming this is available; update as needed)
$global_info = [
    "games_listed" => 0, // Replace with real data if available
    "tvl" => 0,
    "volume_24h" => 0,
    "developers" => 0, // Hypothetical; add real metrics
    "players" => 0,
];

// Include header
$title = "ivy | about us";
$description =
    "Ivy makes Web3 game development radically simple. Build, launch, and monetize in a weekend.";
require_once __DIR__ . "/../includes/header.php";
?>

<main class="pt-8" style="background-image: url('/assets/images/ivy-background.webp');">
    <div class="mx-auto max-w-7xl px-6">
        <!-- Hero Section -->
        <section class="pt-20 pb-60 mb-20 text-center">
            <h1 class="mb-6 text-5xl font-bold leading-tight">
                <span class="bg-emerald-400 text-emerald-950 px-3">ivy</span>
                — radically simple Web3 gaming
            </h1>
            <p class="mx-auto mb-10 max-w-2xl text-xl text-zinc-300">
                Building Web3 games is hard. Ivy makes it easy. Our simple REST API handles deposits, withdrawals, and wallet authentication, so you can focus on creating fun games. Launch on our marketplace, reach players instantly, and share in the revenue.
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
            <a href="/upload" class="rounded-none bg-emerald-400 text-emerald-950 hover:bg-emerald-300 font-bold px-8 py-3 text-lg">
                start building today
            </a>
        </section>
    </div>
</main>

<main class="pb-8">
    <div class="mx-auto max-w-7xl px-6">
        <!-- Value Proposition Sections -->
        <section class="mb-40">
            <div class="mb-10 text-center">
                <h2 class="text-3xl font-bold mb-4">ivy for everyone</h2>
                <p class="text-zinc-300">Whether you're a developer, player, or investor, Ivy empowers you to thrive in Web3 gaming.</p>
            </div>
            <div class="grid gap-8 md:grid-cols-3">
                <div class="border-2 border-emerald-400 p-6 flex flex-col items-center text-center">
                    <div class="mb-4 bg-emerald-400 p-4 rounded-none">
                        <?php echo icon(
                            "code",
                            "h-10 w-10 text-emerald-950"
                        ); ?>
                    </div>
                    <h3 class="text-xl font-bold mb-2">for developers</h3>
                    <p class="text-zinc-300">Build Web3 games in a weekend with our minimal REST API. No complex SDKs or engine lock-in—just deposits, withdrawals, and authentication. Launch on Ivy Marketplace and earn 50% of trading fees.</p>
                </div>
                <div class="border-2 border-emerald-400 p-6 flex flex-col items-center text-center">
                    <div class="mb-4 bg-emerald-400 p-4 rounded-none">
                        <?php echo icon(
                            "gamepad-2",
                            "h-10 w-10 text-emerald-950"
                        ); ?>
                    </div>
                    <h3 class="text-xl font-bold mb-2">for players</h3>
                    <p class="text-zinc-300">Discover, play, and earn in a vibrant ecosystem. Trade game tokens on bonding curves, own your assets, and get rewarded with 50% of trading fees. Seamless wallet integration for real ownership.</p>
                </div>
                <div class="border-2 border-emerald-400 p-6 flex flex-col items-center text-center">
                    <div class="mb-4 bg-emerald-400 p-4 rounded-none">
                        <?php echo icon(
                            "trending-up",
                            "h-10 w-10 text-emerald-950"
                        ); ?>
                    </div>
                    <h3 class="text-xl font-bold mb-2">for investors</h3>
                    <p class="text-zinc-300">Tap into explosive growth with IVY tokenomics. Fees fuel burns and rewards, creating scarcity. Back indie hits early via our launch platform—the highest revenue share in the industry.</p>
                </div>
            </div>
        </section>

        <!-- Features Section -->
        <section class="mb-40">
            <div class="mb-10 text-center">
                <h2 class="text-3xl font-bold mb-4">why choose ivy?</h2>
                <p class="text-zinc-300">Minimalism meets power: Inspired by Unix philosophy, we provide the essentials for maximum flexibility.</p>
            </div>
            <div class="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
                <div class="border-2 border-emerald-400 p-6 text-center">
                    <div class="mb-4"><?php echo icon(
                        "zap",
                        "h-8 w-8 mx-auto text-emerald-400"
                    ); ?></div>
                    <h3 class="text-lg font-bold mb-2">radically simple api</h3>
                    <p class="text-zinc-300">Blockchain as an abstraction—handle Web3 in any language or engine.</p>
                </div>
                <div class="border-2 border-emerald-400 p-6 text-center">
                    <div class="mb-4"><?php echo icon(
                        "rocket",
                        "h-8 w-8 mx-auto text-emerald-400"
                    ); ?></div>
                    <h3 class="text-lg font-bold mb-2">instant launches</h3>
                    <p class="text-zinc-300">Upload, integrate, and go live in hours. Reach players worldwide.</p>
                </div>
                <div class="border-2 border-emerald-400 p-6 text-center">
                    <div class="mb-4"><?php echo icon(
                        "dollar-sign",
                        "h-8 w-8 mx-auto text-emerald-400"
                    ); ?></div>
                    <h3 class="text-lg font-bold mb-2">fair revenue share</h3>
                    <p class="text-zinc-300">1% fee on trades: 50% to devs, 50% to users. No one gets more.</p>
                </div>
                <div class="border-2 border-emerald-400 p-6 text-center">
                    <div class="mb-4"><?php echo icon(
                        "shield",
                        "h-8 w-8 mx-auto text-emerald-400"
                    ); ?></div>
                    <h3 class="text-lg font-bold mb-2">secure by design</h3>
                    <p class="text-zinc-300">Standard on-chain components—no custom smart contracts needed.</p>
                </div>
            </div>
        </section>

        <!-- CTA Section -->
        <section class="mb-8">
            <div class="border-4 border-emerald-400 p-10 text-center">
                <h2 class="text-3xl font-bold mb-4">join the ivy revolution</h2>
                <p class="mx-auto mb-8 max-w-2xl text-zinc-300">Empower indie devs, reward players, and grow with Web3's simplest platform.</p>
                <div class="flex flex-wrap justify-center gap-4">
                    <a href="/upload" class="rounded-none bg-emerald-400 text-emerald-950 hover:bg-emerald-300 font-bold px-8 py-3 text-lg w-full sm:w-auto">
                        build your game
                    </a>
                    <a href="/" class="rounded-none border-2 border-emerald-400 text-emerald-400 hover:bg-emerald-400 hover:text-emerald-950 font-bold px-8 py-3 text-lg w-full sm:w-auto">
                        start playing
                    </a>
                    <a href="/token" class="rounded-none border-2 border-emerald-400 text-emerald-400 hover:bg-emerald-400 hover:text-emerald-950 font-bold px-8 py-3 text-lg w-full sm:w-auto">
                        learn about ivy token
                    </a>
                </div>
            </div>
        </section>
    </div>
</main>

<?php require_once __DIR__ . "/../includes/footer.php"; ?>
