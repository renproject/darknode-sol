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
    mintFee: 10,
    burnFee: 10,
    renBTCMinimumBurnAmount: 10000,
    renZECMinimumBurnAmount: 10000,
    renBCHMinimumBurnAmount: 10000,

    tokenPrefix: "mock"
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

        // DNP
        DarknodePaymentStore: "0xE33417797d6b8Aec9171d0d6516E88002fbe23E7",
        DarknodePayment: "0x098e1708b920EFBdD7afe33Adb6a4CBa30c370B9",

        tokens: {
            DAI: "0x6b175474e89094c44da98b954eedeac495271d0f",
            ETH: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
        },

        RenERC20LogicV1: "0xe2d6cCAC3EE3A21AbF7BeDBE2E107FfC0C037e80",
        GatewayLogicV1: "0x402ec534BaF9e8Dd2968c57fDea368f3856460d6",
        BTCGateway: "0xe4b679400F0f267212D5D812B95f58C83243EE71",
        ZECGateway: "0xc3BbD5aDb611dd74eCa6123F05B18acc886e122D",
        BCHGateway: "0xCc4FF5b8A4A7adb35F00ff0CBf53784e07c3C52F",
        renBTC: "0xEB4C2781e4ebA804CE9a9803C67d0893436bB27D",
        renZEC: "0x1C5db575E2Ff833E46a2E9864C22F4B22E0B37C2",
        renBCH: "0x459086F2376525BdCebA5bDDA135e4E9d3FeF5bf",
        GatewayRegistry: "0xe80d347DF1209a76DD9d2319d62912ba98C54DDD",

        BasicAdapter: "0x32666B64e9fD0F44916E1378Efb2CFa3B3B96e80",

        config: {
            ...config,
            mintAuthority: "0x7f64e4e4b2d7589eb0ac8439c0e639856aeceee7",
            // communityFund: "",

            tokenPrefix: "ren"
        }
    },
    chaosnet: {
        tokens: {
            DAI: "0x6b175474e89094c44da98b954eedeac495271d0f",
            ETH: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
        },

        /* 1_darknodes.js */

        RenProxyAdmin: "0x3840c01167cf06C3101762f0Fce991BEfA1CdFAF",
        RenToken: "0x8E0679d0d4691Ea345fB8C2aEc9bf9c1d3eb40eD",

        // Protocol
        ProtocolLogicV1: "0x637278Bf72127c76d98D9a9BE36D2121fB2447c8",
        ProtocolProxy: "0xf61e97c464ec0cf48b33262c3a1ef42114275144",

        // DNR
        DarknodeRegistryStore: "0x4C2f0533af3792695e71699Ff221205f7FA47579",
        DarknodeRegistryLogicV1: "0x308ecdCEfA3231ad1a8083Bd42510830e749FbB7",
        DarknodeRegistryProxy: "0x7C08FF068b7FF6d7d2f431f08B8C2e536ed693DD",

        // DNP
        DarknodePaymentStore: "0x9C5B076dE6c5c01c9E1ac4cB5b48fB681384742B",
        DarknodePayment: "0xdf2a33Bf44F917b85a716aA1e98Af0bBa4085dEc",

        // Slasher
        DarknodeSlasher: "0xD33CfE24e84D3156211CC2eA74192593Ccf559Aa",

        /* 2_shifter.js */

        GatewayRegistry: "0x817d2E41dABbA7A5e840353c9D73A40674ED3400",
        BasicAdapter: "0x0807d0810714d85B49E40349a3002F06e841B7c3",

        RenERC20LogicV1: "0x0A2d368E4EeCBd515033BA29253909F2978C1Bee",
        GatewayLogicV1: "0x85BdE74CA4760587eC9d77f775Cb83d4Cb76e5ae",

        // BTC
        renBTC: "0x93E47eC9B8cD1a669C7267E20ACF1F6a9c5340Ba",
        BTCGateway: "0xD4d496632b9aF3122FB5DdbF0614aA82effa9F99",

        // ZEC
        renZEC: "0x82E728594b87318e513931469A30713FEF966c8E",
        ZECGateway: "0x37A4860728E292E5852B215c46DBE7a18862EF93",

        // BCH
        renBCH: "0xa2F0a92396cb245BaD15BA77817E1620c58bf05b",
        BCHGateway: "0xc3AC15BEc6dA89e8DC5c4d1b4d0C785547676e3a",

        config: {
            ...config,
            MINIMUM_BOND: new BN(10000).mul(new BN(10).pow(new BN(18))),
            mintAuthority: "0x1D1A5e08Cb784BA16d69F25551Aea5C49482505c",

            tokenPrefix: "chaos"
        }
    },
    testnet: {
        /* 1_darknodes.js */

        RenProxyAdmin: "0x4C695C4Aa6238f0A7092733180328c2E64C912C7",
        RenToken: "0x2cd647668494c1b15743ab283a0f980d90a87394",

        // Protocol
        ProtocolLogicV1: "0x43d39d7ea61741f26E09D377F4E79B1F847Dc356",
        ProtocolProxy: "0x59e23c087cA9bd9ce162875811CD6e99134D6d0F",

        // DNR
        DarknodeRegistryStore: "0x9daa16aA19e37f3de06197a8B5E638EC5e487392",
        DarknodeRegistryLogicV1: "0x046EDe9916e13De79d5530b67FF5dEbB7B72742C",
        DarknodeRegistryProxy: "0x9954C9F839b31E82bc9CA98F234313112D269712",

        // DNP
        DarknodePaymentStore: "0x0EC73cCDCd8e643d909D0c4b663Eb1B2Fb0b1e1C",
        DarknodePayment: "0x023f2e94C3eb128D3bFa6317a3fF860BF93C1616",

        // Slasher
        DarknodeSlasher: "0x5B403bdC360A447290758c8BA779c44cdFC3476F",

        tokens: {
            DAI: "0xc4375b7de8af5a38a93548eb8453a498222c4ff2",
            ETH: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
        },

        /* 2_shifter.js */

        GatewayRegistry: "0x557e211EC5fc9a6737d2C6b7a1aDe3e0C11A8D5D",
        BasicAdapter: "0x7DDFA2e5435027f6e13Ca8Db2f32ebd5551158Bb",

        RenERC20LogicV1: "0xCe77c29b479bDF510f39bc4A2e43B0E4344fAB0f",
        GatewayLogicV1: "0x080d856994Fed1124c93AcA580aF035a86e9e9c7",

        // BTC
        renBTC: "0x0A9ADD98C076448CBcFAcf5E457DA12ddbEF4A8f",
        BTCGateway: "0x55363c0dBf97Ff9C0e31dAfe0fC99d3e9ce50b8A",

        // ZEC
        renZEC: "0x42805DA220DF1f8a33C16B0DF9CE876B9d416610",
        ZECGateway: "0xAACbB1e7bA99F2Ed6bd02eC96C2F9a52013Efe2d",

        // BCH
        renBCH: "0x618dC53e856b1A601119F2Fed5F1E873bCf7Bd6e",
        BCHGateway: "0x9827c8a66a2259fd926E7Fd92EA8DF7ed1D813b1",

        config: {
            ...config,
            mintAuthority: "0x44Bb4eF43408072bC888Afd1a5986ba0Ce35Cb54",

            tokenPrefix: "test"
        }
    },

    devnet: {
        /* 1_darknodes.js */

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

        // DNP
        DarknodePaymentStore: "0xfb98D6900330844CeAce6Ae4ae966D272bE1aeC3",
        DarknodePayment: "0xC7F24fEDfbbAA5248E1F5a160cC30Dcbff9F1176",

        tokens: {
            DAI: "0xc4375b7de8af5a38a93548eb8453a498222c4ff2",
            ETH: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
        },

        /* 2_shifter.js */

        GatewayRegistry: "0x5F051E588f39D95bc6c1742f6FA98B103aa0E5c8",
        BasicAdapter: "0xFABDB1F53Ef8B080332621cBc9F820a39e7A1B83",

        RenERC20LogicV1: "0xE121991B5DAB075E33C30E5C36EB5FFa9B2Af1A4",
        GatewayLogicV1: "0xcADcCC772991d8c49c6242604d334f8a0B07A039",

        renBTC: "0x581347fc652f9FCdbCA8372A4f65404C4154e93b",
        BTCGateway: "0xb4fc6D131A44A3b44668E997Ce0CE00A52D4D9ed",

        renZEC: "0x6f35D542f3E0886281fb6152010fb52aC6B931F6",
        ZECGateway: "0x3E31c6E07Eb4C471A6443e90E304E9C68dcdEd7d",

        renBCH: "0x148234809A551c131951bD01640494eecB905b08",
        BCHGateway: "0x86efB11aF3f2c3E3df525a851e3F28E03F4Dcb17",

        config: {
            ...config,
            mintAuthority: "0x1B9d58208879AA9aa9E10040b34cF2b684237621",

            tokenPrefix: "dev"
        }
    },

    rinkebyDevnet: {
        /* 1_darknodes.js */

        RenProxyAdmin: "0xed01c6323829CbFD3b6bAC8Baa11C7aC8A0F26fb",
        RenToken: "0x8BCCcA938b311029948F70249709CAd7c0F28Bb4",

        // Protocol
        ProtocolLogicV1: "0x9Cc2d9cCea0AE9f7EDD91Cf91ab74074EeDbABE1",
        ProtocolProxy: "0xc5786B864D1DaF57D653470f2fd0c921dC080953",

        // DNR
        DarknodeRegistryStore: "0x93151b8c88A7f6004656556880e2a3E701452375",
        DarknodeRegistryLogicV1: "0xD46dc8a22B980C871207bC57b0e524C46cfB4c1B",
        DarknodeRegistryProxy: "0x74d0651259Cd63e7c15Dc11e3787dB1D80D41d9E",

        // DNP
        DarknodePaymentStore: "0x0a1b343bB36dA2593d15162c8e0370eF5E0085B1",
        DarknodePayment: "0x40BC55A28f07D2208c1a9Da4008912BFcc617463",

        // Slasher
        DarknodeSlasher: "0x78eFADC45D1ba7a2E51072F73b3C2E5Be1ca1B10",

        tokens: {
            DAI: "0x5592ec0cfb4dbc12d3ab100b257153436a1f0fea",
            ETH: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
        },

        /* 2_shifter.js */

        GatewayRegistry: "0xcF9F36668ad5b28B336B248a67268AFcF1ECbdbF",

        config: {
            ...config,
            mintAuthority: "0xbb8c61159153d8a6ffd555584d1ac77fd57feca7",

            tokenPrefix: "dev"
        }
    },

    localnet: {
        /* 1_darknodes.js */

        RenProxyAdmin: "0xC822a36df55b8f88E48417A4765C7Fe27170D8eC",

        RenToken: "0x2cd647668494c1b15743ab283a0f980d90a87394",
        DarknodeSlasher: "0x65852e7ECC0eC12dC7e4b198D72e0D590029cDa9",

        // Protocol
        ProtocolLogicV1: "0xbD276BBAba798339007546392DAEF201EaFA780C",
        ProtocolProxy: "0xE773eDEb42c56aD10456595b8e03C26BC6cde468",

        // DNR
        DarknodeRegistryStore: "0xB38e11c615e14aE44173170763753733410D7432",
        DarknodeRegistryLogicV1: "0xCd5e48F6F48abAFA46266395AD1C1B7b2219d0aE",
        DarknodeRegistryProxy: "0x6adCF5Ba6e299Cf18D839795997A3c6844f37175",

        // DNP
        DarknodePaymentStore: "0x45378fF097d385a342557D291dE59f44f4250982",
        DarknodePayment: "0x6C71C070e99a2585A72Ae3C8199d9326Ad9E898F",

        tokens: {
            DAI: "0xc4375b7de8af5a38a93548eb8453a498222c4ff2",
            ETH: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
        },

        /* 2_shifter.js */

        GatewayRegistry: "0x1832eb340d558a3c05C48247C6dF862Fde863ebB",
        BasicAdapter: "0xD98d8EFF683129d040357439AbA49577452ECcaA",

        RenERC20LogicV1: "0x4337DBfAC0348cd81c167CdB382d0c0B43e60187",
        GatewayLogicV1: "0xb862cE796ac356E4F26507Fa297D5D07Ee4EC8EB",

        renBTC: "0x74D4d4528E948bCebAE54810F2100B9278cb8dEc",
        BTCGateway: "0xA86B7E2C8f45334EE63A379c6C84EAC539d98acA",

        renZEC: "0x1c2B80b7444FC6235DE9ABdf68900E4EDb2b2617",
        ZECGateway: "0x36e668b46DF1b4DfFb843FF8dbb6DBf7200AEAC9",

        renBCH: "0xDF75fb289007DEedcd60f34a069D2941D3448E22",
        BCHGateway: "0xEA96469Cd32D00b2EA1B00d9796e70b71134eD3f",

        config: {
            ...config,
            mintAuthority: "0x04084f1cACCB87Dcab9a29a084281294dA96Bf44",

            tokenPrefix: "local"
        }
    },

    config
};
