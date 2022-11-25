# Tookey Hardhat Signer

This plugin signs Ethereum transaction using Tookey key during deployments.

## Usage

It's assumed that you have Tookey account configured in `.tookey.json` file.

In `hardhat.config.ts` append tookeyConfig to networks:

```
import "@tookey-io/libtss-hardhat-plugin";

...

const config: HardhatUserConfig = {
  networks: {
    ropsten: {
      tookeyConfig: './.tookey.json'
    }
  }
}
```

### Learn your address

```
$ node_modules/.bin/hardhat console --network ropsten
Creating Typechain artifacts in directory types for target ethers-v5
Successfully generated Typechain artifacts!
Welcome to Node.js v12.22.6.
> getNamedAccounts().then(console.log)
Promise { <pending> }
> { deployer: '0x541dD0eC22fB1213d2C2B1fc83B5F302cEFF79A2' }
```

Remember to fund your address with some ETH before deploying.

### Minimal EIP1559 gas values

On less crowded networks (such as Sepolia) there may be situations where automatic gas provider will set 
`maxFeePerGas` & `maxPriorityFeePerGas` near 0 (when empty blocks are mined). To prevent this you can
set minimal values for them in config:

```
import "@tookey-io/libtss-hardhat-plugin";

...

const config: HardhatUserConfig = {
  networks: {
    ropsten: {
      url: `https://ropsten.infura.io/v3/${process.env.INFURA_KEY}`,
      tookeyConfig: './.tookey.json'
      minMaxFeePerGas: 1600000000,
      mixMaxPriorityFeePerGas: 1200000000
    }
  }
}
```

