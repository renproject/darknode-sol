import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {keccak256} from 'ethers/lib/utils';
import {BaseContract} from 'ethers';
import {GetOperatorDarknodes} from '../typechain/GetOperatorDarknodes';
import {Protocol} from '../typechain/Protocol';
import {ClaimRewardsProxy} from '../typechain/ClaimRewardsProxy';
import {ClaimRewardsV1} from '../typechain/ClaimRewardsV1';
import {RenProxyAdmin} from '../typechain';

const CREATE2_SALT = keccak256(Buffer.from('REN-0001'));

const setupCreate2 =
  (hre: HardhatRuntimeEnvironment) =>
  async <T extends BaseContract>(name: string, args: any[]): Promise<T> => {
    const {deployments, getNamedAccounts, ethers} = hre;
    const {deploy} = deployments;

    const {deployer} = await getNamedAccounts();
    console.log(`Deploying ${name} from ${deployer}`);

    const result = await deploy(name, {
      from: deployer,
      args: args,
      log: true,
      deterministicDeployment: CREATE2_SALT,
    });
    console.log(`Deployed ${name} from ${deployer}!`);
    const contract = await ethers.getContractAt<T>(
      name,
      result.address,
      deployer
    );
    console.log(`Got contract!`);
    return contract;
  };

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {getNamedAccounts, ethers} = hre;

  const create2 = await setupCreate2(hre);

  const {deployer} = await getNamedAccounts();

  console.log('deployer', deployer);

  // Testnet
  const darknodeRegistry = {
    address: '0x9954C9F839b31E82bc9CA98F234313112D269712',
  };
  let renProxyAdmin = {address: '0x4C695C4Aa6238f0A7092733180328c2E64C912C7'};

  if (!renProxyAdmin.address) {
    renProxyAdmin = await create2<RenProxyAdmin>('RenProxyAdmin', []);
  }

  const getOperatorDarknodes = await create2<GetOperatorDarknodes>(
    'GetOperatorDarknodes',
    [darknodeRegistry.address]
  );

  const claimRewardsV1 = await create2<ClaimRewardsV1>('ClaimRewardsV1', []);

  const claimRewardsProxy = await create2<ClaimRewardsProxy>(
    'ClaimRewardsProxy',
    [claimRewardsV1.address, renProxyAdmin.address, '0x']
  );

  const claimRewards = await ethers.getContractAt(
    'ClaimRewardsV1',
    claimRewardsProxy.address,
    deployer
  );

  // Deploy Protocol ////////////////////////////////////////////////
  const protocol = await create2<Protocol>('Protocol', []);
  await protocol.__Protocol_init(deployer);
  await protocol.addContract('DarknodeRegistry', darknodeRegistry.address);
  await protocol.addContract('ClaimRewards', claimRewards.address);
  await protocol.addContract(
    'GetOperatorDarknodes',
    getOperatorDarknodes.address
  );
};

export default func;

func.tags = [
  'RenProxyAdmin',
  'GetOperatorDarknodes',
  'ClaimRewardsV1',
  'ClaimRewardsProxy',
  'Protocol',
];
