const menuToggle = document.getElementById("menu-toggle");
const mobileMenu = document.getElementById("mobile-menu");
const menuIcon = document.getElementById("menu-icon");
const closeIcon = document.getElementById("close-icon");

// Validate that all required elements exist
if (!menuToggle) throw new Error("Menu toggle button not found");
if (!mobileMenu) throw new Error("Mobile menu not found");
if (!menuIcon) throw new Error("Menu icon not found");
if (!closeIcon) throw new Error("Close icon not found");

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

// Close menu when clicking outside
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

// Close mobile menu if window resizes above the breakpoint
window.addEventListener("resize", () => {
    if (window.innerWidth >= 1024 && !mobileMenu.classList.contains("hidden")) {
        mobileMenu.classList.add("hidden");
        menuToggle.setAttribute("aria-expanded", "false");
        menuIcon.classList.remove("hidden");
        closeIcon.classList.add("hidden");
    }
});

const walletName = window.localStorage.getItem("walletName");
const isConnected = walletName && walletName.trim() !== "";

// Get all elements with the specified classes
const connectedElements = document.querySelectorAll(".when-connected");
const disconnectedElements = document.querySelectorAll(".when-disconnected");

// Update visibility based on wallet connection status
connectedElements.forEach((el) => {
    if (isConnected) {
        el.classList.remove("hidden");
    } else {
        el.classList.add("hidden");
    }
});

disconnectedElements.forEach((el) => {
    if (isConnected) {
        el.classList.add("hidden");
    } else {
        el.classList.remove("hidden");
    }
});
