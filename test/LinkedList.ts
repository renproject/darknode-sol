import { LinkedListTestInstance } from "../types/truffle-contracts";
import { ID, NULL } from "./helper/testUtils";

const LinkedListTest = artifacts.require("LinkedListTest");

contract("LinkedList", () => {

    let linkedList: LinkedListTestInstance;

    const [NODE1, NODE2, NODE3, NODE4, NOT_NODE1, NOT_NODE2] =
        [ID("1"), ID("2"), ID("3"), ID("4"), ID("NOT1"), ID("NOT2")];

    before(async () => {
        linkedList = await LinkedListTest.new();
    });

    it("can append", async () => {
        await linkedList.append(NODE1);
        (await linkedList.isInList.call(NODE1)).should.equal(true);
    });

    it("can prepend", async () => {
        await linkedList.prepend(NODE2);
        (await linkedList.previous.call(NODE1))
            .should.equal(NODE2);
    });

    it("can swap", async () => {
        await linkedList.swap(NODE1, NODE2);
        (await linkedList.previous.call(NODE2)).should.equal(NODE1);
    });

    it("can insertAfter", async () => {
        await linkedList.insertAfter(NODE2, NODE4);
        (await linkedList.next.call(NODE2)).should.equal(NODE4);
    });

    it("can insertBefore", async () => {
        await linkedList.insertBefore(NODE4, NODE3);
        (await linkedList.previous.call(NODE4)).should.equal(NODE3);
    });

    it("can remove", async () => {
        await linkedList.remove(NODE4);
        (await linkedList.isInList.call(NODE4)).should.equal(false);
    });

    it("can get previous node of the given node", async () => {
        (await linkedList.previous.call(NODE2)).should.equal(NODE1);
    });

    it("can get following node of the given node", async () => {
        (await linkedList.next.call(NODE1)).should.equal(NODE2);
    });

    it("can get the last node of the given list", async () => {
        (await linkedList.end.call()).should.equal(NODE3);
    });

    it("can get the first node of the given list", async () => {
        (await linkedList.begin.call()).should.equal(NODE1);
    });

    it("should not add NULL", async () => {
        await linkedList.insertBefore(NODE1, NULL)
            .should.be.rejectedWith(/LinkedList: invalid address/);
        await linkedList.insertAfter(NODE1, NULL)
            .should.be.rejectedWith(/LinkedList: invalid address/);
        await linkedList.append(NULL)
            .should.be.rejectedWith(/LinkedList: invalid address/);
        await linkedList.remove(NULL)
            .should.be.rejectedWith(/LinkedList: not in list/);
    });

    it("should not add the same value more than once", async () => {
        await linkedList.append(NODE1)
            .should.be.rejectedWith(/LinkedList: already in list/);
    });

    it("should not remove a node not in the list", async () => {
        await linkedList.remove(NOT_NODE1)
            .should.be.rejectedWith(/LinkedList: not in list/);
    });

    it("should not insert after a node not in the list", async () => {
        await linkedList.insertAfter(NOT_NODE1, NOT_NODE2)
            .should.be.rejectedWith(/LinkedList: not in list/);
    });

    it("should not insert before a node not in the list", async () => {
        await linkedList.insertBefore(NOT_NODE1, NOT_NODE2)
            .should.be.rejectedWith(/LinkedList: not in list/);
    });

    it("should not insert a node already in the list", async () => {
        await linkedList.insertAfter(NODE2, NODE3)
            .should.be.rejectedWith(/LinkedList: already in list/);
    });

    it("should not insert a node already in the list", async () => {
        await linkedList.insertBefore(NODE3, NODE2)
            .should.be.rejectedWith(/LinkedList: already in list/);
    });

    it("should not prepend a value that already exists", async () => {
        await linkedList.prepend(NODE2)
            .should.be.rejectedWith(/LinkedList: already in list/);
    });

    it("should not swap a node not in the list, and a node in the list", async () => {
        await linkedList.swap(NOT_NODE1, NODE2)
            .should.be.rejectedWith(/LinkedList: not in list/);
    });

    it("should not swap a node in the list, and a node not in the list", async () => {
        await linkedList.swap(NODE2, NOT_NODE1)
            .should.be.rejectedWith(/LinkedList: not in list/);
    });

    it("should not swap two nodes that are not in the list", async () => {
        await linkedList.swap(NOT_NODE1, NOT_NODE2)
            .should.be.rejectedWith(/LinkedList: not in list/);
    });

    it("should not get previous node of the node if it is not in the list", async () => {
        // NOTE: The revert reason isn't available for .call
        await linkedList.previous.call(NOT_NODE1)
            .should.be.rejectedWith(/LinkedList: not in list/); // not in list
    });

    it("should not get following node of the given node if it is not in the list", async () => {
        // NOTE: The revert reason isn't available for .call
        await linkedList.next.call(NOT_NODE1)
            .should.be.rejectedWith(/LinkedList: not in list/); // not in list
    });

    it("should revert when given incorrect count while retrieving elements in the list", async () => {
        await linkedList.elements.call(NODE1, 0)
            .should.be.rejectedWith(/LinkedList: invalid count/); // invalid count
    });

    it("should revert when given incorrect start address while retrieving elements in the list", async () => {
        await linkedList.elements.call(NODE4, 1)
            .should.be.rejectedWith(/LinkedList: not in list/); // invalid count
    });

    it("should return elements in the list", async () => {
        let gateways = await linkedList.elements.call(NODE1, 1);
        gateways[0].should.equal(NODE1);
        gateways.length.should.equal(1);

        gateways = await linkedList.elements.call(NODE2, 2);
        gateways[0].should.equal(NODE2);
        gateways[1].should.equal(NODE3);
        gateways.length.should.equal(2);

        await linkedList.append(NODE4);

        gateways = await linkedList.elements.call(NODE1, 10);
        gateways[0].should.equal(NODE1);
        gateways[3].should.equal(NODE4);
        gateways.length.should.equal(10);
    });

});
