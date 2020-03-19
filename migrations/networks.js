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
    proxyOwner: "",
    shiftInFee: 10,
    shiftOutFee: 10,
    zBTCMinShiftOutAmount: 10000,
    zZECMinShiftOutAmount: 10000,
    zBCHMinShiftOutAmount: 10000,
}

module.exports = {
    mainnet: {
        Protocol: "",
        ProtocolLogic: "",
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
            proxyOwner: "0x5E2603499eddc325153d96445A6c44487F0d1859",
        },
    },
    chaosnet: {
        tokens: {
            DAI: "0x89d24A6b4CcB1B6fAA2625fE562bDD9a23260359",
            ETH: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
        },

        Protocol: "0xeF4de0E97D92757520D78c4d49d8151964f6a85B",
        ProtocolLogic: "0xa638f33388747d5f62411273f4be8919ed8c94b4",
        RenToken: "0x408e41876cCCDC0F92210600ef50372656052a38",
        DarknodeSlasher: "0x7AdD7E6F431Cfa23dFfce61DD9749810dc678B16",
        DarknodeRegistry: "0xA1eb04Db7a0ffd6e458b1868660a0edAF8199Fa9",
        DarknodeRegistryStore: "0xE8d0C5D4ca958C8619Ab1B98cA901d65340C48B1",
        DarknodePayment: "0x376D835c6Dc5d06C6335915B36ffe9734D3E4faa",
        DarknodePaymentStore: "0x311999EE72B5826D664FD4F3aC09c0C462eFfe49",

        BTCShifter: "0x1258d7FF385d1d81017d4a3d464c02f74C61902a",
        ZECShifter: "0x2b59Ef3Eb28c7388c7eC69d43a9b8E585C461d5b",
        BCHShifter: "0xa76beA11766E0b66bD952bc357CF027742021a8C",
        zBTC: "0x88C64A7D2ecC882D558DD16aBC1537515a78BB7D",
        zZEC: "0x8dD8944320Eb76F8e39C58E7A30d34E7fbA9D719",
        zBCH: "0x466Dd97F83b18aC23dDF16931f8171A817953fF1",
        ShifterRegistry: "0x5d9bF2Bad3dD710e4D533681ed16eD1cfeAc9e6F",

        BasicAdapter: "",

        config: {
            ...config,
            MINIMUM_BOND: new BN(10000).mul(new BN(10).pow(new BN(18))),
            mintAuthority: "0x5D0b91e8a8037C3EBB55f52D76BFc64CaBEBCAE1",
            proxyOwner: "0x5E2603499eddc325153d96445A6c44487F0d1859",
        },
    },
    testnet: {
        Protocol: "0x8E28748620EA6f1285761AF41f311Cf6d05b188B",
        ProtocolLogic: "0x6e35dBBE88A3746600E6e80DE52c6c5b062c6FBf",
        RenToken: "0x2cd647668494c1b15743ab283a0f980d90a87394",
        DarknodeSlasher: "0x06f44b3a0C2621D581Fe667Ec2170F6A5Be02BD0",
        DarknodeRegistry: "0xf33AEd5bEfd9e9a2E92495Ea971c57866C39869f",
        DarknodeRegistryStore: "0xc24146aE71470C2f8749DA0738b09434E0220d92",
        DarknodePayment: "0x4Fc1f776ddfeb7AC1A93Cbb9FcbeFdda7e3C838E",
        DarknodePaymentStore: "0x823c22F1e17766271a5986D9faa12bcfFDeb701B",
        tokens: {
            DAI: "0xc4375b7de8af5a38a93548eb8453a498222c4ff2",
            ETH: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
        },

        BTCShifter: "0x7e6E1D8F26D2b49B2fB4C3B6f5b7dad8d8ea781b",
        ZECShifter: "0x1615f5a285134925Fb4D87812827863fde046fDa",
        BCHShifter: "0xea08e98E56f1088E2001fAB8369A1c9fEEc58Ec9",
        zBTC: "0xc6069E8DeA210C937A846db2CEbC0f58ca111f26",
        zZEC: "0xB9b5B5346BF8CA9bc02f4F9d8947916b7CA9C97E",
        zBCH: "0x7bdb2A8231eB4E4795749F01f0241940a8166575",
        ShifterRegistry: "0xbA563a8510d86dE95F5a50007E180d6d4966ad12",

        BasicAdapter: "0xdCb0B03c2fc9F0b3aF7742C3C1262db436BF5443",

        config: {
            ...config,
            mintAuthority: "0x44Bb4eF43408072bC888Afd1a5986ba0Ce35Cb54",
            proxyOwner: "0x5E2603499eddc325153d96445A6c44487F0d1859",
        },
    },

    devnet: {
        Protocol: "0x1deB773B50B66b0e65e62E41380355a1A2BEd2e1",
        ProtocolLogic: "0x6e35dBBE88A3746600E6e80DE52c6c5b062c6FBf",
        RenToken: "0x2cd647668494c1b15743ab283a0f980d90a87394",
        DarknodeSlasher: "0xf29c5726F9f8afA51CE39658e713dc40692218C5",
        DarknodeRegistry: "0x00bC610a8080e251bABA56488241eB832D95a699",
        DarknodeRegistryStore: "0x3eA70E8eE1C4e0Fe9Cc2b120d72800f093a39665",
        DarknodePayment: "0x388f0B88a814C8dA63F4574DF10C8987E29560e7",
        DarknodePaymentStore: "0xa013EEb63525cDaa94D7FcD08cB822265b6044Fe",
        tokens: {
            DAI: "0xc4375b7de8af5a38a93548eb8453a498222c4ff2",
            ETH: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
        },

        BTCShifter: "0xCAae05102081Eea2Dc573488f44fe7e45f5BD441",
        ZECShifter: "0x494644199dE72f32E320d99E48169DE0d7977BA8",
        BCHShifter: "0x112dBA369B25cebbb739d7576F6E4aC2b582448A",
        zBTC: "0x916B8012E1813E5924a3Eca400dBE6C7055a8484",
        zZEC: "0x71b6A19Fc832bD9C739489EcBEa67ab41261026F",
        zBCH: "0xfC1bc29e7a7282DA195f9b8A824cf242c770673F",
        ShifterRegistry: "0xc7B310c18D78f175812CFfD8896d3cC959aC28d6",

        BasicAdapter: "0x4D322a1DAA623F93F7C44F606f57F5f4D9925f8b",

        config: {
            ...config,
            mintAuthority: "0x1B9d58208879AA9aa9E10040b34cF2b684237621",
            proxyOwner: "0x5E2603499eddc325153d96445A6c44487F0d1859",
        },
    },

    localnet: {
        Protocol: "0x28e4aA30e99F6B80acAf82Cc384a2438AF245204",
        ProtocolLogic: "0xcfb2fD20211552216755E318aD091d0d1C3a39a7",
        RenToken: "0x2cd647668494c1b15743ab283a0f980d90a87394",
        DarknodeSlasher: "0x8447EfA2a06bfEf230c93fa60f8a82EEfEA5A427",
        DarknodeRegistry: "0x226DE25a04AE3b133D6611614D3f24B7B787Abd6",
        DarknodeRegistryStore: "0xA89F46C8daA8E8fe6F4dcc8361205d14b8E2A617",
        DarknodePayment: "0x0C6445A8D3120e52B05A5892E562e53A6ae17Eb9",
        DarknodePaymentStore: "0xee9de0Ab7BB06B063B44677382FE95C87b497358",
        tokens: {
            DAI: "0xc4375b7de8af5a38a93548eb8453a498222c4ff2",
            ETH: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
        },

        BTCShifter: "0x7012ECc13De5Ce416C14C013d9b02b7c37154b37",
        ZECShifter: "0x69AC72Cb35B1AA818e90842C048719a3246ba0BE",
        BCHShifter: "0x175b4A3cC812efd35fc3Ef86F5B1088ced85D96E",
        zBTC: "0xDE027035d33CEB2757685E325de1A0b924aA73E6",
        zZEC: "0xB7b7be50B13E6817afBb30C93161D0eB388b8f08",
        zBCH: "0x679F9e30549311fE7FEE0Eae44CE09e043a44055",
        ShifterRegistry: "0x33666067A7741B9e88520285C96B776E73281811",

        BasicAdapter: "",

        config: {
            ...config,
            mintAuthority: "0x04084f1cACCB87Dcab9a29a084281294dA96Bf44",
            proxyOwner: "0x5E2603499eddc325153d96445A6c44487F0d1859",
        },
    },

    config,
}