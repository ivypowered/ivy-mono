import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { ivy_program, IVY_PROGRAM_ID, WORLD_ADDRESS } from "./interface";

const COMMENT_INDEX_PREFIX = Buffer.from("comment_index");

export type CommentIndex = {
    game: PublicKey;
    totalComments: number;
};

function u64ToLEBytes(x: number): Buffer {
    const lbi = Buffer.alloc(8);
    for (let i = 0; i < 8; i++) {
        lbi[i] = x & 0xff;
        // shr by 8, but avoiding JS 32-bit casting
        x = Math.floor(x / 256);
    }
    return lbi;
}

export class Comment {
    static MAX_LEN = 280;

    game: PublicKey;
    index: number;
    user: PublicKey;
    timestamp: number;
    text: string;

    constructor(
        game: PublicKey,
        index: number,
        user: PublicKey,
        timestamp: number,
        text: string,
    ) {
        this.game = game;
        this.index = index;
        this.user = user;
        this.timestamp = timestamp;
        this.text = text;
    }

    static async getIndex(
        connection: Connection,
        game: PublicKey,
    ): Promise<CommentIndex> {
        const commentIndex = PublicKey.findProgramAddressSync(
            [COMMENT_INDEX_PREFIX, game.toBuffer()],
            IVY_PROGRAM_ID,
        )[0];
        const ciInfo = await connection.getAccountInfo(commentIndex);
        if (!ciInfo) {
            throw new Error(`can't find comment index for game ${game}`);
        }
        type CommentIndexAnchor = Awaited<
            ReturnType<(typeof ivy_program)["account"]["commentIndex"]["fetch"]>
        >;
        const ci: CommentIndexAnchor = ivy_program.coder.accounts.decode(
            "commentIndex",
            ciInfo.data,
        );
        return {
            game: ci.game,
            totalComments: ci.totalCount.toNumber(),
        };
    }

    static async post(
        user: PublicKey,
        game: PublicKey,
        text: string,
    ): Promise<Transaction> {
        if (text.length > Comment.MAX_LEN) {
            throw new Error(
                `comment too large (expected no more than ${Comment.MAX_LEN} characters, got ${text.length})`,
            );
        }
        const ci = PublicKey.findProgramAddressSync(
            [COMMENT_INDEX_PREFIX, game.toBuffer()],
            IVY_PROGRAM_ID,
        )[0];
        return await ivy_program.methods
            .commentPost(text)
            .accounts({
                ci,
                game,
                user,
                world: WORLD_ADDRESS,
            })
            .transaction();
    }
}
