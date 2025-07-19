<?php
/**
 * ivy-frontend/public/about_new_final.php
 *
 * The definitive "About" page, synthesizing the best elements of all prototypes
 * to tell a compelling story for players, developers, and investors.
 */

// ---------------------------------------------------------------------
// 1.  Data & helpers
// ---------------------------------------------------------------------
require_once __DIR__ . "/../includes/api.php";
require_once __DIR__ . "/../includes/fmt.php";

/*
// Example aggregator call (uncomment when available)
$global_info = call_aggregator("/global-info");
*/
$global_info = [
    "games_listed" => 0,
    "tvl" => 0,
    "volume_24h" => 0,
];

// ---------------------------------------------------------------------
// 2.  Meta tags
// ---------------------------------------------------------------------
$title = "About Ivy | Web3 Gaming, Radically Simplified";
$description =
    "Build Web3 games in a weekend, not months. Ivy's simple REST API handles all blockchain complexity so you can focus on making great games.";
require_once __DIR__ . "/../includes/header.php";
?>

<!-- ------------------------------------------------------------------
     HERO SECTION
     - Combines the visual style of the original with the punchy copy
       of the newer versions and the stats for social proof.
------------------------------------------------------------------- -->
<main class="pt-16" style="background-image:url('/assets/images/ivy-background.webp')">
    <div class="mx-auto max-w-7xl px-6">
        <section class="pt-24 pb-36 text-center">
            <h1 class="mb-6 text-6xl font-black leading-tight">
                <span class="bg-emerald-400 text-emerald-950 px-4">Web3&nbsp;Gaming,</span>
                Radically&nbsp;Simplified
            </h1>
            <p class="mx-auto mb-12 max-w-3xl text-xl text-zinc-300">
                Stop wrestling with complex SDKs and smart contracts. Ivy provides a simple REST API that works with any language, any engine, anywhere. Launch your game in a weekend.
            </p>

            <!-- Global Numbers -->
            <div class="flex flex-wrap justify-center gap-8">
                <div class="min-w-[220px] border-2 border-emerald-400 p-6">
                    <div class="text-sm text-emerald-400 uppercase tracking-wide">games listed</div>
                    <div class="text-3xl font-bold"><?= number_format(
                        $global_info["games_listed"]
                    ) ?></div>
                </div>
                <div class="min-w-[220px] border-2 border-emerald-400 p-6">
                    <div class="text-sm text-emerald-400 uppercase tracking-wide">total value locked</div>
                    <div class="text-3xl font-bold">$<?= fmt_number_short(
                        $global_info["tvl"]
                    ) ?></div>
                </div>
                <div class="min-w-[220px] border-2 border-emerald-400 p-6">
                    <div class="text-sm text-emerald-400 uppercase tracking-wide">24h volume</div>
                    <div class="text-3xl font-bold">$<?= fmt_number_short(
                        $global_info["volume_24h"]
                    ) ?></div>
                </div>
            </div>
        </section>
    </div>
</main>

<main class="pb-10">
    <!-- ------------------------------------------------------------------
         PHILOSOPHY SECTION
         - From about_new2.php, this is the strongest proof for developers.
    ------------------------------------------------------------------- -->
    <section class="py-20 px-6">
        <div class="mx-auto max-w-4xl text-center">
            <h2 class="mb-4 text-3xl font-bold">Our Philosophy: Worse is Better</h2>
            <p class="text-lg text-zinc-300 mb-8">
                Ivy embraces the Unix philosophy. We provide the minimal interface for Web3 gaming—deposits,
                withdrawals, and authentication. This simplicity enables maximum flexibility and zero lock-in.
            </p>
            <div class="inline-block bg-zinc-900 border border-emerald-500/20 p-6 text-left">
                <code class="text-emerald-400 text-sm whitespace-pre">
