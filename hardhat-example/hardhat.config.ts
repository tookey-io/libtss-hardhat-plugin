import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@tookey-io/libtss-hardhat-plugin";

const config: HardhatUserConfig = {
  solidity: "0.8.17",
  defaultNetwork: "localhost",
  networks: {
    localhost: {
      url: 'http://localhost:8545',
      tookeys: [
        { filePath: "<KEY_PATH>" },
      ],
    },
  },
  tookey: {
    backendUrl: "http://localhost:3001",
    relayUrl: "http://localhost:8000",
    apiKey: "<API_KEY>",
  },
};

export default config;
