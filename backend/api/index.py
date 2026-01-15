import json
import os
import psycopg2
from datetime import datetime
from decimal import Decimal

def handler(event: dict, context) -> dict:
    """API для управления пользователями и начислениями за просмотр рекламы"""
    
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-Telegram-Init-Data'
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
        
        if method == 'POST' and path == 'user/init':
            telegram_id = body_data.get('telegram_id')
            username = body_data.get('username', '')
            first_name = body_data.get('first_name', '')
            last_name = body_data.get('last_name', '')
            referrer_id = body_data.get('referrer_id')
            
            cur.execute("""
                INSERT INTO users (telegram_id, username, first_name, last_name, referrer_id)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (telegram_id) 
                DO UPDATE SET 
                    username = EXCLUDED.username,
                    first_name = EXCLUDED.first_name,
                    last_name = EXCLUDED.last_name,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING telegram_id, balance, total_earned, ads_watched, referrer_id
            """, (telegram_id, username, first_name, last_name, referrer_id))
            
            user_data = cur.fetchone()
            
            if referrer_id and user_data[4]:
                cur.execute("""
                    INSERT INTO referrals (referrer_id, referred_id)
                    VALUES (%s, %s)
                    ON CONFLICT (referrer_id, referred_id) DO NOTHING
                """, (referrer_id, telegram_id))
            
            conn.commit()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'telegram_id': user_data[0],
                    'balance': float(user_data[1]),
                    'total_earned': float(user_data[2]),
                    'ads_watched': user_data[3],
                    'has_referrer': user_data[4] is not None
                }),
                'isBase64Encoded': False
            }
        
        elif method == 'GET' and path.startswith('user/'):
            telegram_id = int(path.split('/')[-1])
            
            cur.execute("""
                SELECT telegram_id, username, first_name, last_name, 
                       balance, total_earned, ads_watched, referrer_id
                FROM users WHERE telegram_id = %s
            """, (telegram_id,))
            
            user = cur.fetchone()
            
            if not user:
                return {
                    'statusCode': 404,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'User not found'}),
                    'isBase64Encoded': False
                }
            
            cur.execute("""
                SELECT COUNT(*) FROM referrals WHERE referrer_id = %s
            """, (telegram_id,))
            referrals_count = cur.fetchone()[0]
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'telegram_id': user[0],
                    'username': user[1],
                    'first_name': user[2],
                    'last_name': user[3],
                    'balance': float(user[4]),
                    'total_earned': float(user[5]),
                    'ads_watched': user[6],
                    'referrals_count': referrals_count,
                    'has_referrer': user[7] is not None
                }),
                'isBase64Encoded': False
            }
        
        elif method == 'POST' and path == 'ad/reward':
            telegram_id = body_data.get('telegram_id')
            reward_amount = Decimal(str(body_data.get('reward_amount', '0.000281')))
            block_id = body_data.get('block_id', '20933')
            
            cur.execute("""
                UPDATE users 
                SET balance = balance + %s,
                    total_earned = total_earned + %s,
                    ads_watched = ads_watched + 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE telegram_id = %s
                RETURNING balance, total_earned, ads_watched, referrer_id
            """, (reward_amount, reward_amount, telegram_id))
            
            result = cur.fetchone()
            
            if not result:
                conn.rollback()
                return {
                    'statusCode': 404,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'User not found'}),
                    'isBase64Encoded': False
                }
            
            cur.execute("""
                INSERT INTO ad_views (user_id, reward_amount, adsgram_block_id)
                VALUES (%s, %s, %s)
            """, (telegram_id, reward_amount, block_id))
            
            cur.execute("""
                INSERT INTO transactions (user_id, amount, transaction_type, description)
                VALUES (%s, %s, 'ad_view', 'Просмотр рекламы')
            """, (telegram_id, reward_amount))
            
            referrer_id = result[3]
            if referrer_id:
                referral_bonus = reward_amount * Decimal('0.1')
                
                cur.execute("""
                    UPDATE users 
                    SET balance = balance + %s,
                        total_earned = total_earned + %s,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE telegram_id = %s
                """, (referral_bonus, referral_bonus, referrer_id))
                
                cur.execute("""
                    UPDATE referrals 
                    SET bonus_earned = bonus_earned + %s
                    WHERE referrer_id = %s AND referred_id = %s
                """, (referral_bonus, referrer_id, telegram_id))
                
                cur.execute("""
                    INSERT INTO transactions (user_id, amount, transaction_type, description)
                    VALUES (%s, %s, 'referral_bonus', 'Бонус от реферала')
                """, (referrer_id, referral_bonus))
            
            conn.commit()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'balance': float(result[0]),
                    'total_earned': float(result[1]),
                    'ads_watched': result[2],
                    'reward_added': float(reward_amount)
                }),
                'isBase64Encoded': False
            }
        
        elif method == 'GET' and path.startswith('transactions/'):
            telegram_id = int(path.split('/')[-1])
            
            cur.execute("""
                SELECT id, amount, transaction_type, description, created_at
                FROM transactions
                WHERE user_id = %s
                ORDER BY created_at DESC
                LIMIT 50
            """, (telegram_id,))
            
            transactions = []
            for row in cur.fetchall():
                transactions.append({
                    'id': row[0],
                    'amount': float(row[1]),
                    'type': row[2],
                    'description': row[3],
                    'timestamp': row[4].isoformat()
                })
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'transactions': transactions}),
                'isBase64Encoded': False
            }
        
        elif method == 'GET' and path.startswith('referrals/'):
            telegram_id = int(path.split('/')[-1])
            
            cur.execute("""
                SELECT r.referred_id, u.username, u.first_name, r.bonus_earned, r.created_at
                FROM referrals r
                JOIN users u ON r.referred_id = u.telegram_id
                WHERE r.referrer_id = %s
                ORDER BY r.created_at DESC
            """, (telegram_id,))
            
            referrals = []
            for row in cur.fetchall():
                referrals.append({
                    'telegram_id': row[0],
                    'username': row[1],
                    'first_name': row[2],
                    'bonus_earned': float(row[3]),
                    'joined_at': row[4].isoformat()
                })
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'referrals': referrals}),
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