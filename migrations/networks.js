const BN = require("bn.js");

const config = {
    MINIMUM_BOND: new BN(100000).mul(new BN(10).pow(new BN(18))),
    MINIMUM_POD_SIZE: 3, // 24 in production
    MINIMUM_EPOCH_INTERVAL_SECONDS: 30, // 216000 in production, 1 month
    DARKNODE_PAYOUT_PERCENT: 50, // Only payout 50% of the reward pool
    BLACKLIST_SLASH_PERCENT: 0, // Don't slash bond for blacklisting
    MALICIOUS_SLASH_PERCENT: 50, // Slash 50% of the bond
    SECRET_REVEAL_SLASH_PERCENT: 100, // Slash 100% of the bond
    mintAuthority: "", // Darknode public key
    shiftInFee: 10,
    shiftOutFee: 10,
    zBTCMinShiftOutAmount: 10000,
    zZECMinShiftOutAmount: 10000,
    zBCHMinShiftOutAmount: 10000,
}

module.exports = {
    mainnet: {
        RenToken: "0x408e41876cCCDC0F92210600ef50372656052a38",
        DarknodeSlasher: "0x0000000000000000000000000000000000000000",
        DarknodeRegistry: "0x34bd421C7948Bc16f826Fd99f9B785929b121633",
        DarknodeRegistryStore: "0x06df0657ba5e8f5339e742212669f6e7ee3c5057",
        DarknodePayment: "0x5a7802E66b067cB1770ee5b1165AA201690A8B6a",
        DarknodePaymentStore: "0x731Ea4Ba77fF184d89dBeB160A0078274Acbe9D2",
        tokens: {
            DAI: "0x89d24A6b4CcB1B6fAA2625fE562bDD9a23260359",
            ETH: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
        },

        ShifterRegistry: "",
        zZEC: "",
        BTCShifter: "",
        zBTC: "",
        ZECShifter: "",
        zBCH: "",
        BCHShifter: "",

        config: {
            ...config,
            mintAuthority: "TODO",
        },
    },
    chaosnet: {
        RenToken: "0x408e41876cCCDC0F92210600ef50372656052a38",
        DarknodeSlasher: "0x0000000000000000000000000000000000000000",
        DarknodeRegistry: "0xe0a0FC6eCABa77638b4f516C11B68f3837fe949a",
        DarknodeRegistryStore: "0x14Add4Ca443E7445A3418bB572D6079bFC98897a",
        DarknodePayment: "0x50190F37020505405670656E50A3df49484a9123",
        DarknodePaymentStore: "0x7546dbfB23F22C05b190DFbbBAa48E4420316677",
        tokens: {
            DAI: "0x89d24A6b4CcB1B6fAA2625fE562bDD9a23260359",
            ETH: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
        },

        BTCShifter: "0x2F4657e26D4887Ed9029FD5B97661FF4582D0cD6",
        ZECShifter: "0x8cb5e78CD53A6b994d5C1Cc52A4A773705A9599a",
        BCHShifter: "0xE0926B2f1B37c2DAE0c5682F5Fd75ADf83CFe771",
        zBTC: "0xc04956C6472CDd58766614f8D47F6826aC477fB9",
        zZEC: "0x09aA07Ae98fdE91D66775C13107e9F082fF65295",
        zBCH: "0x0e68EE104c768078cB3624396AAf9285C58f1a73",
        ShifterRegistry: "0x1d4713B74e79A3696722Aebe05de976979876CAC",

        config: {
            ...config,
            MINIMUM_BOND: new BN(10000).mul(new BN(10).pow(new BN(18))),
            mintAuthority: "0x5D0b91e8a8037C3EBB55f52D76BFc64CaBEBCAE1", // TODO
        },
    },
    testnet: {
        RenToken: "0x2cd647668494c1b15743ab283a0f980d90a87394",
        DarknodeSlasher: "0x0000000000000000000000000000000000000000",
        DarknodeRegistry: "0x39238ddCc6b301068f6D5B3DCa3A981EB20ba9A3",
        DarknodeRegistryStore: "0xc24146aE71470C2f8749DA0738b09434E0220d92",
        DarknodePayment: "0x7e4E9ECeD2ba1EE5051C3B17dd1F81E7C1AfBFb1",
        DarknodePaymentStore: "0xF842CE0536B49898AC4f7D8aEb5c7764bd3DB443",
        tokens: {
            DAI: "0xc4375b7de8af5a38a93548eb8453a498222c4ff2",
            ETH: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
        },

        BTCShifter: "0xe5c5dAe20CdE920AEEcaE132fB37321523e2fbA5",
        ZECShifter: "0xD0B7E226e7605c0436D37AabE44668F89f941E70",
        BCHShifter: "0x0aFf3BCFD89453d22d38C32bC6b03041f244BB4b",
        zBTC: "0xc6069E8DeA210C937A846db2CEbC0f58ca111f26",
        zZEC: "0xB9b5B5346BF8CA9bc02f4F9d8947916b7CA9C97E",
        zBCH: "0x7bdb2A8231eB4E4795749F01f0241940a8166575",
        ShifterRegistry: "0xbA563a8510d86dE95F5a50007E180d6d4966ad12",

        config: {
            ...config,
            mintAuthority: "0x44Bb4eF43408072bC888Afd1a5986ba0Ce35Cb54",
        },
    },

    devnet: {
        RenToken: "0x2cd647668494c1b15743ab283a0f980d90a87394",
        DarknodeSlasher: "0xfe48363206E1849a2F53f5214af932354c35FD89",
        DarknodeRegistry: "0x6E1a6b85f05bfec5c24C7a26E302cB28e639651c",
        DarknodeRegistryStore: "0xC126a308dd07Adfa4a445686dcF7CbC423185593",
        DarknodePayment: "0x1f1b1d015Fc31d425C616cC35E39e31686DA69A8",
        DarknodePaymentStore: "0x6341DF1012E862f766Fcd72e0fCAAc5a3839CFef",
        tokens: {
            DAI: "0xc4375b7de8af5a38a93548eb8453a498222c4ff2",
            ETH: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
        },

        BTCShifter: "0x8fB4F7D1ea9329697127F2784399301c0F8E6866",
        ZECShifter: "0x19Fe91276a992c2E85544C627583fcc535ff0661",
        zBTC: "0x916B8012E1813E5924a3Eca400dBE6C7055a8484",
        zZEC: "0x71b6A19Fc832bD9C739489EcBEa67ab41261026F",
        zBCH: "0xfC1bc29e7a7282DA195f9b8A824cf242c770673F",
        BCHShifter: "0x9b74517b18D8D0581df70dc6376db5f4974ebfbD",
        ShifterRegistry: "0xc7B310c18D78f175812CFfD8896d3cC959aC28d6",

        config: {
            ...config,
            mintAuthority: "0x1B9d58208879AA9aa9E10040b34cF2b684237621",
        },
    },

    localnet: {
        RenToken: "0x2cd647668494c1b15743ab283a0f980d90a87394",
        DarknodeSlasher: "0xa6B1d1E63B92F8Fb36F8E1356FD5739e6433f0a3",
        DarknodeRegistry: "0xA7F5B11657AA2796B9355DceF075202C26507B9B",
        DarknodeRegistryStore: "0x46d016F50837a5DF8fe229127e54fb18B621bAeF",
        DarknodePayment: "0x7c71E53853863ce0a3BE7D024EF99aba7d872bfe",
        DarknodePaymentStore: "0x72Acdf4f0E3245262E46Bd8daCc207Df7CF3A534",
        tokens: {
            DAI: "0xc4375b7de8af5a38a93548eb8453a498222c4ff2",
            ETH: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
        },

        ShifterRegistry: "0x33666067A7741B9e88520285C96B776E73281811",
        zBTC: "0xDE027035d33CEB2757685E325de1A0b924aA73E6",
        BTCShifter: "0x7012ECc13De5Ce416C14C013d9b02b7c37154b37",
        zZEC: "0xB7b7be50B13E6817afBb30C93161D0eB388b8f08",
        ZECShifter: "0x69AC72Cb35B1AA818e90842C048719a3246ba0BE",
        zBCH: "",
        BCHShifter: "",

        config: {
            ...config,
            mintAuthority: "0x04084f1cACCB87Dcab9a29a084281294dA96Bf44",
        },
    },

    config,
}