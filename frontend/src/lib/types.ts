export type Tier = "star" | "constellation" | "supernova";

export interface DonorInfo {
  id: string;
  x: number;
  y: number;
  name: string;
  message: string;
  amount: number;
  tier: Tier;
  createdAt: Date;
}

export interface DonationDraft {
  x: number;
  y: number;
  tier: Tier;
  name: string;
  message: string;
}
