import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployContract } from "../helpers/deployHelpers";
import { ToToken } from "../helpers/utilsHelper";
import { RewardToken, StakingToken, TokenFarm } from "../typechain";
import { AnotherToken } from "../typechain/AnotherToken";
import { moveBlocks } from "../utils/moveBlocks";
import { moveTime } from "../utils/moveTime";
const SECONDS_IN_DAY = 60 * 60 * 24 * 30;

describe("TokenFarm.sol", async function () {
  let accounts: SignerWithAddress[], deployer: SignerWithAddress, investor: SignerWithAddress;
  let stakingToken: StakingToken;
  let rewardToken: RewardToken;
  let tokenFarm: TokenFarm;
  let anotherToken: AnotherToken;

  const stakeAmount = ethers.utils.parseEther("1");

  before(async () => {
    accounts = await ethers.getSigners();
    deployer = accounts[0];
    investor = accounts[1];

    stakingToken = await deployContract<StakingToken>("StakingToken");
    rewardToken = await deployContract<RewardToken>("RewardToken");
    anotherToken = await deployContract<AnotherToken>("AnotherToken");

    tokenFarm = await deployContract<TokenFarm>("TokenFarm", {
      args: [stakingToken.address, rewardToken.address],
    });

    // transfer reward token total supply to TokenFarm.
    await rewardToken.transfer(tokenFarm.address, await rewardToken.totalSupply());

    await stakingToken.transfer(investor.address, stakeAmount);
    await anotherToken.transfer(investor.address, stakeAmount); //for unauthorized token tests
    const investorBalance = await stakingToken.balanceOf(investor.address);
    console.log("Investor balance:", investorBalance.toString());
  });

  it("TokenFarm should own all RewardToken supply", async () => {
    const rewardTokenBalance = await rewardToken.balanceOf(tokenFarm.address);

    expect(rewardTokenBalance.toString()).to.equal(await rewardToken.totalSupply());
  });

  it("Investor initial balance must be equal to the stake amount", async () => {
    const investorBalance = await stakingToken.balanceOf(investor.address);
    expect(investorBalance).to.eq(stakeAmount);
  });

  it("Should fail if we try to stake an unauthorized token", async () => {
    await anotherToken.connect(investor).approve(tokenFarm.address, stakeAmount); // allow tokenFarm to use our token through investor account

    await expect(tokenFarm.connect(investor).stake(stakeAmount, anotherToken.address)).to.be.revertedWith(
      "The token you submitted to stake isn't allowed!"
    );
  });

  it("TokenFarm should have both RewardToken and StakingToken addresses", async () => {
    const rewardtokenAddress = await tokenFarm.s_rewardToken();
    const StakingTokenAddress = await tokenFarm.s_stakingToken();

    expect(rewardtokenAddress).to.equal(rewardToken.address);
    expect(StakingTokenAddress).to.equal(stakingToken.address);
  });

  it("Shouldn't allow an investor stake 0 tokens", async () => {
    await stakingToken.connect(investor).approve(tokenFarm.address, stakeAmount);

    await expect(tokenFarm.connect(investor).stake(0, stakingToken.address)).to.be.revertedWith("Amount cannot be 0.");
  });

  it("Allows users to stake and claim rewards successfully", async () => {
    const initialStakingTokenBalance = await stakingToken.balanceOf(investor.address);

    await stakingToken.connect(investor).approve(tokenFarm.address, stakeAmount);
    await tokenFarm.connect(investor).stake(stakeAmount, stakingToken.address);

    expect(initialStakingTokenBalance).to.equal(ToToken("1"));

    const startingEarned = await tokenFarm.earned(investor.address);

    console.log(`startingEarned: ${startingEarned}`);

    await moveTime(SECONDS_IN_DAY);
    await moveBlocks(1);

    const endingEarned = await tokenFarm.earned(investor.address);
    console.log(`endingEarned: ${endingEarned}`);
    expect(endingEarned > startingEarned).to.be.true;

    await tokenFarm.connect(investor).claimReward();

    const rewardTokenBalance = await rewardToken.balanceOf(investor.address);

    expect(rewardTokenBalance).to.not.equal(0);

    console.log(`Reward Token balance(investor): ${rewardTokenBalance}`);
  });
});
