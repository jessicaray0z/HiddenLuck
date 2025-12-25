// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {FHE, euint64} from "@fhevm/solidity/lib/FHE.sol";

contract LuckCoin is ERC7984, ZamaEthereumConfig {
    struct SpinResult {
        uint8[3] slots;
        bool isJackpot;
        uint256 playedAt;
    }

    uint256 public constant SPIN_PRICE = 0.001 ether;
    uint64 public constant JACKPOT_REWARD = 10_000;

    address public immutable owner;
    mapping(address player => SpinResult) private _lastSpin;
    uint256 private _nonce;

    error IncorrectStake();
    error InvalidRecipient();
    error NotOwner();
    error UnsupportedChain();

    event SpinPlayed(address indexed player, uint8[3] slots, bool isJackpot, euint64 encryptedReward);
    event Withdrawal(address indexed recipient, uint256 amount);

    constructor() ERC7984("LuckCoin", "LUCK", "") {
        owner = msg.sender;
    }

    function play() external payable returns (uint8[3] memory slots, bool isJackpot, euint64 reward) {
        _validateStake();
        slots = _rollSlots(msg.sender);
        (isJackpot, reward) = _recordSpin(msg.sender, slots);
    }

    function playWithSeed(uint256 seed) external payable returns (uint8[3] memory slots, bool isJackpot, euint64 reward) {
        if (block.chainid != 31337) {
            revert UnsupportedChain();
        }

        _validateStake();
        slots = _rollSlotsWithSeed(seed, msg.sender);
        (isJackpot, reward) = _recordSpin(msg.sender, slots);
    }

    function getLastSpin(address player) external view returns (SpinResult memory) {
        return _lastSpin[player];
    }

    function withdraw(address payable recipient) external {
        if (msg.sender != owner) {
            revert NotOwner();
        }
        if (recipient == address(0)) {
            revert InvalidRecipient();
        }

        uint256 balance = address(this).balance;
        recipient.transfer(balance);
        emit Withdrawal(recipient, balance);
    }

    function _rollSlots(address player) private returns (uint8[3] memory slots) {
        for (uint256 i = 0; i < 3; i++) {
            _nonce++;
            slots[i] = uint8((uint256(keccak256(abi.encode(block.timestamp, block.prevrandao, player, _nonce))) % 4) + 1);
        }
    }

    function _rollSlotsWithSeed(uint256 seed, address player) private returns (uint8[3] memory slots) {
        for (uint256 i = 0; i < 3; i++) {
            _nonce++;
            slots[i] = uint8((uint256(keccak256(abi.encode(seed, player, _nonce))) % 4) + 1);
        }
    }

    function _recordSpin(address player, uint8[3] memory slots) private returns (bool isJackpot, euint64 reward) {
        isJackpot = slots[0] == slots[1] && slots[1] == slots[2];
        reward = FHE.asEuint64(0);

        if (isJackpot) {
            reward = _mint(player, FHE.asEuint64(JACKPOT_REWARD));
        }

        _lastSpin[player] = SpinResult({slots: slots, isJackpot: isJackpot, playedAt: block.timestamp});
        emit SpinPlayed(player, slots, isJackpot, reward);
    }

    function _validateStake() private view {
        if (msg.value != SPIN_PRICE) {
            revert IncorrectStake();
        }
    }
}
