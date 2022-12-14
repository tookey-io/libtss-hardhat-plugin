import axios, { AxiosInstance } from 'axios';
import { BigNumber, utils } from 'ethers';
import { keccak256 } from 'ethers/lib/utils';
import * as fs from 'fs';
import { rpcTransactionRequest } from 'hardhat/internal/core/jsonrpc/types/input/transactionRequest';
import { validateParams } from 'hardhat/internal/core/jsonrpc/types/input/validation';
import { ProviderWrapperWithChainId } from 'hardhat/internal/core/providers/chainId';
import { EIP1193Provider, RequestArguments } from 'hardhat/types';

import { privateKeyToEthereumAddress, privateKeyToPublicKey, sign, encodeMessageSignature } from '@tookey-io/libtss-ethereum';

import { toHexString } from './utils';

class TookeyConfig {
  public backendAddress: string;
  public keyFile: string;
  public shareableToken: string;
  public participantsIndexes: number[];
  public relayAddress: string;

  constructor(file: string) {
    const content = fs.readFileSync(file, { encoding: "utf8" });
    const json = JSON.parse(content);

    this.backendAddress = json.backendAddress || "todo";
    this.keyFile = json.keyFile || "./.tookey.key";
    this.participantsIndexes = json.participantsIndexes || [1, 2];
    this.relayAddress = json.relayAddress || "http://127.0.0.1:8000";

    this.shareableToken = json.shareableToken || "request auth";
  }
}

class TookeyKey {
  public privateKey: string;
  public publicKey: string;
  public publicAddress: string;

  constructor(file: string) {
    this.privateKey = fs.readFileSync(file, { encoding: "utf8" });

    const publicResult = privateKeyToPublicKey(this.privateKey);
    if (typeof publicResult.result === "string") {
      this.publicKey = publicResult.result;
    } else {
      console.error("Failed to parse private key", publicResult.error);
      process.exit(1);
    }

    const addressResult = privateKeyToEthereumAddress(this.privateKey);
    if (typeof addressResult.result === "string") {
      this.publicAddress = addressResult.result;
    } else {
      console.error("Failed to parse private key", addressResult.error);
      process.exit(1);
    }
  }
}

interface RefreshResponse {
  token: string;
}
interface SignResponse {
  roomId: string;
}

export class TookeyProvider extends ProviderWrapperWithChainId {
  public configFile: string;

  constructor(provider: EIP1193Provider, tookeyConfigFile: string) {
    super(provider);
    this.configFile = tookeyConfigFile;
  }

  public async request(args: RequestArguments): Promise<unknown> {
    const method = args.method;
    const params = this._getParams(args);
    const sender = await this._getSender();
    if (method === "eth_sendTransaction") {
      const [txRequest] = validateParams(params, rpcTransactionRequest);
      const tx = await utils.resolveProperties(txRequest);
      const nonce = tx.nonce?.toNumber() ?? (await this._getNonce(sender));
      const chainId = (await this._getChainId()) || undefined;
      const baseTx: utils.UnsignedTransaction = {
        chainId,
        data: tx.data,
        gasLimit: toHexString(tx.gas),
        gasPrice: toHexString(tx.gasPrice),
        nonce,
        type: 2,
        to: toHexString(tx.to),
        value: toHexString(tx.value),
        maxFeePerGas: tx.maxFeePerGas?.toString(),
        maxPriorityFeePerGas: tx.maxPriorityFeePerGas?.toString(),
      };

      if (
        baseTx.maxFeePerGas === undefined &&
        baseTx.maxPriorityFeePerGas === undefined
      ) {
        baseTx.type = 0;
        delete baseTx.maxFeePerGas;
        delete baseTx.maxPriorityFeePerGas;
      }

      const config = new TookeyConfig(this.configFile);
      const key = new TookeyKey(config.keyFile);

      const unsignedTx = utils.serializeTransaction(baseTx);
      const hash = keccak256(utils.arrayify(unsignedTx));
      console.log("Public key:", key.publicKey);
      console.log("Public Address:", key.publicAddress);
      console.log("Transaction hash: ", hash);

      const client = await this.getClient();
      const { data, status } = await client.post<SignResponse>(
        "/api/keys/sign",
        {
          publicKey: key.publicKey,
          participantsConfirmations: config.participantsIndexes,
          data: hash,
          metadata: { source: "ethereum" },
        }
      );
      if (status !== 200) {
        console.error(`Failed to start sign process (${status})`, data);
        process.exit(1);
      }

      await new Promise((res) => setTimeout(res, 1000));
      console.log(`Starting sign in room ${data.roomId}`);
      const signatureRecid = await sign({
        roomId: data.roomId,
        data: hash,
        participantsIndexes: config.participantsIndexes,
        key: key.privateKey,
        timeoutSeconds: 60,
        relayAddress: config.relayAddress,
      });

      if (typeof signatureRecid.result === "string") {
        console.log("Sign result: ", signatureRecid.result);
        const sig = encodeMessageSignature(
          hash,
          chainId || 0,
          signatureRecid.result
        );
        if (typeof sig.result === "undefined") {
          console.error("Failed to convert sign: ", sig.error);
          process.exit(1);
        }

        console.log("Ethereum signature: ", sig.result);
        const rawTx = utils.serializeTransaction(baseTx, sig.result);

        return this._wrappedProvider.request({
          method: "eth_sendRawTransaction",
          params: [rawTx],
        });
      } else {
        console.error("Failed to finish sign process: ", signatureRecid.error);
        process.exit(1);
      }
    } else if (
      args.method === "eth_accounts" ||
      args.method === "eth_requestAccounts"
    ) {
      return [sender];
    }

    return this._wrappedProvider.request(args);
  }

  private async _getSender(): Promise<string> {
    const config = new TookeyConfig(this.configFile);
    const key = new TookeyKey(config.keyFile);

    return key.publicAddress;
  }

  private async _getNonce(address: string): Promise<number> {
    const response = await this._wrappedProvider.request({
      method: "eth_getTransactionCount",
      params: [address, "pending"],
    });

    return BigNumber.from(response).toNumber();
  }

  ////
  // Tookey APIs
  ////

  private async getClient(): Promise<AxiosInstance> {
    const config = new TookeyConfig(this.configFile);
    const key = new TookeyKey(config.keyFile);

    return axios.create({
      baseURL: config.backendAddress,
      headers: { "X-SHAREABLE-KEY": config.shareableToken },
    });
  }
}
