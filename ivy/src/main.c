#include "comment.h"
#include "game.h"
#include "mix.h"
#include "sync.h"
#include "vault.h"
#include "world.h"
#include <ivy-lib/context.h>
#include <ivy-lib/idl.h>

#define CALL_INSTRUCTION(CTX, NAME, FN, ACCOUNTS_TYPE, DATA_TYPE, data, data_len) \
    do { \
        if (CTX.ka_num * sizeof(SolAccountInfo) < sizeof(ACCOUNTS_TYPE)) { \
            sol_log("Error: Not enough accounts"); \
            return 1; \
        } \
        ACCOUNTS_TYPE* a = (ACCOUNTS_TYPE*)ctx.ka; \
        if (data_len < sizeof(DATA_TYPE)) { \
            sol_log("Error: Not enough data"); \
            return 1; \
        } \
        const DATA_TYPE* d = (DATA_TYPE*)data; \
        sol_log("Instruction: " NAME); \
        FN(&CTX, a, d); \
        return 0; \
    } while (0)

#define CALL_INSTRUCTION_WITH_LEN( \
    CTX, NAME, FN, ACCOUNTS_TYPE, DATA_TYPE, data, data_len \
) \
    do { \
        if (CTX.ka_num * sizeof(SolAccountInfo) < sizeof(ACCOUNTS_TYPE)) { \
            sol_log("Error: Not enough accounts"); \
            return 1; \
        } \
        ACCOUNTS_TYPE* a = (ACCOUNTS_TYPE*)ctx.ka; \
        if (data_len < sizeof(DATA_TYPE)) { \
            sol_log("Error: Not enough data"); \
            return 1; \
        } \
        const DATA_TYPE* d = (DATA_TYPE*)data; \
        sol_log("Instruction: " NAME); \
        FN(&CTX, a, d, data_len); \
        return 0; \
    } while (0)

