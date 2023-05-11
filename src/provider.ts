import axios, { AxiosInstance } from "axios";
import { BigNumber, utils } from "ethers";
import { keccak256 } from "ethers/lib/utils";
import * as fs from "fs";
import { rpcTransactionRequest } from "hardhat/internal/core/jsonrpc/types/input/transactionRequest";
import { validateParams } from "hardhat/internal/core/jsonrpc/types/input/validation";
import { ChainIdValidatorProvider } from "hardhat/internal/core/providers/chainId";
import { EIP1193Provider, RequestArguments } from "hardhat/types";
import {
  privateKeyToEthereumAddress,
  privateKeyToPublicKey,
  sign,
  encodeMessageSignature,
} from "@tookey-io/libtss-ethereum";
import { toHexString } from "./utils";
import { signTypedDataRequest, TookeyConfig } from "./types";
import * as typedSig from '@metamask/eth-sig-util'

interface RefreshResponse {
  token: string;
}
interface SignResponse {
  roomId: string;
}

export class TookeyProvider extends ChainIdValidatorProvider {
  constructor(
    provider: EIP1193Provider,
    expectedChainId: number,
    public config: TookeyConfig
  ) {
    super(provider, expectedChainId);
  }

  public async eth_signTypedData_v4(args: RequestArguments): Promise<unknown> {
    const params = this._getParams(args);
    const [senderRaw, typedMessageEncoded] = validateParams(params, ...signTypedDataRequest);
    const typedMessage = JSON.parse(typedMessageEncoded);
    const sender = utils.getAddress(`0x${senderRaw.toString('hex')}`)

    const hash = typedSig.TypedDataUtils.eip712Hash(
      typedMessage,
      typedSig.SignTypedDataVersion.V4
    );

    const key = this.config.keys.find(
      (k) => k.publicAddress.toLowerCase() === sender.toLowerCase()
    );

    if (typeof key === "undefined") {
      throw new Error(
        `Key for sender ${sender} not found. Available signers: \n${this.config.keys
          .map((k) => k.publicAddress)
          .join("\n")}`
      );
    }
    

    const client = await this.getClient();
    const { data } = await client.post<SignResponse>("/api/keys/sign", {
      publicKey: key.publicKey,
      participantsConfirmations: [1, 2],
      data: `0x${hash.toString('hex')}`,
      metadata: { source: "ethereum" },
    });

    console.log(`respond from room`, data)

    await new Promise((res) => setTimeout(res, 5000));
    console.log(`Starting sign in room ${data.roomId}`);
    const result = await sign({
      roomId: data.roomId,
      data: hash.toString('hex'),
      participantsIndexes: [1, 2],
      key: key.privateKey,
      timeoutSeconds: 10,
      relayAddress: this.config.relayUrl,
    });

    console.log(result)

    return result
  }

  public async personal_sign(args: RequestArguments): Promise<unknown> {
    process.exit(1);
  }

  public async eth_sendTransaction(args: RequestArguments): Promise<unknown> {
    const params = this._getParams(args);
    const [txRequest] = validateParams(params, rpcTransactionRequest);
    const tx = await utils.resolveProperties(txRequest);
    const sender = utils.getAddress("0x" + tx.from.toString("hex"));

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

    const key = this.config.keys.find(
      (k) => k.publicAddress.toLowerCase() === sender.toLowerCase()
    );

    if (typeof key === "undefined") {
      throw new Error(
        `Key for sender ${sender} not found. Available signers: \n${this.config.keys
          .map((k) => k.publicAddress)
          .join("\n")}`
      );
    }

    const unsignedTx = utils.serializeTransaction(baseTx);
    const hash = keccak256(utils.arrayify(unsignedTx));
    console.log("Public key:", key.publicKey);
    console.log("Public Address:", key.publicAddress);
    console.log("Transaction hash: ", hash);

    const client = await this.getClient();
    const { data } = await client.post<SignResponse>("/api/keys/sign", {
      publicKey: key.publicKey,
      participantsConfirmations: [1, 2],
      data: hash,
      metadata: { source: "ethereum" },
    });

    await new Promise((res) => setTimeout(res, 1000));
    console.log(`Starting sign in room ${data.roomId}`);
    const result = await sign({
      roomId: data.roomId,
      data: hash,
      participantsIndexes: [1, 2],
      key: key.privateKey,
      timeoutSeconds: 10,
      relayAddress: this.config.relayUrl,
    });

    if (typeof result.result === "string") {
      console.log("Sign result: ", result.result);
      const sig = encodeMessageSignature(hash, chainId || 0, result.result);
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
      console.error("Failed to finish sign process: ", result.error);
      process.exit(1);
    }
  }

  public async request(args: RequestArguments): Promise<unknown> {
    switch (args.method) {
      case "eth_sendTransaction":
        return this.eth_sendTransaction(args);
      case "eth_signTypedData_v4":
        return this.eth_signTypedData_v4(args);
      case "personal_sign":
        return this.personal_sign(args);
      case "eth_accounts":
      case "eth_requestAccounts":
        return this._getSenders(args);
      default:
        return this._wrappedProvider.request(args);
    }
  }

  private async _getSenders(args: RequestArguments): Promise<string[]> {
    return this.config.keys.map((k) => k.publicAddress);
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
    const config = this.config;

    return axios.create({
      baseURL: config.backendUrl,
      headers: { "X-SHAREABLE-KEY": config.apiKey },
    });
  }
}
