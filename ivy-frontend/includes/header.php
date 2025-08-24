<?php
/**
 * ivy-frontend/includes/header.php
 * The global site header.
 */

require_once __DIR__ . "/icon.php";
require_once __DIR__ . "/notification.php"; // Include notification functionality

/**
 * Generate navigation link with appropriate styling
 */
function nav_link($url, $text, $iconName, $isMobile = false)
{
    $path = parse_url($_SERVER["REQUEST_URI"], PHP_URL_PATH);
    $isActive =
        $url === "/"
            ? $path === "/"
            : $path === $url || strpos($path, "$url/") === 0;

    if ($isMobile) {
        $class =
            "flex items-center justify-center gap-3 py-3 px-4 w-full " .
            ($isActive
                ? "bg-emerald-400 text-emerald-950"
                : "bg-zinc-800 text-white hover:bg-zinc-700") .
            " rounded-none border-2 border-emerald-400 font-bold text-sm box-border";
        $iconHtml = icon($iconName, "inline-flex h-5 w-5");
    } else {
        $class =
            "flex items-center gap-2 relative " .
            ($isActive ? "text-emerald-400" : "hover:text-emerald-400");
        $iconHtml = icon($iconName, "inline-flex h-4 w-4");
        $underline =
            "<span class=\"absolute -bottom-1 left-0 right-0 h-0.5 bg-emerald-400 " .
            ($isActive ? "scale-x-100" : "scale-x-0 hover:scale-x-100") .
            " transition-transform duration-200\"></span>";
    }

    return "<a href=\"$url\" class=\"$class\">
                <span>{$iconHtml}</span>
                <span>{$text}</span>
                " .
        (!$isMobile ? $underline : "") .
        "
            </a>";
}

// Start session to track launch notifications
session_start();

// Check if a game was just launched successfully (set by launch-confirm.php)
$justLaunchedGame = null;
if (isset($_SESSION['last_launched_game']) && !empty($_SESSION['last_launched_game'])) {
    $justLaunchedGame = $_SESSION['last_launched_game'];
    // Clear the session variable after displaying to avoid repeated notifications
    unset($_SESSION['last_launched_game']);
}

header("Content-Type: text/html; charset=UTF-8");
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= htmlspecialchars($title ?? 'ivy') ?></title>
    <meta name="description" content="<?= htmlspecialchars($description ?? 'Explore Ivy') ?>">
    <link rel="icon" href="/assets/images/ivy-icon.svg" type="image/svg+xml">
    <link rel="stylesheet" href="/assets/css/styles.css">

    <style>
        input[type="search"]::-webkit-search-cancel-button { -webkit-appearance: none; }
        #mobile-menu.hidden { display: none; }
        #mobile-menu { transform: translateY(-1px); }
        #menu-toggle { cursor: pointer; }

        /* Add box-sizing to elements with borders */
        .border-2, .border-b-4, input[type="search"], #menu-toggle,
        button, a.rounded-none, #mobile-menu, header {
            box-sizing: border-box;
        }

        /* Notification Styles */
        .popup-container {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            pointer-events: none;
            z-index: 1000; /* Ensure it appears above other content */
        }

        .new-game-popup { 
            position: absolute;
            top: 78px;
            left: 50%;
            transform: translateX(-50%) translateY(-100%);
            background-color: #34d399; /* emerald-400 */
            color: #022c22; /* emerald-950 */
            padding: 0.75rem 1.5rem;
            font-size: 0.73rem;
            font-weight: 700;
            width: 75%;
            max-width: 600px;
            display: flex;
            border-radius: 10px;
            align-items: center;
            gap: 0.5rem;
            animation: slideIn 0.5s ease-out forwards, shaking 2s ease-out 0.5s forwards, fadeOut 0.5s ease-out 2.5s forwards;
        }

        .new-game-popup-image {
            width: 2rem;
            height: 1.5rem;
            object-fit: cover;
            border-radius: 10px;
        }

        @keyframes slideIn {
            from {
                transform: translateX(-50%) translateY(-100%);
                opacity: 0;
            }
            to {
                transform: translateX(-50%) translateY(0);
                opacity: 1;
            }  
        }

        @keyframes shaking {
            0%{transform: translateX(-50%)}
            10%{transform: translateX(-44%)}
            20%{transform: translateX(-56%)}
            30%{transform: translateX(-44%)}
            40%{transform: translateX(-56%)}
            50%{transform: translateX(-44%)}
            60%{transform: translateX(-56%)}
            70%{transform: translateX(-44%)}
            80%{transform: translateX(-56%)}
            90%{transform: translateX(-44%)}
            100%{transform: translateX(-50%)}
        }

        @keyframes fadeOut {
            from {
                transform: translateX(-50%) translateY(0);
                opacity: 1;
            }
            to {
                transform: translateX(-50%) translateY(-100%);
                opacity: 0;
            }
        }

        /* Circle notification styles (optional, can be removed if not needed globally) */
        .circle-notification {
            position: fixed;
            bottom: 15rem;
            right: 2rem;
            z-index: 50;
            transition: opacity 0.2s ease;
            animation: shaking 1s infinite;
        }

        .circle-notification.fade-out {
            width: 3rem;
            height: 3rem;
            opacity: 0;
        }

        .circle-notification.fade-in {
            width: 3rem;
            height: 3rem;
            opacity: 1;
        }

        .circle-image {
            width: 6rem;
            height: 6rem;
            border-radius: 50%;
            background-size: cover;
            background-position: center;
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid #34d399;
        }

        @media (min-width: 1024px) {
            .circle-notification {
                bottom: 20rem;
                right: 11rem;
            }
            .circle-image {
                width: 12rem;
                height: 12rem;
            }
            .new-game-popup { top: 100px; }
        }

        .new-text {
            font-size: 0.875rem;
            font-weight: 700;
            color: #022c22;
            background-color: #34d399;
            padding: 0.25rem 0.5rem;
            border-radius: 0.25rem;
            position: absolute;
            bottom: -0.5rem;
            left: 50%;
            transform: translateX(-50%);
            white-space: nowrap;
        }
    </style>

    <script src="/assets/js/ivy-react.js" type="text/javascript" async></script>
    <?php if (isset($extra_head)) {
        echo $extra_head;
    } ?>
