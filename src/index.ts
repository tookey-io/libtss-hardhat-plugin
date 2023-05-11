import { extendConfig, extendEnvironment, task } from "hardhat/config";
import { BackwardsCompatibilityProviderAdapter } from "hardhat/internal/core/providers/backwards-compatibility";
import { AutomaticGasProvider } from "hardhat/internal/core/providers/gas-providers";
import { HttpProvider } from "hardhat/internal/core/providers/http";
import {
  EIP1193Provider,
  HardhatConfig,
  HardhatUserConfig,
  HttpNetworkConfig,
  HttpNetworkUserConfig,
} from "hardhat/types";

import { AutomaticGasPriceProvider } from "./gasProvider";
import { TookeyProvider } from "./provider";
import "./type-extensions";
import { AUTH_SIGNIN_TASK, KEYS_CREATE, SIGNERS_TASKS } from "./task-names";
import axios from "axios";
import { DEFAULT_CONFIG } from "./constants";
import { TookeyBackend } from "./backend";
import slugify from "slugify";

import {
  keygen,
  KeygenParams,
  privateKeyToPublicKey,
} from "@tookey-io/libtss-ethereum";
import { join, resolve } from "path";
import { lstat, writeFile } from "fs/promises";
import { TookeyKey } from "./key";

extendConfig(
  (config: HardhatConfig, userConfig: Readonly<HardhatUserConfig>) => {
    config.tookey = {
      relayUrl:
        process.env.TOOKEY_RELAY_URL ||
        userConfig.tookey?.relayUrl ||
        DEFAULT_CONFIG.relayUrl,
      backendUrl:
        process.env.TOOKEY_BACKEND_URL ||
        userConfig.tookey?.backendUrl ||
        DEFAULT_CONFIG.backendUrl,
      apiKey: process.env.TOOKEY_API_KEY || userConfig.tookey?.apiKey,
      disabled:
        Boolean(process.env.TOOKEY_DISABLED) || userConfig.tookey?.disabled,
      keys: [],
    };

    const userNetworks = userConfig.networks;
    if (userNetworks === undefined) {
      return;
    }

    for (const networkName in userNetworks) {
      const keys: TookeyKey[] = [];
      if (networkName === "hardhat") {
        continue;
      }
      const network = userNetworks[networkName]!;
      const tookeys = network.tookeys;
      if (tookeys) {
        for (const tookey of tookeys) {
          if ("filePath" in tookey) {
            const path = tookey.filePath;
            keys.push(new TookeyKey(path));
          } else {
            const path = process.env[tookey.filePathEnv]!;
            keys.push(new TookeyKey(path));
          }
        }
      }
      config.networks[networkName].tookey = {
        ...config.tookey,
        keys,
      };
    }
  }
);

task(SIGNERS_TASKS).setAction(async (args, hre) => {
  const signers: string[] = await hre.network.provider.send("eth_accounts", []);
  const signersWithBalances = await Promise.all(
    signers.map((address) =>
      hre.network.provider
        .send("eth_getBalance", [address])
        .then((balance: string) => {
          const big = BigInt(balance)
          const floor = big / BigInt(1e18);
          const decimals = big - floor;
          return ({ address, balance: `${floor.toString(10)}.${decimals.toString(10)} ETH` })
        })
    )
  );
  console.log(
    `Available signers: \n${signersWithBalances
      .map(({ address, balance }) => `${address}: ${balance}`)
      .join("\n")}`
  );
});

task(KEYS_CREATE)
  .addParam(
    "authToken",
    "One-time authorization code parameter obtained from the Telegram bot using the /auth command."
  )
  .addParam("name", "Name of the key being created.")
  .addOptionalParam(
    "description",
    "Brief description or additional information about the key.",
    "Key created with Hardhat Plugin"
  )
  .addOptionalParam(
    "tags",
    "Comma-separated list of tags to categorize or label the key."
  )
  .addOptionalParam(
    "timeout",
    "Time limit in seconds before the key creation operation times out. (Default is 60)",
    "60"
  )
  .addOptionalParam(
    "output",
    "Path to the directory where the keys will be saved. (Default is current working dir)",
    "."
  )
  .setAction(
    async (
      args: Record<
        "authToken" | "name" | "description" | "tags" | "timeout" | "output",
        string
      >,
      hre
    ) => {
      const slug = slugify(args.name);
      const makeCertificateName = (suffix: string) =>
        [slug, suffix, "crt"].join(".").toLowerCase();
      const hotName = makeCertificateName("hot");
      const ownerName = makeCertificateName("owner");

      const overrides = await Promise.all([
        lstat(hotName)
          .then(() => true)
          .catch(() => false),
        lstat(ownerName)
          .then(() => true)
          .catch(() => false),
      ]);

      if (overrides.some((o) => o)) {
        console.log(`Key file already exist. Override is prohibidded`);
        process.exit(1);
      }

      const directory = resolve(process.cwd(), args.output);

      try {
        await lstat(directory);
      } catch {
        console.error(`Output directory doesnt exit (${directory})`);
        process.exit(1);
      }

      const backend = new TookeyBackend(hre.config.tookey.backendUrl);
      const tokens = await backend.signin(args.authToken);
      backend.setAuthTokens(tokens);

      const tags = args.tags ? args.tags.split(",") : [];

      const participants = 3;
      const threshold = 2;
      const timeout = Number(args.timeout);
      const generation = await backend.createKey(
        slug,
        args.description,
        threshold,
        participants,
        tags,
        timeout
      );

      const sleep = (ms: number) =>
        new Promise((resolve) => setTimeout(resolve, ms));

      // export interface KeygenParams {
      //   roomId: string
      //   participantIndex: number
      //   participantsCount: number
      //   participantsThreshold: number
      //   relayAddress: string
      //   timeoutSeconds: number
      // }
      const paramFor = (index: number): KeygenParams => ({
        roomId: generation.roomId,
        participantIndex: index,
        participantsCount: participants,
        participantsThreshold: threshold - 1,
        relayAddress: hre.config.tookey.relayUrl,
        timeoutSeconds: timeout,
      });

      const [hot, owner] = await Promise.all([
        sleep(1000).then(() => keygen(paramFor(2))),
        sleep(1500).then(() => keygen(paramFor(3))),
      ]);

      await new Promise((resolve) => setTimeout(resolve, 2000));

      if (hot.key && owner.key) {
        const publicKeyResult = privateKeyToPublicKey(hot.key);

        await writeFile(join(directory, hotName), hot.key);
        await writeFile(join(directory, ownerName), owner.key);

        if (publicKeyResult.result) {
          const apikey = await backend.createApiKey(`Token for ${args.name}`, [
            publicKeyResult.result,
          ]);

          console.log(
            `Add the next token to the Hardhat configuration at tookey.apiKey or set it as an environment variable with TOOKEY_API_KEY: \n${apikey.token}`
          );
        } else {
          console.error(publicKeyResult.error);
        }
      } else {
        console.error(hot.error);
        console.error(owner.error);
      }
    }
  );

extendEnvironment((hre) => {
  const netConfig = hre.network.config;
  const tookeyConfig = netConfig.tookey;

  if (tookeyConfig && !tookeyConfig.disabled && "url" in netConfig) {
    const eip1193Provider = new HttpProvider(
      netConfig.url,
      hre.network.name,
      netConfig.httpHeaders,
      netConfig.timeout
    );
    let wrappedProvider: EIP1193Provider;

    wrappedProvider = new TookeyProvider(
      eip1193Provider,
      hre.network.config.chainId || 0,
      tookeyConfig
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
