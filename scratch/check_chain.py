import sys
import os
sys.path.append(os.path.join(os.getcwd(), "flask_api"))

from blockchain import w3, account
from config import RPC_URL, REGISTRY_ADDRESS, AID_ADDRESS, PRIVATE_KEY, CHAIN_ID

if w3.is_connected():
    print(f"Connected to blockchain: {RPC_URL}")
    balance = w3.eth.get_balance(account.address)
    print(f"Account: {account.address}")
    print(f"Balance: {w3.from_wei(balance, 'ether')} ETH")
    print(f"Nonce (confirmed): {w3.eth.get_transaction_count(account.address)}")
    print(f"Nonce (pending): {w3.eth.get_transaction_count(account.address, 'pending')}")
    print(f"Registry: {REGISTRY_ADDRESS}")
    print(f"Aid: {AID_ADDRESS}")
else:
    print("Not connected to blockchain")
