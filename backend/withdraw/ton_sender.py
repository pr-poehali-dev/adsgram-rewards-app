import os
import asyncio
from decimal import Decimal
from pytoniq import LiteBalancer, WalletV4R2

MAIN_WALLET_ADDRESS = "UQC2xEjVwozC1qw-VKV4cx5c1LmqAVfIJadhTxdc98pEZfqZ"

async def send_ton_transaction(destination_address: str, amount_ton: Decimal) -> dict:
    """
    Отправка TON с основного кошелька на адрес получателя
    
    Args:
        destination_address: Адрес получателя
        amount_ton: Сумма в TON для отправки
        
    Returns:
        dict с результатом транзакции
    """
    
    mnemonic = os.environ.get('TON_WALLET_MNEMONIC')
    if not mnemonic:
        raise ValueError('TON_WALLET_MNEMONIC не установлен в секретах')
    
    mnemonic_list = mnemonic.strip().split()
    if len(mnemonic_list) != 24:
        raise ValueError(f'Неверное количество слов в мнемонике: {len(mnemonic_list)}, ожидается 24')
    
    try:
        provider = LiteBalancer.from_mainnet_config(trust_level=2)
        await provider.start_up()
        
        wallet = await WalletV4R2.from_mnemonic(provider=provider, mnemonics=mnemonic_list)
        
        wallet_address = wallet.address.to_str(is_bounceable=False, is_user_friendly=True)
        
        if wallet_address != MAIN_WALLET_ADDRESS:
            raise ValueError(f'Адрес кошелька не совпадает. Ожидается: {MAIN_WALLET_ADDRESS}, получено: {wallet_address}')
        
        balance_nano = await wallet.get_balance()
        balance_ton = Decimal(balance_nano) / Decimal(10**9)
        
        if balance_ton < amount_ton:
            raise ValueError(f'Недостаточно средств на кошельке. Баланс: {balance_ton} TON, требуется: {amount_ton} TON')
        
        amount_nano = int(amount_ton * Decimal(10**9))
        
        tx_hash = await wallet.transfer(
            destination=destination_address,
            amount=amount_nano,
            body="AdEarn withdrawal"
        )
        
        await provider.close_all()
        
        return {
            'success': True,
            'tx_hash': tx_hash.hex() if isinstance(tx_hash, bytes) else str(tx_hash),
            'amount': float(amount_ton),
            'destination': destination_address,
            'sender_balance': float(balance_ton)
        }
        
    except Exception as e:
        if 'provider' in locals():
            await provider.close_all()
        raise Exception(f'Ошибка отправки транзакции: {str(e)}')


def send_ton_sync(destination_address: str, amount_ton: float) -> dict:
    """Синхронная обертка для send_ton_transaction"""
    return asyncio.run(send_ton_transaction(destination_address, Decimal(str(amount_ton))))
