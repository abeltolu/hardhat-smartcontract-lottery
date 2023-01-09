import { ethers, getChainId, network } from "hardhat";
import { developmentChains } from "../helper-hardhat-config";
import { Raffle } from "../typechain-types";

async function mockKeepers() {
  const raffle = (await ethers.getContract("Raffle")) as Raffle;
  const checkData = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(""));
  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep(checkData);
  if (upkeepNeeded) {
    const tx = await raffle.performUpkeep(checkData);
    const txReceipt = await tx.wait(1);
    const requestId = (txReceipt as any).events[1].args.requestId;
    console.log("requestId === ", requestId);
    console.log(`Performed upkeep with RequestId: ${requestId}`);
    const chainId = await getChainId();
    console.log("chainId === ", chainId);
    console.log("network name === ", network.name);
    if (developmentChains.includes(network.name)) {
      const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock");
      await vrfCoordinatorV2Mock.fulfillRandomWords(requestId, raffle.address);
      console.log("Responded!");
      const recentWinner = await raffle.getRecentWinner();
      console.log(`The winner is: ${recentWinner}`);
    }
  } else {
    console.log("No upkeep needed!");
  }
}

mockKeepers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
