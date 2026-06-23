# BeneficiaryRegistry.sol - Beneficiary Registration Function

## Smart Contract Overview
**Language:** Solidity ^0.8.19  
**Purpose:** Stores and manages beneficiary records on Ethereum blockchain  
**Location:** `contracts/BeneficiaryRegistry.sol`

---

## Contract Structure

### State Variables
```solidity
// Owner of the contract (deploying NGO address)
address public owner;

// Beneficiary data structure
struct Beneficiary {
    uint256 id;
    string  name;
    string  nationalId;   // Zimbabwe national ID number
    string  phone;
    string  location;     // District or ward e.g. "Gweru Ward 5"
    bool    registered;
    bool    active;
}

// Storage
mapping(uint256 => Beneficiary) public beneficiaries;
uint256[] public allIds;           // Track all IDs explicitly
uint256 public totalBeneficiaries;
```

### Events
```solidity
event BeneficiaryRegistered(
    uint256 indexed id,
    string  name,
    string  nationalId,
    string  phone,
    string  location
);

event BeneficiaryDeactivated(uint256 indexed id);
event BeneficiaryReactivated(uint256 indexed id);
```

---

## Core Function: registerBeneficiary

### Function Signature
```solidity
function registerBeneficiary(
    uint256 _id,
    string  memory _name,
    string  memory _nationalId,
    string  memory _phone,
    string  memory _location
) public onlyOwner
```

### Full Implementation
```solidity
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

    allIds.push(_id); // Store ID for enumeration
    totalBeneficiaries++;

    emit BeneficiaryRegistered(
        _id,
        _name,
        _nationalId,
        _phone,
        _location
    );
}
```

---

## Input Validation

### 1. Authorization Check
```solidity
public onlyOwner
```
**Enforces:** Only NGO administrator can register beneficiaries  
**Modifier:**
```solidity
modifier onlyOwner() {
    require(msg.sender == owner, "Only owner can call this");
    _;
}
```

### 2. Duplicate Prevention
```solidity
require(
    !beneficiaries[_id].registered,
    "ID already registered"
);
```
**Prevents:** Same beneficiary registered twice

### 3. Data Completeness
```solidity
require(bytes(_name).length > 0,       "Name cannot be empty");
require(bytes(_nationalId).length > 0, "National ID cannot be empty");
require(bytes(_phone).length > 0,      "Phone cannot be empty");
require(bytes(_location).length > 0,   "Location cannot be empty");
```
**Enforces:** All required fields must have values

---

## Storage Operations

### Create Beneficiary Struct
```solidity
beneficiaries[_id] = Beneficiary({
    id:          _id,
    name:        _name,
    nationalId:  _nationalId,
    phone:       _phone,
    location:    _location,
    registered:  true,
    active:      true
});
```
**Stores:** Full beneficiary record in mapping

### Track ID List
```solidity
allIds.push(_id);
```
**Purpose:** Enables enumeration of all beneficiaries

### Update Counter
```solidity
totalBeneficiaries++;
```
**Purpose:** Maintains count for statistics

---

## Event Emission

### Registration Event
```solidity
emit BeneficiaryRegistered(
    _id,
    _name,
    _nationalId,
    _phone,
    _location
);
```

**Benefits:**
- Immutable audit trail on blockchain
- Indexed by beneficiary ID for quick lookup
- Off-chain systems can listen for new registrations
- Enables blockchain explorers to display registration history

**Event Filtering Example:**
```javascript
// JavaScript/Web3.js
const events = await contract.getPastEvents('BeneficiaryRegistered', {
    filter: { id: 101 },  // Find registration of beneficiary 101
    fromBlock: 0,
    toBlock: 'latest'
});
```

---

## Supporting Functions

### Get Beneficiary Details
```solidity
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
```
**Use Case:** Retrieve beneficiary information during aid distribution

### Check Registration Status
```solidity
function isRegistered(uint256 _id)
    public view returns (bool)
{
    return beneficiaries[_id].registered;
}
```
**Use Case:** Verify beneficiary exists before processing

### Check Active Status
```solidity
function isActive(uint256 _id)
    public
    view
    beneficiaryExists(_id)
    returns (bool)
{
    return beneficiaries[_id].active;
}
```
**Use Case:** Ensure beneficiary is eligible for aid

### Deactivate Beneficiary
```solidity
function deactivateBeneficiary(uint256 _id)
    public
    onlyOwner
    beneficiaryExists(_id)
{
    require(
        beneficiaries[_id].active,
        "Already inactive"
    );
    beneficiaries[_id].active = false;
    emit BeneficiaryDeactivated(_id);
}
```
**Use Case:** Suspend/remove eligibility (e.g., fraud detection)

---

