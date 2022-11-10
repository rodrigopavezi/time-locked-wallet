import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { Contract } from "ethers";
import { ethers, network } from "hardhat";

const ONE_MONTH = 2629800;
const TWO_MONTHS = 2629800 * 2;
const USDC_WHALE = "0xe4dc8ffcfd93216ddf0332c5b94b1a2a3d5665f1";
const POLYGON_USDC = "0x5E48C277b2965Df92fd2B172bf839914Dfa092f5";

const ERC20_ABI = require("../artifacts/@openzeppelin/contracts/token/ERC20/ERC20.sol/ERC20.json");

const USDC = new ethers.Contract(POLYGON_USDC, ERC20_ABI.abi, ethers.provider);

const fastForward = async (seconds: number) => {
  await ethers.provider.send("evm_increaseTime", [seconds]);
  await ethers.provider.send("evm_mine", []);
};

const currentTime = async () => {
  const { timestamp } = await ethers.provider.getBlock("latest");
  return timestamp;
};

describe("TimeLockedWallet", function () {
  let timeLockedWallet: Contract;
  let owner: SignerWithAddress, ownerAddress: string;
  let user1: SignerWithAddress, user1Address: string;
  let user2: SignerWithAddress, user2Address: string;
  let forwarder: SignerWithAddress, forwarderAddress: string;
  let usdcWhale: SignerWithAddress, usdcWhaleAddress: string;
  let nativeToken: string;

  beforeEach(async () => {
    [owner, user1, user2, forwarder] = await ethers.getSigners();
    ownerAddress = await owner.getAddress();
    user1Address = await user1.getAddress();
    user2Address = await user2.getAddress();
    forwarderAddress = await forwarder.getAddress();

    const TimeLockedWallet = await ethers.getContractFactory(
      "TimeLockedWallet"
    );
    timeLockedWallet = await TimeLockedWallet.deploy(forwarderAddress);
    await timeLockedWallet.deployed();
    expect(await timeLockedWallet.unlockDate()).to.equal(await currentTime());

    nativeToken = await timeLockedWallet.NATIVE();

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [USDC_WHALE],
    });

    usdcWhale = await ethers.getSigner(USDC_WHALE);
    usdcWhaleAddress = await usdcWhale.getAddress();

    await USDC.connect(usdcWhale).transfer(
      user1Address,
      ethers.utils.parseUnits("10000", 6)
    );

    await USDC.connect(usdcWhale).transfer(
      user2Address,
      ethers.utils.parseUnits("10000", 6)
    );
  });

  it("Should allow setting the unlockDate", async function () {
    const unlockDate = (await currentTime()) + ONE_MONTH;
    await timeLockedWallet.setUnlockDate(unlockDate);

    expect(await timeLockedWallet.unlockDate()).to.equal(unlockDate);
  });

  it("Should allow to deposit NATIVE tokens at any time", async function () {
    const ethAmount = ethers.utils.parseEther("200");

    await timeLockedWallet.connect(user1).deposit(nativeToken, ethAmount, {
      value: ethAmount,
    });
    const balance = await timeLockedWallet.balances(nativeToken, user1Address);

    expect(balance).to.equal(ethAmount);
  });

  it("Should allow to deposit NATIVE tokens at any time for 2 users", async function () {
    const ethAmountUser1 = ethers.utils.parseEther("200");
    const ethAmountUser2 = ethers.utils.parseEther("500");

    await timeLockedWallet.connect(user1).deposit(nativeToken, ethAmountUser1, {
      value: ethAmountUser1,
    });

    await timeLockedWallet.connect(user2).deposit(nativeToken, ethAmountUser2, {
      value: ethAmountUser2,
    });

    const balanceUser1 = await timeLockedWallet.balances(
      nativeToken,
      user1Address
    );
    const balanceUser2 = await timeLockedWallet.balances(
      nativeToken,
      user2Address
    );

    expect(balanceUser1).to.equal(ethAmountUser1);
    expect(balanceUser2).to.equal(ethAmountUser2);
  });

  it("Should allow to deposit USDC tokens at any time", async function () {
    const usdcAmount = ethers.utils.parseUnits("100", 6);

    await USDC.connect(user1).approve(timeLockedWallet.address, usdcAmount);

    await timeLockedWallet.connect(user1).deposit(POLYGON_USDC, usdcAmount, {
      value: usdcAmount,
    });
    const balance = await timeLockedWallet.balances(POLYGON_USDC, user1Address);

    expect(balance).to.equal(usdcAmount);
  });

  it("Should allow to deposit NATIVE tokens at any time for 2 users", async function () {
    const usdcAmountUser1 = ethers.utils.parseUnits("300", 6);
    const usdcAmountUser2 = ethers.utils.parseUnits("600", 6);

    await USDC.connect(user1).approve(
      timeLockedWallet.address,
      usdcAmountUser1
    );
    await USDC.connect(user2).approve(
      timeLockedWallet.address,
      usdcAmountUser2
    );

    await timeLockedWallet
      .connect(user1)
      .deposit(POLYGON_USDC, usdcAmountUser1, {
        value: usdcAmountUser1,
      });

    await timeLockedWallet
      .connect(user2)
      .deposit(POLYGON_USDC, usdcAmountUser2, {
        value: usdcAmountUser2,
      });

    const balanceUser1 = await timeLockedWallet.balances(
      POLYGON_USDC,
      user1Address
    );
    const balanceUser2 = await timeLockedWallet.balances(
      POLYGON_USDC,
      user2Address
    );

    expect(balanceUser1).to.equal(usdcAmountUser1);
    expect(balanceUser2).to.equal(usdcAmountUser2);
  });

  it("Should allow to deposit NATIVE tokens and claim after the unlockDate", async function () {
    const unlockDate = (await currentTime()) + ONE_MONTH;
    await timeLockedWallet.setUnlockDate(unlockDate);

    const ethAmount = ethers.utils.parseEther("200");
    const balanceBefore = await user1.getBalance();

    const depositTx = await timeLockedWallet
      .connect(user1)
      .deposit(nativeToken, ethAmount, {
        value: ethAmount,
      });

    const depositReceipt = await depositTx.wait();
    const gasCostForDepositTx = depositReceipt.gasUsed.mul(
      depositReceipt.effectiveGasPrice
    );

    const balance = await timeLockedWallet.balances(nativeToken, user1Address);

    expect(balance).to.equal(ethAmount);

    const balanceAfter = await user1.getBalance();
    expect(balanceAfter).to.equal(
      balanceBefore.sub(ethAmount).sub(gasCostForDepositTx)
    );

    await fastForward(TWO_MONTHS);

    const claimTx = await timeLockedWallet
      .connect(user1)
      .claim(nativeToken, ethAmount);

    const claimReceipt = await claimTx.wait();
    const gasCostForClaimTx = claimReceipt.gasUsed.mul(
      claimReceipt.effectiveGasPrice
    );

    const balanceAfterClaim = await timeLockedWallet.balances(
      nativeToken,
      user1Address
    );

    expect(balanceAfterClaim).to.equal(0);

    const balanceNow = await user1.getBalance();
    expect(balanceNow).to.equal(
      balanceBefore.sub(gasCostForDepositTx).sub(gasCostForClaimTx)
    );
  });

  it("Should allow to deposit USDC tokens and claim after the unlockDate", async function () {
    const unlockDate = (await currentTime()) + ONE_MONTH;
    await timeLockedWallet.setUnlockDate(unlockDate);

    const usdcAmount = ethers.utils.parseUnits("100", 6);
    await USDC.connect(user1).approve(timeLockedWallet.address, usdcAmount);
    const balanceBefore = await USDC.balanceOf(user1Address);

    await timeLockedWallet.connect(user1).deposit(POLYGON_USDC, usdcAmount, {
      value: usdcAmount,
    });

    const balance = await timeLockedWallet.balances(POLYGON_USDC, user1Address);

    expect(balance).to.equal(usdcAmount);

    const balanceAfter = await USDC.balanceOf(user1Address);
    expect(balanceAfter).to.equal(balanceBefore.sub(usdcAmount));

    await fastForward(TWO_MONTHS);

    await timeLockedWallet.connect(user1).claim(POLYGON_USDC, usdcAmount);

    const balanceAfterClaim = await timeLockedWallet.balances(
      POLYGON_USDC,
      user1Address
    );

    expect(balanceAfterClaim).to.equal(0);

    const balanceNow = await USDC.balanceOf(user1Address);
    expect(balanceNow).to.equal(balanceBefore);
  });

  it("Should allow to deposit NATIVE tokens and revert claim before the unlockDate", async function () {
    const unlockDate = (await currentTime()) + ONE_MONTH;
    await timeLockedWallet.setUnlockDate(unlockDate);

    const ethAmount = ethers.utils.parseEther("200");
    const balanceBefore = await user1.getBalance();

    const depositTx = await timeLockedWallet
      .connect(user1)
      .deposit(nativeToken, ethAmount, {
        value: ethAmount,
      });

    const depositReceipt = await depositTx.wait();
    const gasCostForDepositTx = depositReceipt.gasUsed.mul(
      depositReceipt.effectiveGasPrice
    );

    const balance = await timeLockedWallet.balances(nativeToken, user1Address);

    expect(balance).to.equal(ethAmount);

    const balanceAfter = await user1.getBalance();
    expect(balanceAfter).to.equal(
      balanceBefore.sub(ethAmount).sub(gasCostForDepositTx)
    );

    await expect(
      timeLockedWallet.connect(user1).claim(nativeToken, ethAmount)
    ).to.be.revertedWith("IsStillLocked()");
  });

  it("Should allow to deposit USDC tokens and revert claim before the unlockDate", async function () {
    const unlockDate = (await currentTime()) + ONE_MONTH;
    await timeLockedWallet.setUnlockDate(unlockDate);

    const usdcAmount = ethers.utils.parseUnits("100", 6);
    await USDC.connect(user1).approve(timeLockedWallet.address, usdcAmount);
    const balanceBefore = await USDC.balanceOf(user1Address);

    await timeLockedWallet.connect(user1).deposit(POLYGON_USDC, usdcAmount, {
      value: usdcAmount,
    });

    const balance = await timeLockedWallet.balances(POLYGON_USDC, user1Address);

    expect(balance).to.equal(usdcAmount);

    const balanceAfter = await USDC.balanceOf(user1Address);
    expect(balanceAfter).to.equal(balanceBefore.sub(usdcAmount));

    await expect(
      timeLockedWallet.connect(user1).claim(POLYGON_USDC, usdcAmount)
    ).to.be.revertedWith("IsStillLocked()");
  });

  it("Should allow to deposit NATIVE tokens and revert claim if balance in the contract is insufficient", async function () {
    const unlockDate = (await currentTime()) + ONE_MONTH;
    await timeLockedWallet.setUnlockDate(unlockDate);

    const ethAmount = ethers.utils.parseEther("200");
    const balanceBefore = await user1.getBalance();

    const depositTx = await timeLockedWallet
      .connect(user1)
      .deposit(nativeToken, ethAmount, {
        value: ethAmount,
      });

    const depositReceipt = await depositTx.wait();
    const gasCostForDepositTx = depositReceipt.gasUsed.mul(
      depositReceipt.effectiveGasPrice
    );

    const balance = await timeLockedWallet.balances(nativeToken, user1Address);

    expect(balance).to.equal(ethAmount);

    const balanceAfter = await user1.getBalance();
    expect(balanceAfter).to.equal(
      balanceBefore.sub(ethAmount).sub(gasCostForDepositTx)
    );

    await fastForward(TWO_MONTHS);

    await expect(
      timeLockedWallet
        .connect(user1)
        .claim(nativeToken, ethAmount.add(ethAmount))
    ).to.be.revertedWith("InsufficientBalance()");
  });

  it("Should allow to deposit USDC tokens and revert claim if balance in the contract is insufficient", async function () {
    const unlockDate = (await currentTime()) + ONE_MONTH;
    await timeLockedWallet.setUnlockDate(unlockDate);

    const usdcAmount = ethers.utils.parseUnits("100", 6);
    await USDC.connect(user1).approve(timeLockedWallet.address, usdcAmount);
    const balanceBefore = await USDC.balanceOf(user1Address);

    await timeLockedWallet.connect(user1).deposit(POLYGON_USDC, usdcAmount, {
      value: usdcAmount,
    });

    const balance = await timeLockedWallet.balances(POLYGON_USDC, user1Address);

    expect(balance).to.equal(usdcAmount);

    const balanceAfter = await USDC.balanceOf(user1Address);
    expect(balanceAfter).to.equal(balanceBefore.sub(usdcAmount));

    await fastForward(TWO_MONTHS);

    await expect(
      timeLockedWallet
        .connect(user1)
        .claim(POLYGON_USDC, usdcAmount.add(usdcAmount))
    ).to.be.revertedWith("InsufficientBalance()");
  });
});
