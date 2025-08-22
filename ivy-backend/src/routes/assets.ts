import { z } from "zod";
import { Request } from "express";
import { Deps } from "../types/deps";
import { createAndUploadMetadata, uploadImageToIPFS } from "../util";
import { parsePublicKey } from "../utils/requestHelpers";

const imageSchema = z.object({
    base64_image: z.string(),
    image_type: z.string(),
});

export const uploadImage = (_: Deps) => async (req: Request) => {
    const data = imageSchema.parse(req.body);
    const image_url = await uploadImageToIPFS(
        data.base64_image,
        data.image_type,
    );
    return image_url;
};

const metadataSchema = z.object({
    name: z.string(),
    symbol: z.string(),
    icon_url: z.string(),
    description: z.string(),
});

export const uploadMetadata = (_: Deps) => async (req: Request) => {
    const data = metadataSchema.parse(req.body);
    const metadata_url = await createAndUploadMetadata(
        data.name,
        data.symbol,
        data.icon_url,
        data.description,
    );
    return metadata_url;
};
