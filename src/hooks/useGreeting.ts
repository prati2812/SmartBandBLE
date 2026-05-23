import { useMemo } from 'react';

export const useGreeting = () => {
  return useMemo(() => {
    const hour = new Date().getHours();

    if (hour < 12) {
      return {
        title: 'Good morning',
        subtitle: 'Recovery starts with a clean signal and a better wake-up ritual.',
      };
    }

    if (hour < 18) {
      return {
        title: 'Good afternoon',
        subtitle: 'Keep your band in sync and your next alarm dialed in.',
      };
    }

    return {
      title: 'Good evening',
      subtitle: 'Wind down, recharge, and push tomorrow’s performance higher.',
    };
  }, []);
};
