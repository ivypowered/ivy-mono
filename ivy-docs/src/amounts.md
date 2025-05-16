# Amounts

Ivy uses two formats for token amounts. The raw format is the native format for all on-chain transactions and internal calculations, and represents the smallest indivisible unit. The decimal format is a human-readable representation that you can display to users. In the decimal format, 1 unit = 10^9 raw. In the REST API and the JS SDK, amounts in the raw format are passed and returned as strings, as these values can exceed JavaScript's safe integer limit (2^53 - 1).

To convert from raw to decimal format, divide by 10^9. To convert from decimal to raw format, multiply by 10^9.

<div style="margin: 10px 0">
    <div style="margin-top: 5px">
        <label for="units" style="display: inline-block; width: 60px"
            >Units:</label
        >
        <input id="units" type="text" placeholder="0" />
    </div>
    <div>
        <label for="raw" style="display: inline-block; width: 60px">Raw:</label>
        <input id="raw" type="text" placeholder="0" />
    </div>
</div>

<script>
    (function() {
        const r = document.getElementById("raw");
        const u = document.getElementById("units");
        const factor = 1e9;

        function get(x) {
            return x.value.replace(/,/g, "") || 0;
        }

        function put(x, v) {
            x.value = v.toFixed(9).replace(
                /(?<=\.\d*[1-9])0+$|\.0*$/, ""
            );
        }

        r.addEventListener("input", () => {
            put(u, get(r) / factor);
        });

        u.addEventListener("input", () => {
            put(r, Math.floor(get(u) * factor));
        });
    })();
</script>
