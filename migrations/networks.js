const BN = require("bn.js");

const config = {
    MINIMUM_BOND: new BN(100000).mul(new BN(10).pow(new BN(18))),
    MINIMUM_POD_SIZE: 3, // 24 in production
    MINIMUM_EPOCH_INTERVAL_SECONDS: 30, // 216000 in production, 1 month
    DARKNODE_PAYOUT_PERCENT: 50, // Only payout 50% of the reward pool
    BLACKLIST_SLASH_PERCENT: 0, // Don't slash bond for blacklisting
    MALICIOUS_SLASH_PERCENT: 50, // Slash 50% of the bond
    SECRET_REVEAL_SLASH_PERCENT: 100, // Slash 100% of the bond
};

module.exports = {
    mainnet: {
        RenProxyAdmin: "0xDf1D8eD27C54bBE5833320cf5a19fd9E73530145",
        RenToken: "0x408e41876cCCDC0F92210600ef50372656052a38",
        DarknodeSlasher: "0x64512ff05a27756694E306e483cBB725F1754C0e",

        // Protocol
        ProtocolLogicV1: "0x8b49f212F2236F4f49bBeff878a73051a8915DE0",
        ProtocolProxy: "0xc25167fFa19B4d9d03c7d5aa4682c7063F345b66",

        // DNR
        DarknodeRegistryStore: "0x60Ab11FE605D2A2C3cf351824816772a131f8782",
        DarknodeRegistryLogicV1: "0x33b53A700de61b6be01d65A758b3635584bCF140",
        DarknodeRegistryProxy: "0x2D7b6C95aFeFFa50C068D50f89C5C0014e054f0A",
        DarknodeRegistryLogicV2: "",
        DarknodeRegistryV1ToV2Upgrader: "",

        // DNP
        DarknodePaymentStore: "0xE33417797d6b8Aec9171d0d6516E88002fbe23E7",
        DarknodePayment: "0x098e1708b920EFBdD7afe33Adb6a4CBa30c370B9",

        tokens: {
            DAI: "0x6b175474e89094c44da98b954eedeac495271d0f",
            ETH: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
        },

        config: {
            ...config,
        },
    },
    testnet: {
        RenProxyAdmin: "0x4C695C4Aa6238f0A7092733180328c2E64C912C7",
        RenToken: "0x2cd647668494c1b15743ab283a0f980d90a87394",
        DarknodeSlasher: "0x5B403bdC360A447290758c8BA779c44cdFC3476F",

        // Protocol
        ProtocolLogicV1: "0x43d39d7ea61741f26E09D377F4E79B1F847Dc356",
        ProtocolProxy: "0x59e23c087cA9bd9ce162875811CD6e99134D6d0F",

        // DNR
        DarknodeRegistryStore: "0x9daa16aA19e37f3de06197a8B5E638EC5e487392",
        DarknodeRegistryLogicV1: "0x046EDe9916e13De79d5530b67FF5dEbB7B72742C",
        DarknodeRegistryLogicV2: "0x61ffD5059Af59D480C57d43DCC09eea653e95eC8",
        DarknodeRegistryProxy: "0x9954C9F839b31E82bc9CA98F234313112D269712",
        DarknodeRegistryV1ToV2Upgrader:
            "0x6587720afB2b306b1888408B907E2A4DD8B18651",

        // DNP
        DarknodePaymentStore: "0x0EC73cCDCd8e643d909D0c4b663Eb1B2Fb0b1e1C",
        DarknodePayment: "0x023f2e94C3eb128D3bFa6317a3fF860BF93C1616",

        tokens: {
            DAI: "0xc4375b7de8af5a38a93548eb8453a498222c4ff2",
            ETH: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
        },

        config: {
            ...config,
        },
    },

    devnet: {
        RenProxyAdmin: "0xA2C9D593bC096FbB3Cf5b869270645C470E5416B",
        RenToken: "0x2cd647668494c1b15743ab283a0f980d90a87394",
        DarknodeSlasher: "0xf4E4AdbDDfd6EBc9457ad7ab9249f63701942BE3",

        // Protocol
        ProtocolLogicV1: "0x4535CB2f0697e797C534cb0853F25470A9f59037",
        ProtocolProxy: "0x5045E727D9D9AcDe1F6DCae52B078EC30dC95455",

        // DNR
        DarknodeRegistryStore: "0x3ccF0cd02ff15b59Ce2B152CdDE78551eFd34a62",
        DarknodeRegistryLogicV1: "0x26D6fEC1C904EB5b86ACed6BB804b4ed35208704",
        DarknodeRegistryProxy: "0x7B69e5e15D4c24c353Fea56f72E4C0c5B93dCb71",
        DarknodeRegistryLogicV2: "",
        DarknodeRegistryV1ToV2Upgrader: "",

        // DNP
        DarknodePaymentStore: "0xfb98D6900330844CeAce6Ae4ae966D272bE1aeC3",
        DarknodePayment: "0xC7F24fEDfbbAA5248E1F5a160cC30Dcbff9F1176",

        tokens: {
            DAI: "0xc4375b7de8af5a38a93548eb8453a498222c4ff2",
            ETH: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
        },

        config: {
            ...config,
        },
    },

    config,
};
