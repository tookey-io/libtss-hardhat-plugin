import { TookeyKey } from "./key";

import * as t from 'io-ts';
import { rpcAddress } from "hardhat/internal/core/jsonrpc/types/base-types";

export interface TookeyConfig {
  relayUrl: string;
  backendUrl: string;
  apiKey?: string;
  disabled?: true;
  keys: TookeyKey[]
}


export const signTypedDataRequest = [
  rpcAddress,
  t.string
] as const;
