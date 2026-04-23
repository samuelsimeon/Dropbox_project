import os
from dotenv import load_dotenv
from azure.storage.blob import BlobServiceClient

load_dotenv()

AZURITE_CONNECTION_STRING = os.getenv("AZURITE_CONNECTION_STRING")
AZURITE_CONTAINER_NAME = os.getenv("AZURITE_CONTAINER_NAME", "files")

if not AZURITE_CONNECTION_STRING:
    raise ValueError("AZURITE_CONNECTION_STRING is not set in the .env file")

blob_service_client = BlobServiceClient.from_connection_string(
    AZURITE_CONNECTION_STRING,
    api_version="2023-11-03"
)

container_client = blob_service_client.get_container_client(AZURITE_CONTAINER_NAME)

try:
    container_client.create_container()
except Exception:
    pass