import {
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth } from "/static/js/firebase-config.js";

const logoutBtn = document.getElementById("logout-btn");
const navRootBtn = document.getElementById("nav-root-btn");
const navSharedBtn = document.getElementById("nav-shared-btn");
const backBtn = document.getElementById("back-btn");
const goRootBtn = document.getElementById("go-root-btn");
const refreshBtn = document.getElementById("refresh-btn");
const createFolderBtn = document.getElementById("create-folder-btn");
const uploadFileBtn = document.getElementById("upload-file-btn");
const loadSharedBtn = document.getElementById("load-shared-btn");

const folderNameInput = document.getElementById("folder-name");
const fileInput = document.getElementById("file-input");

const userEmailDisplay = document.getElementById("user-email-display");
const pathDisplay = document.getElementById("path-display");
const foldersGrid = document.getElementById("folders-grid");
const filesGrid = document.getElementById("files-grid");
const sharedFilesGrid = document.getElementById("shared-files-grid");
const output = document.getElementById("output");

const explorerSection = document.getElementById("explorer-section");
const sharedSection = document.getElementById("shared-section");

let currentUser = null;
let currentIdToken = null;
let currentFolderId = null;
let folderHistory = [];
let folderPathNames = ["Root"];

function setOutput(data) {
  output.textContent = JSON.stringify(data, null, 2);
}

async function authHeaders() {
  if (!currentUser) {
    throw new Error("You must log in first.");
  }

  currentIdToken = await currentUser.getIdToken();

  return {
    Authorization: `Bearer ${currentIdToken}`
  };
}

function updatePathDisplay() {
  pathDisplay.textContent = folderPathNames.join(" / ");
}

function setActiveNav(which) {
  navRootBtn.classList.remove("active");
  navSharedBtn.classList.remove("active");

  if (which === "root") {
    navRootBtn.classList.add("active");
    explorerSection.classList.remove("hidden");
    sharedSection.classList.add("hidden");
  } else {
    navSharedBtn.classList.add("active");
    explorerSection.classList.add("hidden");
    sharedSection.classList.remove("hidden");
  }
}

function renderEmpty(container, text) {
  container.innerHTML = `<div class="empty-state">${text}</div>`;
}

function renderFolders(folders) {
  foldersGrid.innerHTML = "";

  if (!folders.length) {
    renderEmpty(foldersGrid, "No folders here");
    return;
  }

  folders.forEach((folder) => {
    const card = document.createElement("div");
    card.className = "item-card";
    card.innerHTML = `
      <div class="item-icon folder-icon"><i class="ri-folder-3-fill"></i></div>
      <div class="item-title">${folder.name}</div>
      <div class="item-meta">Folder ID: ${folder._id}</div>
      <div class="item-actions">
        <button class="primary-btn small-btn open-folder-btn" data-folder-id="${folder._id}" data-folder-name="${folder.name}">
          <i class="ri-folder-open-line"></i> Open
        </button>
        <button class="danger-btn small-btn delete-folder-btn" data-folder-id="${folder._id}">
          <i class="ri-delete-bin-line"></i> Delete
        </button>
      </div>
    `;
    foldersGrid.appendChild(card);
  });

  document.querySelectorAll(".open-folder-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const folderId = e.currentTarget.dataset.folderId;
      const folderName = e.currentTarget.dataset.folderName;

      folderHistory.push({
        folderId: currentFolderId,
        pathNames: [...folderPathNames]
      });

      currentFolderId = folderId;
      folderPathNames.push(folderName);
      updatePathDisplay();
      await loadDirectory();
    });
  });

  document.querySelectorAll(".delete-folder-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const folderId = e.currentTarget.dataset.folderId;

      try {
        const headers = await authHeaders();
        const response = await fetch(`/folders/${folderId}`, {
          method: "DELETE",
          headers
        });

        const data = await response.json();
        setOutput(data);

        if (response.ok) {
          await loadDirectory();
        }
      } catch (error) {
        setOutput({ error: error.message });
      }
    });
  });
}

function renderFiles(files) {
  filesGrid.innerHTML = "";

  if (!files.length) {
    renderEmpty(filesGrid, "No files here");
    return;
  }

  files.forEach((file) => {
    const card = document.createElement("div");
    card.className = "item-card";
    card.innerHTML = `
      <div class="item-icon file-icon"><i class="ri-file-text-line"></i></div>
      <div class="item-title">${file.filename}</div>
      <div class="item-meta">
        Size: ${file.size} bytes<br>
        File ID: ${file._id}
      </div>
      <div class="item-actions">
        <button class="secondary-btn small-btn download-file-btn" data-file-id="${file._id}">
          <i class="ri-download-2-line"></i> Download
        </button>
        <button class="danger-btn small-btn delete-file-btn" data-file-id="${file._id}">
          <i class="ri-delete-bin-line"></i> Delete
        </button>
      </div>
    `;
    filesGrid.appendChild(card);
  });

  document.querySelectorAll(".download-file-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const fileId = e.currentTarget.dataset.fileId;

      try {
        const headers = await authHeaders();
        const response = await fetch(`/files/${fileId}/download`, {
          method: "GET",
          headers
        });

        if (!response.ok) {
          const data = await response.json();
          setOutput(data);
          return;
        }

        const blob = await response.blob();
        const contentDisposition = response.headers.get("Content-Disposition");
        let filename = "download";

        if (contentDisposition) {
          const match = contentDisposition.match(/filename="(.+)"/);
          if (match && match[1]) {
            filename = match[1];
          }
        }

        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(downloadUrl);
      } catch (error) {
        setOutput({ error: error.message });
      }
    });
  });

  document.querySelectorAll(".delete-file-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const fileId = e.currentTarget.dataset.fileId;

      try {
        const headers = await authHeaders();
        const response = await fetch(`/files/${fileId}`, {
          method: "DELETE",
          headers
        });

        const data = await response.json();
        setOutput(data);

        if (response.ok) {
          await loadDirectory();
        }
      } catch (error) {
        setOutput({ error: error.message });
      }
    });
  });
}

