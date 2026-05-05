
import requests
import json

# ---------------------------------------------------------
# SIMGATE CONFIGURATION (From your screenshot)
# ---------------------------------------------------------
API_KEY = "6380835e-445d-409b-bab6-269b49c9e8ee"
DEVICE_ID = "android-c7a7e69879c8d759" 
ENDPOINT = "https://api.simgate.app/v1/sms/send"

# Change this to YOUR phone number to receive the test
TEST_RECEIVER = "+263785813135" 
# ---------------------------------------------------------

def test_simgate():
    headers = {
        "x-api-key": API_KEY,
        "Content-Type": "application/json"
    }
    
    payload = {
        "deviceId": DEVICE_ID,
        "phoneNumber": TEST_RECEIVER,
        "message": "Hello! This is a test from the AidChain system via SimGate Cloud Gateway."
    }

    try:
        print(f"Sending SimGate request for {TEST_RECEIVER}...")
        response = requests.post(ENDPOINT, headers=headers, json=payload, timeout=15)
        
        print("-" * 30)
        print(f"Status Code: {response.status_code}")
        print(f"Response:    {response.text}")
        print("-" * 30)
        
        if response.status_code == 200 or response.status_code == 201:
            print("SUCCESS! Check your phone, the message should be sent shortly.")
        else:
            print("FAILED. Check your API key or Device ID on the SimGate dashboard.")
            
    except Exception as e:
        print(f"ERROR: {str(e)}")

if __name__ == "__main__":
    test_simgate()
