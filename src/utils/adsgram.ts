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

export const showAdsgram = async (blockId: string): Promise<AdsgramResult> => {
  if (!window.Adsgram) {
    return {
      success: false,
      error: 'Adsgram SDK not loaded'
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
        reward: 0.000281
      };
    } else {
      return {
        success: false,
        error: `Ad not completed: ${result.description}`
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};
