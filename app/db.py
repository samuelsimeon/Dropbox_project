from pymongo import MongoClient
from dotenv import load_dotenv
import os

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")
DATABASE_NAME = os.getenv("DATABASE_NAME", "cloud_assignment")

client = MongoClient(MONGODB_URI)
db = client[DATABASE_NAME]