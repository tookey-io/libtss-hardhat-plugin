import { privateKeyToEthereumAddress, privateKeyToPublicKey } from "@tookey-io/libtss-ethereum";
import { readFileSync } from "fs";

export class TookeyKey {
    public privateKey: string;
    public publicKey: string;
    public publicAddress: string;
  
    constructor(public file: string) {
      this.privateKey = readFileSync(file, { encoding: "utf8" });
  
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