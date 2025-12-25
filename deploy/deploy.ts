import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedLuckCoin = await deploy("LuckCoin", {
    from: deployer,
    log: true,
  });

  console.log(`LuckCoin contract: `, deployedLuckCoin.address);
};
export default func;
func.id = "deploy_luckCoin"; // id required to prevent reexecution
func.tags = ["LuckCoin"];
