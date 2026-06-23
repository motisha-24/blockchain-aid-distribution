
import requests
import json

# ---------------------------------------------------------
# CONFIGURATION
# ---------------------------------------------------------
# 1. CHANGE THIS to the IP address shown on your phone app
# Example: "http://192.168.1.10:8080/"
GATEWAY_URL = "http://192.168.1.136:8082/" 

# 2. CHANGE THIS to the phone number you want to receive the test
TEST_RECEIVER = "+263785813135"
# ---------------------------------------------------------

payload = {
    "to": TEST_RECEIVER,
    "message": "Hello! This is a test from the AidChain SMS Gateway using your phone line."
}

def test_gateway():
    if "YOUR_PHONE_IP" in GATEWAY_URL:
        print("ERROR: Please edit the GATEWAY_URL in this script with the IP shown on your phone.")
        return

    try:
        print(f"Attempting to send SMS to {TEST_RECEIVER} via {GATEWAY_URL}...")
        
        # The app expects a POST request with a JSON body
        response = requests.post(GATEWAY_URL, json=payload, timeout=10)
        
        print("-" * 30)
        print(f"HTTP Status: {response.status_code}")
        print(f"Response:    {response.text}")
        print("-" * 30)
        
        if response.status_code == 200:
            print("SUCCESS! Your phone should be sending the message now.")
        else:
            print("FAILED. Check if the app is running and the IP is correct.")
            
    except requests.exceptions.Timeout:
        print("ERROR: Connection timed out. Are your phone and computer on the same WiFi?")
    except Exception as e:
        print(f"ERROR: {str(e)}")

if __name__ == "__main__":
    test_gateway()
