<?php
/**
 * ivy-frontend/public/about_new.php
 * A stripped-down, story-first homepage that balances
 * developer clarity with player appeal.
 */

require_once __DIR__ . "/../includes/header.php"; ?>
<main class="max-w-6xl mx-auto px-6 py-16 text-zinc-100">
  <!-- HERO ------------------------------------------------------------------->
  <section class="text-center mb-24">
    <h1 class="text-5xl md:text-6xl font-black mb-4 leading-none bg-gradient-to-r from-emerald-400 via-red-400 to-purple-400 bg-clip-text text-transparent">
      Hit “Save & Deploy” to Web3
    </h1>
    <p class="max-w-3xl mx-auto text-xl md:text-2xl text-zinc-300">
      Ivy is the first platform that lets you wrap any HTML5 game in tokens,
      deposits and economies in the time it takes to order lunch.
    </p>
    <div class="mt-10 flex justify-center gap-4">
      <a href="/play" class="px-6 py-3 bg-emerald-400 text-zinc-900 rounded-xl font-bold text-lg hover:bg-emerald-300 transition">Play</a>
      <a href="/api" class="px-6 py-3 border border-zinc-400 text-zinc-100 rounded-xl font-bold text-lg hover:bg-zinc-800 transition">Docs</a>
    </div>
  </section>

  <!-- VALUE PROP (blocks) ---------------------------------------------------->
  <section class="grid md:grid-cols-3 gap-6 mb-20">

    <!-- Developers -->
    <div class="rounded-2xl bg-zinc-900 p-8">
      <h2 class="text-3xl font-extrabold text-red-400 mb-2">For Devs</h2>
      <p class="text-zinc-300 mb-4">
        No smart-contract writing, no SDK lock-in. Deposit, withdraw, and auth
        are <em>three REST calls</em>. Build your game in Unity, Godot, GDevelop
        or raw JavaScript.
      </p>
      <ul class="text-sm space-y-1 text-zinc-400">
        <li>• POST /deposit</li>
        <li>• POST /withdraw</li>
        <li>• POST /auth/wallet</li>
      </ul>
    </div>

    <!-- Players -->
    <div class="rounded-2xl bg-zinc-900 p-8">
      <h2 class="text-3xl font-extrabold text-purple-400 mb-2">For Players</h2>
      <p class="text-zinc-300 mb-4">
        Instantly swap in-game tokens in a single click, collect drops that move
        across games, and trade without ever leaving the flow.
      </p>
      <ul class="text-sm space-y-1 text-zinc-400">
        <li>• One wallet browser-wide</li>
        <li>• Shared NFT market spread</li>
        <li>• Gas–free offer system</li>
      </ul>
    </div>

    <!-- Builders / Investors -->
    <div class="rounded-2xl bg-zinc-900 p-8">
      <h2 class="text-3xl font-extrabold text-emerald-400 mb-2">For Builders</h2>
      <p class="text-zinc-300 mb-4">
        Zero-barrier onboarding = market size 10× smaller competitors.
        Your token jumps out of the gate with a guaranteed curve and 0.5 % rev share.
      </p>
      <ul class="text-sm space-y-1 text-zinc-400">
        <li>• No whitelisting</li>
        <li>• Self-serve treasury</li>
        <li>• Burn-free token swap fee</li>
      </ul>
    </div>
  </section>

  <!-- HOW IT WORKS ----------------------------------------------------------->
  <section class="mb-20">
    <h2 class="text-4xl font-bold mb-6 text-center">Weekend-deploy checklist</h2>
    <div class="flex flex-col gap-6 sm:flex-row justify-center items-center sm:justify-between text-center">

      <div class="w-36">
        <div class="text-5xl font-mono text-red-400 mb-2">1</div>
        <p>Create game & ed25519 keypair<br>(30 s)</p>
      </div>

      <div class="hidden sm:block text-3xl text-zinc-600">→</div>

      <div class="w-36">
        <div class="text-5xl font-mono text-purple-400 mb-2">2</div>
        <p>Wire three REST endpoints<br>(5 min)</p>
      </div>

      <div class="hidden sm:block text-3xl text-zinc-600">→</div>

      <div class="w-36">
        <div class="text-5xl font-mono text-emerald-400 mb-2">✓</div>
        <p>Launch on Ivy<br>(1 click)</p>
      </div>

    </div>
  </section>

  <!-- TRUST TORCH ----------------------------------------------------------->
  <section class="border-2 border-emerald-400/50 rounded-2xl p-8 text-center">
    <h3 class="text-2xl font-bold mb-3">All trust, zero lock-in</h3>
    <p class="max-w-lg mx-auto text-zinc-300">
      Every byte of code is open-source, every token employs trustless escrow,
      and your private keys never touch Ivy’s infra.
    </p>
  </section>
</main>

<?php require_once __DIR__ . "/../includes/footer.php"; ?>
