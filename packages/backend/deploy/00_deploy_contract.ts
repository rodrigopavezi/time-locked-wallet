import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const main: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
}: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const timeLockedWalletArgs = ["0xE041608922d06a4F26C0d4c27d8bCD01daf1f792"];
  await deploy("TimeLockedWallet", {
    // Learn more about args here: https://www.npmjs.com/package/hardhat-deploy#deploymentsdeploy
    args: timeLockedWalletArgs,
    from: deployer,
    log: true,
  });

  const testUSDCArgs = [
    "0xE041608922d06a4F26C0d4c27d8bCD01daf1f792",
    "TestUSDC",
    "TestUSDC",
    "1000000000000000000000000",
  ];
  await deploy("TestUSDC", {
    // Learn more about args here: https://www.npmjs.com/package/hardhat-deploy#deploymentsdeploy
    args: testUSDCArgs,
    from: deployer,
    log: true,
  });
};

export default main;

export const tags = ["all", "timeLockedWallet", "testUSDC"];
