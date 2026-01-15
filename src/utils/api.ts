const API_URL = 'https://functions.poehali.dev/b44513b3-c4e9-4b6f-97ed-72699f5fc749';

export interface User {
  telegram_id: number;
  username?: string;
  first_name: string;
  last_name?: string;
  balance: number;
  total_earned: number;
  ads_watched: number;
  referrals_count: number;
  has_referrer: boolean;
}

export interface Transaction {
  id: number;
  amount: number;
  type: string;
  description: string;
  timestamp: string;
}

export interface Referral {
  telegram_id: number;
  username?: string;
  first_name: string;
  bonus_earned: number;
  joined_at: string;
}

export const initUser = async (
  telegram_id: number,
  username?: string,
  first_name?: string,
  last_name?: string,
  referrer_id?: number
): Promise<User> => {
  const response = await fetch(`${API_URL}?path=user/init`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      telegram_id,
      username,
      first_name,
      last_name,
      referrer_id,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to initialize user');
  }

  return response.json();
};

export const getUser = async (telegram_id: number): Promise<User> => {
  const response = await fetch(`${API_URL}?path=user/${telegram_id}`);

  if (!response.ok) {
    throw new Error('Failed to get user');
  }

  return response.json();
};

export const addAdReward = async (
  telegram_id: number,
  reward_amount: number = 0.000281,
  block_id: string = '20933'
): Promise<User> => {
  const response = await fetch(`${API_URL}?path=ad/reward`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      telegram_id,
      reward_amount: reward_amount.toString(),
      block_id,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to add reward');
  }

  return response.json();
};

export const getTransactions = async (telegram_id: number): Promise<Transaction[]> => {
  const response = await fetch(`${API_URL}?path=transactions/${telegram_id}`);

  if (!response.ok) {
    throw new Error('Failed to get transactions');
  }

  const data = await response.json();
  return data.transactions;
};

export const getReferrals = async (telegram_id: number): Promise<Referral[]> => {
  const response = await fetch(`${API_URL}?path=referrals/${telegram_id}`);

  if (!response.ok) {
    throw new Error('Failed to get referrals');
  }

  const data = await response.json();
  return data.referrals;
};
