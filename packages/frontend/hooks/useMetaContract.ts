import { Biconomy } from "@biconomy/mexa";
import { BigNumber, ContractInterface, ethers } from "ethers";
import { useEffect, useState } from "react";
import { ExternalProvider } from "@ethersproject/providers";
import { useSigner } from "wagmi";
import contracts from "@/contracts/hardhat_contracts.json";
import { NETWORK_ID } from "@/config";

export const useMetaContract = () => {
  const chainId = Number(NETWORK_ID);

  const { data: signer } = useSigner();
  const [biconomy, setBiconomy] = useState<Biconomy>();
  const [loading, setLoading] = useState(false);

  const initBiconomy = async () => {
    const apiKey = process.env.NEXT_PUBLIC_BICONOMY_API_KEY || "";
    const allContracts = contracts as any;
    const timeLockedWalletAddress =
      allContracts[chainId][0].contracts.TimeLockedWallet.address;

    const testUSDCAddress = allContracts[chainId][0].contracts.TestUSDC.address;

    if (signer?.provider) {
      setLoading(true);
      const biconomy = new Biconomy(
        (signer?.provider as any).provider as unknown as ExternalProvider,
        {
          apiKey,
          debug: true,
          contractAddresses: [timeLockedWalletAddress, testUSDCAddress],
        }
      );

      await biconomy.init();
      setBiconomy(biconomy);
      setLoading(false);
    }
  };

  useEffect(() => {
    initBiconomy();
  }, [signer?.provider]);

  const callStandardMetaTxMethod = async (
    contractAddress: string,
    contractAbi: ContractInterface,
    userAddress: string,
    methodName: string,
    attr: Array<unknown>,
    batchId: number = 0
  ): Promise<
    { msg: string; id: string; hash: string; receipt: string } | any
  > => {
    console.log("contractAddress", contractAddress);
    const contract = new ethers.Contract(
      contractAddress,
      contractAbi,
      biconomy?.ethersProvider
    );

    console.log("contract", contract);

    // Create your target method signature.
    const { data } = await contract.populateTransaction[methodName](...attr);

    const provider = await biconomy?.provider;

    const txParams = {
      data,
      to: contractAddress,
      from: userAddress,
      signatureType: "EIP712_SIGN",
      batchId,
    };

    // add this because Biconomy contract is expecting a different domainName in production
    ///if (isProd()) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    //txParams.domainName = "Powered by Biconomy";
    //}

    // as ethers does not allow providing custom options while sending transaction
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    await provider.send("eth_sendTransaction", [txParams]);

    //event emitter methods
    return new Promise((resolve, reject) => {
      biconomy?.on("error", (data: any) => {
        // Event emitter to monitor when an error occurs
        reject(data);
      });

      biconomy?.on(
        "txMined",
        (data: { msg: string; id: string; hash: string; receipt: string }) => {
          resolve(data);
        }
      );
    });
  };

  return { callStandardMetaTxMethod, loading };
};