function renderSharedFiles(sharedFiles) {
  sharedFilesGrid.innerHTML = "";

  if (!sharedFiles.length) {
    renderEmpty(sharedFilesGrid, "No shared files");
    return;
  }

  sharedFiles.forEach((item) => {
    const card = document.createElement("div");
    card.className = "item-card";
    card.innerHTML = `
      <div class="item-icon shared-icon"><i class="ri-share-forward-fill"></i></div>
      <div class="item-title">${item.file.filename}</div>
      <div class="item-meta">
        Shared by: ${item.shared_by}<br>
        File ID: ${item.file._id}
      </div>
    `;
    sharedFilesGrid.appendChild(card);
  });
}

async function loadDirectory() {
  try {
    const headers = await authHeaders();
    const url = currentFolderId
      ? `/directory?folder_id=${encodeURIComponent(currentFolderId)}`
      : `/directory`;

    const response = await fetch(url, {
      method: "GET",
      headers
    });

    const data = await response.json();

    if (!response.ok) {
      setOutput(data);
      return;
    }

    renderFolders(data.folders || []);
    renderFiles(data.files || []);
    setOutput({
      message: "Directory loaded successfully",
      current_folder_id: data.current_folder_id
    });
  } catch (error) {
    setOutput({ error: error.message });
  }
}

async function loadSharedFiles() {
  try {
    const headers = await authHeaders();
    const response = await fetch("/shares/shared-with-me", {
      method: "GET",
      headers
    });

    const data = await response.json();

    if (!response.ok) {
      setOutput(data);
      return;
    }

    renderSharedFiles(data.shared_files || []);
    setOutput({ message: "Shared files loaded successfully" });
  } catch (error) {
    setOutput({ error: error.message });
  }
}

logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
    window.location.href = "/login";
  } catch (error) {
    setOutput({ error: error.message });
  }
});

navRootBtn.addEventListener("click", async () => {
  setActiveNav("root");
  await loadDirectory();
});

navSharedBtn.addEventListener("click", async () => {
  setActiveNav("shared");
  await loadSharedFiles();
});

backBtn.addEventListener("click", async () => {
  if (folderHistory.length === 0) {
    currentFolderId = null;
    folderPathNames = ["Root"];
  } else {
    const previous = folderHistory.pop();
    currentFolderId = previous.folderId;
    folderPathNames = previous.pathNames;
  }

  updatePathDisplay();
  await loadDirectory();
});

goRootBtn.addEventListener("click", async () => {
  currentFolderId = null;
  folderHistory = [];
  folderPathNames = ["Root"];
  updatePathDisplay();
  await loadDirectory();
});

refreshBtn.addEventListener("click", async () => {
  await loadDirectory();
});

createFolderBtn.addEventListener("click", async () => {
  const folderName = folderNameInput.value.trim();

  if (!folderName) {
    setOutput({ error: "Please enter a folder name." });
    return;
  }

  try {
    const headers = await authHeaders();

    const response = await fetch("/folders", {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: folderName,
        parent_id: currentFolderId
      })
    });

    const data = await response.json();
    setOutput(data);

    if (response.ok) {
      folderNameInput.value = "";
      await loadDirectory();
    }
  } catch (error) {
    setOutput({ error: error.message });
  }
});

uploadFileBtn.addEventListener("click", async () => {
  const selectedFile = fileInput.files[0];

  if (!selectedFile) {
    setOutput({ error: "Please choose a file first." });
    return;
  }

  try {
    const headers = await authHeaders();
    const formData = new FormData();
    formData.append("file", selectedFile);

    if (currentFolderId) {
      formData.append("folder_id", currentFolderId);
    }

    const response = await fetch("/files/upload", {
      method: "POST",
      headers,
      body: formData
    });

    const data = await response.json();
    setOutput(data);

    if (response.ok) {
      fileInput.value = "";
      await loadDirectory();
    }
  } catch (error) {
    setOutput({ error: error.message });
  }
});

loadSharedBtn.addEventListener("click", async () => {
  await loadSharedFiles();
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login";
    return;
  }

  currentUser = user;
  userEmailDisplay.textContent = user.email || "User";
  updatePathDisplay();
  setActiveNav("root");
  await loadDirectory();
});