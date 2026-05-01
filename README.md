# Cloud Dropbox Assignment

A simplified Dropbox-style cloud storage web application built with **FastAPI**, **MongoDB Atlas**, **Firebase Authentication**, and **Azurite**.

## Features

- User registration and login with Firebase Authentication
- Create folders and subfolders
- Upload and download files
- Navigate through directory structures
- Share files with other users by email
- Move files to Trash and restore them
- Permanently delete files from Trash
- Prevent deletion of folders that still contain files or subfolders
- Detect duplicate files using hashing
- Detect duplicates across a user’s full Dropbox and display matching paths

## Technologies Used

- **FastAPI** for the backend web framework
- **MongoDB Atlas** for metadata storage
- **Firebase Authentication** for user management
- **Azurite** as the Azure Blob Storage emulator
- **HTML, CSS, JavaScript** for the frontend

## How the System Works

The application uses Firebase Authentication for account creation and login. After a user logs in, the frontend sends their Firebase token with requests to the FastAPI backend. The backend verifies the token and uses the user ID to manage folders, files, sharing, and duplicate detection.

MongoDB Atlas stores metadata such as:
- folder names and parent-child folder relationships
- file information such as filename, folder location, file size, and hash
- sharing records between users
- deleted file state for the Trash feature

Azurite stores the actual uploaded file contents as blobs.

## Project Setup

### 1. Open the project folder

Open the project in VS Code or terminal.

### 2. Create and activate a virtual environment

```bash
python3 -m venv venv
source venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

## Environment Variables

Create a `.env` file in the project root and add:

```env
MONGODB_URI=mongodb_atlas_connection_string
DATABASE_NAME=CloudDropboxAssignment

AZURITE_CONNECTION_STRING=UseDevelopmentStorage=true
AZURITE_CONTAINER_NAME=files
```

You will also need your Firebase Admin SDK JSON key file saved in the project and referenced by your backend authentication setup.

## External Services Setup

### MongoDB Atlas
- Create a MongoDB Atlas cluster
- Create a database user
- Add IP address to the Atlas Network Access list
- Copy the MongoDB connection string into `.env`

### Firebase Authentication
- Create a Firebase project
- Enable **Email/Password** authentication
- Download the Firebase Admin SDK service account JSON file
- Add your Firebase frontend config to the frontend config file

### Azurite
Install Azurite globally if not already installed:

```bash
npm install -g azurite
```

Start Azurite in a separate terminal:

```bash
azurite
```

## Running the Application

Make sure:
- the virtual environment is activated
- Azurite is running
- the `.env` file is correctly configured

Then start the FastAPI server:

```bash
python -m uvicorn app.main:app --reload --reload-dir app
```

Open the app in the browser at:

```text
http://127.0.0.1:8000
```

## How to Use

1. Register a new account or log in
2. Create folders in the main file area
3. Open folders to navigate into them
4. Upload files to the current folder
5. Download or share files
6. Delete files to move them to Trash
7. Restore or permanently delete files from Trash
8. Use the Duplicates section to view matching files across the full Dropbox

## Notes

- A folder can only be deleted if it is empty
- Duplicate uploads in the same folder are blocked using file hashing
- Duplicate files across the user’s Dropbox are displayed in the Duplicates view
- Files shared with another user can be accessed from the Sharing section



