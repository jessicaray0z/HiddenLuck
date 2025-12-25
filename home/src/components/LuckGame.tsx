import { useEffect, useMemo, useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { Contract, ZeroAddress, ZeroHash, formatEther, parseEther } from 'ethers';
import { LUCKCOIN_ABI, LUCKCOIN_ADDRESS } from '../config/contracts';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';
import '../styles/LuckGame.css';

const slotFaces = ['🍒', '🍋', '🍇', '⭐️'];

type SpinResult = {
  slots: number[];
  isJackpot: boolean;
  playedAt: number;
};

export function LuckGame() {
  const { address, isConnected, chain } = useAccount();
  const signer = useEthersSigner();
  const { instance, isLoading: zamaLoading, error: zamaError } = useZamaInstance();

  const [displaySlots, setDisplaySlots] = useState<number[]>([1, 2, 3]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [decryptedBalance, setDecryptedBalance] = useState<bigint | null>(null);
  const [decrypting, setDecrypting] = useState(false);

  const contractReady = LUCKCOIN_ADDRESS !== ZeroAddress;

  const {
    data: spinPriceData,
    error: spinPriceError,
  } = useReadContract({
    address: LUCKCOIN_ADDRESS,
    abi: LUCKCOIN_ABI,
    functionName: 'SPIN_PRICE',
    query: { enabled: contractReady },
  });

  const { data: jackpotReward } = useReadContract({
    address: LUCKCOIN_ADDRESS,
    abi: LUCKCOIN_ABI,
    functionName: 'JACKPOT_REWARD',
    query: { enabled: contractReady },
  });

  const {
    data: lastSpinData,
    refetch: refetchLastSpin,
    error: lastSpinError,
  } = useReadContract({
    address: LUCKCOIN_ADDRESS,
    abi: LUCKCOIN_ABI,
    functionName: 'getLastSpin',
    args: address ? [address] : undefined,
    query: { enabled: contractReady && Boolean(address) },
  });

  const {
    data: encryptedBalance,
    refetch: refetchBalance,
    error: balanceError,
  } = useReadContract({
    address: LUCKCOIN_ADDRESS,
    abi: LUCKCOIN_ABI,
    functionName: 'confidentialBalanceOf',
    args: address ? [address] : undefined,
    query: { enabled: contractReady && Boolean(address) },
  });

  const spinPrice = (spinPriceData as bigint | undefined) ?? parseEther('0.001');
  const jackpotValue = (jackpotReward as bigint | undefined) ?? 10_000n;

  const lastSpin: SpinResult | null = useMemo(() => {
    if (!lastSpinData) return null;
    const data = lastSpinData as any;
    const slotsArray = (data.slots ?? data[0] ?? []) as readonly (number | bigint)[];
    const slots = slotsArray.slice(0, 3).map((value) => Number(value));
    return {
      slots,
      isJackpot: Boolean(data.isJackpot ?? data[1]),
      playedAt: Number(data.playedAt ?? data[2] ?? 0),
    };
  }, [lastSpinData]);

  useEffect(() => {
    if (lastSpin?.slots?.length === 3 && !isSpinning) {
      setDisplaySlots(lastSpin.slots);
      setStatusMessage(lastSpin.isJackpot ? 'Jackpot! +10,000 LuckCoin' : 'Spin settled');
    }
  }, [isSpinning, lastSpin]);

  useEffect(() => {
    if (!isSpinning) return;
    const interval = setInterval(() => {
      setDisplaySlots([
        1 + Math.floor(Math.random() * 4),
        1 + Math.floor(Math.random() * 4),
        1 + Math.floor(Math.random() * 4),
      ]);
    }, 140);
    return () => clearInterval(interval);
  }, [isSpinning]);

  const handleSpin = async () => {
    setStatusMessage(null);
    setTxHash(null);
    setDecryptedBalance(null);

    if (!contractReady) {
      setStatusMessage('Deploy LuckCoin to Sepolia and update the configured address first.');
      return;
    }

    if (!isConnected) {
      setStatusMessage('Connect a wallet to start spinning.');
      return;
    }

    const resolvedSigner = await signer;
    if (!resolvedSigner) {
      setStatusMessage('Wallet is not ready yet.');
      return;
    }

    try {
      setIsSpinning(true);
      const contract = new Contract(LUCKCOIN_ADDRESS, LUCKCOIN_ABI, resolvedSigner);
      const tx = await contract.play({ value: spinPrice });
      setTxHash(tx.hash);
      await tx.wait();
      await refetchLastSpin();
      await refetchBalance();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Spin failed';
      setStatusMessage(message);
    } finally {
      setIsSpinning(false);
    }
  };

  const handleDecryptBalance = async () => {
    setStatusMessage(null);
    if (!instance) {
      setStatusMessage('Encryption service is still loading.');
      return;
    }
    if (!address) {
      setStatusMessage('Connect your wallet to decrypt.');
      return;
    }
    if (!encryptedBalance || encryptedBalance === ZeroHash) {
      setStatusMessage('No encrypted balance found yet. Spin to earn LuckCoin.');
      return;
    }

    const resolvedSigner = await signer;
    if (!resolvedSigner) {
      setStatusMessage('Wallet is not ready yet.');
      return;
    }

    try {
      setDecrypting(true);
      const keypair = instance.generateKeypair();
      const contractAddresses = [LUCKCOIN_ADDRESS];
      const startTimeStamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = '7';
      const eip712 = instance.createEIP712(keypair.publicKey, contractAddresses, startTimeStamp, durationDays);
      const signature = await resolvedSigner.signTypedData(
        eip712.domain,
        { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
        eip712.message
      );
      const result = await instance.userDecrypt(
        [{ handle: encryptedBalance, contractAddress: LUCKCOIN_ADDRESS }],
        keypair.privateKey,
        keypair.publicKey,
        signature.replace('0x', ''),
        contractAddresses,
        address,
        startTimeStamp,
        durationDays
      );

      const clear = result[encryptedBalance as string];
      setDecryptedBalance(clear ? BigInt(clear) : 0n);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Decryption failed';
      setStatusMessage(message);
    } finally {
      setDecrypting(false);
    }
  };

  const formattedPrice = formatEther(spinPrice);
  const encryptedSnippet =
    encryptedBalance && encryptedBalance !== ZeroHash
      ? `${(encryptedBalance as string).slice(0, 10)}...`
      : '0x0';

  const showChainWarning = chain && chain.id !== 11155111;

  return (
    <div className="game-grid">
      <section className="slot-machine panel-dark">
        <div className="slot-header">
          <div>
            <p className="tag">Slot session</p>
            <h2 className="slot-title">Spin to win LuckCoin</h2>
            <p className="helper-text">
              Stake 0.001 ETH, watch the reels, and hit three of a kind for a confidential {Number(jackpotValue)} LUCK
              reward.
            </p>
          </div>
          <div className="spin-price">
            <span className="label">Spin price</span>
            <strong>{formattedPrice} ETH</strong>
          </div>
        </div>

        <div className={`slot-window ${isSpinning ? 'spinning' : ''}`}>
          {displaySlots.map((value, idx) => (
            <div className="slot-cell" key={idx}>
              <div className="slot-face">{slotFaces[value - 1] ?? '❔'}</div>
              <div className="slot-number">#{value}</div>
            </div>
          ))}
        </div>

        <div className="slot-actions">
          <button className="primary-button" onClick={handleSpin} disabled={isSpinning || zamaLoading || !contractReady}>
            {isSpinning ? 'Spinning...' : 'Spin for 0.001 ETH'}
          </button>
          <div className="status-text">
            {statusMessage && <span>{statusMessage}</span>}
            {txHash && (
              <a
                className="inline-link"
                href={`https://sepolia.etherscan.io/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
              >
                View transaction
              </a>
            )}
          </div>
        </div>

        <div className="spin-footer">
          <div>
            <p className="helper-text">
              Last spin: {lastSpin ? `${lastSpin.slots.join(' - ')} ${lastSpin.isJackpot ? '🎉 Jackpot' : ''}` : '—'}
            </p>
            {lastSpinError && <p className="warning">Unable to load last spin. Check the contract address.</p>}
            {spinPriceError && <p className="warning">Spin price not available. Deploy the contract first.</p>}
          </div>
          <div className="jackpot-pill">
            <span>Jackpot</span>
            <strong>{Number(jackpotValue).toLocaleString()} LUCK</strong>
          </div>
        </div>
      </section>

      <section className="panel info-panel">
        <div className="info-header">
          <div>
            <p className="tag">Encrypted balance</p>
            <h3 className="info-title">LuckCoin vault</h3>
            <p className="helper-text">Balances are encrypted on-chain. Use the relayer to decrypt your amount.</p>
          </div>
        </div>

        <div className="balance-card">
          <div>
            <span className="label">Encrypted handle</span>
            <p className="encrypted-text">{encryptedSnippet}</p>
            {balanceError && <p className="warning">Cannot read balance. Confirm the contract is live.</p>}
          </div>
          <div className="balance-actions">
            <button
              className="ghost-button"
              onClick={handleDecryptBalance}
              disabled={decrypting || zamaLoading || !isConnected}
            >
              {decrypting ? 'Decrypting...' : 'Decrypt my LuckCoin'}
            </button>
            {decryptedBalance !== null && (
              <p className="balance-value">
                {Number(decryptedBalance).toLocaleString()} <span>LUCK</span>
              </p>
            )}
          </div>
        </div>

        <div className="info-grid">
          <div className="stat-card">
            <p className="label">Network</p>
            <p className="stat-value">Sepolia</p>
            {showChainWarning && <p className="warning">Switch to Sepolia to play.</p>}
          </div>
          <div className="stat-card">
            <p className="label">Encryption</p>
            <p className="stat-value">{zamaLoading ? 'Initializing relayer...' : 'Zama FHE ready'}</p>
            {zamaError && <p className="warning">{zamaError}</p>}
          </div>
          <div className="stat-card">
            <p className="label">Game rules</p>
            <p className="helper-text">Three identical symbols trigger the 10,000 LUCK jackpot. Every spin uses 0.001 ETH.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
