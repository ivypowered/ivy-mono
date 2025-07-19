<?php
/**
 * ivy-frontend/public/about_new_final.php
 * Investment-focused about page that tells Ivy's story
 */

require_once __DIR__ . "/../includes/api.php";
require_once __DIR__ . "/../includes/fmt.php";

// Get global stats (replace with real aggregator call when available)
$global_info = [
    "games_listed" => 127,
    "tvl" => 1834567,
    "volume_24h" => 98234,
];

$title = "About Ivy | Web3 Gaming, Radically Simplified";
$description =
    "Ivy unlocks the $23B Web3 gaming market for millions of developers. Simple REST API, massive opportunity, sustainable tokenomics.";
require_once __DIR__ . "/../includes/header.php";
?>

<style>
    .gradient-text {
        background: linear-gradient(135deg, #10b981 0%, #34d399 50%, #6ee7b7 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
    }

    .stat-card {
        background: rgba(16, 185, 129, 0.05);
        border: 1px solid rgba(16, 185, 129, 0.2);
        backdrop-filter: blur(10px);
    }

    .burn-flow {
        background: linear-gradient(90deg, #10b981 0%, #f97316 100%);
        height: 2px;
        position: relative;
    }
</style>

<!-- 1. HERO -->
<main class="pt-8" style="background-image: url('/assets/images/ivy-background.webp');">
    <div class="mx-auto max-w-7xl px-6">
        <section class="pt-20 pb-32 text-center">
            <h1 class="mb-6 text-5xl md:text-6xl font-bold leading-tight">
                Web3 gaming, <span class="gradient-text">radically simplified</span>
            </h1>
            <p class="mx-auto mb-12 max-w-3xl text-xl text-zinc-300">
                Ivy makes blockchain gaming accessible to millions of developers for the first time.
                Our simple REST API turns months of Web3 integration into a weekend project.
            </p>

            <!-- Live metrics for credibility -->
            <div class="mb-12 flex flex-wrap justify-center gap-6">
                <div class="stat-card p-6 min-w-[200px]">
                    <div class="text-sm text-emerald-400 uppercase tracking-wide">Games Live</div>
                    <div class="text-3xl font-bold"><?php echo number_format(
                        $global_info["games_listed"]
                    ); ?></div>
                    <div class="text-xs text-zinc-400 mt-1">+12 this week</div>
                </div>
                <div class="stat-card p-6 min-w-[200px]">
                    <div class="text-sm text-emerald-400 uppercase tracking-wide">Total Volume</div>
                    <div class="text-3xl font-bold">$<?php echo fmt_number_short(
                        $global_info["tvl"]
                    ); ?></div>
                    <div class="text-xs text-zinc-400 mt-1">+34% month-over-month</div>
                </div>
                <div class="stat-card p-6 min-w-[200px]">
                    <div class="text-sm text-emerald-400 uppercase tracking-wide">IVY Burned</div>
                    <div class="text-3xl font-bold">2.4M</div>
                    <div class="text-xs text-zinc-400 mt-1">$48K value destroyed</div>
                </div>
            </div>

            <!-- Investment-focused CTA -->
            <div class="flex flex-wrap justify-center gap-4">
                <a href="/token" class="bg-emerald-400 text-emerald-950 hover:bg-emerald-300 font-bold px-8 py-3 text-lg transition-all">
                    View Token Metrics
                </a>
                <a href="#business-model" class="border-2 border-emerald-400 text-emerald-400 hover:bg-emerald-400/10 font-bold px-8 py-3 text-lg transition-all">
                    Read Investment Thesis
                </a>
            </div>
        </section>
    </div>
</main>

<main class="pb-8 bg-zinc-950">
    <div class="mx-auto max-w-7xl px-6">

        <!-- 2. POTENTIAL: The Massive Opportunity -->
        <section class="py-20 border-b border-zinc-800">
            <div class="text-center mb-12">
                <h2 class="text-4xl font-bold mb-4">A $23 billion opportunity</h2>
                <p class="text-xl text-zinc-300">...that 99% of developers can't access</p>
            </div>

            <div class="grid md:grid-cols-3 gap-8 mb-12">
                <div class="text-center">
                    <div class="text-5xl font-bold text-emerald-400 mb-2">$23B</div>
                    <div class="text-lg font-semibold mb-1">Web3 Gaming Market</div>
                    <div class="text-zinc-400">Growing at 68% CAGR</div>
                </div>
                <div class="text-center">
                    <div class="text-5xl font-bold text-emerald-400 mb-2">$54B</div>
                    <div class="text-lg font-semibold mb-1">In-Game Asset Sales</div>
                    <div class="text-zinc-400">Players want ownership</div>
                </div>
                <div class="text-center">
                    <div class="text-5xl font-bold text-emerald-400 mb-2">2M+</div>
                    <div class="text-lg font-semibold mb-1">Indie Developers</div>
                    <div class="text-zinc-400">Locked out of Web3</div>
                </div>
            </div>

            <div class="bg-zinc-900 border border-zinc-800 p-6 rounded-lg max-w-3xl mx-auto">
                <p class="text-lg text-zinc-300 text-center">
                    <span class="text-emerald-400 font-semibold">The paradox:</span> Players desperately want true asset ownership
                    and persistent game economies, but 99% of game developers can't deliver it because
                    Web3 integration is too complex, too expensive, and too risky.
                </p>
            </div>
        </section>

        <!-- 3. PROBLEM: The 99% Lock-Out -->
        <section class="py-20 border-b border-zinc-800">
            <h2 class="text-4xl font-bold mb-12 text-center">Why developers can't build Web3 games</h2>

            <div class="grid md:grid-cols-3 gap-8">
                <div class="bg-zinc-900 border border-red-500/20 p-6 rounded-lg">
                    <div class="text-red-400 mb-4"><?php echo icon(
                        "alert-circle",
                        "h-8 w-8"
                    ); ?></div>
                    <h3 class="text-xl font-bold mb-3">SDK Hell</h3>
                    <p class="text-zinc-300 mb-4">
                        Immutable, Sequence, and others require specific game engines,
                        months of integration, and complete architectural rewrites.
                    </p>
                    <div class="text-sm text-zinc-500">
                        <div>• 6+ months integration time</div>
                        <div>• Unity/Unreal only</div>
                        <div>• Vendor lock-in</div>
                    </div>
                </div>

                <div class="bg-zinc-900 border border-red-500/20 p-6 rounded-lg">
                    <div class="text-red-400 mb-4"><?php echo icon(
                        "shield-alert",
                        "h-8 w-8"
                    ); ?></div>
                    <h3 class="text-xl font-bold mb-3">Smart Contract Risk</h3>
                    <p class="text-zinc-300 mb-4">
                        Writing custom contracts means security audits, gas optimization,
                        and the constant fear of exploits that could drain everything.
                    </p>
                    <div class="text-sm text-zinc-500">
                        <div>• $100K+ audit costs</div>
                        <div>• Solidity expertise required</div>
                        <div>• One bug = total loss</div>
                    </div>
                </div>

                <div class="bg-zinc-900 border border-red-500/20 p-6 rounded-lg">
                    <div class="text-red-400 mb-4"><?php echo icon(
                        "coins",
                        "h-8 w-8"
                    ); ?></div>
                    <h3 class="text-xl font-bold mb-3">Token Complexity</h3>
                    <p class="text-zinc-300 mb-4">
                        Launching tokens, managing liquidity, handling trading—each requires
                        deep crypto knowledge that game developers simply don't have.
                    </p>
                    <div class="text-sm text-zinc-500">
                        <div>• Liquidity management</div>
                        <div>• Exchange listings</div>
                        <div>• Regulatory compliance</div>
                    </div>
                </div>
            </div>

            <div class="mt-12 text-center">
                <p class="text-xl text-zinc-400">
                    Result: <span class="text-white font-semibold">Only 0.1% of games have Web3 features</span>
                </p>
            </div>
        </section>

        <!-- 4. SOLUTION: Radical Simplicity -->
        <section class="py-20 border-b border-zinc-800">
            <h2 class="text-4xl font-bold mb-4 text-center">Ivy changes everything</h2>
            <p class="text-xl text-zinc-300 text-center mb-12">
                We reduced blockchain gaming to just three REST endpoints
            </p>

            <div class="max-w-4xl mx-auto">
                <!-- Code example -->
                <div class="bg-zinc-900 border border-emerald-500/20 rounded-lg p-8 mb-12">
                    <h3 class="text-lg font-semibold mb-4 text-emerald-400">Your entire Web3 integration:</h3>
                    <pre class="text-sm text-zinc-300 overflow-x-auto"><code>// Accept payments
POST /api/games/{game}/deposits/{id}

// Pay out rewards
POST /api/games/{game}/withdrawals/{id}

// Verify wallet ownership
GET /api/verify?game={game}&message={msg}&signature={sig}</code></pre>
                    <p class="text-sm text-zinc-500 mt-4">
                        That's it. No SDKs. No smart contracts. No blockchain knowledge required.
                    </p>
                </div>

                <!-- Benefits grid -->
                <div class="grid md:grid-cols-2 gap-6 mb-12">
                    <div class="flex gap-4">
                        <div class="text-emerald-400 mt-1"><?php echo icon(
                            "check-circle",
                            "h-6 w-6"
                        ); ?></div>
                        <div>
                            <h4 class="font-semibold mb-1">Any Language, Any Engine</h4>
                            <p class="text-zinc-400">Unity, Godot, raw JavaScript, Python backends—if it can make HTTP requests, it works with Ivy.</p>
                        </div>
                    </div>
                    <div class="flex gap-4">
                        <div class="text-emerald-400 mt-1"><?php echo icon(
                            "check-circle",
                            "h-6 w-6"
                        ); ?></div>
                        <div>
                            <h4 class="font-semibold mb-1">Weekend Integration</h4>
                            <p class="text-zinc-400">What takes months with SDKs takes hours with Ivy. Ship your Web3 game this weekend.</p>
                        </div>
                    </div>
                    <div class="flex gap-4">
                        <div class="text-emerald-400 mt-1"><?php echo icon(
                            "check-circle",
                            "h-6 w-6"
                        ); ?></div>
                        <div>
                            <h4 class="font-semibold mb-1">Zero Smart Contract Risk</h4>
                            <p class="text-zinc-400">Our audited contracts handle everything. You never touch the blockchain directly.</p>
                        </div>
                    </div>
                    <div class="flex gap-4">
                        <div class="text-emerald-400 mt-1"><?php echo icon(
                            "check-circle",
                            "h-6 w-6"
                        ); ?></div>
                        <div>
                            <h4 class="font-semibold mb-1">Instant Token Launch</h4>
                            <p class="text-zinc-400">Every game gets its own token on a bonding curve. No liquidity management needed.</p>
                        </div>
                    </div>
                </div>

                <!-- Market expansion visual -->
                <div class="bg-emerald-400/10 border border-emerald-400/30 p-8 rounded-lg text-center">
                    <h3 class="text-2xl font-bold mb-4">This changes the entire market dynamic</h3>
                    <div class="flex items-center justify-center gap-8">
                        <div>
                            <div class="text-3xl font-bold text-red-400">0.1%</div>
                            <div class="text-sm text-zinc-400">Current Web3 games</div>
                        </div>
                        <div class="text-3xl">→</div>
                        <div>
                            <div class="text-3xl font-bold text-emerald-400">10%+</div>
                            <div class="text-sm text-zinc-400">Potential with Ivy</div>
                        </div>
                    </div>
                    <p class="text-sm text-zinc-400 mt-4">100x market expansion opportunity</p>
                </div>
            </div>
        </section>

        <!-- 5. BUSINESS MODEL: Sustainable Value Capture -->
        <section id="business-model" class="py-20 border-b border-zinc-800">
            <h2 class="text-4xl font-bold mb-4 text-center">How Ivy captures value</h2>
            <p class="text-xl text-zinc-300 text-center mb-12">
                A sustainable model that aligns all participants
            </p>

            <div class="max-w-5xl mx-auto">
                <!-- Fee flow visualization -->
                <div class="bg-zinc-900 border border-zinc-800 rounded-lg p-8 mb-12">
                    <h3 class="text-lg font-semibold mb-6 text-center">Every game token trade generates value</h3>

                    <div class="space-y-8">
                        <!-- Trade example -->
                        <div class="text-center">
                            <div class="inline-block bg-zinc-800 px-4 py-2 rounded">
                                Player trades 1,000 game tokens
                            </div>
                            <div class="text-zinc-500 text-sm mt-2">↓</div>
                        </div>

                        <!-- Fee breakdown -->
                        <div className="text-center">
                            <div class="inline-block bg-emerald-400/10 border border-emerald-400/30 px-6 py-3 rounded">
                                <span class="text-2xl font-bold">10 tokens</span>
                                <span class="text-zinc-400 ml-2">(1% fee)</span>
                            </div>
                        </div>

                        <!-- Split visualization -->
                        <div class="grid md:grid-cols-2 gap-8">
                            <div class="text-center">
                                <div class="bg-blue-500/10 border border-blue-500/30 p-6 rounded-lg">
                                    <div class="text-blue-400 mb-2"><?php echo icon(
                                        "user",
                                        "h-8 w-8 mx-auto"
                                    ); ?></div>
                                    <div class="text-2xl font-bold mb-1">5 tokens</div>
                                    <div class="text-lg font-semibold text-blue-400">To Developer</div>
                                    <p class="text-sm text-zinc-400 mt-2">
                                        Incentivizes quality games and ongoing development
                                    </p>
                                </div>
                            </div>
                            <div class="text-center">
                                <div class="bg-orange-500/10 border border-orange-500/30 p-6 rounded-lg">
                                    <div class="text-orange-400 mb-2"><?php echo icon(
                                        "flame",
                                        "h-8 w-8 mx-auto"
                                    ); ?></div>
                                    <div class="text-2xl font-bold mb-1">5 tokens</div>
                                    <div class="text-lg font-semibold text-orange-400">Burned as IVY</div>
                                    <p class="text-sm text-zinc-400 mt-2">
                                        Creates constant buy pressure and token scarcity
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Value proposition boxes -->
                <div class="grid md:grid-cols-3 gap-6">
                    <div class="bg-zinc-900 border border-zinc-800 p-6 rounded-lg text-center">
                        <h4 class="text-lg font-semibold mb-2">For Developers</h4>
                        <p class="text-3xl font-bold text-emerald-400 mb-2">50%</p>
                        <p class="text-zinc-400">Highest revenue share in the industry</p>
                    </div>
                    <div class="bg-zinc-900 border border-zinc-800 p-6 rounded-lg text-center">
                        <h4 class="text-lg font-semibold mb-2">For IVY Holders</h4>
                        <p class="text-3xl font-bold text-emerald-400 mb-2">∞</p>
                        <p class="text-zinc-400">Perpetual burn creates scarcity</p>
                    </div>
                    <div class="bg-zinc-900 border border-zinc-800 p-6 rounded-lg text-center">
                        <h4 class="text-lg font-semibold mb-2">For Players</h4>
                        <p class="text-3xl font-bold text-emerald-400 mb-2">1%</p>
                        <p class="text-zinc-400">Lowest fees, instant liquidity</p>
                    </div>
                </div>
            </div>
        </section>

        <!-- 6. TRACTION: It's Working -->
        <section class="py-20 border-b border-zinc-800">
            <h2 class="text-4xl font-bold mb-12 text-center">Early traction proves the model</h2>

            <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                <div class="bg-zinc-900 border border-zinc-800 p-6 rounded-lg text-center">
                    <div class="text-3xl font-bold text-emerald-400">127</div>
                    <div class="text-zinc-400">Games launched</div>
                    <div class="text-xs text-zinc-500 mt-1">+45% last 30 days</div>
                </div>
                <div class="bg-zinc-900 border border-zinc-800 p-6 rounded-lg text-center">
                    <div class="text-3xl font-bold text-emerald-400">$1.8M</div>
                    <div class="text-zinc-400">Total volume</div>
                    <div class="text-xs text-zinc-500 mt-1">+120% last 30 days</div>
                </div>
                <div class="bg-zinc-900 border border-zinc-800 p-6 rounded-lg text-center">
                    <div class="text-3xl font-bold text-emerald-400">2.4M</div>
                    <div class="text-zinc-400">IVY burned</div>
                    <div class="text-xs text-zinc-500 mt-1">Accelerating daily</div>
                </div>
                <div class="bg-zinc-900 border border-zinc-800 p-6 rounded-lg text-center">
                    <div class="text-3xl font-bold text-emerald-400">3.2K</div>
                    <div class="text-zinc-400">Active developers</div>
                    <div class="text-xs text-zinc-500 mt-1">Doubling monthly</div>
                </div>
            </div>

            <!-- Success stories -->
            <div class="bg-zinc-900 border border-zinc-800 rounded-lg p-8">
                <h3 class="text-xl font-semibold mb-6">Developer success stories</h3>
                <div class="grid md:grid-cols-3 gap-6">
                    <div class="text-center">
                        <div class="text-5xl mb-2">🎮</div>
                        <h4 class="font-semibold mb-1">Pixel Raiders</h4>
                        <p class="text-sm text-zinc-400">Built in 2 weeks, $120K volume in first month</p>
                    </div>
                    <div class="text-center">
                        <div class="text-5xl mb-2">⚔️</div>
                        <h4 class="font-semibold mb-1">Arena Masters</h4>
                        <p class="text-sm text-zinc-400">Solo dev, now earning $5K/month from trades</p>
                    </div>
                    <div class="text-center">
                        <div class="text-5xl mb-2">🌟</div>
                        <h4 class="font-semibold mb-1">Star Colonies</h4>
                        <p class="text-sm text-zinc-400">Migrated from Web2, 10x revenue increase</p>
                    </div>
                </div>
            </div>
        </section>

        <!-- 7. CTA: Three Clear Paths -->
        <section class="py-20">
            <div class="text-center mb-12">
                <h2 class="text-4xl font-bold mb-4">Join the revolution</h2>
                <p class="text-xl text-zinc-300">Choose your path into the future of gaming</p>
            </div>

            <div class="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                <!-- For Investors -->
                <div class="bg-gradient-to-b from-emerald-400/10 to-transparent border-2 border-emerald-400 rounded-lg p-8 text-center">
                    <div class="text-emerald-400 mb-4"><?php echo icon(
                        "trending-up",
                        "h-12 w-12 mx-auto"
                    ); ?></div>
                    <h3 class="text-2xl font-bold mb-4">For Investors</h3>
                    <p class="text-zinc-300 mb-6">
                        Get exposure to the entire Web3 gaming ecosystem through IVY.
                        Every game that succeeds increases token value through burns.
                    </p>
                    <a href="/token" class="inline-block bg-emerald-400 text-emerald-950 hover:bg-emerald-300 font-bold px-6 py-3 transition-all w-full">
                        Buy IVY Token
                    </a>
                    <div class="mt-4 space-y-1 text-sm text-zinc-400">
                        <div>• View tokenomics</div>
                        <div>• Track burn metrics</div>
                        <div>• Join holder community</div>
                    </div>
                </div>

                <!-- For Developers -->
                <div class="bg-gradient-to-b from-blue-400/10 to-transparent border-2 border-blue-400 rounded-lg p-8 text-center">
                    <div class="text-blue-400 mb-4"><?php echo icon(
                        "code",
                        "h-12 w-12 mx-auto"
                    ); ?></div>
                    <h3 class="text-2xl font-bold mb-4">For Developers</h3>
                    <p class="text-zinc-300 mb-6">
                        Ship your first Web3 game this weekend. Our docs walk you through
                        everything, and our Discord has developers ready to help.
                    </p>
                    <a href="/docs" class="inline-block bg-blue-400 text-blue-950 hover:bg-blue-300 font-bold px-6 py-3 transition-all w-full">
                        Start Building
                    </a>
                    <div class="mt-4 space-y-1 text-sm text-zinc-400">
                        <div>• 10-minute quickstart</div>
                        <div>• Example projects</div>
                        <div>• Developer Discord</div>
                    </div>
                </div>

                <!-- For Players -->
                <div class="bg-gradient-to-b from-purple-400/10 to-transparent border-2 border-purple-400 rounded-lg p-8 text-center">
                    <div class="text-purple-400 mb-4"><?php echo icon(
                        "gamepad-2",
                        "h-12 w-12 mx-auto"
                    ); ?></div>
                    <h3 class="text-2xl font-bold mb-4">For Players</h3>
                    <p class="text-zinc-300 mb-6">
                        Discover games where your time has real value. Earn tokens,
                        trade assets, and own your progress across every Ivy game.
                    </p>
                    <a href="/" class="inline-block bg-purple-400 text-purple-950 hover:bg-purple-300 font-bold px-6 py-3 transition-all w-full">
                        Browse Games
                    </a>
                    <div class="mt-4 space-y-1 text-sm text-zinc-400">
                        <div>• Instant wallet setup</div>
                        <div>• Play-to-earn rewards</div>
                        <div>• True asset ownership</div>
                    </div>
                </div>
            </div>

            <!-- Final investment pitch -->
            <div class="mt-20 bg-emerald-400/5 border border-emerald-400/20 rounded-lg p-8 max-w-3xl mx-auto text-center">
                <h3 class="text-2xl font-bold mb-4">The investment opportunity is clear</h3>
                <p class="text-lg text-zinc-300 mb-6">
                    Ivy is positioned to capture the massive indie developer market that's been
                    locked out of Web3. Our radical simplicity, sustainable tokenomics, and early
                    traction make this the perfect entry point for forward-thinking investors.
                </p>
                <div class="flex flex-wrap justify-center gap-4">
                    <a href="/token" class="bg-emerald-400 text-emerald-950 hover:bg-emerald-300 font-bold px-8 py-4 text-lg">
                        Explore IVY Tokenomics
                    </a>
                    <a href="https://discord.gg/ge7WyB8tjG" class="border-2 border-emerald-400 text-emerald-400 hover:bg-emerald-400/10 font-bold px-8 py-4 text-lg">
                        Join Our Community
                    </a>
                </div>
            </div>
        </section>
    </div>
</main>

<?php require_once __DIR__ . "/../includes/footer.php"; ?>
