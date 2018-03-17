
import * as chai from "chai";
chai.use(require("chai-as-promised"));
chai.use(require("chai-bignumber")());
chai.should();

const LinkedListMock = artifacts.require("LinkedListMock");

contract("LinkedList", function() {

  let linkedlist: any;

  before(async function () {
    linkedlist = await LinkedListMock.new();
  });

  it("can append", async function () {
    await linkedlist.append("1");
    (await linkedlist.isInList.call("1"))
      .should.equal(true);
    await linkedlist.remove("1");
  });

  it("can do everything else... (TODO)", async function () {
    await linkedlist.append("1");
    await linkedlist.prepend("2");
    await linkedlist.swap("2", "1");
    await linkedlist.remove("2");
    await linkedlist.insertAfter("1", "3");
    await linkedlist.insertBefore("3", "2");
    await linkedlist.previous("3");
    await linkedlist.next("1");
    await linkedlist.tail();
    await linkedlist.head();
  });

  it("negative tests... (TODO)", async function () {
    await linkedlist.remove(0x0)
      .should.be.rejectedWith(Error);
    await linkedlist.remove("4")
      .should.be.rejectedWith(Error);
    await linkedlist.append("1")
      .should.be.rejectedWith(Error);
  });

});