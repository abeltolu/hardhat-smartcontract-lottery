import { ethers } from "hardhat";

export const networkConfig: Record<
  string,
  {
    name: string;
    vrfCordinatorV2Address?: string;
    entranceFee: string;
    gasLane: string;
    subscriptionId?: string;
    callBackGasLimit: string;
    interval: string;
  }
> = {
  "5": {
    name: "goerli",
    vrfCordinatorV2Address: "0x2Ca8E0C643bDe4C2E08ab1fA0da3401AdAD7734D",
    entranceFee: ethers.utils.parseEther("0.01").toString(),
    gasLane: "0x79d3d8832d904592c0bf9818b621522c988bb8b0c05cdc3b15aea1b6e8db0c15",
    subscriptionId: "8388", //got this from vrf.chain.link
    callBackGasLimit: "500000",
    interval: "30", //secs
  },
  "31337": {
    name: "hardhat",
    entranceFee: ethers.utils.parseEther("0.01").toString(),
    gasLane: "0x79d3d8832d904592c0bf9818b621522c988bb8b0c05cdc3b15aea1b6e8db0c15",
    callBackGasLimit: "500000",
    interval: "30", //secs
  },
};

export const developmentChains = ["hardhat", "localhost"];
export const DECIMALS = "8";
export const INITIAL_ANSWER = 200000000000;
export const VRF_BASE_FEE = ethers.utils.parseEther("0.25"); //0.25 is the premium. it costs 0.25 LINK per VRF request
export const GAS_PRICE_LINK = 1e9; //1000000000
export const VRF_SUB_FUND_AMOUNT = ethers.utils.parseEther("10");
