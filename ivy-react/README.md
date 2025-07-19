# ivy-react

This project is built with [Next.js](https://nextjs.org) and contains Ivy's React components.

When `ivy-react.js` is loaded into a webpage, it dynamically renders content based on specific elements found on the page:

1. **Transaction widget**: Using `#tx-widget` and `#tx-button` elements:

    - The `#tx-button` element will be enhanced to enable users to sign, send, and confirm transactions.
    - Transactions should be encoded as JSON and then Base64 in the `data-transaction` attribute of `#ivy-tx-button`.
    - The `#tx-widget` container displays the connect wallet modal.

2. **Game interface**: Using the `#ivy-game` element:
    - This container displays game content encoded as JSON and then Base64 in its `data-game` attribute.