## Data Schema Example

### Registered Beneficiary Record
```json
{
  "id": 101,
  "name": "John Mwangi",
  "nationalId": "ZWE123456789",
  "phone": "+263775123456",
  "location": "Harare Ward 5",
  "registered": true,
  "active": true
}
```

### After 5 Registrations
```solidity
totalBeneficiaries = 5
allIds = [101, 102, 103, 104, 105]

beneficiaries[101] = { ... John Mwangi ... }
beneficiaries[102] = { ... Mary Dlamini ... }
beneficiaries[103] = { ... David Munihu ... }
beneficiaries[104] = { ... Sophia Makaro ... }
beneficiaries[105] = { ... Prophet Moyo ... }
```

---

## Gas Cost Analysis

| Operation | Gas (Approx) | Description |
|-----------|--------------|-------------|
| registerBeneficiary | 150,000 | Full registration with storage write |
| getBeneficiary | 5,000 | Read-only query |
| isRegistered | 3,000 | Simple state check |
| getTotal | 3,000 | Return counter value |

**Cost Optimization:** Uses array-based tracking instead of enumeration patterns for faster lookups.

---

## Integration with AidDistribution Contract

### Flow:
```
Dashboard Request
    ↓
Flask API /api/beneficiary/<id>
    ↓
Python calls BeneficiaryRegistry.isRegistered(_id)
    ↓
Smart Contract checks mapping[_id].registered == true
    ↓
Returns true/false to Flask
    ↓
Flask allows/rejects aid distribution
    ↓
If approved, calls AidDistribution.distribute_aid()
```

---

## Deployment

### Constructor
```solidity
function constructor() public {
    owner = msg.sender;
}
```
Automatically executed on deployment. Sets contract owner to deployer address (NGO wallet).

### Deployment Command (Truffle)
```bash
truffle migrate --network matic
```

### Post-Deployment
1. NGO administrator creates beneficiary records via blockchain transaction
2. Each registration costs gas and creates immutable record
3. Flask API queries contract off-chain (no transaction cost)
4. Aid distribution verified against registration data

---

## Security Features

1. **Owner-Only Registration:** Only NGO can add beneficiaries
2. **Immutable Records:** Blockchain prevents tampering
3. **Duplicate Prevention:** Cannot register same ID twice
4. **Data Validation:** All fields checked before storage
5. **Audit Trail:** Events log all registration changes
6. **Permanent History:** Records cannot be deleted, only deactivated
7. **On-Chain Verification:** No reliance on centralized database

---

## Beneficiary Lifecycle

```
NEW BENEFICIARY
    ↓
registerBeneficiary() called
    ├─ Validates all fields
    ├─ Checks authorization (owner only)
    ├─ Prevents duplicates
    └─ Stores on blockchain
    ↓
REGISTERED & ACTIVE
    ├─ Can receive aid distributions
    ├─ Duplicate prevention enforced
    └─ Can query beneficiary details
    ↓
Optional: deactivateBeneficiary()
    ├─ Marks as inactive
    └─ Can no longer receive aid
    ↓
PERMANENTLY ON BLOCKCHAIN
    └─ Full history retained for audit
```

---

## Example Registration Transaction

### Web3.js Call
```javascript
const tx = await contract.methods.registerBeneficiary(
    101,                          // Beneficiary ID
    "John Mwangi",               // Name
    "ZWE123456789",              // National ID
    "+263775123456",             // Phone
    "Harare Ward 5"              // Location
).send({
    from: ngoAdminAddress,
    gas: 200000,
    gasPrice: web3.utils.toWei('10', 'gwei')
});

console.log("Transaction Hash:", tx.transactionHash);
console.log("Block Number:", tx.blockNumber);
```

### Transaction Receipt
```json
{
  "status": true,
  "blockNumber": 12345,
  "transactionHash": "0x7f8d9e2c1a5b4d3e6f9a2b1c4d5e6f8a9b0c1d2",
  "gasUsed": 147832,
  "cumulativeGasUsed": 8934532,
  "events": {
    "BeneficiaryRegistered": {
      "id": "101",
      "name": "John Mwangi",
      "nationalId": "ZWE123456789",
      "phone": "+263775123456",
      "location": "Harare Ward 5"
    }
  }
}
```

---

## Key Features

1. **Immutable Registration:** Once registered, record exists permanently on blockchain
2. **Efficient Storage:** Uses mapping for O(1) lookup times
3. **Comprehensive Audit Trail:** All registrations logged via events
4. **Extensible Design:** Additional fields can be added via upgradeable patterns
5. **Multi-Recipient Support:** Stores names, IDs, phone, location all in one record
6. **Duplicate-Proof:** Cannot register same ID twice, even across cycles
