import "hardhat/types/config";

declare module "hardhat/types/config" {
  export interface HttpNetworkUserConfig {
    tookeyConfig?: string;
    minMaxFeePerGas?: string | number;
    minMaxPriorityFeePerGas?: string | number;
  }

  export interface HardhatNetworkUserConfig {
    tookeyConfig?: string;
    minMaxFeePerGas?: string | number;
    minMaxPriorityFeePerGas?: string | number;
  }
  export interface HttpNetworkConfig {
    tookeyConfig?: string;
    minMaxFeePerGas?: string | number;
    minMaxPriorityFeePerGas?: string | number;
  }
  export interface HardhatNetworkConfig {
    tookeyConfig?: string;
    minMaxFeePerGas?: string | number;
    minMaxPriorityFeePerGas?: string | number;
  }
}
