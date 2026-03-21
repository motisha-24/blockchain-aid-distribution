// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// ================================================================
//  BeneficiaryRegistry.sol
//  Stores and manages registered beneficiaries on the blockchain
//  Supports cash, food, goods and agricultural aid distribution
//  Author: Motisha John Mafukashe — R2211825P
// ================================================================

contract BeneficiaryRegistry {

    // ── Owner of the contract (deploying NGO address) ────────
    address public owner;

    // ── Beneficiary data structure ───────────────────────────
    struct Beneficiary {
        uint256 id;
        string  name;
        string  nationalId;   // Zimbabwe national ID number
        string  phone;
        string  location;     // District or ward e.g. "Gweru Ward 5"
        bool    registered;
        bool    active;
    }

    // ── Storage ──────────────────────────────────────────────
    mapping(uint256 => Beneficiary) public beneficiaries;
    uint256 public totalBeneficiaries;

    // ── Events ───────────────────────────────────────────────
    event BeneficiaryRegistered(
        uint256 indexed id,
        string  name,
        string  nationalId,
        string  phone,
        string  location
    );

    event BeneficiaryDeactivated(uint256 indexed id);
    event BeneficiaryReactivated(uint256 indexed id);

    // ── Access control ───────────────────────────────────────
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this");
        _;
    }

    modifier beneficiaryExists(uint256 _id) {
        require(
            beneficiaries[_id].registered,
            "Beneficiary not registered"
        );
        _;
    }

    // ── Constructor ──────────────────────────────────────────
    constructor() {
        owner = msg.sender;
    }

    // ── Register a new beneficiary ───────────────────────────
    function registerBeneficiary(
        uint256 _id,
        string  memory _name,
        string  memory _nationalId,
        string  memory _phone,
        string  memory _location
    ) public onlyOwner {

        require(
            !beneficiaries[_id].registered,
            "ID already registered"
        );
        require(bytes(_name).length > 0,       "Name cannot be empty");
        require(bytes(_nationalId).length > 0, "National ID cannot be empty");
        require(bytes(_phone).length > 0,      "Phone cannot be empty");
        require(bytes(_location).length > 0,   "Location cannot be empty");

        beneficiaries[_id] = Beneficiary({
            id:          _id,
            name:        _name,
            nationalId:  _nationalId,
            phone:       _phone,
            location:    _location,
            registered:  true,
            active:      true
        });

        totalBeneficiaries++;

        emit BeneficiaryRegistered(
            _id,
            _name,
            _nationalId,
            _phone,
            _location
        );
    }

    // ── Get beneficiary details ──────────────────────────────
    function getBeneficiary(uint256 _id)
        public
        view
        beneficiaryExists(_id)
        returns (
            string memory name,
            string memory nationalId,
            string memory phone,
            string memory location,
            bool   active
        )
    {
        Beneficiary memory b = beneficiaries[_id];
        return (
            b.name,
            b.nationalId,
            b.phone,
            b.location,
            b.active
        );
    }

    // ── Check if beneficiary is registered ───────────────────
    function isRegistered(uint256 _id)
        public view returns (bool)
    {
        return beneficiaries[_id].registered;
    }

    // ── Check if beneficiary is active ───────────────────────
    function isActive(uint256 _id)
        public
        view
        beneficiaryExists(_id)
        returns (bool)
    {
        return beneficiaries[_id].active;
    }

    // ── Deactivate a beneficiary ─────────────────────────────
    function deactivateBeneficiary(uint256 _id)
        public
        onlyOwner
        beneficiaryExists(_id)
    {
        require(
            beneficiaries[_id].active,
            "Beneficiary already deactivated"
        );
        beneficiaries[_id].active = false;
        emit BeneficiaryDeactivated(_id);
    }

    // ── Reactivate a beneficiary ─────────────────────────────
    function reactivateBeneficiary(uint256 _id)
        public
        onlyOwner
        beneficiaryExists(_id)
    {
        require(
            !beneficiaries[_id].active,
            "Beneficiary is already active"
        );
        beneficiaries[_id].active = true;
        emit BeneficiaryReactivated(_id);
    }

    // ── Get total registered beneficiaries ───────────────────
    function getTotalBeneficiaries()
        public view returns (uint256)
    {
        return totalBeneficiaries;
    }
    // ── Get all registered beneficiary IDs ───────────────────
// Returns array of all IDs ever registered
// Frontend uses these to fetch full details one by one
function getAllIds()
    public view returns (uint256[] memory)
{
    uint256[] memory ids = new uint256[](totalBeneficiaries);
    uint256 count = 0;
    // Note: this works because IDs are sequential from 1
    // In production use a more robust enumeration pattern
    for (uint256 i = 1; i <= totalBeneficiaries + 50; i++) {
        if (beneficiaries[i].registered && count < totalBeneficiaries) {
            ids[count] = i;
            count++;
        }
    }
    return ids;
}
}