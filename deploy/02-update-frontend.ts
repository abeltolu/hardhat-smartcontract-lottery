//THIS FILE IS OPTIONAL AND WAS ONLY INCLUDED TO GENERATE TYPES FOR THE NEXTJS FRONTEND CODE

import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import fs from "fs";
import { ethers, getChainId } from "hardhat";
import { frontEndAbiFile, frontEndContractsFile } from "../helper-hardhat-config";

async function updateAbi() {
  const raffle = await ethers.getContract("Raffle");
  fs.writeFileSync(frontEndAbiFile, raffle.interface.format(ethers.utils.FormatTypes.json) as string);
}

async function updateContractAddresses() {
  const raffle = await ethers.getContract("Raffle");
  const chainId = await getChainId();
  const contractAddresses = JSON.parse(fs.readFileSync(frontEndContractsFile, "utf8"));
  if (chainId.toString() in contractAddresses) {
    if (!contractAddresses[chainId.toString()].includes(raffle.address)) {
      contractAddresses[chainId.toString()].push(raffle.address);
    }
  } else {
    contractAddresses[chainId.toString()] = [raffle.address];
  }
  fs.writeFileSync(frontEndContractsFile, JSON.stringify(contractAddresses));
}

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  if (process.env.UPDATE_FRONT_END) {
    console.log("Writing to front end...");
    await updateContractAddresses();
    await updateAbi();
    console.log("Front end written!");
  }
};

func["tags"] = ["All", "FrontEnd"];
export default func;
