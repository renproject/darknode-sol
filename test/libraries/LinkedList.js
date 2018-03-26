const linkedListTest = artifacts.require("LinkedListTest.sol");
const chai = require("chai");
chai.use(require("chai-as-promised"));
chai.should();

contract("LinkedList", function(accounts) {

  let linkedList;

  before(async function () {
    linkedList = await linkedListTest.new();
  });


  it("can append", async function () {
    await linkedList.append("1");
    (await linkedList.isInList.call("1")).should.equal(true);
  });

  it("can prepend", async () => {
    await linkedList.prepend("2");
    (await linkedList.previous.call("1")).should.equal("0x2000000000000000000000000000000000000000");
  });

  it("can swap", async () => {
    await linkedList.swap("1", "2");
    (await linkedList.previous.call("2")).should.equal("0x1000000000000000000000000000000000000000");
  });

  it("can insertAfter", async () => {
    await linkedList.insertAfter("2", "4");
    (await linkedList.next.call("2")).should.equal("0x4000000000000000000000000000000000000000");
  });

  it("can insertBefore", async () => {
    await linkedList.insertBefore("4", "3");
    (await linkedList.previous.call("4")).should.equal("0x3000000000000000000000000000000000000000");
  });

  it("can remove", async () => {
    await linkedList.remove("4");
    (await linkedList.isInList.call("4")).should.equal(false);
  });

  it("can get previous node of the given node", async () => {
    (await linkedList.previous.call("2")).should.equal("0x1000000000000000000000000000000000000000");
  });

  it("can get following node of the given node", async () => {
    (await linkedList.next.call("1")).should.equal("0x2000000000000000000000000000000000000000");
  });


  it("can get the last node of the given list", async () => {
    (await linkedList.end.call()).should.equal("0x3000000000000000000000000000000000000000");
  });


  it("can get the first node of the given list", async () => {
    (await linkedList.begin.call()).should.equal("0x1000000000000000000000000000000000000000");
  });

  it("handle removing NULL", async () => {
    await linkedList.insertBefore("1", "").should.not.be.rejectedWith();
    await linkedList.remove("").should.not.be.rejectedWith();
  });

  it("should not add the same value more than once", async () => {
    await linkedList.append("1").should.be.rejectedWith();
  });

  it("should not remove a node not in the list", async () => {
    await linkedList.remove("6").should.be.rejectedWith();
  })

  it("should not insert after a node not in the list", async () => {
    await linkedList.insertAfter("6", "7").should.be.rejectedWith();
  })

  it("should not insert before a node not in the list", async () => {
    await linkedList.insertBefore("6", "8").should.be.rejectedWith();
  })

  it("should not insert a node aldready in the list", async () => {
    await linkedList.insertAfter("2", "3").should.be.rejectedWith();
  })

  it("should not insert a node aldready in the list", async () => {
    await linkedList.insertBefore("3", "2").should.be.rejectedWith();
  })

  it("should not prepend a value that aldready exists", async () => {
    await linkedList.prepend("2").should.be.rejectedWith();
  })

  it("should not swap a node not in the list, and a node in the list", async () => {
    await linkedList.swap("6", "2").should.be.rejectedWith();
  })

  it("should not swap a node in the list, and a node not in the list", async () => {
    await linkedList.swap("2", "6").should.be.rejectedWith();
  })

  it("should not swap two nodes that are not in the list", async () => {
    await linkedList.swap("6", "7").should.be.rejectedWith();
  })

  it("should not get previous node of the node if it is not in the list", async () => {
    await linkedList.previous.call("6").should.be.rejectedWith();
  });

  it("should not get following node of the given node if it is not in the list", async () => {
    await linkedList.next.call("6").should.be.rejectedWith();
  });

});