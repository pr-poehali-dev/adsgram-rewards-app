const WITHDRAW_API_URL = 'https://functions.poehali.dev/ae7e9e74-09e6-4d62-9359-6e3f3fd340aa';

export interface WithdrawalRequest {
  telegram_id: number;
  wallet_address: string;
  amount: number;
}

export interface WithdrawalResponse {
  success: boolean;
  withdrawal_id?: number;
  new_balance?: number;
  amount?: number;
  wallet?: string;
  message?: string;
  error?: string;
}

export interface Withdrawal {
  id: number;
  amount: number;
  wallet: string;
  status: string;
  created_at: string;
  processed_at: string | null;
}

export const requestWithdrawal = async (
  telegram_id: number,
  wallet_address: string,
  amount: number
): Promise<WithdrawalResponse> => {
  const response = await fetch(`${WITHDRAW_API_URL}?path=request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      telegram_id,
      wallet_address,
      amount: amount.toString(),
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to request withdrawal');
  }

  return data;
};

export const getWithdrawalHistory = async (telegram_id: number): Promise<Withdrawal[]> => {
  const response = await fetch(`${WITHDRAW_API_URL}?path=history/${telegram_id}`);

  if (!response.ok) {
    throw new Error('Failed to get withdrawal history');
  }

  const data = await response.json();
  return data.withdrawals;
};
