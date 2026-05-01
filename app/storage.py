import os
from dotenv import load_dotenv
from azure.storage.blob import BlobServiceClient

# Load environment variables from the .env file
# This is used to get the Azurite connection string and container name
load_dotenv()

# Read the Azurite connection settings from environment variables
AZURITE_CONNECTION_STRING = os.getenv("AZURITE_CONNECTION_STRING")
AZURITE_CONTAINER_NAME = os.getenv("AZURITE_CONTAINER_NAME", "files")

# Stop the app early if the connection string is missing
# because blob storage cannot work without it
if not AZURITE_CONNECTION_STRING:
    raise ValueError("AZURITE_CONNECTION_STRING is not set in the .env file")

# Create the main blob service client used to connect to Azurite
# The API version is set explicitly to match Azurite compatibility
blob_service_client = BlobServiceClient.from_connection_string(
    AZURITE_CONNECTION_STRING,
    api_version="2023-11-03"
)

# Get a client for the specific container where uploaded files will be stored
container_client = blob_service_client.get_container_client(AZURITE_CONTAINER_NAME)

# Try to create the container if it does not already exist
# If it already exists, the exception is ignored
try:
    container_client.create_container()
except Exception:
    pass