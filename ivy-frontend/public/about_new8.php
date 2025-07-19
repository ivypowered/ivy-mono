<?php
/**
 * ivy-frontend/public/about_new_final.php
 * About page that captures Ivy's value proposition for players, developers, and investors
 */

require_once __DIR__ . "/../includes/api.php";
require_once __DIR__ . "/../includes/fmt.php";

// Get global stats (replace with real aggregator call when available)
$global_info = [
    "games_listed" => 127,
    "tvl" => 1834567,
    "volume_24h" => 98234,
];

$title = "ivy | Web3 gaming, radically simplified";
$description =
    "Build a Web3 game in a weekend. Play and earn instantly. Invest in the future of gaming. No lock-in, no complexity, just results.";
require_once __DIR__ . "/../includes/header.php";
?>

<style>
    .gradient-text {
        background: linear-gradient(135deg, #10b981 0%, #34d399 50%, #6ee7b7 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
    }

    .comparison-check { color: #10b981; }
    .comparison-x { color: #ef4444; }
</style>

<!-- Hero Section -->
<main class="pt-8" style="background-image: url('/assets/images/ivy-background.webp');">
    <div class="mx-auto max-w-7xl px-6">
        <section class="pt-20 pb-32 text-center">
            <!-- Punchy headline inspired by about_new4 -->
            <h1 class="mb-6 text-5xl md:text-6xl font-bold leading-tight">
                Hit "Save & Deploy" to <span class="gradient-text">Web3</span>
            </h1>
            <p class="mx-auto mb-12 max-w-3xl text-xl text-zinc-300">
                Ivy reduces blockchain gaming to three REST endpoints. Build in any language,
                launch in any engine, monetize in minutes. This is Web3 gaming, radically simplified.
            </p>

            <!-- Live stats -->
            <div class="mb-12 flex flex-wrap justify-center gap-6">
                <div class="border-2 border-emerald-400 p-6 min-w-[200px] backdrop-blur-sm bg-zinc-900/50">
                    <div class="text-sm text-emerald-400 uppercase tracking-wide">games live</div>
                    <div class="text-3xl font-bold"><?php echo number_format(
                        $global_info["games_listed"]
                    ); ?></div>
                </div>
                <div class="border-2 border-emerald-400 p-6 min-w-[200px] backdrop-blur-sm bg-zinc-900/50">
                    <div class="text-sm text-emerald-400 uppercase tracking-wide">total value locked</div>
                    <div class="text-3xl font-bold">$<?php echo fmt_number_short(
                        $global_info["tvl"]
                    ); ?></div>
                </div>
                <div class="border-2 border-emerald-400 p-6 min-w-[200px] backdrop-blur-sm bg-zinc-900/50">
                    <div class="text-sm text-emerald-400 uppercase tracking-wide">24h volume</div>
                    <div class="text-3xl font-bold">$<?php echo fmt_number_short(
                        $global_info["volume_24h"]
                    ); ?></div>
                </div>
            </div>

            <!-- Primary CTAs -->
            <div class="flex flex-wrap justify-center gap-4">
                <a href="/example-1-cat" class="bg-emerald-400 text-emerald-950 hover:bg-emerald-300 font-bold px-8 py-3 text-lg transition-all">
                    Build Your First Game
                </a>
                <a href="/" class="border-2 border-emerald-400 text-emerald-400 hover:bg-emerald-400 hover:text-emerald-950 font-bold px-8 py-3 text-lg transition-all">
                    Play Now
                </a>
            </div>
        </section>
    </div>
</main>

<main class="pb-8 bg-zinc-950">
    <div class="mx-auto max-w-7xl px-6">

        <!-- Weekend Deploy Checklist (from about_new4) -->
        <section class="py-20 border-b border-zinc-800">
            <h2 class="text-3xl font-bold mb-12 text-center">From idea to Web3 in a weekend</h2>
            <div class="flex flex-col md:flex-row justify-between items-center gap-8 max-w-4xl mx-auto">
                <div class="text-center flex-1">
                    <div class="text-5xl font-mono text-emerald-400 mb-4">1</div>
                    <h3 class="font-bold mb-2">Create game & keypair</h3>
                    <p class="text-zinc-400">30 seconds</p>
                </div>
                <div class="hidden md:block text-3xl text-zinc-600">→</div>
                <div class="text-center flex-1">
                    <div class="text-5xl font-mono text-emerald-400 mb-4">2</div>
                    <h3 class="font-bold mb-2">Add 3 REST endpoints</h3>
                    <p class="text-zinc-400">5 minutes</p>
                </div>
                <div class="hidden md:block text-3xl text-zinc-600">→</div>
                <div class="text-center flex-1">
                    <div class="text-5xl font-mono text-emerald-400 mb-4">✓</div>
                    <h3 class="font-bold mb-2">Launch on Ivy</h3>
                    <p class="text-zinc-400">1 click</p>
                </div>
            </div>
        </section>

        <!-- Three Audiences Section (inspired by about_new3) -->
        <section class="py-20">
            <div class="grid gap-12 lg:grid-cols-3">
                <!-- For Developers -->
                <div class="text-center">
                    <div class="mb-6 mx-auto w-20 h-20 bg-emerald-400/10 rounded-full flex items-center justify-center">
                        <?php echo icon(
                            "code",
                            "h-10 w-10 text-emerald-400"
                        ); ?>
                    </div>
                    <h3 class="text-2xl font-bold mb-4 text-emerald-400">For Developers</h3>
                    <p class="text-zinc-300 mb-6">
                        No smart contracts. No proprietary SDKs. No lock-in. Just three REST endpoints
                        that work with any language or engine. Build your game, not blockchain infrastructure.
                    </p>
                    <div class="bg-zinc-900 border border-zinc-800 p-4 rounded text-left font-mono text-sm">
                        <div class="text-emerald-400">POST /api/deposit</div>
                        <div class="text-emerald-400">POST /api/withdraw</div>
                        <div class="text-emerald-400">GET /api/verify</div>
                    </div>
                    <a href="/docs" class="inline-block mt-6 text-emerald-400 hover:text-emerald-300 font-semibold">
                        Read the docs →
                    </a>
                </div>

                <!-- For Players -->
                <div class="text-center">
                    <div class="mb-6 mx-auto w-20 h-20 bg-emerald-400/10 rounded-full flex items-center justify-center">
                        <?php echo icon(
                            "gamepad-2",
                            "h-10 w-10 text-emerald-400"
                        ); ?>
                    </div>
                    <h3 class="text-2xl font-bold mb-4 text-emerald-400">For Players</h3>
                    <p class="text-zinc-300 mb-6">
                        Every game has its own token. Earn by playing, trade on bonding curves,
                        and cash out instantly. Your wallet, your assets, your rewards—with 50%
                        of all trading fees going back to you.
                    </p>
                    <div class="flex justify-center gap-4 mb-6">
                        <div class="text-center">
                            <div class="text-2xl font-bold text-emerald-400">1-click</div>
                            <div class="text-sm text-zinc-400">trades</div>
                        </div>
                        <div class="text-center">
                            <div class="text-2xl font-bold text-emerald-400">50%</div>
                            <div class="text-sm text-zinc-400">fee share</div>
                        </div>
                        <div class="text-center">
                            <div class="text-2xl font-bold text-emerald-400">instant</div>
                            <div class="text-sm text-zinc-400">cashout</div>
                        </div>
                    </div>
                    <a href="/" class="inline-block text-emerald-400 hover:text-emerald-300 font-semibold">
                        Start playing →
                    </a>
                </div>

                <!-- For Investors -->
                <div class="text-center">
                    <div class="mb-6 mx-auto w-20 h-20 bg-emerald-400/10 rounded-full flex items-center justify-center">
                        <?php echo icon(
                            "trending-up",
                            "h-10 w-10 text-emerald-400"
                        ); ?>
                    </div>
                    <h3 class="text-2xl font-bold mb-4 text-emerald-400">For Investors</h3>
                    <p class="text-zinc-300 mb-6">
                        Ivy unlocks the massive indie game market for Web3. Our radical simplicity
                        means millions of developers can now participate. 1% trading fee: 50% burns
                        IVY, 50% rewards developers. The best tokenomics in gaming.
                    </p>
                    <div class="bg-emerald-400/10 border border-emerald-400/30 p-4 rounded">
                        <div class="text-sm text-zinc-400 mb-1">On every $1M traded:</div>
                        <div class="text-lg font-bold">$5,000 burned as IVY</div>
                    </div>
                    <a href="/token" class="inline-block mt-6 text-emerald-400 hover:text-emerald-300 font-semibold">
                        Learn about IVY →
                    </a>
                </div>
            </div>
        </section>

        <!-- Comparison Table (from about_new2) -->
        <section class="py-20 border-t border-zinc-800">
            <h2 class="text-3xl font-bold mb-12 text-center">The Ivy difference</h2>
            <div class="overflow-x-auto">
                <table class="w-full max-w-4xl mx-auto">
                    <thead>
                        <tr class="border-b border-zinc-800">
                            <th class="text-left p-4"></th>
                            <th class="text-left p-4 text-emerald-400">Ivy</th>
                            <th class="text-left p-4 text-zinc-500">Traditional Web3 Platforms</th>
                        </tr>
                    </thead>
                    <tbody class="text-zinc-300">
                        <tr class="border-b border-zinc-800/50">
                            <td class="p-4 font-semibold">Integration Time</td>
                            <td class="p-4"><span class="comparison-check">✓</span> Weekend project</td>
                            <td class="p-4"><span class="comparison-x">✗</span> Months of development</td>
                        </tr>
                        <tr class="border-b border-zinc-800/50">
                            <td class="p-4 font-semibold">Required Knowledge</td>
                            <td class="p-4"><span class="comparison-check">✓</span> Basic HTTP requests</td>
                            <td class="p-4"><span class="comparison-x">✗</span> Blockchain expertise</td>
                        </tr>
                        <tr class="border-b border-zinc-800/50">
                            <td class="p-4 font-semibold">Language Support</td>
                            <td class="p-4"><span class="comparison-check">✓</span> Any language</td>
                            <td class="p-4"><span class="comparison-x">✗</span> Limited SDK support</td>
                        </tr>
                        <tr class="border-b border-zinc-800/50">
                            <td class="p-4 font-semibold">Engine Lock-in</td>
                            <td class="p-4"><span class="comparison-check">✓</span> Use any engine</td>
                            <td class="p-4"><span class="comparison-x">✗</span> Specific engines only</td>
                        </tr>
                        <tr class="border-b border-zinc-800/50">
                            <td class="p-4 font-semibold">Revenue Share</td>
                            <td class="p-4"><span class="comparison-check">✓</span> 50% to developers</td>
                            <td class="p-4"><span class="comparison-x">✗</span> 20-30% typical</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </section>

        <!-- Philosophy Section -->
        <section class="py-20 text-center border-t border-zinc-800">
            <h2 class="text-3xl font-bold mb-6">Our philosophy: Worse is better</h2>
            <p class="max-w-3xl mx-auto text-lg text-zinc-300 mb-8">
                Inspired by Unix, Ivy provides the absolute minimum needed for Web3 gaming.
                This radical simplicity enables maximum flexibility. No bloat, no lock-in,
                no compromises. Just the essentials, done right.
            </p>
            <div class="inline-flex items-center gap-4 text-zinc-400">
                <span>Simple</span>
                <span class="text-emerald-400">></span>
                <span>Complex</span>
                <span class="mx-4">·</span>
                <span>Open</span>
                <span class="text-emerald-400">></span>
                <span>Proprietary</span>
                <span class="mx-4">·</span>
                <span>Fast</span>
                <span class="text-emerald-400">></span>
                <span>Feature-rich</span>
            </div>
        </section>

        <!-- Final CTA -->
        <section class="py-20">
            <div class="border-4 border-emerald-400 p-12 text-center max-w-4xl mx-auto">
                <h2 class="text-4xl font-bold mb-4">Ready to build the future?</h2>
                <p class="text-xl text-zinc-300 mb-8">
                    Join thousands of developers, players, and investors who are choosing
                    simplicity over complexity, openness over lock-in, and shipping over planning.
                </p>
                <div class="flex flex-wrap justify-center gap-4">
                    <a href="/upload" class="bg-emerald-400 text-emerald-950 hover:bg-emerald-300 font-bold px-8 py-4 text-lg">
                        Upload Your Game
                    </a>
                    <a href="/docs" class="border-2 border-emerald-400 text-emerald-400 hover:bg-emerald-400 hover:text-emerald-950 font-bold px-8 py-4 text-lg transition-all">
                        Start Building
                    </a>
                    <a href="https://discord.gg/ge7WyB8tjG" class="border-2 border-emerald-400 text-emerald-400 hover:bg-emerald-400 hover:text-emerald-950 font-bold px-8 py-4 text-lg transition-all">
                        Join Discord
                    </a>
                </div>
            </div>
        </section>
    </div>
</main>

<?php require_once __DIR__ . "/../includes/footer.php"; ?>
