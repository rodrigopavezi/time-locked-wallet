//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.17;
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@opengsn/contracts/src/ERC2771Recipient.sol";

contract TimeLockedWallet is Ownable, ReentrancyGuard, ERC2771Recipient {
    // -------------------------------------------------------------
    // STORAGE
    // --------------------------------------------------------------
    address public constant NATIVE = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    uint256 public unlockDate;
    mapping(address => mapping(address => uint256)) public balances;

    // --------------------------------------------------------------
    // EVENTS
    // --------------------------------------------------------------
    event Deposited(address from, address tokenId, uint256 amount);
    event Claimed(address from, address tokenId, uint256 amount);

    // --------------------------------------------------------------
    // CUSTOM ERRORS
    // --------------------------------------------------------------
    error InvalidAmount();
    error TransferFailed();
    error IsStillLocked();
    error InsufficientBalance();

    // --------------------------------------------------------------
    // CONSTRUCTOR
    // --------------------------------------------------------------
    constructor(address _trustedForwarder) {
        _setTrustedForwarder(_trustedForwarder);
        unlockDate = block.timestamp;
    }

    // --------------------------------------------------------------
    // STATE-MODIFYING FUNCTIONS
    // --------------------------------------------------------------

    function setUnlockDate(uint256 _unlockDate) public onlyOwner {
        unlockDate = _unlockDate;
    }

    /// @notice Transfers Native or ERC20 tokens from the sender to the contract.
    /// @param _token Address of the token
    /// @param _amount Amount of tokens
    function deposit(address _token, uint256 _amount)
        public
        payable
        nonReentrant
    {
        if (_token != NATIVE) {
            balances[_token][_msgSender()] += _amount;
            IERC20(_token).transferFrom(_msgSender(), address(this), _amount);
        } else {
            if (msg.value != _amount) revert InvalidAmount();
            balances[_token][_msgSender()] += _amount;
        }

        emit Deposited(_msgSender(), _token, _amount);
    }

    /// @notice Transfers Native or ERC20 tokens from the contract to the recipient.
    /// @param _token Address of the token
    /// @param _amount Amount of tokens
    function claim(address _token, uint256 _amount) public nonReentrant {
        if (block.timestamp < unlockDate) revert IsStillLocked();
        if (balances[_token][_msgSender()] < _amount)
            revert InsufficientBalance();

        balances[_token][_msgSender()] -= _amount;

        if (_token == NATIVE) {
            (bool success, ) = payable(_msgSender()).call{value: _amount}("");
            if (!success) revert TransferFailed();
        } else {
            IERC20(_token).transfer(_msgSender(), _amount);
        }

        emit Claimed(_msgSender(), _token, _amount);
    }

    function setTrustedForwarder(address _forwarder) public onlyOwner {
        _setTrustedForwarder(_forwarder);
    }

    function _msgSender()
        internal
        view
        override(Context, ERC2771Recipient)
        returns (address sender)
    {
        sender = ERC2771Recipient._msgSender();
    }

    function _msgData()
        internal
        view
        override(Context, ERC2771Recipient)
        returns (bytes calldata)
    {
        return ERC2771Recipient._msgData();
    }
}
