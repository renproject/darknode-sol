import { ethers } from "hardhat";
import { use as useChaiPlugin, expect } from "chai";
import { BondToken } from "../typechain/BondToken";
import { BondNFT } from "../typechain/BondNFT";
import { Bonding } from "../typechain/Bonding";
import { Claiming } from "../typechain/Claiming";
import BigNumber from "bignumber.js";
import * as chaiAsPromised from "chai-as-promised";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import {
    Contract,
    ContractFactory,
    ContractReceipt,
    ContractTransaction,
} from "ethers";
import { keccak256 } from "ethers/lib/utils";

const BOND_AMOUNT = new BigNumber(100000)
    .times(new BigNumber(10).exponentiatedBy(18))
    .toFixed();
const REDEEM_DELAY = 1000000;
const BOND_TOKEN_NAME = "Republic Token";
const BOND_TOKEN_SYMBOL = "REN";
const NFT_NAME = "Ren Operator NFT";
const NFT_SYMBOL = "OFT";

const wait = async (
    tx: Promise<ContractTransaction>,
): Promise<ContractReceipt> => await (await tx).wait();

interface Factory<T extends Contract> extends ContractFactory {
    deploy(...args: Array<any>): Promise<T>;
    attach(address: string): T;
}

useChaiPlugin(chaiAsPromised);

