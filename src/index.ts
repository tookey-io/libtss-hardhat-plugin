import { extendConfig, extendEnvironment } from "hardhat/config";
import { BackwardsCompatibilityProviderAdapter } from "hardhat/internal/core/providers/backwards-compatibility";
import { AutomaticGasProvider } from "hardhat/internal/core/providers/gas-providers";
import { HttpProvider } from "hardhat/internal/core/providers/http";
import {
  EIP1193Provider,
  HardhatConfig,
  HardhatUserConfig,
  HttpNetworkUserConfig,
} from "hardhat/types";

import { AutomaticGasPriceProvider } from "./gasProvider";
import { TookeyProvider } from "./provider";
import "./type-extensions";

extendConfig(
  (config: HardhatConfig, userConfig: Readonly<HardhatUserConfig>) => {
    const userNetworks = userConfig.networks;
    if (userNetworks === undefined) {
      return;
    }
    for (const networkName in userNetworks) {
      if (networkName === "hardhat") {
        continue;
      }
      const network = userNetworks[networkName]!;
      if (network.tookeyConfig) {
        config.networks[networkName].tookeyConfig = network.tookeyConfig;
      }
    }
  }
);

extendEnvironment((hre) => {
  if (hre.network.config.tookeyConfig) {
    const httpNetConfig = hre.network.config as HttpNetworkUserConfig;
    const eip1193Provider = new HttpProvider(
      httpNetConfig.url!,
      hre.network.name,
      httpNetConfig.httpHeaders,
      httpNetConfig.timeout
    );
    let wrappedProvider: EIP1193Provider;
    wrappedProvider = new TookeyProvider(
      eip1193Provider,
      hre.network.config.tookeyConfig
    );
    wrappedProvider = new AutomaticGasProvider(
      wrappedProvider,
      hre.network.config.gasMultiplier
    );
    wrappedProvider = new AutomaticGasPriceProvider(
      wrappedProvider,
      hre.network.config.minMaxFeePerGas,
      hre.network.config.minMaxPriorityFeePerGas
    );
    hre.network.provider = new BackwardsCompatibilityProviderAdapter(
      wrappedProvider
    );
  }
});
