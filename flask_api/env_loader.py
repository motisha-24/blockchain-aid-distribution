import os
from dotenv import dotenv_values

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT_ENV_PATH = os.path.join(BASE_DIR, ".env")
LOCAL_ENV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")

ROOT_ENV = dotenv_values(ROOT_ENV_PATH)
LOCAL_ENV = dotenv_values(LOCAL_ENV_PATH)


def get_setting(*names, default=None, prefer="root"):
    for name in names:
        value = os.getenv(name)
        if value not in (None, ""):
            return value

    sources = (ROOT_ENV, LOCAL_ENV) if prefer == "root" else (LOCAL_ENV, ROOT_ENV)
    for name in names:
        for source in sources:
            value = source.get(name)
            if value not in (None, ""):
                return value

    return default
