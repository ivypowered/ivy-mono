/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "docs_build/**/*.html",
        "import/*",
        "public/**/*.php",
        "includes/**/*.php",
    ],
    theme: {
        extend: {
            screens: {
                xxs: "370px",
                xs: "480px",
            },
        },
    },
    plugins: [],
};
