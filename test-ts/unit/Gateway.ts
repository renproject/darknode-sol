const Gateway = artifacts.require("Gateway");

import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);
chai.should();

contract("Gateway", function (accounts: string[]) {

    let gateway;

    before(async function () {
        gateway = await Gateway.new(
            "0x261C74f7dD1ed6A069E18375aB2BeE9AfCb10956",
            "0x42A990655Bffe188c9823A2F914641a32dCbB1b2",
            "0x8c98238C9823842a99018A2f914641A32dcBb1b2",
            5
        );
    });

    it("can get the RepublicToken address", async () => {
        (await gateway.republicToken.call()).should.equal("0x261C74f7dD1ed6A069E18375aB2BeE9AfCb10956");
    });

    it("can get the DarknodeRegistry address", async () => {
        (await gateway.darknodeRegistry.call()).should.equal("0x42A990655Bffe188c9823A2F914641a32dCbB1b2");
    });

    it("can get the TraderRegistry address", async () => {
        (await gateway.traderRegistry.call()).should.equal("0x8c98238C9823842a99018A2f914641A32dcBb1b2");
    });

    it("can get the MinimumPodSize", async () => {
        (await gateway.minimumPodSize.call()).toNumber().should.equal(5);
    });

    it("owner can update the DarknodeRegistry address", async () => {
        await gateway.updateDarknodeRegistry("", { from: accounts[0] });
        (await gateway.darknodeRegistry.call()).should.equal("0x0000000000000000000000000000000000000000");
    });

    it("owner can update the TraderRegistry address", async () => {
        await gateway.updateTraderRegistry("", { from: accounts[0] });
        (await gateway.traderRegistry.call()).should.equal("0x0000000000000000000000000000000000000000");
    });

    it("owner can update the MinimumPodSize", async () => {
        await gateway.updateMinimumPodSize(10, { from: accounts[0] });
        (await gateway.minimumPodSize.call()).toNumber().should.equal(10);
    });

    it("anyone other than the owner cannot update the DarknodeRegistry address", async () => {
        await gateway.updateDarknodeRegistry("", { from: accounts[1] }).should.be.rejected;
    });

    it("anyone other than the owner cannot update the TraderRegistry address", async () => {
        await gateway.updateTraderRegistry("", { from: accounts[1] }).should.be.rejected;
    });

    it("anyone other than the owner cannot update the MinimumPodSize", async () => {
        await gateway.updateMinimumPodSize(10, { from: accounts[1] }).should.be.rejected;
    });

    it("the owner should be able to change the ownership of the contract", async () => {
        await gateway.transferOwnership(accounts[1], { from: accounts[0] });
        (await gateway.owner()).should.equal(accounts[1]);
    });

    it("anyone other than the owner should not be able to change the ownership of the contract", async () => {
        await gateway.transferOwnership(accounts[1], { from: accounts[0] }).should.be.rejected;
    });

    it("should not be able to give the ownership to 0x0 address", async () => {
        await gateway.transferOwnership("", { from: accounts[1] }).should.be.rejected;
    });

});