import { ethers } from "hardhat";
import { expect } from "chai";

export const BOND_AMOUNT = 100000;
export const REDEEM_DELAY = 1;
export const BOND_TOKEN_NAME = "Republic Token";
export const BOND_TOKEN_SYMBOL = "REN";
export const NFT_NAME = "Ren Operator NFT";
export const NFT_SYMBOL = "OFT";

describe("Bonding", function () {
    it("Should return the new greeting once it's changed", async function () {
        const ERC20 = await ethers.getContractFactory("ERC20");
        const erc20 = await ERC20.deploy(BOND_TOKEN_NAME, BOND_TOKEN_SYMBOL);
        await erc20.deployed();

        const Bonding = await ethers.getContractFactory("Bonding");
        const bonding = await Bonding.deploy(
            erc20.address,
            BOND_AMOUNT,
            REDEEM_DELAY,
            NFT_NAME,
            NFT_SYMBOL,
        );
        await bonding.deployed();

        // expect(await bonding.greet()).to.equal("Hello, world!");

        // await bonding.setGreeting("Hola, mundo!");
        // expect(await bonding.greet()).to.equal("Hola, mundo!");
    });
});
