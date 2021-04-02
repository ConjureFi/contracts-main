// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./lib/CloneLibrary.sol";


/// @author Conjure Finance Team
/// @title ConjureFactory
/// @notice Factory contract to create new instances of Conjure
contract ConjureFactory {
    using CloneLibrary for address;

    event NewConjure(address conjure, address etherCollateral);
    event FactoryOwnerChanged(address newowner);

    address payable public factoryOwner;
    address public conjureImplementation;
    address public etherCollateralImplementation;
    address payable public conjureRouter;
    IERC20 cnj;

    constructor(
        address _conjureImplementation,
        address _etherCollateralImplementation,
        address payable _conjureRouter,
        IERC20 _cnj
    )
    {
        factoryOwner = msg.sender;
        conjureImplementation = _conjureImplementation;
        etherCollateralImplementation = _etherCollateralImplementation;
        conjureRouter = _conjureRouter;
        cnj = _cnj;
    }

    /**
     * @dev lets anyone mint a new Conjure contract
     *
     * @param name_ the name of the conjure asset
     * @param symbol_ the symbol of the conjure asset
     * @param owner_ the owner of the conjure asset
     * @param indexedFinanceUniswapv2oracle_ the uniswap oracle
    */
    function ConjureMint(
        string memory name_,
        string memory symbol_,
        address payable owner_,
        address indexedFinanceUniswapv2oracle_,
        uint256 mintingFee_,
        uint256 cratio_
    )
    public
    returns(address conjure, address etherCollateral)
    {
        conjure = conjureImplementation.createClone();
        etherCollateral = etherCollateralImplementation.createClone();

        IConjure(conjure).initialize(
            name_,
            symbol_,
            owner_,
            address(this),
            indexedFinanceUniswapv2oracle_,
            etherCollateral
        );

        IEtherCollateral(etherCollateral).initialize(
            payable(conjure),
            owner_,
            address(this),
            mintingFee_,
            cratio_
        );

        emit NewConjure(conjure, etherCollateral);
    }

    /**
     * @dev gets the address of the current factory owner
     *
     * @return the address of the conjure router
    */
    function getConjureRouter() public view returns (address payable) {
        return conjureRouter;
    }

    /**
     * @dev lets the owner change the current conjure implementation
     *
     * @param conjureImplementation_ the address of the new implementation
    */
    function newConjureImplementation(address conjureImplementation_) public {
        require(msg.sender == factoryOwner, "Only factory owner");
        conjureImplementation = conjureImplementation_;
    }

    /**
     * @dev lets the owner change the current ethercollateral implementation
     *
     * @param etherCollateralImplementation_ the address of the new implementation
    */
    function newEtherCollateralImplementation(address etherCollateralImplementation_) public {
        require(msg.sender == factoryOwner, "Only factory owner");
        etherCollateralImplementation = etherCollateralImplementation_;
    }

    /**
     * @dev lets the owner change the current conjure router
     *
     * @param conjureRouter_ the address of the new router
    */
    function newConjureRouter(address payable conjureRouter_) public {
        require(msg.sender == factoryOwner, "Only factory owner");
        conjureRouter = conjureRouter_;
    }

    /**
     * @dev lets the owner change the ownership to another address
     *
     * @param newOwner the address of the new owner
    */
    function newFactoryOwner(address payable newOwner) public {
        require(msg.sender == factoryOwner, "Only factory owner");
        factoryOwner = newOwner;
        emit FactoryOwnerChanged(factoryOwner);
    }
}

interface IConjure {
    function initialize(
        string memory name_,
        string memory symbol_,
        address payable owner_,
        address factoryaddress_,
        address uniswapv2oracle,
        address collateralContract
    ) external;
}

interface IEtherCollateral {
    function initialize(
        address payable _asset,
        address _owner,
        address _factoryaddress,
        uint256 _mintingfeerate,
        uint256 _ratio
    )
    external;
}