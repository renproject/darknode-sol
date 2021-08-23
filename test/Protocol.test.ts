import {expect} from './chai-setup';
import {
  ethers,
  deployments,
  getUnnamedAccounts,
  getNamedAccounts,
} from 'hardhat';
import {Protocol} from '../typechain';
import {setupUser, setupUsers} from './utils';

const setup = deployments.createFixture(async () => {
  await deployments.fixture('Protocol');
  const contracts = {
    Protocol: <Protocol>await ethers.getContract('Protocol'),
  };
  const users = await setupUsers(await getUnnamedAccounts(), contracts);
  return {
    ...contracts,
    users,
  };
});

describe.only('Protocol', function () {
  it.only('transfer fails', async function () {
    this.timeout(1000 * 1000);
    const {users} = await setup();
    console.log(await users[0].Protocol.getContract('DarknodeRegistry'));
  });
});