extern u64 entrypoint(const u8* input) {
    // Load Solana context from input
    Context ctx = context_load(input);

    // Get discriminator
    require(ctx.data_len >= 8, "Provided data too short");
    u64 discriminator = *(u64*)ctx.data;

    // Get data after discriminator
    const u8* data = &ctx.data[8];
    u64 data_len = ctx.data_len - 8;

    // Roughly ordered by estimated frequency
    switch (discriminator) {
        // Event receiving
        case WORLD_RECEIVE_EVENT_DISCRIMINATOR:
            CALL_INSTRUCTION(
                ctx,
                "WorldReceiveEvent",
                world_receive_event,
                WorldReceiveEventAccounts,
                WorldReceiveEventData,
                data,
                data_len
            );

        // Swap operations
        case GAME_SWAP_DISCRIMINATOR:
            CALL_INSTRUCTION(
                ctx,
                "GameSwap",
                game_swap,
                GameSwapAccounts,
                GameSwapData,
                data,
                data_len
            );

        case WORLD_SWAP_DISCRIMINATOR:
            CALL_INSTRUCTION(
                ctx,
                "WorldSwap",
                world_swap,
                WorldSwapAccounts,
                WorldSwapData,
                data,
                data_len
            );

        // Mix operations
        case MIX_USDC_TO_GAME_DISCRIMINATOR:
            CALL_INSTRUCTION(
                ctx,
                "MixUsdcToGame",
                mix_usdc_to_game,
                MixUsdcToGameAccounts,
                MixUsdcToGameData,
                data,
                data_len
            );

        case MIX_GAME_TO_USDC_DISCRIMINATOR:
            CALL_INSTRUCTION(
                ctx,
                "MixGameToUsdc",
                mix_game_to_usdc,
                MixGameToUsdcAccounts,
                MixGameToUsdcData,
                data,
                data_len
            );

        case MIX_ANY_TO_GAME_DISCRIMINATOR:
            sol_log("Instruction: MixAnyToGame");
            mix_any_to_game(&ctx, data, data_len);
            return 0;

        case MIX_GAME_TO_ANY_DISCRIMINATOR:
            sol_log("Instruction: MixGameToAny");
            mix_game_to_any(&ctx, data, data_len);
            return 0;

        case MIX_ANY_TO_IVY_DISCRIMINATOR:
            sol_log("Instruction: MixAnyToIvy");
            mix_any_to_ivy(&ctx, data, data_len);
            return 0;

        case MIX_IVY_TO_ANY_DISCRIMINATOR:
            sol_log("Instruction: MixIvyToAny");
            mix_ivy_to_any(&ctx, data, data_len);
            return 0;

        // Game deposit/withdraw/burn operations
        case GAME_BURN_COMPLETE_DISCRIMINATOR:
            CALL_INSTRUCTION(
                ctx,
                "GameBurnComplete",
                game_burn_complete,
                GameBurnCompleteAccounts,
                GameBurnCompleteData,
                data,
                data_len
            );

        case GAME_DEPOSIT_COMPLETE_DISCRIMINATOR:
            CALL_INSTRUCTION(
                ctx,
                "GameDepositComplete",
                game_deposit_complete,
                GameDepositCompleteAccounts,
                GameDepositCompleteData,
                data,
                data_len
            );

        case GAME_WITHDRAW_CLAIM_DISCRIMINATOR:
            CALL_INSTRUCTION(
                ctx,
                "GameWithdrawClaim",
                game_withdraw_claim,
                GameWithdrawClaimAccounts,
                GameWithdrawClaimData,
                data,
                data_len
            );

        case GAME_CREDIT_DISCRIMINATOR:
            CALL_INSTRUCTION(
                ctx,
                "GameCredit",
                game_credit,
                GameCreditAccounts,
                GameCreditData,
                data,
                data_len
            );

        case GAME_DEBIT_DISCRIMINATOR:
            CALL_INSTRUCTION(
                ctx,
                "GameDebit",
                game_debit,
                GameDebitAccounts,
                GameDebitData,
                data,
                data_len
            );

        // Vault operations
        case VAULT_CREATE_DISCRIMINATOR:
            CALL_INSTRUCTION(
                ctx,
                "VaultCreate",
                vault_create,
                VaultCreateAccounts,
                VaultCreateData,
                data,
                data_len
            );

        case VAULT_DEPOSIT_DISCRIMINATOR:
            CALL_INSTRUCTION(
                ctx,
                "VaultDeposit",
                vault_deposit,
                VaultDepositAccounts,
                VaultDepositData,
                data,
                data_len
            );

        case VAULT_WITHDRAW_DISCRIMINATOR:
            CALL_INSTRUCTION(
                ctx,
                "VaultWithdraw",
                vault_withdraw,
                VaultWithdrawAccounts,
                VaultWithdrawData,
                data,
                data_len
            );

        case VAULT_EDIT_DISCRIMINATOR:
            CALL_INSTRUCTION(
                ctx,
                "VaultEdit",
                vault_edit,
                VaultEditAccounts,
                VaultEditData,
                data,
                data_len
            );

        // World operations
        case WORLD_CLAIM_VESTING_DISCRIMINATOR:
            CALL_INSTRUCTION(
                ctx,
                "WorldClaimVesting",
                world_claim_vesting,
                WorldClaimVestingAccounts,
                WorldClaimVestingData,
                data,
                data_len
            );

        // Setup/Configuration operations
        case GAME_CREATE_DISCRIMINATOR:
            CALL_INSTRUCTION_WITH_LEN(
                ctx,
                "GameCreate",
                game_create,
                GameCreateAccounts,
                GameCreateData,
                data,
                data_len
            );

        case WORLD_CREATE_DISCRIMINATOR:
            CALL_INSTRUCTION(
                ctx,
                "WorldCreate",
                world_create,
                WorldCreateAccounts,
                WorldCreateData,
                data,
                data_len
            );

        case GAME_EDIT_DISCRIMINATOR:
            CALL_INSTRUCTION_WITH_LEN(
                ctx,
                "GameEdit",
                game_edit,
                GameEditAccounts,
                GameEditData,
                data,
                data_len
            );

        case WORLD_SET_PARAMS_DISCRIMINATOR:
            CALL_INSTRUCTION(
                ctx,
                "WorldSetParams",
                world_set_params,
                WorldSetParamsAccounts,
                WorldSetParamsData,
                data,
                data_len
            );

        case WORLD_UPDATE_METADATA_DISCRIMINATOR:
            CALL_INSTRUCTION(
                ctx,
                "WorldUpdateMetadata",
                world_update_metadata,
                WorldUpdateMetadataAccounts,
                WorldUpdateMetadataData,
                data,
                data_len
            );

        case WORLD_SET_OWNER_DISCRIMINATOR:
            CALL_INSTRUCTION(
                ctx,
                "WorldSetOwner",
                world_set_owner,
                WorldSetOwnerAccounts,
                WorldSetOwnerData,
                data,
                data_len
            );

        case IDL_IX_TAG:
            idl_dispatch(&ctx);
            return 0;

        // Comments
        case COMMENT_POST_DISCRIMINATOR:
            CALL_INSTRUCTION_WITH_LEN(
                ctx,
                "CommentPost",
                comment_post,
                CommentPostAccounts,
                CommentPostData,
                data,
                data_len
            );

        // Sync
        case SYNC_CREATE_DISCRIMINATOR:
            CALL_INSTRUCTION_WITH_LEN(
                ctx,
                "SyncCreate",
                sync_create,
                SyncCreateAccounts,
                SyncCreateData,
                data,
                data_len
            );

        case SYNC_SWAP_DISCRIMINATOR:
            CALL_INSTRUCTION(
                ctx,
                "SyncSwap",
                sync_swap,
                SyncSwapAccounts,
                SyncSwapData,
                data,
                data_len
            );

        case SYNC_PSWAP_DISCRIMINATOR:
            CALL_INSTRUCTION(
                ctx,
                "SyncPswap",
                sync_pswap,
                SyncPswapAccounts,
                SyncPswapData,
                data,
                data_len
            );

        default:
            sol_log("Error: Unknown instruction discriminator");
            return 1;
    }
}