GET    /verify?game={...}&msg={...}&sig={...}
GET    /api/games/{game}/deposits/{id}
POST   /api/games/{game}/withdrawals/{id}
                </code>
            </div>
            <p class="mt-4 text-sm text-zinc-400">That's it. The entire core API.</p>
        </div>
    </section>

    <!-- ------------------------------------------------------------------
         COMPARISON SECTION
         - From about_new2.php, a confident and direct value proposition.
    ------------------------------------------------------------------- -->
    <section class="py-20 bg-zinc-900/50">
        <div class="mx-auto max-w-7xl px-6">
            <h2 class="text-center mb-12 text-4xl font-bold">The Ivy Difference</h2>

            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse" style="border-spacing: 0;">
                    <thead>
                        <tr>
                            <th class="p-4 bg-emerald-500/10 w-1/4"></th>
                            <th class="p-4 bg-emerald-500/10 text-emerald-400 text-lg">Ivy</th>
                            <th class="p-4 text-zinc-400 text-lg">Traditional Web3 Platforms</th>
                        </tr>
                    </thead>
                    <tbody class="border border-emerald-500/20">
                        <tr>
                            <td class="p-4 font-semibold border-t border-emerald-500/20">Technology</td>
                            <td class="p-4 text-emerald-400 border-t border-emerald-500/20">Simple REST API</td>
                            <td class="p-4 text-zinc-400 border-t border-emerald-500/20">Complex SDKs</td>
                        </tr>
                        <tr class="bg-zinc-900/30">
                            <td class="p-4 font-semibold">Engine / Language</td>
                            <td class="p-4 text-emerald-400">Any</td>
                            <td class="p-4 text-zinc-400">Locked to supported platforms</td>
                        </tr>
                        <tr>
                            <td class="p-4 font-semibold">Integration Time</td>
                            <td class="p-4 text-emerald-400">Hours to days</td>
                            <td class="p-4 text-zinc-400">Weeks to months</td>
                        </tr>
                        <tr class="bg-zinc-900/30">
                            <td class="p-4 font-semibold">Developer Rev Share</td>
                            <td class="p-4 text-emerald-400">50% of trading fees</td>
                            <td class="p-4 text-zinc-400">Varies, typically lower</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </section>

    <!-- ------------------------------------------------------------------
         THREE AUDIENCES SECTION
         - Using the clear structure from about_new3.php.
    ------------------------------------------------------------------- -->
    <section class="py-24">
        <div class="mx-auto max-w-7xl px-6">
            <div class="mb-16 text-center">
                <h2 class="text-4xl font-bold mb-4">An Ecosystem for Everyone</h2>
                <p class="mx-auto max-w-2xl text-zinc-300">Whether you build, play, or invest, Ivy's simple design creates value for you.</p>
            </div>
            <div class="grid gap-8 md:grid-cols-3">
                <!-- FOR DEVELOPERS -->
                <div class="border-2 border-emerald-400 p-8 flex flex-col items-center text-center">
                    <div class="mb-4 bg-emerald-400 p-4"><?= icon(
                        "code-2",
                        "h-10 w-10 text-emerald-950"
                    ) ?></div>
                    <h3 class="text-xl font-bold mb-2">For Developers</h3>
                    <p class="text-zinc-300">Build Web3 games in a weekend with a minimal REST API. No complex SDKs or engine lock-in. Launch on the Ivy Marketplace and earn 50% of all trading fees from your game's token.</p>
                </div>
                <!-- FOR PLAYERS -->
                <div class="border-2 border-emerald-400 p-8 flex flex-col items-center text-center">
                    <div class="mb-4 bg-emerald-400 p-4"><?= icon(
                        "gamepad-2",
                        "h-10 w-10 text-emerald-950"
                    ) ?></div>
                    <h3 class="text-xl font-bold mb-2">For Players</h3>
                    <p class="text-zinc-300">Discover, play, and earn in a vibrant ecosystem. Every game has its own token. Earn it by playing, trade it on the marketplace, and own your progress with a wallet you control.</p>
                </div>
                <!-- FOR INVESTORS -->
                <div class="border-2 border-emerald-400 p-8 flex flex-col items-center text-center">
                    <div class="mb-4 bg-emerald-400 p-4"><?= icon(
                        "trending-up",
                        "h-10 w-10 text-emerald-950"
                    ) ?></div>
                    <h3 class="text-xl font-bold mb-2">For Investors</h3>
                    <p class="text-zinc-300">Tap into the long-tail of indie games. Ivy's fee structure (0.5% to dev, 0.5% burned) creates a deflationary pressure on the IVY token, aligning platform growth with token value.</p>
                </div>
            </div>
        </section>


    <!-- ------------------------------------------------------------------
         MARKETPLACE / REVENUE FLOW
         - From about_new2.php, visually explains the economics.
    ------------------------------------------------------------------- -->
    <section class="py-20">
        <div class="mx-auto max-w-7xl px-6">
            <div class="grid gap-12 lg:grid-cols-2 items-center">
                <div>
                    <h2 class="mb-6 text-4xl font-bold">The Ivy Marketplace</h2>
                    <p class="mb-6 text-lg text-zinc-300">
                       Launch your game's token in a click. Ivy provides instant liquidity via a bonding curve, so you can focus on building your community, not on managing liquidity pools.
                    </p>
                     <ul class="space-y-4 text-zinc-200">
                        <li class="flex items-start gap-3"><?= icon(
                            "check",
                            "h-5 w-5 text-emerald-400 flex-shrink-0 mt-1"
                        ) ?><span><strong>Highest Revenue Share:</strong> 50% of trading fees go directly to you.</span></li>
                        <li class="flex items-start gap-3"><?= icon(
                            "check",
                            "h-5 w-5 text-emerald-400 flex-shrink-0 mt-1"
                        ) ?><span><strong>Ecosystem Growth:</strong> 50% of fees buy & burn IVY, creating value for everyone.</span></li>
                        <li class="flex items-start gap-3"><?= icon(
                            "check",
                            "h-5 w-5 text-emerald-400 flex-shrink-0 mt-1"
                        ) ?><span><strong>Instant Reach:</strong> Tap into Ivy's growing community of Web3 players and investors.</span></li>
                    </ul>
                </div>
                <div class="border-2 border-emerald-400/50 p-8">
                    <h3 class="text-2xl font-bold mb-6 text-center">Revenue Flow (1% Fee)</h3>
                    <div class="space-y-4">
                        <div class="bg-zinc-800/50 p-4">
                            <div class="text-sm text-zinc-400 mb-1">Player trades 1,000 tokens</div>
                            <div class="text-lg">Fee Collected: 10 tokens</div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div class="bg-emerald-500/10 border border-emerald-500/30 p-4 text-center">
                                <div class="text-2xl font-bold text-emerald-400">5 tokens</div>
                                <div class="text-sm text-zinc-300">To Developer</div>
                                <div class="text-xs text-zinc-400">(0.5% of trade)</div>
                            </div>
                            <div class="bg-orange-500/10 border border-orange-500/30 p-4 text-center">
                                <div class="text-2xl font-bold text-orange-400">5 tokens</div>
                                <div class="text-sm text-zinc-300">Buys & Burns IVY</div>
                                <div class="text-xs text-zinc-400">(0.5% of trade)</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- ------------------------------------------------------------------
         CALL TO ACTION
    ------------------------------------------------------------------- -->
    <section class="py-20">
        <div class="mx-auto max-w-7xl px-6">
            <div class="border-4 border-emerald-400 p-14 text-center">
                <h2 class="text-4xl font-bold mb-4">Build the Future of Gaming</h2>
                <p class="mx-auto mb-10 max-w-2xl text-zinc-300">
                    Join the developers choosing simplicity over complexity and flexibility over lock-in.
                </p>
                <div class="flex flex-wrap justify-center gap-4">
                    <a href="/docs" class="bg-emerald-400 text-emerald-950 font-bold px-10 py-3 hover:bg-emerald-300">
                        Start Building
                    </a>
                    <a href="/" class="border-2 border-emerald-400 text-emerald-400 font-bold px-10 py-3 hover:bg-emerald-400 hover:text-emerald-950">
                        Explore Games
                    </a>
                    <a href="https://discord.gg/ge7WyB8tjG" target="_blank" class="border-2 border-emerald-400 text-emerald-400 font-bold px-10 py-3 hover:bg-emerald-400 hover:text-emerald-950">
                        Join Discord
                    </a>
                </div>
            </div>
        </section>
    </div>
</main>

<?php require_once __DIR__ . "/../includes/footer.php"; ?>