describe("Bonding", () => {
    let owner: SignerWithAddress;
    let user1: SignerWithAddress;
    let user2: SignerWithAddress;
    let attacker: SignerWithAddress;
    let bondToken: BondToken;
    let bonding: Bonding;
    let nft: BondNFT;
    let claiming: Claiming;

    const asOwner = <T extends Contract>(contract: T): T =>
        contract.connect(owner) as T;

    const asUser1 = <T extends Contract>(contract: T): T =>
        contract.connect(user1) as T;

    const asUser2 = <T extends Contract>(contract: T): T =>
        contract.connect(user2) as T;

    const asAttacker = <T extends Contract>(contract: T): T =>
        contract.connect(attacker) as T;

    const bondFrom = async (acc: SignerWithAddress): Promise<number> => {
        await wait(
            bondToken.connect(acc).approve(bonding.address, BOND_AMOUNT),
        );
        const receipt = await wait(bonding.connect(acc).enter());
        const log = bonding.interface.parseLog(receipt.logs[3]);
        return log.args[0].toNumber();
    };

    const waitForRedeem = async () =>
        await ethers.provider.send("evm_increaseTime", [REDEEM_DELAY]);

    before(async () => {
        [owner, user1, user2, attacker] = await ethers.getSigners();

        const BondToken = (await ethers.getContractFactory(
            "BondToken",
        )) as Factory<BondToken>;
        bondToken = asUser1(
            await BondToken.deploy(BOND_TOKEN_NAME, BOND_TOKEN_SYMBOL),
        );
        await bondToken.deployed();

        await wait(asOwner(bondToken).transfer(user1.address, BOND_AMOUNT));

        const Bonding = (await ethers.getContractFactory(
            "Bonding",
        )) as Factory<Bonding>;
        bonding = asUser1(
            await Bonding.deploy(
                bondToken.address,
                BOND_AMOUNT,
                REDEEM_DELAY,
                NFT_NAME,
                NFT_SYMBOL,
            ),
        );
        await bonding.deployed();

        const BondNFT = (await ethers.getContractFactory(
            "BondNFT",
        )) as Factory<BondNFT>;
        const nftAddress = await bonding.nft();
        nft = asUser1(await BondNFT.attach(nftAddress));

        const Claiming = (await ethers.getContractFactory(
            "Claiming",
        )) as Factory<Claiming>;
        claiming = asUser1(await Claiming.deploy(nft.address));
    });

    describe("entering and exiting", () => {
        describe("standard cycle", () => {
            let id: number;

            it("entering", async () => {
                await wait(bondToken.approve(bonding.address, BOND_AMOUNT, {}));

                const balanceBefore = new BigNumber(
                    (await bondToken.balanceOf(user1.address)).toString(),
                );

                const receipt = await wait(bonding.enter());

                const log = bonding.interface.parseLog(receipt.logs[3]);

                id = log.args[0].toNumber();

                expect(await nft.balanceOf(user1.address)).to.equal(1);
                expect(await bondToken.balanceOf(user1.address)).to.equal(0);
                expect(await bondToken.balanceOf(user1.address)).to.equal(
                    balanceBefore.minus(BOND_AMOUNT).toFixed(),
                );
            });

            it("exiting", async () => {
                await wait(bonding.exit(id));

                expect(await nft.balanceOf(user1.address)).to.equal(1);
                expect(await bondToken.balanceOf(user1.address)).to.equal(0);
            });

            it("redeeming", async () => {
                await ethers.provider.send("evm_increaseTime", [
                    REDEEM_DELAY - 10,
                ]);

                await expect(bonding.redeem(id)).to.be.rejectedWith(
                    /Bonding: must wait redeem delay after exiting/,
                );

                await ethers.provider.send("evm_increaseTime", [10]);

                const balanceBefore = new BigNumber(
                    (await bondToken.balanceOf(user2.address)).toString(),
                );

                await wait(bonding.redeem(id));

                expect(await nft.balanceOf(user1.address)).to.equal(0);
                expect(await bondToken.balanceOf(user1.address)).to.equal(
                    balanceBefore.plus(BOND_AMOUNT).toFixed(),
                );
            });
        });

        it("can't enter without bond", async () => {
            await expect(bonding.enter()).to.be.rejectedWith(
                /Bonding: insufficient balance for bond/,
            );
        });

        it("only bonder can exit and redeem", async () => {
            const id = await bondFrom(user1);

            await expect(asAttacker(bonding).exit(id)).to.be.rejectedWith(
                /Bonding: only callable by NFT owner/,
            );

            await wait(bonding.exit(id));

            await waitForRedeem();

            await expect(asAttacker(bonding).redeem(id)).to.be.rejectedWith(
                /Bonding: only callable by NFT owner/,
            );

            await wait(bonding.redeem(id));
        });

        it("can only exit and redeem with valid nft", async () => {
            const fakeId = (await nft.nextNftId()).toNumber();

            await expect(asAttacker(bonding).exit(fakeId)).to.be.rejectedWith(
                /ERC721: owner query for nonexistent token/,
            );

            await expect(asAttacker(bonding).redeem(fakeId)).to.be.rejectedWith(
                /ERC721: owner query for nonexistent token/,
            );
        });

        it("can only exit and redeem once per nft", async () => {
            const id = await bondFrom(user1);

            await expect(bonding.redeem(id)).to.be.rejectedWith(
                /Bonding: must exit first/,
            );

            await wait(bonding.exit(id));

            await expect(bonding.exit(id)).to.be.rejectedWith(
                /Bonding: already exited/,
            );

            await waitForRedeem();

            await wait(bonding.redeem(id));

            await expect(bonding.redeem(id)).to.be.rejectedWith(
                /ERC721: owner query for nonexistent token/,
            );
        });

        it("can transfer nft", async () => {
            const id = await bondFrom(user1);

            await wait(nft.transferFrom(user1.address, user2.address, id));

            expect(await nft.ownerOf(id)).to.equal(user2.address);

            await expect(bonding.exit(id)).to.be.rejectedWith(
                /Bonding: only callable by NFT owner/,
            );

            await wait(asUser2(bonding).exit(id));

            await waitForRedeem();

            await expect(bonding.redeem(id)).to.be.rejectedWith(
                /Bonding: only callable by NFT owner/,
            );

            const balanceBefore = new BigNumber(
                (await bondToken.balanceOf(user2.address)).toString(),
            );
            await wait(asUser2(bonding).redeem(id));

            expect(await bondToken.balanceOf(user2.address)).to.equal(
                balanceBefore.plus(BOND_AMOUNT).toFixed(),
            );

            await wait(asUser2(bondToken).transfer(user1.address, BOND_AMOUNT));
        });
    });

    describe("governance", () => {
        afterEach(async () => {
            // Reset redeem delay.
            await asOwner(bonding).setRedeemDelay(REDEEM_DELAY);
        });

        it("updating redeem delay to 0", async () => {
            expect(await bonding.redeemDelay()).to.equal(REDEEM_DELAY);

            await asOwner(bonding).setRedeemDelay(0);

            expect(await bonding.redeemDelay()).to.equal(0);

            // Redeem without delay.
            const id = await bondFrom(user1);
            await wait(bonding.exit(id));
            await wait(bonding.redeem(id));
        });

        it("can't updating redeem delay to larger than 365 days", async () => {
            const DAYS = 60 * 60 * 24;
            await expect(
                asOwner(bonding).setRedeemDelay(365 * DAYS + 1),
            ).to.be.rejectedWith(
                /Bonding: redeemDelay larger than maximum delay/,
            );
        });

        it("only owner can update redeem delay", async () => {
            await expect(bonding.setRedeemDelay(0)).to.be.rejectedWith(
                /Ownable: caller is not the owner/,
            );
        });

        it("can transfer ownership", async () => {
            await wait(asOwner(bonding).transferOwnership(user1.address));
            expect(await bonding.owner()).to.equal(owner.address);
            expect(await bonding.pendingOwner()).to.equal(user1.address);
            await wait(asUser1(bonding).claimOwnership());
            expect(await bonding.owner()).to.equal(user1.address);

            await expect(asOwner(bonding).setRedeemDelay(0)).to.be.rejectedWith(
                /Ownable: caller is not the owner/,
            );

            await wait(bonding.transferOwnership(owner.address));
            await wait(asOwner(bonding).claimOwnership());
            expect(await bonding.owner()).to.equal(owner.address);

            await expect(bonding.setRedeemDelay(0)).to.be.rejectedWith(
                /Ownable: caller is not the owner/,
            );
        });

        it("only pending owner can claim ownership", async () => {
            await expect(
                asAttacker(bonding).claimOwnership(),
            ).to.be.rejectedWith(/Claimable: caller is not the pending owner/);
        });

        it("can't transfer ownership to existing or pending owner", async () => {
            await expect(
                asOwner(bonding).transferOwnership(owner.address),
            ).to.be.rejectedWith("Claimable: invalid new owner");
        });

        it("can renounce ownership", async () => {
            const Bonding = (await ethers.getContractFactory(
                "Bonding",
            )) as Factory<Bonding>;
            const bonding = await Bonding.deploy(
                bondToken.address,
                BOND_AMOUNT,
                REDEEM_DELAY,
                NFT_NAME,
                NFT_SYMBOL,
            );
            await bonding.deployed();

            await bonding.renounceOwnership();

            const NULL20 = `0x${"00".repeat(20)}`;
            expect(await bonding.owner()).to.equal(NULL20);
        });
    });

    describe("claiming", () => {
        const symbol = "SYMBOL";
        const recipient = "recipient";

        it("owner of nft can claim", async () => {
            const id = await bondFrom(user1);

            const receipt = await wait(claiming.claim(id, symbol, recipient));

            const log = claiming.interface.parseLog(receipt.logs[0]);
            expect(log.name).to.equal("Claim");
            // NFT ID
            expect(log.args[0]).to.equal(id);
            // Symbol
            expect(log.args[1]).to.equal(symbol);
            // Recipient
            expect(log.args[2]).to.equal(recipient);
            // Symbol Indexed
            expect(log.args[3].hash).to.equal(keccak256(Buffer.from(symbol)));
            // Recipient Indexed
            expect(log.args[4].hash).to.equal(
                keccak256(Buffer.from(recipient)),
            );

            await wait(bonding.exit(id));
            await waitForRedeem();
            await wait(bonding.redeem(id));
        });

        it("only nft owners can claim", async () => {
            const id = await bondFrom(user1);

            await expect(
                asAttacker(claiming).claim(id, symbol, recipient),
            ).to.be.rejectedWith(/Claiming: only callable by NFT owner/);

            await wait(bonding.exit(id));
            await waitForRedeem();
            await wait(bonding.redeem(id));
        });

        it("can't claim for inexistent nft", async () => {
            const fakeId = (await nft.nextNftId()).toNumber();

            await expect(
                asAttacker(claiming).claim(fakeId, symbol, recipient),
            ).to.be.rejectedWith(/ERC721: owner query for nonexistent token/);
        });

        it("can't claim after exiting", async () => {
            const id = await bondFrom(user1);

            await wait(bonding.exit(id));
            await waitForRedeem();
            await wait(bonding.redeem(id));

            await expect(
                claiming.claim(id, symbol, recipient),
            ).to.be.rejectedWith(/ERC721: owner query for nonexistent token/);
        });
    });
});
