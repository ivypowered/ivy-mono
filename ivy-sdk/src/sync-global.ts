import { PublicKey } from "@solana/web3.js";
import { PUMP_PROGRAM_ID, PSWAP_PROGRAM_ID } from "./interface";

export class SyncGlobal {
    // Pump.fun globals
    public readonly pumpFeeRecipient: PublicKey;
    public readonly pumpGlobalVolumeAccumulator: PublicKey;

    // PumpSwap globals
    public readonly pswapEventAuthority: PublicKey;
    public readonly pswapGlobalVolumeAccumulator: PublicKey;
    public readonly pswapProtocolFeeRecipients: PublicKey[];

    constructor(
        pumpFeeRecipient: PublicKey,
        pumpGlobalVolumeAccumulator: PublicKey,
        pswapEventAuthority: PublicKey,
        pswapGlobalVolumeAccumulator: PublicKey,
        pswapProtocolFeeRecipients: PublicKey[],
    ) {
        this.pumpFeeRecipient = pumpFeeRecipient;
        this.pumpGlobalVolumeAccumulator = pumpGlobalVolumeAccumulator;
        this.pswapEventAuthority = pswapEventAuthority;
        this.pswapGlobalVolumeAccumulator = pswapGlobalVolumeAccumulator;
        this.pswapProtocolFeeRecipients = pswapProtocolFeeRecipients;
    }

    static create(
        pumpGlobalData: Buffer,
        pswapGlobalConfigData: Buffer,
    ): SyncGlobal {
        // Parse Pump.fun global
        const pumpFeeRecipient = new PublicKey(pumpGlobalData.subarray(41, 73));

        const [pumpGlobalVolumeAccumulator] = PublicKey.findProgramAddressSync(
            [Buffer.from("global_volume_accumulator")],
            PUMP_PROGRAM_ID,
        );

        // Parse protocol fee recipients
        const pswapProtocolFeeRecipients: PublicKey[] = [];
        const startOffset = 57;
        for (let i = 0; i < 8; i++) {
            const start = startOffset + i * 32;
            const end = start + 32;
            if (end > pswapGlobalConfigData.length) break;
            const recipient = new PublicKey(
                pswapGlobalConfigData.subarray(start, end),
            );
            if (!recipient.equals(PublicKey.default)) {
                pswapProtocolFeeRecipients.push(recipient);
            }
        }

        const [pswapEventAuthority] = PublicKey.findProgramAddressSync(
            [Buffer.from("__event_authority")],
            PSWAP_PROGRAM_ID,
        );

        const [pswapGlobalVolumeAccumulator] = PublicKey.findProgramAddressSync(
            [Buffer.from("global_volume_accumulator")],
            PSWAP_PROGRAM_ID,
        );

        return new SyncGlobal(
            pumpFeeRecipient,
            pumpGlobalVolumeAccumulator,
            pswapEventAuthority,
            pswapGlobalVolumeAccumulator,
            pswapProtocolFeeRecipients,
        );
    }

    getRandomProtocolFeeRecipient(): PublicKey {
        return (
            this.pswapProtocolFeeRecipients[
                Math.floor(
                    Math.random() * this.pswapProtocolFeeRecipients.length,
                )
            ] || PublicKey.default
        );
    }
}
