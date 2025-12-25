import { ConnectButton } from '@rainbow-me/rainbowkit';
import '../styles/Header.css';

export function Header() {
  return (
    <header className="header panel">
      <div className="header-inner">
        <div>
          <p className="tag">Confidential arcade</p>
          <h1 className="brand-title">Hidden Luck Slots</h1>
          <p className="brand-subtitle">
            Spin with 0.001 ETH, line up three matching reels, and unlock a 10,000 LuckCoin encrypted jackpot.
          </p>
        </div>
        <ConnectButton />
      </div>
    </header>
  );
}
