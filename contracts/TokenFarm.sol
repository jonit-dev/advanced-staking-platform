//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/*
Main functionalities:
- Stake: lock tokens into our smart contract.
- Withdraw: unlock tokens and pull out of the contract.
- claimReward: users get their reward tokens.
 */

contract TokenFarm is Ownable, ReentrancyGuard {
  IERC20 public s_stakingToken;
  IERC20 public s_rewardToken;
  mapping(address => uint256) public s_balances; // address => balance
  mapping(address => uint256) public s_rewards; // address => reward   (how much rewards each address has)
  uint256 public s_totalSupply;
  uint256 public s_rewardPerTokenStored;
  uint256 s_lastUpdateTime;
  uint256 REWARD_RATE = 100; //100 tokens per second

  mapping(address => uint256) public s_userRewardPerTokenPaid; // how much each address has been paid

  constructor(address stakingToken, address rewardToken) {
    s_stakingToken = IERC20(stakingToken);
    s_rewardToken = IERC20(rewardToken);
  }

  function stake(uint256 amount, address tokenToStake)
    public
    nonReentrant
    moreThanZero(amount)
    updateReward(msg.sender)
    onlyAllowedTokens(tokenToStake)
  {
    require(amount > 0, "Amount cannot be 0.");

    s_balances[msg.sender] += amount;
    s_totalSupply += amount;

    bool success = IERC20(tokenToStake).transferFrom(msg.sender, address(this), amount);
    require(success, "Staking failed.");
  }

  function withdraw(uint256 amount) external nonReentrant moreThanZero(amount) updateReward(msg.sender) {
    s_balances[msg.sender] -= amount;
    s_totalSupply -= amount;
    bool success = s_stakingToken.transfer(msg.sender, amount);

    require(success, "Withdraw failed.");
  }

  function claimReward() external updateReward(msg.sender) {
    uint256 reward = s_rewards[msg.sender];
    bool success = s_rewardToken.transfer(msg.sender, reward);

    require(success, "Claim reward failed.");
  }

  function rewardPerToken() public view returns (uint256) {
    if (s_totalSupply == 0) {
      return s_rewardPerTokenStored;
    }
    return s_rewardPerTokenStored + (((block.timestamp - s_lastUpdateTime) * REWARD_RATE * 1e18) / s_totalSupply);
  }

  function earned(address account) public view returns (uint256) {
    uint256 currentBalance = s_balances[account];
    uint256 amountPaid = s_userRewardPerTokenPaid[account];
    uint256 currentRewardPerToken = rewardPerToken();

    uint256 pastRewards = s_rewards[account];

    uint256 earnedRewards = ((currentBalance * (currentRewardPerToken - amountPaid)) / 1e18) + pastRewards;

    return earnedRewards;
  }

  modifier moreThanZero(uint256 amount) {
    require(amount > 0, "Amount cannot be 0.");
    _;
  }

  modifier updateReward(address account) {
    s_rewardPerTokenStored = rewardPerToken();
    s_lastUpdateTime = block.timestamp;
    s_rewards[account] = earned(account);
    s_userRewardPerTokenPaid[account] = s_rewardPerTokenStored;
    _;
  }

  modifier onlyAllowedTokens(address token) {
    require(token == address(s_stakingToken), "The token you submitted to stake isn't allowed!");
    _;
  }
}
