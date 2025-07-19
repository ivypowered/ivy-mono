<?php

define("BACKEND_API_URL", getenv("IVY_BACKEND_URL") ?: "http://127.0.0.1:4000");
define(
    "AGGREGATOR_API_URL",
    getenv("IVY_AGGREGATOR_URL") ?: "http://127.0.0.1:5000"
);
define(
    "SQL_SERVER_URL",
    getenv("SQL_SERVER_URL") ?: "sqlite:" . __DIR__ . "/../tmp.sqlite"
);

?>
