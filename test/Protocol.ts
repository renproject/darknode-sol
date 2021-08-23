import {
    DarknodeRegistryLogicV1Instance,
    ProtocolInstance
} from "../types/truffle-contracts";
import { NULL, waitForEpoch } from "./helper/testUtils";

const DarknodeRegistryLogicV1 = artifacts.require("DarknodeRegistryLogicV1");
const DarknodeRegistryProxy = artifacts.require("DarknodeRegistryProxy");
const Protocol = artifacts.require("Protocol");

contract("Protocol", ([owner, otherAccount]: string[]) => {
    let dnr: DarknodeRegistryLogicV1Instance;
    let protocol: ProtocolInstance;

    before(async () => {
        const dnrProxy = await DarknodeRegistryProxy.deployed();
        dnr = await DarknodeRegistryLogicV1.at(dnrProxy.address);
        protocol = await Protocol.at(Protocol.address);
        await waitForEpoch(dnr);
    });

    it("Address getters", async () => {
        (await protocol.getContract("DarknodeRegistry")).should.equal(
            dnr.address
        );
    });

    it("Protocol owner", async () => {
        (await protocol.owner()).should.equal(owner);

        await protocol
            .transferOwnership(otherAccount, { from: otherAccount })
            .should.be.rejectedWith(/Ownable: caller is not the owner/);

        await protocol.transferOwnership(otherAccount);

        (await protocol.owner()).should.equal(owner);

        await protocol.claimOwnership({ from: otherAccount });

        (await protocol.owner()).should.equal(otherAccount);

        await protocol.transferOwnership(owner, { from: otherAccount });
        await protocol.claimOwnership({ from: owner });

        (await protocol.owner()).should.equal(owner);
    });

    it("Update DarknodeRegistry address", async () => {
        await protocol
            .updateContract("DarknodeRegistry", NULL, { from: otherAccount })
            .should.be.rejectedWith(/Ownable: caller is not the owner/);

        await protocol.updateContract("DarknodeRegistry", NULL);

        (await protocol.getContract("DarknodeRegistry")).should.equal(NULL);

        await protocol.updateContract("DarknodeRegistry", dnr.address);

        (await protocol.getContract("DarknodeRegistry")).should.equal(
            dnr.address
        );
    });

    it("Proxy functions", async () => {
        // Try to initialize again
        await protocol
            .__Protocol_init(owner, { from: owner })
            .should.be.rejectedWith(
                /Contract instance has already been initialized/
            );
    });
});
