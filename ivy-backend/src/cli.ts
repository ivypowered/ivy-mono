import { program } from "commander";
import { Connection } from "@solana/web3.js";
import dotenv from "dotenv";
import { RPC_URL } from "./constants";

import { registerNewWorldCommand } from "./commands/new-world";
import { registerSetOwnerCommand } from "./commands/set-owner";
import { registerLoadWorldCommand } from "./commands/load-world";
import { registerWorldSwapCommand } from "./commands/world-swap";
import { registerSetParamsCommand } from "./commands/set-params";
import { registerNewGameCommand } from "./commands/new-game";
import { registerDebugMintCommand } from "./commands/debug-mint";
import { registerCreateTestGamesCommand } from "./commands/create-test-games";
import { registerGameEditCommand } from "./commands/game-edit";

// Load env
dotenv.config();

// Create connection to the Solana blockchain
const connection = new Connection(RPC_URL, "confirmed");

// Initialize commander
program
    .name("ivy-cli")
    .description("CLI tool for Ivy development operations")
    .version("0.1.0");

// Register commands (dependency-injected)
registerNewWorldCommand(program, connection);
registerSetOwnerCommand(program, connection);
registerLoadWorldCommand(program, connection);
registerWorldSwapCommand(program, connection);
registerSetParamsCommand(program, connection);
registerNewGameCommand(program, connection);
registerDebugMintCommand(program, connection);
registerCreateTestGamesCommand(program, connection);
registerGameEditCommand(program, connection);

// Parse
program.parse(process.argv);
