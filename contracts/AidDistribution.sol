// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./BeneficiaryRegistry.sol";

// ================================================================
//  AidDistribution.sol
//  Records every aid distribution transaction immutably
//  Supports cash, food, goods and agricultural inputs
//  e.g. CASH(USD), MAIZE(KG), OIL(LITRES), SEEDS(PACKETS),
//       CLOTHES(UNITS), FERTILISER(KG), BLANKETS(UNITS)
//  Prevents duplicate collection per aid type per cycle
//  Author: Motisha John Mafukashe — R2211825P
// ================================================================

contract AidDistribution {

    // ── Owner and registry reference ─────────────────────────
    address public owner;
    BeneficiaryRegistry public registry;

    // ── Current distribution cycle ───────────────────────────
    uint256 public currentCycle;

    // ── Transaction record structure ─────────────────────────
    struct Transaction {
        uint256 txId;
        uint256 beneficiaryId;
        uint256 amount;
        string  aidType;       // CASH, MAIZE, OIL, SEEDS, CLOTHES etc
        string  aidUnit;       // USD, KG, LITRES, PACKETS, UNITS etc
        string  location;      // Distribution point e.g. "Gweru Ward 5"
        uint256 timestamp;
        uint256 cycle;
        address officerAddress;
        string  status;
    }

    // ── Storage ──────────────────────────────────────────────
    mapping(uint256 => Transaction) public transactions;
    uint256 public txCount;

    // ── Duplicate guard ──────────────────────────────────────
    // beneficiaryId => cycle => aidType => collected?
    // Allows same beneficiary to receive MAIZE and CASH
    // in the same cycle but NOT MAIZE twice
    mapping(uint256 =>
        mapping(uint256 =>
            mapping(string => bool)
        )
    ) public hasCollected;

    // ── Authorised field officers ─────────────────────────────
    mapping(address => bool) public authorisedOfficers;

    // ── Events ───────────────────────────────────────────────
    event AidDistributed(
        uint256 indexed txId,
        uint256 indexed beneficiaryId,
        uint256 amount,
        string  aidType,
        string  aidUnit,
        string  location,
        uint256 timestamp,
        uint256 cycle,
        address officer
    );

    event DuplicateAttempt(
        uint256 indexed beneficiaryId,
        string  aidType,
        uint256 cycle,
        address officer
    );

    event OfficerAuthorised(address indexed officer);
    event OfficerRevoked(address indexed officer);
    event CycleAdvanced(uint256 newCycle);

    // ── Access control modifiers ──────────────────────────────
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner allowed");
        _;
    }

    modifier onlyOfficer() {
        require(
            authorisedOfficers[msg.sender],
            "Not an authorised officer"
        );
        _;
    }

    // ── Constructor ──────────────────────────────────────────
    constructor(address _registryAddress) {
        owner    = msg.sender;
        registry = BeneficiaryRegistry(_registryAddress);
        currentCycle = 1;
        authorisedOfficers[msg.sender] = true;
    }

    // ── Authorise a field officer ─────────────────────────────
    function authoriseOfficer(address _officer)
        public onlyOwner
    {
        authorisedOfficers[_officer] = true;
        emit OfficerAuthorised(_officer);
    }

    // ── Revoke a field officer ────────────────────────────────
    function revokeOfficer(address _officer)
        public onlyOwner
    {
        authorisedOfficers[_officer] = false;
        emit OfficerRevoked(_officer);
    }

    // ================================================================
    //  CORE FUNCTION: Distribute aid
    //  Called by Flask API after fingerprint authentication
    //  _amount meaning depends on aid type:
    //    CASH        → amount in USD cents  e.g. 5000 = $50.00
    //    MAIZE       → amount in KG         e.g. 50   = 50 KG
    //    OIL         → amount in LITRES     e.g. 5    = 5 litres
    //    SEEDS       → amount in PACKETS    e.g. 3    = 3 packets
    //    CLOTHES     → amount in UNITS      e.g. 2    = 2 items
    //    FERTILISER  → amount in KG         e.g. 25   = 25 KG
    //    BLANKETS    → amount in UNITS      e.g. 1    = 1 blanket
    // ================================================================
    function distribute(
        uint256 _beneficiaryId,
        uint256 _amount,
        string memory _aidType,
        string memory _aidUnit,
        string memory _location
    ) public onlyOfficer returns (uint256) {

        // ── Input validation ──────────────────────────────────
        require(_amount > 0,
            "Amount must be greater than zero");
        require(bytes(_aidType).length > 0,
            "Aid type cannot be empty");
        require(bytes(_aidUnit).length > 0,
            "Aid unit cannot be empty");
        require(bytes(_location).length > 0,
            "Location cannot be empty");

        // ── Beneficiary checks ────────────────────────────────
        require(
            registry.isRegistered(_beneficiaryId),
            "Beneficiary not registered"
        );
        require(
            registry.isActive(_beneficiaryId),
            "Beneficiary account is deactivated"
        );

        // ── Duplicate check per aid type per cycle ────────────
        // A beneficiary CAN receive both MAIZE and CASH in cycle 1
        // A beneficiary CANNOT receive MAIZE twice in cycle 1
        if (hasCollected[_beneficiaryId][currentCycle][_aidType]) {
            emit DuplicateAttempt(
                _beneficiaryId,
                _aidType,
                currentCycle,
                msg.sender
            );
            revert("DUPLICATE: Already received this aid type this cycle");
        }

        // ── Record transaction ────────────────────────────────
        txCount++;
        transactions[txCount] = Transaction({
            txId:           txCount,
            beneficiaryId:  _beneficiaryId,
            amount:         _amount,
            aidType:        _aidType,
            aidUnit:        _aidUnit,
            location:       _location,
            timestamp:      block.timestamp,
            cycle:          currentCycle,
            officerAddress: msg.sender,
            status:         "CONFIRMED"
        });

        // ── Mark as collected for this aid type this cycle ────
        hasCollected[_beneficiaryId][currentCycle][_aidType] = true;

        // ── Emit event to blockchain ──────────────────────────
        emit AidDistributed(
            txCount,
            _beneficiaryId,
            _amount,
            _aidType,
            _aidUnit,
            _location,
            block.timestamp,
            currentCycle,
            msg.sender
        );

        return txCount;
    }

    // ── Get full transaction details ──────────────────────────
    function getTransaction(uint256 _txId)
        public view
        returns (
            uint256 beneficiaryId,
            uint256 amount,
            string  memory aidType,
            string  memory aidUnit,
            string  memory location,
            uint256 timestamp,
            uint256 cycle,
            address officer,
            string  memory status
        )
    {
        Transaction memory t = transactions[_txId];
        require(t.txId != 0, "Transaction does not exist");
        return (
            t.beneficiaryId,
            t.amount,
            t.aidType,
            t.aidUnit,
            t.location,
            t.timestamp,
            t.cycle,
            t.officerAddress,
            t.status
        );
    }

    // ── Check if beneficiary received specific aid this cycle ─
    function hasCollectedThisCycle(
        uint256 _beneficiaryId,
        string memory _aidType
    ) public view returns (bool) {
        return hasCollected[_beneficiaryId][currentCycle][_aidType];
    }

    // ── Get all aid types collected by beneficiary this cycle ─
    function getCollectionStatus(
        uint256 _beneficiaryId,
        string[] memory _aidTypes
    ) public view returns (bool[] memory) {
        bool[] memory status = new bool[](_aidTypes.length);
        for (uint256 i = 0; i < _aidTypes.length; i++) {
            status[i] = hasCollected
                [_beneficiaryId][currentCycle][_aidTypes[i]];
        }
        return status;
    }

    // ── Advance to next distribution cycle ───────────────────
    function advanceCycle() public onlyOwner {
        currentCycle++;
        emit CycleAdvanced(currentCycle);
    }

    // ── Get total transactions on blockchain ──────────────────
    function getTotalTransactions() public view returns (uint256) {
        return txCount;
    }

    // ── Get current cycle number ──────────────────────────────
    function getCurrentCycle() public view returns (uint256) {
        return currentCycle;
    }
}