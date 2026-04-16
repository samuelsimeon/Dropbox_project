import os
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, auth
from fastapi import Header, HTTPException, Depends

load_dotenv()

FIREBASE_SERVICE_ACCOUNT_PATH = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")

if not FIREBASE_SERVICE_ACCOUNT_PATH:
    raise ValueError("FIREBASE_SERVICE_ACCOUNT_PATH is not set in the .env file")

if not firebase_admin._apps:
    cred = credentials.Certificate(FIREBASE_SERVICE_ACCOUNT_PATH)
    firebase_admin.initialize_app(cred)


def verify_firebase_token(id_token: str):
    try:
        decoded_token = auth.verify_id_token(id_token)
        return decoded_token
    except Exception:
        return None


def get_current_user(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")

    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header format")

    id_token = authorization.split("Bearer ")[1].strip()

    decoded_token = verify_firebase_token(id_token)

    if not decoded_token:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return decoded_token