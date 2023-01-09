import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { developmentChains, networkConfig, VRF_SUB_FUND_AMOUNT } from "../helper-hardhat-config";
import { verifyContract } from "../utils/verify";
import { ethers, network } from "hardhat";
import { VRFCoordinatorV2Mock } from "../typechain-types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, getChainId } = hre;
  const { deploy, log, get } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = await getChainId();
  console.log("THIS CHAIN ID === ", chainId);

  let vrfCordinatorAddress, subscriptionId;
  if (developmentChains.includes(network.name)) {
    const vrfCordinatorV2Mock = (await ethers.getContract("VRFCoordinatorV2Mock")) as VRFCoordinatorV2Mock;
    vrfCordinatorAddress = vrfCordinatorV2Mock.address;
    //create subscription for local testing
    const trxResponse = await vrfCordinatorV2Mock.createSubscription();
    const trxReceipt = await trxResponse.wait(1);
    subscriptionId = (trxReceipt as any)["events"][0]["args"]["subId"];
    //fund the subscription
    //usually you'd need the LINK token on a real network
    await vrfCordinatorV2Mock.fundSubscription(subscriptionId, VRF_SUB_FUND_AMOUNT);
  } else {
    vrfCordinatorAddress = networkConfig[chainId]["vrfCordinatorV2Address"];
    subscriptionId = networkConfig[chainId]["subscriptionId"];
  }

  log("Deploying Raffle...");
  const entranceFee = networkConfig[chainId]["entranceFee"];
  const gasLane = networkConfig[chainId]["gasLane"];
  const callBackGasLimit = networkConfig[chainId]["callBackGasLimit"];
  const interval = networkConfig[chainId]["interval"];
  const args = [vrfCordinatorAddress, entranceFee, gasLane, subscriptionId, callBackGasLimit, interval];

  const raffle = await deploy("Raffle", {
    from: deployer,
    args, //put smart contract constructor arguments here
    log: true,
    waitConfirmations: developmentChains.includes(network.name) ? 1 : 6,
  });
  log("Deployed Raffle...");

  // Ensure the Raffle contract is a valid consumer of the VRFCoordinatorV2Mock contract.
  if (developmentChains.includes(network.name)) {
    const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock");
    await vrfCoordinatorV2Mock.addConsumer(subscriptionId, raffle.address);
  }

  if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
    await verifyContract(raffle.address, args);
    log("Verified on Etherscan!");
  }
};
func["tags"] = ["All", "Raffle"];
export default func;
