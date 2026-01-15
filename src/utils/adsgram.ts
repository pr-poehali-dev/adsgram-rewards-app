declare global {
  interface Window {
    Adsgram?: {
      init: (options: { blockId: string; debug?: boolean }) => {
        show: () => Promise<{
          done: boolean;
          state: 'load' | 'render' | 'playing' | 'destroy';
          description: string;
        }>;
      };
    };
  }
}

export interface AdsgramResult {
  success: boolean;
  error?: string;
  reward?: number;
}

export const showAdsgram = async (blockId: string, useDemoMode: boolean = false): Promise<AdsgramResult> => {
  if (useDemoMode) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          reward: 0.001
        });
      }, 2000);
    });
  }

  if (!window.Adsgram) {
    return {
      success: false,
      error: 'Adsgram SDK не загружен. Используйте демо-режим для тестирования.'
    };
  }

  try {
    const AdController = window.Adsgram.init({ 
      blockId,
      debug: false
    });

    const result = await AdController.show();

    if (result.done) {
      return {
        success: true,
        reward: 0.001
      };
    } else {
      return {
        success: false,
        error: `Реклама не досмотрена: ${result.description}`
      };
    }
  } catch (error: any) {
    if (error?.message?.includes('no ads') || error?.toString().includes('no ads')) {
      return {
        success: false,
        error: 'В данный момент нет доступных объявлений. Попробуйте позже или используйте демо-режим.'
      };
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Неизвестная ошибка при показе рекламы'
    };
  }
};