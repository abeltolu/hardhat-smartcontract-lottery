//this file is not always necessary
//we only used it because of pricefeed in hardhat local network
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { developmentChains, GAS_PRICE_LINK, VRF_BASE_FEE } from "../helper-hardhat-config";
import { getChainId, network } from "hardhat";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  console.log("Network Name === ", network.name);
  console.log("Network ChainId === ", await getChainId());
  if (developmentChains.includes(network.name)) {
    log("Local network detected! Deploying mocks...");
    await deploy("VRFCoordinatorV2Mock", {
      contract: "VRFCoordinatorV2Mock",
      from: deployer,
      args: [VRF_BASE_FEE, GAS_PRICE_LINK],
      log: true,
    });
    log("Mocks Deployed!");
  }
};
func["tags"] = ["All", "VRFCoordinatorV2Mock"];
export default func;
