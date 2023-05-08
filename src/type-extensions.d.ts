import "hardhat/types/config";
import { TookeyConfig } from "./types";

declare module "hardhat/types/config" {
  interface HardhatConfig {
    tookey: TookeyConfig;
  }
  interface HardhatUserConfig {
    tookey?: Partial<Omit<TookeyConfig, "keys">>;
  }

  interface HttpNetworkUserConfig {
    minMaxFeePerGas?: string | number;
    minMaxPriorityFeePerGas?: string | number;
    tookeys?: TookeyUserConfig[];
  }

  interface HardhatNetworkUserConfig {
    minMaxFeePerGas?: string | number;
    minMaxPriorityFeePerGas?: string | number;
    tookeys?: TookeyUserConfig[];
  }

  interface HttpNetworkConfig {
    minMaxFeePerGas?: string | number;
    minMaxPriorityFeePerGas?: string | number;
    tookey: TookeyConfig;
  }
  interface HardhatNetworkConfig {
    minMaxFeePerGas?: string | number;
    minMaxPriorityFeePerGas?: string | number;
    tookey: TookeyConfig;
  }

  type TookeyPath =
    | { filePath: string }
    | {
        filePathEnv: string;
      };

  type TookeyUserConfig = { participants?: number } & TookeyPath;
}
