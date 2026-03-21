# ================================================================
#  sms.py — SMS Notification Service
#  Simulates SIM800L GSM module until hardware arrives
#  Updated to support all aid types (cash, food, goods etc)
#  Author: Motisha John Mafukashe — R2211825P
# ================================================================

import datetime

# ── In-memory SMS log (resets when server restarts) ───────────
SMS_LOG = []


# ── FUNCTION: Send SMS ────────────────────────────────────────
# aid_type and aid_unit have default values so old 4-param
# calls still work alongside new 6-param calls
def send_sms(phone: str, name: str, amount,
             tx_hash: str, aid_type: str = "CASH",
             aid_unit: str = "USD") -> dict:

    # ── Build message based on aid type ───────────────────────
    if aid_type.upper() == "CASH":
        item_desc = f"USD ${float(amount):.2f}"
    else:
        item_desc = f"{amount} {aid_unit} of {aid_type}"

    message = (
        f"Dear {name}, you have received {item_desc} "
        f"as humanitarian aid. "
        f"Ref: {str(tx_hash)[:10]}... "
        f"Blockchain Aid System Zimbabwe."
    )

    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # ── Log entry ─────────────────────────────────────────────
    log_entry = {
        "to"       : phone,
        "name"     : name,
        "aid_type" : aid_type.upper(),
        "aid_unit" : aid_unit.upper(),
        "amount"   : amount,
        "message"  : message,
        "tx_hash"  : str(tx_hash)[:20],
        "timestamp": timestamp,
        "status"   : "SENT (simulated)"
    }

    SMS_LOG.append(log_entry)

    # ── Print to console (visible in Flask CMD window) ────────
    print(f"\n[SMS] ─────────────────────────────────────")
    print(f"[SMS] To       : {phone}")
    print(f"[SMS] Name     : {name}")
    print(f"[SMS] Aid Type : {aid_type.upper()}")
    print(f"[SMS] Amount   : {amount} {aid_unit.upper()}")
    print(f"[SMS] Message  : {message}")
    print(f"[SMS] Time     : {timestamp}")
    print(f"[SMS] Status   : SENT (simulation mode)")
    print(f"[SMS] ─────────────────────────────────────\n")

    return {
        "success" : True,
        "to"      : phone,
        "message" : message,
        "status"  : "SIMULATED"
    }


# ── FUNCTION: Send auth failure alert ─────────────────────────
def send_failure_alert(officer_phone: str, attempts: int) -> dict:

    message = (
        f"ALERT: {attempts} failed authentication "
        f"attempts detected on your field device. "
        f"Session has been locked. "
        f"Blockchain Aid System Zimbabwe."
    )

    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    log_entry = {
        "to"       : officer_phone,
        "message"  : message,
        "timestamp": timestamp,
        "status"   : "ALERT (simulated)"
    }

    SMS_LOG.append(log_entry)

    print(f"\n[SMS] ALERT ────────────────────────────────")
    print(f"[SMS] To      : {officer_phone}")
    print(f"[SMS] Message : {message}")
    print(f"[SMS] Time    : {timestamp}")
    print(f"[SMS] ─────────────────────────────────────\n")

    return {"success": True, "message": message}


# ── FUNCTION: Get full SMS log ────────────────────────────────
def get_sms_log() -> list:
    return SMS_LOG


# ── FUNCTION: Clear SMS log ───────────────────────────────────
def clear_sms_log() -> dict:
    SMS_LOG.clear()
    return {"success": True, "message": "SMS log cleared"}


# ================================================================
#  HARDWARE IMPLEMENTATION
#  Uncomment and use this when SIM800L hardware arrives
#  Replace the send_sms function body with this block
#  Connect SIM800L: GPIO4(RX1) <- SIM TX, GPIO2(TX1) -> SIM RX
# ================================================================
# def send_sms_hardware(phone: str, message: str) -> dict:
#     import serial
#     try:
#         gsm = serial.Serial(
#             port     = 'COM3',    # Change to your actual COM port
#             baudrate = 9600,
#             timeout  = 1
#         )
#         gsm.write(b'AT\r\n')                              ; time.sleep(0.3)
#         gsm.write(b'ATE0\r\n')                            ; time.sleep(0.3)
#         gsm.write(b'AT+CMGF=1\r\n')                      ; time.sleep(0.3)
#         gsm.write(f'AT+CMGS="{phone}"\r\n'.encode())     ; time.sleep(0.3)
#         gsm.write(message.encode())
#         gsm.write(bytes([26]))                            ; time.sleep(1.0)
#         response = gsm.read(gsm.in_waiting).decode()
#         gsm.close()
#         if "+CMGS" in response or "OK" in response:
#             return {"success": True, "message": message}
#         return {"success": False, "error": response}
#     except Exception as e:
#         return {"success": False, "error": str(e)}