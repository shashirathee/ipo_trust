import {Ipo} from "../models/IPO.js";
import { exec } from "child_process";
import { promisify } from "util";
export const createIpo = async (req, res) => {
  try {
    const { companyName, winnerCount, primaryRegistrar,extraRegistrar1,extraRegistrar2, sebi, contractAddress } = req.body;

    // Basic validation
    if (!companyName || !winnerCount || !primaryRegistrar || !extraRegistrar1 || !extraRegistrar2 || !sebi || !contractAddress) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const newIpo = new Ipo({
      companyName,
      winnerCount,
      primaryRegistrar,
      extraRegistrar1,
      extraRegistrar2,
      sebi,
      contractAddress,
    });

    await newIpo.save();

    return res.status(201).json({ message: "IPO created", ipo: newIpo });
  } catch (error) {
    console.error("Error creating IPO:", error);
    return res.status(500).json({ message: "Server error while creating IPO" });
  }
};

export const getAllIpos = async (req, res) => {
  try {
    const allIpos = await Ipo.find().sort({ createdAt: -1 });
    res.status(200).json(allIpos);
  } catch (error) {
    console.error("Error fetching IPOs:", error);
    res.status(500).json({ message: "Server error while fetching IPOs" });
  }
};

export const getIpoById = async (req, res) => {
  try {
    // cout<<"Hello";
    const { id } = req.params;
    const ipo = await Ipo.findById(id);
    if (!ipo) return res.status(404).json({ message: "IPO not found" });
    res.json(ipo);
  } catch (error) {
    res.status(500).json({ message: "Error fetching IPO", error });
  }
};

export const addApplicants = async (req, res) => {
  const { contractAddress, applicantDematMap } = req.body;
  try {
    const ipo = await Ipo.findOne({ contractAddress });
    if (!ipo) return res.status(404).json({ message: "IPO not found" });

    ipo.applicantDematMap.push(...applicantDematMap);
    await ipo.save();

    res.status(200).json({ message: "Applicants added to backend." });
  } catch (error) {
    console.error("Error adding applicants:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const saveWinners = async (req, res) => {
  try {
    const { contractAddress, winnerHashes } = req.body;
    // console.log(winnerHashes);
    const ipo = await Ipo.findOne({ contractAddress });
    if (!ipo) return res.status(404).json({ message: "IPO not found" });

    const resolvedWinners = winnerHashes.map((hash) => {
      const mapping = ipo.applicantDematMap.find((entry) => entry.hash === hash);
      return mapping ? { hash, dematId: mapping.dematId } : null;
    }).filter(Boolean); // filter out unmatched

    ipo.winners = resolvedWinners;
    ipo.status = "lotteryCompleted";
    await ipo.save();
    // Verifying it on etherscan to make variables public
    const execAsync = promisify(exec);
    const verifyCmd = `cd ../hardhat && npx hardhat verify --network sepolia ${contractAddress} ${ipo.winnerCount} ${ipo.primaryRegistrar} ${ipo.extraRegistrar1} ${ipo.extraRegistrar2}`;
    try {
      await execAsync(verifyCmd);
      // console.log("Verification success:", stdout);
    } catch (err) {
      console.error("Verification failed:", err);
    }
    res.status(200).json({ message: "Winners saved successfully and contract verified", winners: resolvedWinners });
  } catch (error) {
    console.error("Error saving winners:", error);
    res.status(500).json({ message: "Server error while saving winners" });
  }
};