</head>
<body class="min-h-screen bg-zinc-900 text-white font-['JetBrains_Mono',monospace]">
    <header class="border-b-4 border-emerald-400 px-6 py-4 relative">
        <div class="mx-auto flex max-w-7xl items-center justify-between">
            <a href="/" class="flex items-center gap-2 text-2xl font-bold flex-shrink-0">
                <img src="/assets/images/ivy-symbol.svg" alt="Ivy Symbol" class="h-8 text-emerald-400">
                <span class="bg-emerald-400 text-emerald-950 px-2">ivy</span>
            </a>

            <!-- Mobile Actions (Right Side) -->
            <div class="flex items-center gap-3 lg:hidden">
                <div id="wallet-mobile-button">
                    <button class="rounded-none border-2 border-emerald-400 text-emerald-400 hover:bg-emerald-400 hover:text-emerald-950 p-2">
                        <?= icon("link", "h-6 w-6") ?>
                    </button>
                </div>

                <button id="menu-toggle" class="lg:hidden p-2 text-emerald-400 hover:text-emerald-300 focus:outline-none border-2 border-emerald-400" aria-controls="mobile-menu" aria-expanded="false">
                    <span class="sr-only">Open main menu</span>
                    <span id="menu-icon"><?= icon("menu", "h-6 w-6") ?></span>
                    <span id="close-icon" class="hidden"><?= icon("x", "h-6 w-6") ?></span>
                </button>
            </div>

            <!-- Desktop Navigation -->
            <nav class="hidden lg:block">
                <ul class="flex items-center gap-8 font-bold text-sm">
                    <?php foreach (
                        [
                            ["/" => ["explore", "compass"]],
                            ["/about" => ["about", "info"]],
                            ["/docs" => ["docs", "book"]],
                            ["/token" => ["token", "token"]],
                        ]
                        as $link
                    ) {
                        $url = key($link);
                        $data = current($link);
                        echo nav_link($url, $data[0], $data[1]);
                    } ?>
                </ul>
            </nav>

            <!-- Desktop Actions -->
            <div class="hidden lg:flex items-center gap-4">
                <div class="relative">
                    <?= icon("search", "absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-950 pointer-events-none") ?>
                    <form action="/search" method="GET" class="m-0 p-0">
                        <input type="search" name="q" placeholder="search games..." class="h-10 w-64 rounded-none border-2 border-emerald-400 bg-emerald-50 pl-8 text-sm font-bold text-emerald-950 placeholder:text-emerald-900/70 focus:outline-none focus:ring-0 [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none">
                    </form>
                </div>
                <div id="wallet-button">
                    <button class="rounded-none border-2 border-emerald-400 text-emerald-400 hover:bg-emerald-400 hover:text-emerald-950 p-2 h-10 w-10">
                        <?= icon("link", "h-5 w-5") ?>
                    </button>
                </div>
                <a href="/launch" class="rounded-none bg-emerald-400 text-emerald-950 hover:bg-emerald-300 font-bold px-4 py-2 flex items-center gap-2 text-sm h-10">
                    <?= icon("rocket", "h-4 w-4") ?>
                    <span>launch gamecoin</span>
                </a>
            </div>

            <!-- Mobile Menu - Retro Style -->
            <div id="mobile-menu" class="hidden lg:hidden absolute top-full left-0 right-0 bg-zinc-900 border-b-4 border-b-emerald-400 p-6 z-20">
                <nav class="mb-6">
                    <ul class="flex flex-col items-center gap-3 w-full mx-auto">
                        <?php foreach (
                            [
                                ["/" => ["explore", "compass"]],
                                ["/about" => ["about", "info"]],
                                ["/docs" => ["docs", "book"]],
                                ["/token" => ["token", "token"]],
                            ]
                            as $link
                        ) {
                            $url = key($link);
                            $data = current($link);
                            echo "<li class=\"w-full\">" .
                                nav_link($url, $data[0], $data[1], true) .
                                "</li>";
                        } ?>
                    </ul>
                </nav>
                <div class="flex flex-col gap-4 w-full mx-auto">
                    <div class="relative w-full">
                        <?= icon("search", "absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-950 pointer-events-none") ?>
                        <form action="/search" method="GET" class="m-0 p-0">
                            <input type="search" name="q" placeholder="search games..." class="h-12 w-full rounded-none border-2 border-emerald-400 bg-emerald-50 pl-10 text-sm font-bold text-emerald-950 placeholder:text-emerald-900/70 focus:outline-none focus:ring-0 [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none">
                        </form>
                    </div>
                    <a href="/launch" class="text-center rounded-none bg-emerald-400 text-emerald-950 hover:bg-emerald-300 font-bold px-4 py-3 flex items-center justify-center gap-2 text-sm">
                        <?= icon("rocket", "h-5 w-5") ?>
                        <span>launch gamecoin</span>
                    </a>
                </div>
            </div>
        </div>
    </header>

    <?php
    // Render notification if a game was just launched
    if ($justLaunchedGame) {
        notification_render($justLaunchedGame);
    }
    ?>

    <script>
        (function() {
            const menuToggle = document.getElementById("menu-toggle");
            const mobileMenu = document.getElementById("mobile-menu");
            const menuIcon = document.getElementById("menu-icon");
            const closeIcon = document.getElementById("close-icon");

            if (!menuToggle || !mobileMenu || !menuIcon || !closeIcon) {
                console.warn("One or more menu elements not found, skipping menu initialization.");
                return;
            }

            menuToggle.addEventListener("click", () => {
                const isExpanded = menuToggle.getAttribute("aria-expanded") === "true";

                if (isExpanded) {
                    mobileMenu.classList.add("hidden");
                    menuIcon.classList.remove("hidden");
                    closeIcon.classList.add("hidden");
                } else {
                    mobileMenu.classList.remove("hidden");
                    menuIcon.classList.add("hidden");
                    closeIcon.classList.remove("hidden");
                }

                menuToggle.setAttribute("aria-expanded", !isExpanded);
            });

            document.addEventListener("click", (event) => {
                if (
                    !mobileMenu.contains(event.target) &&
                    !menuToggle.contains(event.target) &&
                    !mobileMenu.classList.contains("hidden")
                ) {
                    mobileMenu.classList.add("hidden");
                    menuToggle.setAttribute("aria-expanded", "false");
                    menuIcon.classList.remove("hidden");
                    closeIcon.classList.add("hidden");
                }
            });

            window.addEventListener("resize", () => {
                if (window.innerWidth >= 1024 && !mobileMenu.classList.contains("hidden")) {
                    mobileMenu.classList.add("hidden");
                    menuToggle.setAttribute("aria-expanded", "false");
                    menuIcon.classList.remove("hidden");
                    closeIcon.classList.add("hidden");
                }
            });
        })();
    </script>
