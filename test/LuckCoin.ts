import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { LuckCoin, LuckCoin__factory } from "../types";

type Signers = {
  deployer: HardhatEthersSigner;
  player: HardhatEthersSigner;
};

function computeSlots(seed: bigint, player: string, startNonce: bigint = 0n): number[] {
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  let nonce = startNonce;
  const slots: number[] = [];

  for (let i = 0; i < 3; i++) {
    nonce += 1n;
    const encoded = abiCoder.encode(["uint256", "address", "uint256"], [seed, player, nonce]);
    const hashed = ethers.keccak256(encoded);
    const slotValue = (BigInt(hashed) % 4n) + 1n;
    slots.push(Number(slotValue));
  }

  return slots;
}

function findJackpotSeed(player: string, startNonce: bigint = 0n): bigint {
  let seed = 1n;
  while (seed < 200_000n) {
    const slots = computeSlots(seed, player, startNonce);
    if (slots[0] === slots[1] && slots[1] === slots[2]) {
      return seed;
    }
    seed += 1n;
  }
  throw new Error("Failed to find jackpot seed");
}

describe("LuckCoin", function () {
  let signers: Signers;
  let luckCoin: LuckCoin;
  let contractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], player: ethSigners[1] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn("This Hardhat test suite requires the local FHEVM mock environment");
      this.skip();
    }

    const factory = (await ethers.getContractFactory("LuckCoin")) as LuckCoin__factory;
    luckCoin = (await factory.deploy()) as LuckCoin;
    contractAddress = await luckCoin.getAddress();
  });

  it("requires the exact spin price", async function () {
    await expect(luckCoin.connect(signers.player).play({ value: 0 })).to.be.revertedWithCustomError(
      luckCoin,
      "IncorrectStake",
    );
  });

  it("stores deterministic seeded spins", async function () {
    const seed = 12345n;
    const expectedSlots = computeSlots(seed, signers.player.address, 0n);
    await luckCoin.connect(signers.player).playWithSeed(seed, { value: ethers.parseEther("0.001") });

    const lastSpin = await luckCoin.getLastSpin(signers.player.address);
    expect(Number(lastSpin.slots[0])).to.equal(expectedSlots[0]);
    expect(Number(lastSpin.slots[1])).to.equal(expectedSlots[1]);
    expect(Number(lastSpin.slots[2])).to.equal(expectedSlots[2]);
    expect(lastSpin.isJackpot).to.equal(
      expectedSlots[0] === expectedSlots[1] && expectedSlots[1] === expectedSlots[2],
    );
  });

  it("mints encrypted rewards on jackpot", async function () {
    const jackpotSeed = findJackpotSeed(signers.player.address, 0n);
    await luckCoin.connect(signers.player).playWithSeed(jackpotSeed, { value: ethers.parseEther("0.001") });

    const encryptedBalance = await luckCoin.confidentialBalanceOf(signers.player.address);
    expect(encryptedBalance).to.not.equal(ethers.ZeroHash);

    const clearBalance = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedBalance,
      contractAddress,
      signers.player,
    );
    expect(clearBalance).to.equal(10_000n);
  });
});
