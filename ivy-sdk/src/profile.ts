import { Connection, PublicKey } from "@solana/web3.js";
import {
    IVY_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    decodeGame,
    decodeMetadata,
    deriveMetadataAddress,
} from "./interface";

interface TokenAccountInfo {
    isNative: boolean;
    mint: string;
    owner: string;
    state: "initialized" | "frozen" | "uninitialized";
    tokenAmount: {
        amount: string;
        decimals: number;
        uiAmount: number;
        uiAmountString: string;
    };
}

/// For the given user, returns a mapping
/// of game addresses to raw balances.
export async function loadProfile(
    connection: Connection,
    user: PublicKey,
): Promise<Record<string, string>> {
    let token_accounts = (
        await connection.getParsedTokenAccountsByOwner(user, {
            programId: TOKEN_PROGRAM_ID,
        })
    ).value
        .map((x) => x.account.data.parsed.info as TokenAccountInfo)
        .filter((x) => Number(x.tokenAmount.amount) > 0);

    const metadata_info_options = await connection.getMultipleAccountsInfo(
        token_accounts.map((x) => deriveMetadataAddress(new PublicKey(x.mint))),
    );

    token_accounts = token_accounts.filter(
        (_, i) => !!metadata_info_options[i],
    );

    const metadatas = metadata_info_options
        .filter((x) => !!x)
        .map((x) => decodeMetadata(x.data));
    const update_authorities = metadatas.map((x) => x.updateAuthority);

    const update_authority_infos =
        await connection.getMultipleAccountsInfo(update_authorities);

    const profile: Record<string, string> = {};

    for (let i = 0; i < update_authority_infos.length; i++) {
        const update_authority_info = update_authority_infos[i];
        if (!update_authority_info) {
            continue;
        }
        const { owner, data } = update_authority_info;
        // Skip if not owned by the Ivy program
        if (!owner.equals(IVY_PROGRAM_ID)) {
            continue;
        }

        const { amount } = token_accounts[i].tokenAmount;
        const update_authority = update_authorities[i];

        const _ = decodeGame(data);
        const game_key = update_authority.toBase58();
        profile[game_key] = amount;
    }

    return profile;
}
