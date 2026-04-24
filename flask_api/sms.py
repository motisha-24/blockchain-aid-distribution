# ================================================================
#  sms.py - Hardware SMS Audit Log
#  Flask does not send beneficiary SMS. The ESP32 + SIM800L handle
#  real delivery, while Flask stores log entries for dashboards.
# ================================================================

import datetime

SMS_LOG = []


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
