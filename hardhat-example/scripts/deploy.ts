import { ethers } from "hardhat";
import * as typedSig from "@metamask/eth-sig-util";

async function main() {
  const currentTimestampInSeconds = Math.round(Date.now() / 1000);
  const ONE_YEAR_IN_SECS = 365 * 24 * 60 * 60;
  const unlockTime = currentTimestampInSeconds + ONE_YEAR_IN_SECS;

  const [owner] = await ethers.getSigners();
  // const domain = {
  //   name: "Ether Mail",
  //   version: "1",
  //   chainId: 1,
  //   verifyingContract: "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC",
  // };

  // // The named list of all type definitions
  // const types = {
  //   Person: [
  //     { name: "name", type: "string" },
  //     { name: "wallet", type: "address" },
  //   ],
  //   Mail: [
  //     { name: "from", type: "Person" },
  //     { name: "to", type: "Person" },
  //     { name: "contents", type: "string" },
  //   ],
  // };

  // const EIP712Domain = [
  //   { name: "name", type: "string" },
  //   { name: "version", type: "string" },
  //   { name: "chainId", type: "uint256" },
  //   { name: "verifyingContract", type: "address" },
  // ]

  // // The data to sign
  // const value = {
  //   from: {
  //     name: "Cow",
  //     wallet: "0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826",
  //   },
  //   to: {
  //     name: "Bob",
  //     wallet: "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB",
  //   },
  //   contents: "Hello, Bob!",
  // };
  // const primaryType = "Mail" as const;

  // const signedTypedData = await owner._signTypedData(domain, types, value);

  // console.log(`[SignTypedData] Sig: ${signedTypedData}`)
  // const signer = typedSig.recoverTypedSignature({
  //   data: {
  //     types: {
  //       EIP712Domain,
  //       ...types,
  //     },
  //     primaryType,
  //     domain,
  //     message: value,
  //   },
  //   signature: signedTypedData,
  //   version: typedSig.SignTypedDataVersion.V4
  // });
  // console.log(`[SignTypedData] signer: ${signer}, expected: ${owner.address}`);
  // const signedTx = await owner.signTransaction({
  //   to: ethers.constants.AddressZero,
  //   value: ethers.utils.parseEther("1"),
  // });
  // const signature = await owner.signMessage("hello world 111111");
  // console.log(signature, signedTx);

  const lockedAmount = ethers.utils.parseEther("1");

  const Lock = await ethers.getContractFactory("Lock");
  const lock = await Lock.deploy(unlockTime, { value: lockedAmount });

  await lock.deployed();

  console.log(
    `Lock with 1 ETH and unlock timestamp ${unlockTime} deployed to ${lock.address}`
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
