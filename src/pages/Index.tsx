import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import { useTonConnectUI, useTonAddress } from '@tonconnect/ui-react';
import { initTelegramWebApp, getTelegramUser, getStartParam, hapticFeedback, isTelegramWebApp } from '@/utils/telegram';
import { showAdsgram } from '@/utils/adsgram';
import { initUser, getUser, addAdReward, getTransactions, getReferrals, type User, type Transaction as ApiTransaction } from '@/utils/api';
import { requestWithdrawal, getWithdrawalHistory, type Withdrawal } from '@/utils/withdrawal';

type Screen = 'home' | 'profile' | 'wallet';

interface Transaction {
  id: number;
  amount: number;
  type: string;
  description: string;
  timestamp: string;
}

const Index = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [userData, setUserData] = useState<User | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [referralsList, setReferralsList] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [isWatchingAd, setIsWatchingAd] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [telegramId, setTelegramId] = useState<number | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const [tonConnectUI] = useTonConnectUI();
  const walletAddress = useTonAddress();

  const REWARD_AMOUNT = 0.000281;
  const BOT_USERNAME = 'adearntask_bot';
  const ADSGRAM_BLOCK_ID = '21184';
  const MIN_WITHDRAWAL = 0.5;

  useEffect(() => {
    const init = async () => {
      initTelegramWebApp();
      
      const tgUser = getTelegramUser();
      const startParam = getStartParam();
      
      let userId: number;
      let referrerId: number | undefined;
      
      if (tgUser) {
        userId = tgUser.id;
        
        if (startParam && startParam.startsWith('ref_')) {
          referrerId = parseInt(startParam.replace('ref_', ''));
        }
        
        try {
          const user = await initUser(
            userId,
            tgUser.username,
            tgUser.first_name,
            tgUser.last_name,
            referrerId
          );
          setUserData(user);
          setTelegramId(userId);
        } catch (error) {
          console.error('Failed to init user:', error);
          toast.error('Ошибка инициализации пользователя');
        }
      } else {
        userId = 123456789;
        setTelegramId(userId);
        
        try {
          const user = await getUser(userId);
          setUserData(user);
        } catch {
          const user = await initUser(userId, 'demo_user', 'Demo', 'User');
          setUserData(user);
        }
      }
      
      setIsLoading(false);
    };
    
    init();
  }, []);

  const loadTransactions = async () => {
    if (!telegramId) return;
    
    try {
      const txs = await getTransactions(telegramId);
      setTransactions(txs);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    }
  };

  const loadReferrals = async () => {
    if (!telegramId) return;
    
    try {
      const refs = await getReferrals(telegramId);
      setReferralsList(refs);
    } catch (error) {
      console.error('Failed to load referrals:', error);
    }
  };

  const loadWithdrawals = async () => {
    if (!telegramId) return;
    
    try {
      const history = await getWithdrawalHistory(telegramId);
      setWithdrawals(history);
    } catch (error) {
      console.error('Failed to load withdrawals:', error);
    }
  };

  useEffect(() => {
    if (currentScreen === 'wallet' && telegramId) {
      loadTransactions();
      loadWithdrawals();
    }
  }, [currentScreen, telegramId]);

  useEffect(() => {
    if (currentScreen === 'profile' && telegramId) {
      loadReferrals();
    }
  }, [currentScreen, telegramId]);

  const handleWatchAd = async () => {
    if (!telegramId) {
      toast.error('Пользователь не авторизован');
      return;
    }
    
    setIsWatchingAd(true);
    hapticFeedback('medium');
    
    try {
      const result = await showAdsgram(ADSGRAM_BLOCK_ID, demoMode);
      
      if (result.success) {
        const updatedUser = await addAdReward(telegramId, REWARD_AMOUNT, ADSGRAM_BLOCK_ID);
        setUserData(updatedUser);
        
        hapticFeedback('success');
        toast.success(`+${REWARD_AMOUNT} TON начислено!`, {
          description: demoMode ? 'Демо-режим: награда начислена' : 'Продолжай смотреть рекламу для заработка'
        });
      } else {
        hapticFeedback('error');
        
        if (result.error?.includes('нет доступных объявлений')) {
          toast.error(result.error, {
            description: 'Включите демо-режим в настройках',
            action: {
              label: 'Включить демо',
              onClick: () => {
                setDemoMode(true);
                toast.success('Демо-режим включен!');
              }
            }
          });
        } else {
          toast.error(result.error || 'Реклама не была досмотрена до конца');
        }
      }
    } catch (error) {
      hapticFeedback('error');
      toast.error('Ошибка при показе рекламы');
      console.error('Ad error:', error);
    } finally {
      setIsWatchingAd(false);
    }
  };

  const copyReferralLink = () => {
    if (!telegramId) return;
    
    const referralLink = `https://t.me/${BOT_USERNAME}?start=ref_${telegramId}`;
    navigator.clipboard.writeText(referralLink);
    hapticFeedback('success');
    toast.success('Реферальная ссылка скопирована!');
  };

  const handleConnectWallet = async () => {
    if (!tonConnectUI) return;
    
    try {
      hapticFeedback('medium');
      await tonConnectUI.openModal();
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      toast.error('Ошибка подключения кошелька');
    }
  };

  const handleWithdraw = async () => {
    if (!userData || !telegramId) {
      toast.error('Пользователь не авторизован');
      return;
    }

    if (!walletAddress) {
      hapticFeedback('error');
      toast.error('Подключите TON кошелек', {
        action: {
          label: 'Подключить',
          onClick: handleConnectWallet
        }
      });
      return;
    }

    if (userData.balance < MIN_WITHDRAWAL) {
      hapticFeedback('error');
      toast.error(`Минимальная сумма для вывода: ${MIN_WITHDRAWAL} TON`, {
        description: `Ваш баланс: ${userData.balance.toFixed(6)} TON`
      });
      return;
    }

    setIsWithdrawing(true);
    hapticFeedback('medium');

    try {
      const result = await requestWithdrawal(
        telegramId,
        walletAddress,
        userData.balance
      );

      if (result.success) {
        setUserData({
          ...userData,
          balance: result.new_balance || 0
        });

        hapticFeedback('success');
        toast.success('Запрос на вывод создан!', {
          description: result.message || 'Обработка в течение 24 часов'
        });

        await loadWithdrawals();
      }
    } catch (error: any) {
      hapticFeedback('error');
      toast.error(error.message || 'Ошибка при создании запроса на вывод');
    } finally {
      setIsWithdrawing(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(dateString));
  };

  if (isLoading || !userData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Icon name="Loader2" className="w-12 h-12 mx-auto animate-spin text-primary" />
          <p className="text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 safe-area-inset">
      {currentScreen === 'home' && (
        <div className="animate-fade-in">
          <div className="bg-gradient-to-br from-primary to-primary/80 text-white p-6 rounded-b-3xl shadow-lg">
            <div className="text-center space-y-2">
              <p className="text-sm opacity-90 font-medium">Ваш баланс</p>
              <h1 className="text-5xl font-bold tracking-tight">{userData.balance.toFixed(6)}</h1>
              <p className="text-lg opacity-90">TON</p>
            </div>
          </div>

          <div className="px-6 mt-8 space-y-6">
            <div className="grid grid-cols-3 gap-3">
              <Card className="p-4 text-center">
                <Icon name="Eye" className="w-6 h-6 mx-auto mb-2 text-primary" />
                <p className="text-2xl font-bold">{userData.ads_watched}</p>
                <p className="text-xs text-muted-foreground mt-1">Просмотров</p>
              </Card>
              
              <Card className="p-4 text-center">
                <Icon name="Users" className="w-6 h-6 mx-auto mb-2 text-primary" />
                <p className="text-2xl font-bold">{userData.referrals_count}</p>
                <p className="text-xs text-muted-foreground mt-1">Рефералов</p>
              </Card>
              
              <Card className="p-4 text-center">
                <Icon name="TrendingUp" className="w-6 h-6 mx-auto mb-2 text-success" />
                <p className="text-2xl font-bold">{userData.total_earned.toFixed(4)}</p>
                <p className="text-xs text-muted-foreground mt-1">Всего TON</p>
              </Card>
            </div>

            <Card className="p-6 bg-gradient-to-br from-card to-muted/20">
              <div className="text-center space-y-4">
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold">Смотри и зарабатывай</h2>
                  <p className="text-sm text-muted-foreground">
                    Получай <span className="font-bold text-success">{REWARD_AMOUNT} TON</span> за каждый просмотр
                  </p>
                </div>
                
                <Button
                  onClick={handleWatchAd}
                  disabled={isWatchingAd}
                  size="lg"
                  className={`w-full h-16 text-lg font-semibold shadow-lg touch-manipulation ${
                    isWatchingAd ? 'animate-pulse-scale' : ''
                  }`}
                >
                  {isWatchingAd ? (
                    <>
                      <Icon name="Loader2" className="w-6 h-6 mr-2 animate-spin" />
                      Загрузка рекламы...
                    </>
                  ) : (
                    <>
                      <Icon name="Play" className="w-6 h-6 mr-2" />
                      Смотреть рекламу
                    </>
                  )}
                </Button>
              </div>
            </Card>

            <Card className="p-5 bg-muted/30">
              <div className="flex items-start gap-3">
                <div className="bg-primary/10 p-2 rounded-lg">
                  <Icon name="Lightbulb" className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 text-sm">
                  <p className="font-medium mb-1">Приглашай друзей!</p>
                  <p className="text-muted-foreground text-xs">
                    Получай бонусы за каждого приглашенного друга
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-amber-50 dark:bg-amber-950/20 border-amber-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon name={demoMode ? "CheckCircle2" : "AlertCircle"} className={`w-5 h-5 ${demoMode ? 'text-success' : 'text-amber-600'}`} />
                  <div>
                    <p className="text-sm font-medium">Демо-режим</p>
                    <p className="text-xs text-muted-foreground">
                      {demoMode ? 'Включен' : 'Если нет рекламы'}
                    </p>
                  </div>
                </div>
                <Button
                  variant={demoMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setDemoMode(!demoMode);
                    hapticFeedback('light');
                    toast.success(demoMode ? 'Демо-режим выключен' : 'Демо-режим включен');
                  }}
                  className="touch-manipulation"
                >
                  {demoMode ? 'Выкл' : 'Вкл'}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {currentScreen === 'profile' && (
        <div className="px-6 py-8 animate-fade-in">
          <h1 className="text-3xl font-bold mb-6">Профиль</h1>
          
          <Card className="p-6 mb-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                <Icon name="User" className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">
                  {userData.first_name} {userData.last_name || ''}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {userData.username ? `@${userData.username}` : `ID: ${userData.telegram_id}`}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b">
                <span className="text-muted-foreground">Просмотров рекламы</span>
                <span className="font-semibold">{userData.ads_watched}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b">
                <span className="text-muted-foreground">Приглашено друзей</span>
                <span className="font-semibold">{userData.referrals_count}</span>
              </div>
              <div className="flex justify-between items-center py-3">
                <span className="text-muted-foreground">Всего заработано</span>
                <span className="font-semibold text-success">{userData.total_earned.toFixed(6)} TON</span>
              </div>
            </div>
          </Card>

          <Card className="p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <Icon name="Gift" className="w-6 h-6 text-primary" />
              <h3 className="text-lg font-semibold">Реферальная программа</h3>
            </div>
            
            <p className="text-sm text-muted-foreground mb-4">
              Приглашай друзей и получай 10% от их заработка!
            </p>
            
            <Button 
              onClick={copyReferralLink}
              variant="outline" 
              className="w-full touch-manipulation mb-4"
            >
              <Icon name="Copy" className="w-4 h-4 mr-2" />
              Скопировать реферальную ссылку
            </Button>

            {referralsList.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium">Ваши рефералы:</p>
                {referralsList.map((ref) => (
                  <div key={ref.telegram_id} className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{ref.first_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {ref.username ? `@${ref.username}` : `ID: ${ref.telegram_id}`}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-success">+{ref.bonus_earned.toFixed(6)} TON</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {currentScreen === 'wallet' && (
        <div className="px-6 py-8 animate-fade-in">
          <h1 className="text-3xl font-bold mb-6">Кошелек</h1>
          
          <Card className="p-6 mb-6 bg-gradient-to-br from-primary to-primary/80 text-white">
            <p className="text-sm opacity-90 mb-2">Доступно для вывода</p>
            <p className="text-4xl font-bold mb-4">{userData.balance.toFixed(6)} TON</p>
            
            {!walletAddress ? (
              <Button 
                onClick={handleConnectWallet}
                variant="secondary"
                className="w-full touch-manipulation"
              >
                <Icon name="Wallet" className="w-4 h-4 mr-2" />
                Подключить TON кошелек
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="bg-white/10 rounded-lg p-3">
                  <p className="text-xs opacity-80 mb-1">Подключен кошелек</p>
                  <p className="text-sm font-mono">
                    {walletAddress.slice(0, 8)}...{walletAddress.slice(-6)}
                  </p>
                </div>
                <Button 
                  onClick={handleWithdraw}
                  disabled={isWithdrawing || userData.balance < MIN_WITHDRAWAL}
                  variant="secondary"
                  className="w-full touch-manipulation"
                >
                  {isWithdrawing ? (
                    <>
                      <Icon name="Loader2" className="w-4 h-4 mr-2 animate-spin" />
                      Обработка...
                    </>
                  ) : (
                    <>
                      <Icon name="Send" className="w-4 h-4 mr-2" />
                      Вывести {userData.balance.toFixed(6)} TON
                    </>
                  )}
                </Button>
                {userData.balance < MIN_WITHDRAWAL && (
                  <p className="text-xs text-center opacity-80">
                    Минимум для вывода: {MIN_WITHDRAWAL} TON
                  </p>
                )}
              </div>
            )}
          </Card>

          {withdrawals.length > 0 && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-3">Выводы</h2>
              <div className="space-y-2">
                {withdrawals.map((withdrawal) => (
                  <Card key={withdrawal.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          withdrawal.status === 'completed' ? 'bg-success/10' : 
                          withdrawal.status === 'pending' ? 'bg-amber-500/10' : 'bg-destructive/10'
                        }`}>
                          <Icon 
                            name={withdrawal.status === 'completed' ? 'CheckCircle2' : 
                                  withdrawal.status === 'pending' ? 'Clock' : 'XCircle'} 
                            className={`w-5 h-5 ${
                              withdrawal.status === 'completed' ? 'text-success' : 
                              withdrawal.status === 'pending' ? 'text-amber-500' : 'text-destructive'
                            }`}
                          />
                        </div>
                        <div>
                          <p className="font-medium">Вывод на кошелек</p>
                          <p className="text-xs text-muted-foreground">
                            {withdrawal.wallet.slice(0, 8)}...{withdrawal.wallet.slice(-6)}
                          </p>
                          <p className="text-xs text-muted-foreground">{formatDate(withdrawal.created_at)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-destructive">-{withdrawal.amount.toFixed(6)}</p>
                        <p className="text-xs text-muted-foreground capitalize">{withdrawal.status}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <div className="mb-4">
            <h2 className="text-lg font-semibold mb-3">История операций</h2>
            {transactions.length === 0 ? (
              <Card className="p-8 text-center">
                <Icon name="Inbox" className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground">История пуста</p>
              </Card>
            ) : (
              <div className="space-y-2">
                {transactions.map((tx) => (
                  <Card key={tx.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          tx.type === 'ad_view' ? 'bg-success/10' : 'bg-primary/10'
                        }`}>
                          <Icon 
                            name={tx.type === 'ad_view' ? 'Eye' : 'Users'} 
                            className={`w-5 h-5 ${
                              tx.type === 'ad_view' ? 'text-success' : 'text-primary'
                            }`}
                          />
                        </div>
                        <div>
                          <p className="font-medium">{tx.description}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(tx.timestamp)}</p>
                        </div>
                      </div>
                      <p className="font-bold text-success">+{tx.amount.toFixed(6)}</p>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t shadow-lg safe-area-inset">
        <div className="flex justify-around items-center h-16">
          <button
            onClick={() => {
              setCurrentScreen('home');
              hapticFeedback('light');
            }}
            className={`flex flex-col items-center gap-1 px-6 py-2 touch-manipulation transition-colors ${
              currentScreen === 'home' ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <Icon name="Home" className="w-6 h-6" />
            <span className="text-xs font-medium">Главная</span>
          </button>
          
          <button
            onClick={() => {
              setCurrentScreen('profile');
              hapticFeedback('light');
            }}
            className={`flex flex-col items-center gap-1 px-6 py-2 touch-manipulation transition-colors ${
              currentScreen === 'profile' ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <Icon name="User" className="w-6 h-6" />
            <span className="text-xs font-medium">Профиль</span>
          </button>
          
          <button
            onClick={() => {
              setCurrentScreen('wallet');
              hapticFeedback('light');
            }}
            className={`flex flex-col items-center gap-1 px-6 py-2 touch-manipulation transition-colors ${
              currentScreen === 'wallet' ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <Icon name="Wallet" className="w-6 h-6" />
            <span className="text-xs font-medium">Кошелек</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

export default Index;