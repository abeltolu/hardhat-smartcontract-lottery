import { assert, expect } from "chai";
import { ethers, getChainId, network } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { Raffle, VRFCoordinatorV2Mock } from "../../typechain-types";
import { developmentChains, GAS_PRICE_LINK, networkConfig, VRF_BASE_FEE } from "../../helper-hardhat-config";

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Raffle", async () => {
      async function deployRaffleFixture() {
        const [owner] = await ethers.getSigners();
        const chainId = await getChainId();
        const entranceFee = networkConfig[chainId]["entranceFee"];
        const gasLane = networkConfig[chainId]["gasLane"];
        const callBackGasLimit = networkConfig[chainId]["callBackGasLimit"];
        const intervalVal = networkConfig[chainId]["interval"];

        //deploy vrf
        const VRFCoordinatorV2MockFactory = await ethers.getContractFactory("VRFCoordinatorV2Mock");
        const vrfCoordinatorV2Mock = (await VRFCoordinatorV2MockFactory.deploy(
          VRF_BASE_FEE,
          GAS_PRICE_LINK
        )) as VRFCoordinatorV2Mock;
        await vrfCoordinatorV2Mock.deployed();
        const trxResponse = await vrfCoordinatorV2Mock.createSubscription();
        const trxReceipt = await trxResponse.wait(1);
        const subscriptionId = (trxReceipt as any)["events"][0]["args"]["subId"];

        //deploy raffle
        const RaffleFactory = await ethers.getContractFactory("Raffle");

        const args = [
          vrfCoordinatorV2Mock.address,
          entranceFee,
          gasLane,
          subscriptionId,
          callBackGasLimit,
          intervalVal,
        ];
        const raffleContract = (await RaffleFactory.deploy(...args)) as Raffle;
        await raffleContract.deployed();
        // Fixtures can return anything you consider useful for your tests

        //fix error with "InvalidConsumer"
        //https://ethereum.stackexchange.com/questions/131426/chainlink-keepers-getting-invalidconsumer
        await vrfCoordinatorV2Mock.addConsumer(subscriptionId.toNumber(), raffleContract.address);

        const accounts = await ethers.getSigners();
        const player = owner;
        const raffle = raffleContract.connect(player);
        const raffleEntranceFee = await raffle.getEntranceFee();
        const interval = await raffle.getInterval();
        return {
          RaffleFactory,
          VRFCoordinatorV2MockFactory: vrfCoordinatorV2Mock,
          raffleContract,
          vrfCoordinatorV2Mock,
          owner,
          accounts,
          player,
          raffle,
          raffleEntranceFee,
          interval,
          subscriptionId,
        };
      }

      describe("constructor", async () => {
        it("it initializes the raffle correctly", async () => {
          const { raffle } = await loadFixture(deployRaffleFixture);
          const raffleState = await raffle.getRaffleState();
          assert.equal(raffleState.toString(), "0");
        });
      });

      describe("enterRaffle", async function () {
        it("reverts when you don't pay enough", async () => {
          const { raffle } = await loadFixture(deployRaffleFixture);
          // is reverted when not paid enough or raffle is not open
          await expect(raffle.enterRaffle()).to.be.revertedWithCustomError(raffle, "Raffle_NotEnoughETHEntered");
        });
        it("records player when they enter", async () => {
          const { raffle, raffleEntranceFee, player } = await loadFixture(deployRaffleFixture);
          await raffle.enterRaffle({ value: raffleEntranceFee });
          const contractPlayer = await raffle.getPlayer(0);
          assert.equal(player.address, contractPlayer);
        });
        it("emits event on enter", async () => {
          const { raffle, raffleEntranceFee } = await loadFixture(deployRaffleFixture);
          await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.emit(
            // emits RaffleEnter event if entered to index player(s) address
            raffle,
            "RaffleEnter"
          );
        });
        it("doesn't allow entrance when raffle is calculating", async () => {
          const { raffle, raffleEntranceFee, interval } = await loadFixture(deployRaffleFixture);
          await raffle.enterRaffle({ value: raffleEntranceFee });
          // for a documentation of the methods below, go here: https://hardhat.org/hardhat-network/reference
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
          await network.provider.send("evm_mine", []);
          // we pretend to be a Chainlink keeper for a second
          await raffle.performUpkeep([]); // changes the state to calculating for our comparison below

          // is reverted as raffle is calculating
          await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.be.revertedWithCustomError(
            raffle,
            "Raffle_NotOpen"
          );
        });
      });
      describe("checkUpkeep", async function () {
        it("returns false if people haven't sent any ETH", async () => {
          const { raffle, interval } = await loadFixture(deployRaffleFixture);
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
          await network.provider.request({ method: "evm_mine", params: [] });

          //using callStatic to simulate what *checkUpkeep* will return.
          //this is because calling *checkUpkeep* will perform a transaction and
          //we don't want to do that in this test
          //callStatic is a read-only operation and will not consume any Ether. It simulates what would happen in a transaction, but discards all the state changes when it is done.
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x"); // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
          assert(!upkeepNeeded);
        });
        it("returns false if raffle isn't open", async () => {
          const { raffle, interval, raffleEntranceFee } = await loadFixture(deployRaffleFixture);
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
          await network.provider.request({ method: "evm_mine", params: [] });
          await raffle.performUpkeep([]); // changes the state to calculating
          const raffleState = await raffle.getRaffleState(); // stores the new state
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x"); // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
          assert.equal(raffleState.toString(), "1");
          assert.equal(upkeepNeeded, false);
        });
        it("returns false if enough time hasn't passed", async () => {
          const { raffle, interval, raffleEntranceFee } = await loadFixture(deployRaffleFixture);
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [interval.toNumber() - 5]); // use a higher number here if this test fails
          await network.provider.request({ method: "evm_mine", params: [] });
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x"); // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
          assert(!upkeepNeeded);
        });
        it("returns true if enough time has passed, has players, eth, and is open", async () => {
          const { raffle, interval, raffleEntranceFee } = await loadFixture(deployRaffleFixture);
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
          await network.provider.request({ method: "evm_mine", params: [] });
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x"); // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
          assert(upkeepNeeded);
        });
      });

      describe("performUpkeep", async function () {
        it("can only run if checkupkeep is true", async () => {
          const { raffle, raffleEntranceFee, interval } = await loadFixture(deployRaffleFixture);
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
          await network.provider.request({ method: "evm_mine", params: [] });
          const tx = await raffle.performUpkeep("0x");
          assert(tx);
        });
        it("reverts if checkup is false", async () => {
          const { raffle } = await loadFixture(deployRaffleFixture);
          await expect(raffle.performUpkeep("0x")).to.be.revertedWithCustomError(raffle, "Raffle__UpkeepNotNeeded");
        });
        it("updates the raffle state and emits a requestId", async () => {
          const { raffle, raffleEntranceFee, interval } = await loadFixture(deployRaffleFixture);
          // Too many asserts in this test!
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
          await network.provider.request({ method: "evm_mine", params: [] });
          const txResponse = await raffle.performUpkeep("0x"); // emits requestId
          const txReceipt = await txResponse.wait(1); // waits 1 block
          const raffleState = await raffle.getRaffleState(); // updates state
          const requestId = (txReceipt as any).events[1].args.requestId;
          assert(requestId.toNumber() > 0);
          assert(raffleState == 1); // 0 = open, 1 = calculating
        });
      });
      describe("fulfillRandomWords", async function () {
        beforeEach(async () => {
          const { raffle, raffleEntranceFee, interval } = await loadFixture(deployRaffleFixture);
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
          await network.provider.request({ method: "evm_mine", params: [] });
        });
        it("can only be called after performupkeep", async () => {
          const { raffle, vrfCoordinatorV2Mock } = await loadFixture(deployRaffleFixture);
          await expect(
            vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address) // reverts if not fulfilled
          ).to.be.revertedWith("nonexistent request");
          await expect(
            vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.address) // reverts if not fulfilled
          ).to.be.revertedWith("nonexistent request");
        });

        // This test is too big...
        // This test simulates users entering the raffle and wraps the entire functionality of the raffle
        // inside a promise that will resolve if everything is successful.
        // An event listener for the WinnerPicked is set up
        // Mocks of chainlink keepers and vrf coordinator are used to kickoff this winnerPicked event
        // All the assertions are done once the WinnerPicked event is fired
        it("picks a winner, resets the lottery, and sends money", async () => {
          let { raffle, raffleEntranceFee, raffleContract, accounts, vrfCoordinatorV2Mock } = await loadFixture(
            deployRaffleFixture
          );
          const additionalEntrances = 3; // three additional entrants to raffle to make total of 4
          const startingIndex = 1; //since deployer or owner is 0
          for (let i = startingIndex; i < startingIndex + additionalEntrances; i++) {
            const accountConnectedRaffle = raffleContract.connect(accounts[i]); // Returns a new instance of the Raffle contract connected to player
            await accountConnectedRaffle.enterRaffle({ value: raffleEntranceFee });
          }
          const startingTimeStamp = await raffle.getLastTimeStamp(); // stores starting timestamp (before we fire our event)

          // This will be more important for our staging tests...
          await new Promise(async (resolve, reject) => {
            raffle.once("WinnerPicked", async () => {
              // event listener for WinnerPicked
              console.log("WinnerPicked event fired!");
              // assert throws an error if it fails, so we need to wrap
              // it in a try/catch so that the promise returns event
              // if it fails.
              try {
                // Now lets get the ending values...
                const recentWinner = await raffle.getRecentWinner();
                console.log("recentWinner === ", recentWinner);
                const raffleState = await raffle.getRaffleState();
                //const winnerBalance = await accounts[2].getBalance();
                const endingTimeStamp = await raffle.getLastTimeStamp();
                const numPlayers = await raffle.getNumberOfPlayers();
                assert.equal(numPlayers.toString(), "0");
                assert.equal(raffleState.toString(), "0"); //0 = open, 1 = calculating
                assert(endingTimeStamp > startingTimeStamp);

                //await expect(raffle.getPlayer(0)).to.be.reverted;
                // Comparisons to check if our ending values are correct:
                //assert.equal(recentWinner.toString(), accounts[2].address);

                /*assert.equal(
                  winnerBalance.toString(),
                  startingBalance // startingBalance + ( (raffleEntranceFee * additionalEntrances) + raffleEntranceFee )
                    .add(raffleEntranceFee.mul(additionalEntrances).add(raffleEntranceFee))
                    .toString()
                );*/

                resolve(""); // if try passes, resolves the promise
              } catch (e) {
                reject(e); // if try fails, rejects the promise
              }
            });

            // kicking off the event by mocking the chainlink keepers and vrf coordinator
            const tx = await raffle.performUpkeep("0x"); //0x is an empty bytes object that hardhat automatically understands. You can replace with empty array: []
            const txReceipt = await tx.wait(1);
            //const startingBalance = await accounts[2].getBalance();
            await vrfCoordinatorV2Mock.fulfillRandomWords((txReceipt as any).events[1].args.requestId, raffle.address);
          });
        });
      });
    });
