import { FhevmType } from "@fhevm/hardhat-plugin";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

task("task:address", "Prints the LuckCoin address").setAction(async function (_taskArguments: TaskArguments, hre) {
  const { deployments } = hre;

  const deployment = await deployments.get("LuckCoin");

  console.log(`LuckCoin address is ${deployment.address}`);
});

task("task:play", "Plays the slot machine once (0.001 ETH)").setAction(async function (_taskArguments: TaskArguments, hre) {
  const { ethers, deployments } = hre;
  const deployment = await deployments.get("LuckCoin");
  const signer = (await ethers.getSigners())[0];
  const contract = await ethers.getContractAt("LuckCoin", deployment.address);

  console.log(`Spinning slots from ${signer.address} ...`);
  const tx = await contract.connect(signer).play({ value: ethers.parseEther("0.001") });
  const receipt = await tx.wait();
  console.log(`tx: ${tx.hash} status=${receipt?.status}`);

  const lastSpin = await contract.getLastSpin(signer.address);
  console.log(
    `Last spin -> slots: [${lastSpin.slots[0]}, ${lastSpin.slots[1]}, ${lastSpin.slots[2]}], jackpot: ${lastSpin.isJackpot}`,
  );
});

task("task:decrypt-balance", "Decrypts the caller encrypted LuckCoin balance")
  .addOptionalParam("address", "LuckCoin contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;
    await fhevm.initializeCLIApi();

    const deployment = taskArguments.address ? { address: taskArguments.address } : await deployments.get("LuckCoin");
    const signer = (await ethers.getSigners())[0];
    const contract = await ethers.getContractAt("LuckCoin", deployment.address);

    const encryptedBalance = await contract.confidentialBalanceOf(signer.address);
    if (encryptedBalance === ethers.ZeroHash) {
      console.log("Encrypted balance: 0x0");
      console.log("Clear balance    : 0");
      return;
    }

    const clearBalance = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedBalance,
      deployment.address,
      signer,
    );
    console.log(`Encrypted balance: ${encryptedBalance}`);
    console.log(`Clear balance    : ${clearBalance}`);
  });
