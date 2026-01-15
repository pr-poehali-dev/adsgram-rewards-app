import json
import os
import psycopg2
from decimal import Decimal

def handler(event: dict, context) -> dict:
    """API для обработки выводов средств на TON кошелек"""
    
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    dsn = os.environ.get('DATABASE_URL')
    
    try:
        conn = psycopg2.connect(dsn)
        conn.autocommit = False
        cur = conn.cursor()
        
        query_params = event.get('queryStringParameters') or {}
        path = query_params.get('path', '')
        
        body_data = {}
        if event.get('body'):
            body_data = json.loads(event['body'])
        
        if method == 'POST' and path == 'request':
            telegram_id = body_data.get('telegram_id')
            wallet_address = body_data.get('wallet_address')
            amount = Decimal(str(body_data.get('amount', '0')))
            
            MIN_WITHDRAWAL = Decimal('0.5')
            
            if amount < MIN_WITHDRAWAL:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({
                        'error': f'Минимальная сумма вывода: {float(MIN_WITHDRAWAL)} TON'
                    }),
                    'isBase64Encoded': False
                }
            
            cur.execute("""
                SELECT balance FROM users WHERE telegram_id = %s
            """, (telegram_id,))
            
            result = cur.fetchone()
            if not result:
                conn.rollback()
                return {
                    'statusCode': 404,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Пользователь не найден'}),
                    'isBase64Encoded': False
                }
            
            current_balance = result[0]
            
            if current_balance < amount:
                conn.rollback()
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({
                        'error': 'Недостаточно средств',
                        'balance': float(current_balance),
                        'requested': float(amount)
                    }),
                    'isBase64Encoded': False
                }
            
            cur.execute("""
                UPDATE users 
                SET balance = balance - %s,
                    updated_at = CURRENT_TIMESTAMP
                WHERE telegram_id = %s
                RETURNING balance
            """, (amount, telegram_id))
            
            new_balance = cur.fetchone()[0]
            
            cur.execute("""
                INSERT INTO transactions (user_id, amount, transaction_type, description)
                VALUES (%s, %s, 'withdrawal', %s)
                RETURNING id
            """, (telegram_id, -amount, f'Вывод на кошелек {wallet_address[:8]}...{wallet_address[-6:]}'))
            
            transaction_id = cur.fetchone()[0]
            
            cur.execute("""
                INSERT INTO withdrawals (user_id, amount, wallet_address, status, transaction_id)
                VALUES (%s, %s, %s, 'pending', %s)
                RETURNING id
            """, (telegram_id, amount, wallet_address, transaction_id))
            
            withdrawal_id = cur.fetchone()[0]
            
            conn.commit()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'success': True,
                    'withdrawal_id': withdrawal_id,
                    'new_balance': float(new_balance),
                    'amount': float(amount),
                    'wallet': wallet_address,
                    'message': 'Запрос на вывод создан. Обработка в течение 24 часов.'
                }),
                'isBase64Encoded': False
            }
        
        elif method == 'GET' and path.startswith('history/'):
            telegram_id = int(path.split('/')[-1])
            
            cur.execute("""
                SELECT id, amount, wallet_address, status, created_at, processed_at
                FROM withdrawals
                WHERE user_id = %s
                ORDER BY created_at DESC
                LIMIT 50
            """, (telegram_id,))
            
            withdrawals = []
            for row in cur.fetchall():
                withdrawals.append({
                    'id': row[0],
                    'amount': float(row[1]),
                    'wallet': row[2],
                    'status': row[3],
                    'created_at': row[4].isoformat(),
                    'processed_at': row[5].isoformat() if row[5] else None
                })
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'withdrawals': withdrawals}),
                'isBase64Encoded': False
            }
        
        else:
            return {
                'statusCode': 404,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Endpoint not found'}),
                'isBase64Encoded': False
            }
    
    except Exception as e:
        if 'conn' in locals():
            conn.rollback()
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)}),
            'isBase64Encoded': False
        }
    
    finally:
        if 'cur' in locals():
            cur.close()
        if 'conn' in locals():
            conn.close()
