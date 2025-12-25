import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'Hidden Luck',
  projectId: '3f1e2d3c0b8d4f2e88d93d5c1b9c8a38',
  chains: [sepolia],
  ssr: false,
});
