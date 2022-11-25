import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@tookey-io/libtss-hardhat-plugin";

const config: HardhatUserConfig = {
  solidity: "0.8.17",
  defaultNetwork: "localhost",
  networks: {
    localhost: {
      tookeyConfig: './.tookey.json'
    }
  }
};

export default config;
