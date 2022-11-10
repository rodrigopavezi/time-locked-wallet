import { useEffect, useState, useCallback } from "react";
import { useAccount, useContract, useProvider } from "wagmi";

import contracts from "@/contracts/hardhat_contracts.json";
import { NETWORK_ID } from "@/config";
import { ethers } from "ethers";

export const Balance = () => {
  const chainId = Number(NETWORK_ID);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const provider = useProvider();
  const { address } = useAccount();

  const allContracts = contracts as any;
  const timeLockedWalletAddress =
    allContracts[chainId][0].contracts.TimeLockedWallet.address;
  const timeLockedWalletABI =
    allContracts[chainId][0].contracts.TimeLockedWallet.abi;

  const timeLockedWalletContract = useContract({
    address: timeLockedWalletAddress,
    abi: timeLockedWalletABI,
    signerOrProvider: provider,
  });

  const fetchData = useCallback(async () => {
    try {
      const balance = await timeLockedWalletContract?.balances(
        "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
        address
      );
      setBalance(Number(ethers.utils.formatEther(balance)));
      setError("");
    } catch (error) {
      setError("Contract couldn't be fetched.  Please check your network.");
    }
    setLoading(false);
  }, [timeLockedWalletContract]);

  useEffect(() => {
    if (provider) {
      fetchData();
    }
  }, [provider, timeLockedWalletContract, fetchData]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  return (
    <div style={{ margin: "20px" }}>
      <span>current balance : {balance}</span>
      <button style={{ marginLeft: "20px" }} onClick={() => fetchData()}>
        refresh
      </button>
    </div>
  );
};
