const linkedListTest = artifacts.require("LinkedListTest.sol");
const chai = require("chai");
chai.use(require("chai-as-promised"));
chai.should();

contract("LinkedList", function (accounts) {

  let linkedList;

  before(async function () {
    linkedList = await linkedListTest.new();
  });

  it("can append", async function () {
    await linkedList.append("0x10");
    (await linkedList.isInList.call("0x10")).should.equal(true);
  });

  it("can prepend", async () => {
    await linkedList.prepend("0x20");
    (await linkedList.previous.call("0x10")).should.equal("0x2000000000000000000000000000000000000000");
  });

  it("can swap", async () => {
    await linkedList.swap("0x10", "0x20");
    (await linkedList.previous.call("0x20")).should.equal("0x1000000000000000000000000000000000000000");
  });

  it("can insertAfter", async () => {
    await linkedList.insertAfter("0x20", "0x40");
    (await linkedList.next.call("0x20")).should.equal("0x4000000000000000000000000000000000000000");
  });

  it("can insertBefore", async () => {
    await linkedList.insertBefore("0x40", "0x30");
    (await linkedList.previous.call("0x40")).should.equal("0x3000000000000000000000000000000000000000");
  });

  it("can remove", async () => {
    await linkedList.remove("0x40");
    (await linkedList.isInList.call("0x40")).should.equal(false);
  });

  it("can get previous node of the given node", async () => {
    (await linkedList.previous.call("0x20")).should.equal("0x1000000000000000000000000000000000000000");
  });

  it("can get following node of the given node", async () => {
    (await linkedList.next.call("0x10")).should.equal("0x2000000000000000000000000000000000000000");
  });


  it("can get the last node of the given list", async () => {
    (await linkedList.end.call()).should.equal("0x3000000000000000000000000000000000000000");
  });


  it("can get the first node of the given list", async () => {
    (await linkedList.begin.call()).should.equal("0x1000000000000000000000000000000000000000");
  });

  it("handle removing NULL", async () => {
    await linkedList.insertBefore("0x10", "0x").should.not.be.rejected;
    await linkedList.remove("0x").should.not.be.rejected;
  });

  it("should not add the same value more than once", async () => {
    await linkedList.append("0x10").should.be.rejected;
  });

  it("should not remove a node not in the list", async () => {
    await linkedList.remove("0x60").should.be.rejected;
  })

  it("should not insert after a node not in the list", async () => {
    await linkedList.insertAfter("0x60", "0x70").should.be.rejected;
  })

  it("should not insert before a node not in the list", async () => {
    await linkedList.insertBefore("0x60", "0x80").should.be.rejected;
  })

  it("should not insert a node aldready in the list", async () => {
    await linkedList.insertAfter("0x20", "0x30").should.be.rejected;
  })

  it("should not insert a node aldready in the list", async () => {
    await linkedList.insertBefore("0x30", "0x20").should.be.rejected;
  })

  it("should not prepend a value that aldready exists", async () => {
    await linkedList.prepend("0x20").should.be.rejected;
  })

  it("should not swap a node not in the list, and a node in the list", async () => {
    await linkedList.swap("0x60", "0x20").should.be.rejected;
  })

  it("should not swap a node in the list, and a node not in the list", async () => {
    await linkedList.swap("0x20", "0x60").should.be.rejected;
  })

  it("should not swap two nodes that are not in the list", async () => {
    await linkedList.swap("0x60", "0x70").should.be.rejected;
  })

  it("should not get previous node of the node if it is not in the list", async () => {
    await linkedList.previous.call("0x60").should.be.rejected;
  });

  it("should not get following node of the given node if it is not in the list", async () => {
    await linkedList.next.call("0x60").should.be.rejected;
  });

});