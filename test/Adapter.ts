import BN from "bn.js";
import { ecsign } from "ethereumjs-util";
import { Account } from "web3-eth-accounts";
import { keccak256 } from "web3-utils";

import {
    BTCGatewayInstance, GatewayLogicV1Instance, GatewayRegistryInstance, RenERC20LogicV1Instance,
} from "../types/truffle-contracts";
import { deployProxy, Ox, randomBytes } from "./helper/testUtils";

const BasicAdapter = artifacts.require("BasicAdapter");
const BTCGateway = artifacts.require("BTCGateway");
const GatewayRegistry = artifacts.require("GatewayRegistry");
const RenBTC = artifacts.require("RenBTC");
const RenERC20LogicV1 = artifacts.require("RenERC20LogicV1");
const GatewayLogicV1 = artifacts.require("GatewayLogicV1");

contract.skip("Adapter", ([owner, feeRecipient, user, proxyGovernanceAddress]) => {
    let btcGateway: GatewayLogicV1Instance;
    let renbtc: RenERC20LogicV1Instance;
    let registry: GatewayRegistryInstance;

    // We generate a new account so that we have access to its private key for
    // `ecsign`. Web3's sign functions all prefix the message being signed.
    let mintAuthority: Account;
    let privKey: Buffer;

    const mintFees = new BN(5);
    const burnFees = new BN(15);

    before(async () => {
        renbtc = await deployProxy<RenERC20LogicV1Instance>(web3, RenBTC, RenERC20LogicV1, proxyGovernanceAddress, [{ type: "uint256", value: await web3.eth.net.getId() }, { type: "address", value: owner }, { type: "uint256", value: "500000000000000000" }, { type: "string", value: "1" }, { type: "string", value: "renBTC" }, { type: "uint8", value: 8 }], { from: owner });
        mintAuthority = web3.eth.accounts.create();
        privKey = Buffer.from(mintAuthority.privateKey.slice(2), "hex");

        btcGateway = await deployProxy<GatewayLogicV1Instance>(web3, BTCGateway, GatewayLogicV1, proxyGovernanceAddress, [{ type: "address", value: renbtc.address }, { type: "address", value: feeRecipient }, { type: "address", value: mintAuthority.address }, { type: "uint16", value: mintFees }, { type: "uint16", value: burnFees }, { type: "uint256", value: 10000 }], { from: owner });

        registry = await GatewayRegistry.new();
        await registry.setGateway("BTC", renbtc.address, btcGateway.address);

        await renbtc.transferOwnership(btcGateway.address);
        await btcGateway.claimTokenOwnership();
    });

    const removeFee = (value: number | BN, bips: number | BN) =>
        new BN(value).sub(new BN(value).mul(new BN(bips)).div(new BN(10000)));

    it("can mint to an adapter", async () => {
        const value = new BN(20000);
        const burnValue = removeFee(value, mintFees);

        const basicAdapter = await BasicAdapter.new(registry.address);

        const nHash = randomBytes(32);
        const bitcoinAddress = "0x" + Buffer.from("BITCOIN ADDRESS").toString("hex");

        const pHash = keccak256(web3.eth.abi.encodeParameters(
            ["string", "address"],
            ["BTC", user],
        ));

        const hash = await btcGateway.hashForSignature.call(pHash, value, basicAdapter.address, nHash);
        const sig = ecsign(Buffer.from(hash.slice(2), "hex"), privKey);
        const sigString = Ox(`${sig.r.toString("hex")}${sig.s.toString("hex")}${(sig.v).toString(16)}`);

        const balanceBeforeMint = new BN((await renbtc.balanceOfUnderlying.call(user)).toString());
        await basicAdapter.mint("BTC", user, value, nHash, sigString);
        const balanceAfterMint = new BN((await renbtc.balanceOfUnderlying.call(user)).toString());
        balanceAfterMint.should.bignumber.equal(balanceBeforeMint.add(burnValue));

        await renbtc.approve(basicAdapter.address, burnValue, { from: user });
        await basicAdapter.burn("BTC", bitcoinAddress, burnValue, { from: user });
        (await renbtc.balanceOfUnderlying.call(user)).should.bignumber.equal(balanceAfterMint.sub(burnValue));
    });
});
