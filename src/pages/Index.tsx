import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';

type Screen = 'home' | 'profile' | 'wallet';

interface Transaction {
  id: string;
  amount: number;
  type: 'watch' | 'referral';
  timestamp: Date;
}

const Index = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [balance, setBalance] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [adsWatched, setAdsWatched] = useState(0);
  const [referrals, setReferrals] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isWatchingAd, setIsWatchingAd] = useState(false);

  const REWARD_AMOUNT = 0.000281;
  const BOT_USERNAME = 'adearntask_bot';
  const ADSGRAM_BLOCK_ID = '20933';

  const handleWatchAd = () => {
    setIsWatchingAd(true);
    
    setTimeout(() => {
      const newBalance = balance + REWARD_AMOUNT;
      const newTotal = totalEarned + REWARD_AMOUNT;
      const newAdsCount = adsWatched + 1;
      
      setBalance(parseFloat(newBalance.toFixed(6)));
      setTotalEarned(parseFloat(newTotal.toFixed(6)));
      setAdsWatched(newAdsCount);
      
      const newTransaction: Transaction = {
        id: Date.now().toString(),
        amount: REWARD_AMOUNT,
        type: 'watch',
        timestamp: new Date()
      };
      
      setTransactions([newTransaction, ...transactions]);
      setIsWatchingAd(false);
      
      toast.success(`+${REWARD_AMOUNT} TON начислено!`, {
        description: 'Продолжай смотреть рекламу для заработка'
      });
    }, 3000);
  };

  const copyReferralLink = () => {
    const referralLink = `https://t.me/${BOT_USERNAME}?start=ref_${Date.now()}`;
    navigator.clipboard.writeText(referralLink);
    toast.success('Реферальная ссылка скопирована!');
  };

  const handleWithdraw = () => {
    if (balance < 0.001) {
      toast.error('Минимальная сумма для вывода: 0.001 TON');
      return;
    }
    toast.success('Запрос на вывод отправлен!', {
      description: 'Средства поступят на ваш кошелек в течение 24 часов'
    });
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <div className="min-h-screen bg-background pb-20 safe-area-inset">
      {currentScreen === 'home' && (
        <div className="animate-fade-in">
          <div className="bg-gradient-to-br from-primary to-primary/80 text-white p-6 rounded-b-3xl shadow-lg">
            <div className="text-center space-y-2">
              <p className="text-sm opacity-90 font-medium">Ваш баланс</p>
              <h1 className="text-5xl font-bold tracking-tight">{balance.toFixed(6)}</h1>
              <p className="text-lg opacity-90">TON</p>
            </div>
          </div>

          <div className="px-6 mt-8 space-y-6">
            <div className="grid grid-cols-3 gap-3">
              <Card className="p-4 text-center">
                <Icon name="Eye" className="w-6 h-6 mx-auto mb-2 text-primary" />
                <p className="text-2xl font-bold">{adsWatched}</p>
                <p className="text-xs text-muted-foreground mt-1">Просмотров</p>
              </Card>
              
              <Card className="p-4 text-center">
                <Icon name="Users" className="w-6 h-6 mx-auto mb-2 text-primary" />
                <p className="text-2xl font-bold">{referrals}</p>
                <p className="text-xs text-muted-foreground mt-1">Рефералов</p>
              </Card>
              
              <Card className="p-4 text-center">
                <Icon name="TrendingUp" className="w-6 h-6 mx-auto mb-2 text-success" />
                <p className="text-2xl font-bold">{totalEarned.toFixed(4)}</p>
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
                <h2 className="text-xl font-semibold">Пользователь</h2>
                <p className="text-sm text-muted-foreground">ID: {Date.now().toString().slice(-8)}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b">
                <span className="text-muted-foreground">Просмотров рекламы</span>
                <span className="font-semibold">{adsWatched}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b">
                <span className="text-muted-foreground">Приглашено друзей</span>
                <span className="font-semibold">{referrals}</span>
              </div>
              <div className="flex justify-between items-center py-3">
                <span className="text-muted-foreground">Всего заработано</span>
                <span className="font-semibold text-success">{totalEarned.toFixed(6)} TON</span>
              </div>
            </div>
          </Card>

          <Card className="p-6">
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
              className="w-full touch-manipulation"
            >
              <Icon name="Copy" className="w-4 h-4 mr-2" />
              Скопировать реферальную ссылку
            </Button>
          </Card>
        </div>
      )}

      {currentScreen === 'wallet' && (
        <div className="px-6 py-8 animate-fade-in">
          <h1 className="text-3xl font-bold mb-6">Кошелек</h1>
          
          <Card className="p-6 mb-6 bg-gradient-to-br from-primary to-primary/80 text-white">
            <p className="text-sm opacity-90 mb-2">Доступно для вывода</p>
            <p className="text-4xl font-bold mb-4">{balance.toFixed(6)} TON</p>
            <Button 
              onClick={handleWithdraw}
              variant="secondary"
              className="w-full touch-manipulation"
            >
              <Icon name="Send" className="w-4 h-4 mr-2" />
              Вывести средства
            </Button>
          </Card>

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
                          tx.type === 'watch' ? 'bg-success/10' : 'bg-primary/10'
                        }`}>
                          <Icon 
                            name={tx.type === 'watch' ? 'Eye' : 'Users'} 
                            className={`w-5 h-5 ${
                              tx.type === 'watch' ? 'text-success' : 'text-primary'
                            }`}
                          />
                        </div>
                        <div>
                          <p className="font-medium">
                            {tx.type === 'watch' ? 'Просмотр рекламы' : 'Реферальный бонус'}
                          </p>
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
            onClick={() => setCurrentScreen('home')}
            className={`flex flex-col items-center gap-1 px-6 py-2 touch-manipulation transition-colors ${
              currentScreen === 'home' ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <Icon name="Home" className="w-6 h-6" />
            <span className="text-xs font-medium">Главная</span>
          </button>
          
          <button
            onClick={() => setCurrentScreen('profile')}
            className={`flex flex-col items-center gap-1 px-6 py-2 touch-manipulation transition-colors ${
              currentScreen === 'profile' ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <Icon name="User" className="w-6 h-6" />
            <span className="text-xs font-medium">Профиль</span>
          </button>
          
          <button
            onClick={() => setCurrentScreen('wallet')}
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