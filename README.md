# Hardhat Smart Lottery Contract

This project demonstrates a smart contract that allows users enter a raffle and automatically selects winner at set interval

# Requirements

Create a `.env` file with the following information:

```GOERLI_RPC_URL=
GOERLI_PRIVATE_KEY=
COINMARKETCAP_API_KEY=
ETHERSCAN_API_KEY=
```

_GOERLI_RPC_URL_ is the RPC URL to the test network. You can create one on Alchemy.
_GOERLI_PRIVATE_KEY_ is the private key of your wallet on Metamask.

Get your SubscriptionId for Chainlink VRF at https://vrf.chain.link

After deploying your contract using `npx hardhat deploy --network goerli`, register the contract with Chainlink Keepers: https://automation.chain.link

Run `npx hardhat test --network goerli`
