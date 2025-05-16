/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/token_metadata.json`.
 */
export type TokenMetadata = {
    address: "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s";
    metadata: {
        name: "tokenMetadata";
        version: "0.3.0";
        spec: "0.1.0";
        description: "MPL Metadata";
    };
    instructions: [];
    accounts: [
        {
            name: "metadata";
            discriminator: [0, 0, 0, 0, 0, 0, 0, 0];
        },
    ];
    types: [
        {
            name: "metadata";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "key";
                        type: {
                            defined: {
                                name: "key";
                            };
                        };
                    },
                    {
                        name: "updateAuthority";
                        type: "pubkey";
                    },
                    {
                        name: "mint";
                        type: "pubkey";
                    },
                    {
                        name: "data";
                        type: {
                            defined: {
                                name: "data";
                            };
                        };
                    },
                    {
                        name: "primarySaleHappened";
                        type: "bool";
                    },
                    {
                        name: "isMutable";
                        type: "bool";
                    },
                    {
                        name: "editionNonce";
                        type: {
                            option: "u8";
                        };
                    },
                    {
                        name: "tokenStandard";
                        type: {
                            option: {
                                defined: {
                                    name: "tokenStandard";
                                };
                            };
                        };
                    },
                    {
                        name: "collection";
                        type: {
                            option: {
                                defined: {
                                    name: "collection";
                                };
                            };
                        };
                    },
                    {
                        name: "uses";
                        type: {
                            option: {
                                defined: {
                                    name: "uses";
                                };
                            };
                        };
                    },
                    {
                        name: "collectionDetails";
                        type: {
                            option: {
                                defined: {
                                    name: "collectionDetails";
                                };
                            };
                        };
                    },
                    {
                        name: "programmableConfig";
                        type: {
                            option: {
                                defined: {
                                    name: "programmableConfig";
                                };
                            };
                        };
                    },
                ];
            };
        },
        {
            name: "collection";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "verified";
                        type: "bool";
                    },
                    {
                        name: "key";
                        type: "pubkey";
                    },
                ];
            };
        },
        {
            name: "collectionDetails";
            type: {
                kind: "enum";
                variants: [
                    {
                        name: "v1";
                        fields: [
                            {
                                name: "size";
                                type: "u64";
                            },
                        ];
                    },
                    {
                        name: "v2";
                        fields: [
                            {
                                name: "padding";
                                type: {
                                    array: ["u8", 8];
                                };
                            },
                        ];
                    },
                ];
            };
        },
        {
            name: "creator";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "address";
                        type: "pubkey";
                    },
                    {
                        name: "verified";
                        type: "bool";
                    },
                    {
                        name: "share";
                        type: "u8";
                    },
                ];
            };
        },
        {
            name: "data";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "name";
                        type: "string";
                    },
                    {
                        name: "symbol";
                        type: "string";
                    },
                    {
                        name: "uri";
                        type: "string";
                    },
                    {
                        name: "sellerFeeBasisPoints";
                        type: "u16";
                    },
                    {
                        name: "creators";
                        type: {
                            option: {
                                vec: {
                                    defined: {
                                        name: "creator";
                                    };
                                };
                            };
                        };
                    },
                ];
            };
        },
        {
            name: "key";
            type: {
                kind: "enum";
                variants: [
                    {
                        name: "uninitialized";
                    },
                    {
                        name: "editionV1";
                    },
                    {
                        name: "masterEditionV1";
                    },
                    {
                        name: "reservationListV1";
                    },
                    {
                        name: "metadataV1";
                    },
                    {
                        name: "reservationListV2";
                    },
                    {
                        name: "masterEditionV2";
                    },
                    {
                        name: "editionMarker";
                    },
                    {
                        name: "useAuthorityRecord";
                    },
                    {
                        name: "collectionAuthorityRecord";
                    },
                    {
                        name: "tokenOwnedEscrow";
                    },
                    {
                        name: "tokenRecord";
                    },
                    {
                        name: "metadataDelegate";
                    },
                    {
                        name: "editionMarkerV2";
                    },
                    {
                        name: "holderDelegate";
                    },
                ];
            };
        },
        {
            name: "programmableConfig";
            type: {
                kind: "enum";
                variants: [
                    {
                        name: "v1";
                        fields: [
                            {
                                name: "ruleSet";
                                type: {
                                    option: "pubkey";
                                };
                            },
                        ];
                    },
                ];
            };
        },
        {
            name: "reservation";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "address";
                        type: "pubkey";
                    },
                    {
                        name: "spotsRemaining";
                        type: "u64";
                    },
                    {
                        name: "totalSpots";
                        type: "u64";
                    },
                ];
            };
        },
        {
            name: "tokenStandard";
            type: {
                kind: "enum";
                variants: [
                    {
                        name: "nonFungible";
                    },
                    {
                        name: "fungibleAsset";
                    },
                    {
                        name: "fungible";
                    },
                    {
                        name: "nonFungibleEdition";
                    },
                    {
                        name: "programmableNonFungible";
                    },
                    {
                        name: "programmableNonFungibleEdition";
                    },
                ];
            };
        },
        {
            name: "useMethod";
            type: {
                kind: "enum";
                variants: [
                    {
                        name: "burn";
                    },
                    {
                        name: "multiple";
                    },
                    {
                        name: "single";
                    },
                ];
            };
        },
        {
            name: "uses";
            type: {
                kind: "struct";
                fields: [
                    {
                        name: "useMethod";
                        type: {
                            defined: {
                                name: "useMethod";
                            };
                        };
                    },
                    {
                        name: "remaining";
                        type: "u64";
                    },
                    {
                        name: "total";
                        type: "u64";
                    },
                ];
            };
        },
    ];
};
