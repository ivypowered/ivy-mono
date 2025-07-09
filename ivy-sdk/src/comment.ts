import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { ivy_program, IVY_PROGRAM_ID, WORLD_ADDRESS } from "./interface";

const COMMENT_INDEX_PREFIX = Buffer.from("comment_index");
const COMMENT_BUFFER_PREFIX = Buffer.from("comment_buffer");

export type CommentIndex = {
    bufAddress: PublicKey;
    game: PublicKey;
    bufIndex: number;
    bufNonce: number;
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
            bufAddress: ci.bufAddress,
            game: ci.game,
            bufIndex: ci.bufIndex.toNumber(),
            bufNonce: ci.bufNonce,
        };
    }

    static async getComments(
        connection: Connection,
        game: PublicKey,
        start: number,
        endExclusive: number,
    ): Promise<Comment[]> {
        const pages = [];
        for (let i = start; i < endExclusive; i++) {
            pages.push(
                PublicKey.findProgramAddressSync(
                    [COMMENT_BUFFER_PREFIX, game.toBuffer(), u64ToLEBytes(i)],
                    IVY_PROGRAM_ID,
                )[0],
            );
        }

        const result = await connection.getMultipleAccountsInfo(pages);
        const comments: Comment[] = [];
        for (let i = 0; i < result.length; i++) {
            const info = result[i];
            if (!info || !info.data) {
                throw new Error(
                    `can't find info for comment buffer at index ${i}, game ${game.toBase58()}`,
                );
            }

            const data = info.data;
            let offset = 0;

            // Parse all comments in this buffer
            // Format: [8-byte index][32-byte address][8-byte timestamp][text][null terminator]
            while (true) {
                if (offset + 8 + 32 + 8 >= data.length) {
                    break; // Not enough data for index + address + timestamp
                }

                // Read index (8 bytes, little endian)
                const indexBytes = data.slice(offset, offset + 8);
                const index =
                    indexBytes.readUint32LE(0) + // lo
                    4294967296 * indexBytes.readUint32LE(4); // hi

                // Read user address (32 bytes)
                const userBytes = data.slice(offset, offset + 32);
                const user = new PublicKey(userBytes);
                offset += 32;

                // Read timestamp (8 bytes, little endian)
                const timestampBytes = data.slice(offset, offset + 8);
                const timestamp =
                    timestampBytes.readUint32LE(0) + // lo
                    4294967296 * timestampBytes.readUint32LE(4); // hi
                offset += 8;

                // Read text until null terminator
                let textEnd = offset;
                while (textEnd < data.length && data[textEnd] !== 0) {
                    textEnd++;
                }

                if (textEnd >= data.length) {
                    break; // No null terminator found
                }

                const text = data.slice(offset, textEnd).toString("utf8");
                offset = textEnd + 1; // Skip null terminator

                comments.push(new Comment(game, index, user, timestamp, text));
            }
        }

        return comments;
    }

    static async post(
        user: PublicKey,
        game: PublicKey,
        text: string,
        latestBufIndex: number,
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
        const cbCur = PublicKey.findProgramAddressSync(
            [
                COMMENT_BUFFER_PREFIX,
                game.toBuffer(),
                u64ToLEBytes(latestBufIndex),
            ],
            IVY_PROGRAM_ID,
        )[0];
        const cbNext = PublicKey.findProgramAddressSync(
            [
                COMMENT_BUFFER_PREFIX,
                game.toBuffer(),
                u64ToLEBytes(latestBufIndex + 1),
            ],
            IVY_PROGRAM_ID,
        )[0];
        return await ivy_program.methods
            .commentPost(text)
            .accounts({
                ci,
                game,
                user,
                cbCur,
                cbNext,
                world: WORLD_ADDRESS,
            })
            .transaction();
    }
}
