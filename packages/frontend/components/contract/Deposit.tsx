import { useEffect, useState, FormEvent } from "react";
import { useContract, useSigner } from "wagmi";

import contracts from "@/contracts/hardhat_contracts.json";
import { NETWORK_ID } from "@/config";
import { ethers } from "ethers";

export const Deposit = () => {
  const chainId = Number(NETWORK_ID);
  const [tokenAddress, setTokenAddress] = useState(
    "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
  );
  const [amount, setAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const { data: signerData } = useSigner();

  const allContracts = contracts as any;
  const timeLockedWalletAddress =
    allContracts[chainId][0].contracts.TimeLockedWallet.address;
  const timeLockedWalletABI =
    allContracts[chainId][0].contracts.TimeLockedWallet.abi;

  const timeLockedWalletContract = useContract({
    address: timeLockedWalletAddress,
    abi: timeLockedWalletABI,
    signerOrProvider: signerData,
  });

  useEffect(() => {
    if (signerData) {
      setError("");
      setLoading(false);
    } else {
      setLoading(false);
      setError("please connect your wallet");
    }
  }, [signerData]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const amountInWei = ethers.utils.parseEther(amount.toString());

      setLoading(true);
      const tx = await timeLockedWalletContract?.deposit(
        tokenAddress,
        amountInWei,
        {
          value: amountInWei,
        }
      );
      await tx.wait();
      setAmount(0);
      setLoading(false);
    } catch (error) {
      console.error(error);
      setError("txn failed, check contract");
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  return (
    <div style={{ margin: "20px" }}>
      <form onSubmit={(e) => handleSubmit(e)}>
        <input
          type="number"
          required
          value={amount}
          placeholder="0"
          onChange={(e) => setAmount(Number(e.target.value))}
        />
        <button style={{ marginLeft: "20px" }} type="submit">
          Deposit
        </button>
      </form>
    </div>
  );
};
