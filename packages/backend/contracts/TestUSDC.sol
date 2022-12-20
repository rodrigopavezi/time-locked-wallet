pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";
import "@opengsn/contracts/src/ERC2771Recipient.sol";

contract TestUSDC is ERC20, ERC20Permit, ERC2771Recipient {
    constructor(
        address _trustedForwarder,
        string memory name_,
        string memory symbol_,
        uint256 totalSupply_
    ) ERC20(name_, symbol_) ERC20Permit(name_) {
         _setTrustedForwarder(_trustedForwarder);
        _mint(_msgSender(), totalSupply_);
        emit Transfer(address(this), _msgSender(), totalSupply_);
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
