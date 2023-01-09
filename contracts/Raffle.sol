// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/AutomationCompatible.sol";

error Raffle_NotEnoughETHEntered();
error Raffle_TransferFailed();
error Raffle_NotOpen();
error Raffle__UpkeepNotNeeded(uint256 currentBalance, uint256 numPlayers, uint256 raffleState);

contract Raffle is VRFConsumerBaseV2, AutomationCompatibleInterface {
  enum RaffleState {
    OPEN,
    CALCULATING
  }

  uint256 private immutable i_entranceFee;
  address payable[] private s_players; //payable because the winner of the raffle should be paid
  VRFCoordinatorV2Interface private immutable i_vrfCordinator;
  bytes32 private immutable i_gasLane;
  uint64 private immutable i_subscriptionId;
  uint32 private immutable i_callbackGasLimit;
  uint32 private immutable i_interval;
  uint16 private constant REQUEST_CONFIRMATIONS = 3;
  uint32 private constant NUM_WORDS = 1;
  address private s_recentWinner;
  uint256 private s_lastTimeStamp;
  RaffleState s_raffleState;

  //events
  event RaffleEnter(address indexed player);
  event RequestedRaffleWinner(uint256 indexed requestId);
  event WinnerPicked(address indexed winner);

  constructor(
    address vrfCordinatorV2,
    uint256 entranceFee,
    bytes32 gasLane,
    uint64 subscriptionId,
    uint32 callbackGasLimit,
    uint32 interval
  ) VRFConsumerBaseV2(vrfCordinatorV2) {
    i_entranceFee = entranceFee;
    i_vrfCordinator = VRFCoordinatorV2Interface(vrfCordinatorV2);
    i_gasLane = gasLane;
    i_subscriptionId = subscriptionId;
    i_callbackGasLimit = callbackGasLimit;
    i_interval = interval;
    s_raffleState = RaffleState.OPEN;
    s_lastTimeStamp = block.timestamp;
  }

  function enterRaffle() public payable {
    if (msg.value < i_entranceFee) {
      revert Raffle_NotEnoughETHEntered();
    }

    if (s_raffleState != RaffleState.OPEN) {
      revert Raffle_NotOpen();
    }

    s_players.push(payable(msg.sender));

    //Emit an event when we update a dynamic array or mapping
    emit RaffleEnter(msg.sender);
  }

  /**
   * This is the function that Chianlink Automation calls to know if upKeep is needed.
   * Conditions:
   * 1 - Our time interval shoud have passed
   * 2 - Atleast one player, and has some ETH
   * 3 - Our subscription is funded with ETH
   * 4 - Lottery state is OPEN
   */
  function checkUpkeep(
    bytes memory /* checkData */
  ) public view override returns (bool upkeepNeeded, bytes memory /* performData */) {
    bool isOpen = RaffleState.OPEN == s_raffleState;
    bool timePassed = (block.timestamp - s_lastTimeStamp) > i_interval;
    bool hasPlayers = s_players.length > 0;
    bool hasBalance = address(this).balance > 0;
    upkeepNeeded = isOpen && timePassed && hasPlayers && hasBalance;
    // We don't use the checkData in this example. The checkData is defined when the Upkeep was registered.
  }

  //we are using *external* because we don't want the function to be called by the smart-contract but by an external factor
  function performUpkeep(bytes calldata /*performData*/) external override {
    (bool upkeepNeeded, ) = checkUpkeep("");
    if (!upkeepNeeded) {
      revert Raffle__UpkeepNotNeeded(address(this).balance, s_players.length, uint256(s_raffleState));
    }

    s_raffleState = RaffleState.CALCULATING;

    //request the random number
    //this also emits an event
    uint256 requestId = i_vrfCordinator.requestRandomWords(
      i_gasLane,
      i_subscriptionId,
      REQUEST_CONFIRMATIONS,
      i_callbackGasLimit,
      NUM_WORDS
    );

    //second event emitted
    emit RequestedRaffleWinner(requestId);
  }

  function fulfillRandomWords(uint256 /*requestId*/, uint256[] memory randomWords) internal override {
    uint256 indexofWinner = randomWords[0] % s_players.length;
    address payable recentWinner = s_players[indexofWinner];
    s_recentWinner = recentWinner;
    s_raffleState = RaffleState.OPEN;
    s_players = new address payable[](0); //reset list of players
    s_lastTimeStamp = block.timestamp; //reset timestamp

    //send winner the amount
    (bool success, ) = recentWinner.call{value: address(this).balance}("");
    if (!success) {
      revert Raffle_TransferFailed();
    }
    emit WinnerPicked(recentWinner);
  }

  function getEntranceFee() public view returns (uint256) {
    return i_entranceFee;
  }

  function getPlayer(uint256 index) public view returns (address) {
    return s_players[index];
  }

  function getRecentWinner() public view returns (address) {
    return s_recentWinner;
  }

  function getRaffleState() public view returns (RaffleState) {
    return s_raffleState;
  }

  function getNumWords() public pure returns (uint256) {
    return NUM_WORDS;
  }

  function getRequestConfirmations() public pure returns (uint256) {
    return REQUEST_CONFIRMATIONS;
  }

  function getInterval() public view returns (uint256) {
    return i_interval;
  }

  function getNumberOfPlayers() public view returns (uint256) {
    return s_players.length;
  }

  function getLastTimeStamp() public view returns (uint256) {
    return s_lastTimeStamp;
  }
}
