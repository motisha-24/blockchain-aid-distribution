#!/usr/bin/env python
"""
Diagnostic script to check blockchain connectivity and contract status
"""
import json
import os
import sys
from web3 import Web3
from dotenv import load_dotenv

load_dotenv()

MODE = os.getenv("MODE", "LOCAL")
if MODE == "LOCAL":
    RPC_URL = os.getenv("LOCAL_RPC")
    REGISTRY = os.getenv("LOCAL_REGISTRY_ADDRESS")
    AID = os.getenv("LOCAL_AID_ADDRESS")
    PRIVATE_KEY = os.getenv("LOCAL_PRIVATE_KEY")
else:
    RPC_URL = os.getenv("INFURA_URL")
    REGISTRY = os.getenv("CLOUD_REGISTRY_ADDRESS")
    AID = os.getenv("CLOUD_AID_ADDRESS")
    PRIVATE_KEY = os.getenv("PRIVATE_KEY")

print("=" * 60)
print("  AidChain Blockchain Diagnostics")
print("=" * 60)
print(f"\n📍 MODE: {MODE}")
print(f"🌐 RPC URL: {RPC_URL}")
print(f"📝 Registry: {REGISTRY}")
print(f"💰 Aid Contract: {AID}")

# Test Web3 connection
print("\n[1/5] Testing Web3 Connection...")
try:
    w3 = Web3(Web3.HTTPProvider(RPC_URL))
    if w3.is_connected():
        print("  ✅ Connected to blockchain node")
    else:
        print("  ❌ NOT connected - Ganache might not be running")
        print("  💡 Start Ganache with: npx ganache-cli --port 7545")
        sys.exit(1)
except Exception as e:
    print(f"  ❌ Connection error: {e}")
    sys.exit(1)

# Check wallet
print("\n[2/5] Checking Wallet...")
try:
    account = w3.eth.account.from_key(PRIVATE_KEY)
    balance = w3.eth.get_balance(account.address)
    balance_eth = w3.from_wei(balance, 'ether')
    print(f"  ✅ Wallet: {account.address}")
    print(f"  ✅ Balance: {balance_eth} ETH")
except Exception as e:
    print(f"  ❌ Wallet error: {e}")
    sys.exit(1)

# Check registry contract
print("\n[3/5] Checking BeneficiaryRegistry Contract...")
try:
    registry_code = w3.eth.get_code(Web3.to_checksum_address(REGISTRY))
    if registry_code == b'':
        print(f"  ❌ No contract at {REGISTRY}")
        print("  💡 Run: npm run deploy:local")
    else:
        print(f"  ✅ Contract found at {REGISTRY}")
        print(f"  📊 Code size: {len(registry_code)} bytes")
except Exception as e:
    print(f"  ❌ Error: {e}")

# Check aid distribution contract
print("\n[4/5] Checking AidDistribution Contract...")
try:
    aid_code = w3.eth.get_code(Web3.to_checksum_address(AID))
    if aid_code == b'':
        print(f"  ❌ No contract at {AID}")
        print("  💡 Run: npm run deploy:local")
    else:
        print(f"  ✅ Contract found at {AID}")
        print(f"  📊 Code size: {len(aid_code)} bytes")
except Exception as e:
    print(f"  ❌ Error: {e}")

# Test contract ABI loading
print("\n[5/5] Checking Contract ABIs...")
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD_DIR = os.path.join(BASE_DIR, "build", "contracts")

try:
    registry_abi_path = os.path.join(BUILD_DIR, "BeneficiaryRegistry.json")
    with open(registry_abi_path) as f:
        registry_artifact = json.load(f)
    print(f"  ✅ BeneficiaryRegistry ABI loaded ({len(registry_artifact['abi'])} methods)")
except Exception as e:
    print(f"  ❌ Registry ABI Error: {e}")

try:
    aid_abi_path = os.path.join(BUILD_DIR, "AidDistribution.json")
    with open(aid_abi_path) as f:
        aid_artifact = json.load(f)
    print(f"  ✅ AidDistribution ABI loaded ({len(aid_artifact['abi'])} methods)")
except Exception as e:
    print(f"  ❌ Aid ABI Error: {e}")

print("\n" + "=" * 60)
print("  Diagnostics Complete!")
print("=" * 60)
