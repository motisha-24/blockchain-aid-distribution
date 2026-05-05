import datetime
import requests
import json
from env_loader import get_setting

SMS_LOG = []

def trigger_simgate_sms(phone: str, message: str) -> dict:
    """
    Fallback function: Sends SMS via SimGate Cloud Gateway if hardware fails.
    """
    api_key = get_setting("SIMGATE_API_KEY")
    device_id = get_setting("SIMGATE_DEVICE_ID")
    endpoint = "https://api.simgate.app/v1/sms/send"

    if not api_key or not device_id:
        return {"success": False, "error": "SimGate credentials missing in .env"}

    headers = {
        "x-api-key": api_key,
        "Content-Type": "application/json"
    }
    
    payload = {
        "deviceId": device_id,
        "phoneNumber": phone,
        "message": message
    }

    try:
        response = requests.post(endpoint, headers=headers, json=payload, timeout=15)
        if response.status_code in [200, 201]:
            log_sms_event(phone, message, status="SENT_VIA_GATEWAY", metadata={"gateway": "SimGate"})
            return {"success": True, "message": "Sent via SimGate fallback"}
        else:
            log_sms_event(phone, message, status="GATEWAY_FAILED", metadata={"error": response.text})
            return {"success": False, "error": response.text}
    except Exception as e:
        log_sms_event(phone, message, status="GATEWAY_ERROR", metadata={"error": str(e)})
        return {"success": False, "error": str(e)}

def log_sms_event(phone: str, message: str, status: str = "SENT",
                  metadata: dict | None = None) -> dict:
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_entry = {
        "to": phone,
        "message": message,
        "timestamp": timestamp,
        "status": status
    }

    if metadata:
        log_entry.update(metadata)

    SMS_LOG.append(log_entry)

    print("\n[SMS-LOG] -------------------------------------")
    print(f"[SMS-LOG] To      : {phone}")
    print(f"[SMS-LOG] Status  : {status}")
    print(f"[SMS-LOG] Message : {message}")
    print(f"[SMS-LOG] Time    : {timestamp}")
    print("[SMS-LOG] -------------------------------------\n")

    return {"success": True, "logged": True, "status": status}


def send_failure_alert(officer_phone: str, attempts: int) -> dict:
    message = (
        f"ALERT: {attempts} failed authentication attempts detected on "
        f"your field device. Session has been locked."
    )
    return log_sms_event(
        officer_phone,
        message,
        status="ALERT",
        metadata={"attempts": attempts}
    )


def get_sms_log() -> list:
    return SMS_LOG


def clear_sms_log() -> dict:
    SMS_LOG.clear()
    return {"success": True, "message": "SMS log cleared"}
