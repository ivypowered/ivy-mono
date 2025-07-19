<?php
/**
 * ivy-frontend/public/about_new.php
 * Modern about page inspired by Immutable's design approach
 */

require_once __DIR__ . "/../includes/api.php";
require_once __DIR__ . "/../includes/fmt.php";

$title = "About Ivy - Web3 Gaming Made Simple";
$description =
    "Build Web3 games in a weekend, not months. Ivy's simple REST API handles all blockchain complexity so you can focus on making great games.";
require_once __DIR__ . "/../includes/header.php";
?>

<style>
.gradient-text {
    background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}

.hero-gradient {
    background: radial-gradient(ellipse at top, rgba(16, 185, 129, 0.1) 0%, transparent 50%);
}

.feature-card {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(16, 185, 129, 0.2);
    transition: all 0.3s ease;
}

.feature-card:hover {
    background: rgba(16, 185, 129, 0.05);
    border-color: rgba(16, 185, 129, 0.4);
    transform: translateY(-2px);
}

.comparison-table {
    border-collapse: separate;
    border-spacing: 0;
}

.comparison-table td, .comparison-table th {
    border: 1px solid rgba(16, 185, 129, 0.2);
}
</style>

<main class="min-h-screen bg-zinc-950 text-white">
    <!-- Hero Section -->
    <section class="hero-gradient relative overflow-hidden pt-24 pb-32">
        <div class="mx-auto max-w-7xl px-6">
            <div class="text-center">
                <h1 class="mb-6 text-6xl font-bold leading-tight">
                    Web3 Gaming,<br>
                    <span class="gradient-text">Radically Simplified</span>
                </h1>
                <p class="mx-auto mb-8 max-w-3xl text-xl text-zinc-300">
                    While others build complex SDKs that lock you into their ecosystem,
                    Ivy provides a simple REST API that works with any language, any engine, anywhere.
                </p>
                <div class="flex flex-wrap justify-center gap-4">
                    <a href="/docs" class="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold px-8 py-4 text-lg transition-colors">
                        Read the Docs
                    </a>
                    <a href="/example-1-cat" class="border-2 border-emerald-500 text-emerald-400 hover:bg-emerald-500 hover:text-black font-semibold px-8 py-4 text-lg transition-all">
                        Build in Minutes
                    </a>
                </div>
            </div>
        </div>
    </section>

    <!-- Philosophy Section -->
    <section class="py-20 px-6">
        <div class="mx-auto max-w-4xl text-center">
            <h2 class="mb-4 text-3xl font-bold">Our Philosophy: Worse is Better</h2>
            <p class="text-lg text-zinc-300 mb-8">
                Ivy embraces the Unix philosophy. We provide the minimal interface needed for Web3 gaming—deposits,
                withdrawals, and authentication—nothing more, nothing less. This simplicity enables maximum flexibility
                and zero lock-in.
            </p>
            <div class="inline-block bg-zinc-900 border border-emerald-500/20 p-6">
                <code class="text-emerald-400 text-sm">
                    GET /api/games/{game}/deposits/{id}<br>
                    POST /api/games/{game}/withdrawals/{id}<br>
                    GET /verify?game={game}&message={msg}&signature={sig}
                </code>
            </div>
            <p class="mt-4 text-sm text-zinc-400">That's it. The entire API.</p>
        </div>
    </section>

    <!-- Comparison Section -->
    <section class="py-20 bg-zinc-900/50">
        <div class="mx-auto max-w-7xl px-6">
            <h2 class="text-center mb-12 text-4xl font-bold">The Ivy Difference</h2>

            <div class="overflow-x-auto">
                <table class="comparison-table w-full text-left">
                    <thead>
                        <tr>
                            <th class="p-4 bg-emerald-500/10"></th>
                            <th class="p-4 bg-emerald-500/10 text-emerald-400 text-lg">Ivy</th>
                            <th class="p-4 text-zinc-400 text-lg">Traditional Web3 Platforms</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td class="p-4 font-semibold">Integration Time</td>
                            <td class="p-4 text-emerald-400">Weekend project</td>
                            <td class="p-4 text-zinc-400">Months of development</td>
                        </tr>
                        <tr class="bg-zinc-900/30">
                            <td class="p-4 font-semibold">Technology</td>
                            <td class="p-4 text-emerald-400">Simple REST API</td>
                            <td class="p-4 text-zinc-400">Complex SDKs</td>
                        </tr>
                        <tr>
                            <td class="p-4 font-semibold">Language Support</td>
                            <td class="p-4 text-emerald-400">Any language that can make HTTP requests</td>
                            <td class="p-4 text-zinc-400">Limited to supported SDKs</td>
                        </tr>
                        <tr class="bg-zinc-900/30">
                            <td class="p-4 font-semibold">Game Engine</td>
                            <td class="p-4 text-emerald-400">Any engine (Unity, Godot, custom, etc.)</td>
                            <td class="p-4 text-zinc-400">Only officially supported engines</td>
                        </tr>
                        <tr>
                            <td class="p-4 font-semibold">Smart Contracts</td>
                            <td class="p-4 text-emerald-400">Pre-built and audited</td>
                            <td class="p-4 text-zinc-400">Often need custom development</td>
                        </tr>
                        <tr class="bg-zinc-900/30">
                            <td class="p-4 font-semibold">Revenue Share</td>
                            <td class="p-4 text-emerald-400">50% to developers</td>
                            <td class="p-4 text-zinc-400">Typically 20-30%</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </section>

    <!-- Features Grid -->
    <section class="py-20">
        <div class="mx-auto max-w-7xl px-6">
            <h2 class="text-center mb-12 text-4xl font-bold">Everything You Need, Nothing You Don't</h2>

            <div class="grid gap-6 md:grid-cols-3">
                <div class="feature-card p-8">
                    <div class="mb-4 text-emerald-400">
                        <?php echo icon("credit-card", "h-12 w-12"); ?>
                    </div>
                    <h3 class="mb-3 text-xl font-bold">Simple Deposits</h3>
                    <p class="text-zinc-300">
                        Accept payments with a single API call. Generate a unique ID,
                        redirect users to our payment page, check completion status. Done.
                    </p>
                </div>

                <div class="feature-card p-8">
                    <div class="mb-4 text-emerald-400">
                        <?php echo icon("banknote", "h-12 w-12"); ?>
                    </div>
                    <h3 class="mb-3 text-xl font-bold">Easy Withdrawals</h3>
                    <p class="text-zinc-300">
                        Let players cash out rewards. Sign a message with your authority key,
                        give it to the user, they claim on-chain. It's that simple.
                    </p>
                </div>

                <div class="feature-card p-8">
                    <div class="mb-4 text-emerald-400">
                        <?php echo icon("shield-check", "h-12 w-12"); ?>
                    </div>
                    <h3 class="mb-3 text-xl font-bold">Wallet Authentication</h3>
                    <p class="text-zinc-300">
                        Let users sign in with their wallet. Verify signatures with our API
                        or using simple code in any language. No complex integrations.
                    </p>
                </div>
            </div>
        </div>
    </section>

    <!-- Marketplace Section -->
    <section class="py-20 bg-gradient-to-b from-transparent to-zinc-900/50">
        <div class="mx-auto max-w-7xl px-6">
            <div class="grid gap-12 lg:grid-cols-2 items-center">
                <div>
                    <h2 class="mb-6 text-4xl font-bold">
                        The Ivy Marketplace:<br>
                        <span class="gradient-text">Where Games Launch</span>
                    </h2>
                    <p class="mb-6 text-lg text-zinc-300">
                        Every game on Ivy gets its own token, traded on a bonding curve.
                        Players invest in games they love, developers get instant liquidity.
                    </p>

                    <div class="mb-8 space-y-4">
                        <div class="flex items-start gap-4">
                            <div class="mt-1 text-emerald-400">
                                <?php echo icon("trending-up", "h-6 w-6"); ?>
                            </div>
                            <div>
                                <h4 class="font-semibold mb-1">Best Revenue Share in Web3</h4>
                                <p class="text-zinc-400">50% of trading fees go directly to developers.
                                The other 50% is burned as IVY, creating value for the ecosystem.</p>
                            </div>
                        </div>

                        <div class="flex items-start gap-4">
                            <div class="mt-1 text-emerald-400">
                                <?php echo icon("zap", "h-6 w-6"); ?>
                            </div>
                            <div>
                                <h4 class="font-semibold mb-1">Launch in Minutes</h4>
                                <p class="text-zinc-400">No complicated token contracts or liquidity setup.
                                Upload your game, set your parameters, go live.</p>
                            </div>
                        </div>

                        <div class="flex items-start gap-4">
                            <div class="mt-1 text-emerald-400">
                                <?php echo icon("users", "h-6 w-6"); ?>
                            </div>
                            <div>
                                <h4 class="font-semibold mb-1">Built-in Community</h4>
                                <p class="text-zinc-400">Tap into Ivy's growing ecosystem of Web3 gamers
                                actively looking for the next great game.</p>
                            </div>
                        </div>
                    </div>

                    <a href="/upload" class="inline-block bg-emerald-500 hover:bg-emerald-600 text-black font-semibold px-8 py-4 text-lg transition-colors">
                        Launch Your Game
                    </a>
                </div>

                <div class="relative">
                    <div class="bg-zinc-900 border border-emerald-500/20 p-8 rounded-lg">
                        <h3 class="text-2xl font-bold mb-6 text-center">Revenue Flow</h3>
                        <div class="space-y-4">
                            <div class="bg-zinc-800/50 p-4 rounded">
                                <div class="text-sm text-zinc-400 mb-1">Player trades 1,000 tokens</div>
                                <div class="text-lg">Fee: 10 tokens (1%)</div>
                            </div>
                            <div class="grid grid-cols-2 gap-4">
                                <div class="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded text-center">
                                    <div class="text-2xl font-bold text-emerald-400">5 tokens</div>
                                    <div class="text-sm text-zinc-300">To Developer</div>
                                </div>
                                <div class="bg-orange-500/10 border border-orange-500/30 p-4 rounded text-center">
                                    <div class="text-2xl font-bold text-orange-400">5 tokens</div>
                                    <div class="text-sm text-zinc-300">Burned as IVY</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Use Cases -->
    <section class="py-20">
        <div class="mx-auto max-w-7xl px-6">
            <h2 class="text-center mb-12 text-4xl font-bold">Who Uses Ivy?</h2>

            <div class="grid gap-8 md:grid-cols-3">
                <div class="text-center">
                    <div class="mb-4 mx-auto w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center">
                        <?php echo icon(
                            "code",
                            "h-10 w-10 text-emerald-400"
                        ); ?>
                    </div>
                    <h3 class="mb-3 text-xl font-bold">Indie Developers</h3>
                    <p class="text-zinc-300">
                        Ship your Web3 game in a weekend. No blockchain expertise required,
                        just basic HTTP requests.
                    </p>
                </div>

                <div class="text-center">
                    <div class="mb-4 mx-auto w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center">
                        <?php echo icon(
                            "building",
                            "h-10 w-10 text-emerald-400"
                        ); ?>
                    </div>
                    <h3 class="mb-3 text-xl font-bold">Game Studios</h3>
                    <p class="text-zinc-300">
                        Add Web3 features to existing games without rewriting your codebase
                        or switching engines.
                    </p>
                </div>

                <div class="text-center">
                    <div class="mb-4 mx-auto w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center">
                        <?php echo icon(
                            "gamepad-2",
                            "h-10 w-10 text-emerald-400"
                        ); ?>
                    </div>
                    <h3 class="mb-3 text-xl font-bold">Players</h3>
                    <p class="text-zinc-300">
                        Discover innovative games, invest in your favorites, and truly
                        own your in-game assets.
                    </p>
                </div>
            </div>
        </div>
    </section>

    <!-- CTA Section -->
    <section class="py-20 bg-gradient-to-t from-zinc-900 to-transparent">
        <div class="mx-auto max-w-4xl px-6 text-center">
            <h2 class="mb-6 text-4xl font-bold">
                Ready to Build the Future of Gaming?
            </h2>
            <p class="mb-8 text-xl text-zinc-300">
                Join developers who are choosing simplicity over complexity,
                flexibility over lock-in, and shipping games instead of wrestling with SDKs.
            </p>
            <div class="flex flex-wrap justify-center gap-4">
                <a href="/docs" class="bg-emerald-500 hover:bg-emerald-600 text-black font-semibold px-8 py-4 text-lg transition-colors">
                    Start Building
                </a>
                <a href="https://discord.gg/ge7WyB8tjG" class="border-2 border-emerald-500 text-emerald-400 hover:bg-emerald-500 hover:text-black font-semibold px-8 py-4 text-lg transition-all">
                    Join Our Discord
                </a>
            </div>

            <div class="mt-12 flex justify-center gap-8 text-sm text-zinc-400">
                <a href="/docs" class="hover:text-emerald-400 transition-colors">Documentation</a>
                <a href="/example-1-cat" class="hover:text-emerald-400 transition-colors">Quick Start</a>
                <a href="https://discord.gg/ge7WyB8tjG" class="hover:text-emerald-400 transition-colors">Community</a>
            </div>
        </div>
    </section>
</main>

<?php require_once __DIR__ . "/../includes/footer.php"; ?>
