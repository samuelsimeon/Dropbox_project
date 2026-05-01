import {
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth } from "/static/js/firebase-config.js";

// Main buttons in the sidebar and top navigation
const logoutBtn = document.getElementById("logout-btn");
const navRootBtn = document.getElementById("nav-root-btn");
const navSharedBtn = document.getElementById("nav-shared-btn");
const navTrashBtn = document.getElementById("nav-trash-btn");
const navDuplicatesBtn = document.getElementById("nav-duplicates-btn");

const backBtn = document.getElementById("back-btn");
const goRootBtn = document.getElementById("go-root-btn");
const refreshBtn = document.getElementById("refresh-btn");

// Action buttons used for creating folders, uploading files, loading shared files, etc.
const createFolderBtn = document.getElementById("create-folder-btn");
const uploadFileBtn = document.getElementById("upload-file-btn");
const uploadFileBtnSide = document.getElementById("upload-file-btn-side");
const loadSharedBtn = document.getElementById("load-shared-btn");
const loadDuplicatesBtn = document.getElementById("load-duplicates-btn");
const shareFileBtnPanel = document.getElementById("share-file-btn-panel");

// User input fields
const folderNameInput = document.getElementById("folder-name");
const fileInput = document.getElementById("file-input");
const shareEmailInput = document.getElementById("share-email-input");

// UI areas where dynamic information is displayed
const userEmailDisplay = document.getElementById("user-email-display");
const pathDisplay = document.getElementById("path-display");

const foldersGrid = document.getElementById("folders-grid");
const filesTableBody = document.getElementById("files-table-body");
const sharedFilesGrid = document.getElementById("shared-files-grid");
const trashFoldersGrid = document.getElementById("trash-folders-grid");
const trashFilesTableBody = document.getElementById("trash-files-table-body");
const duplicatesContainer = document.getElementById("duplicates-container");

const previewContent = document.getElementById("preview-content");
const toast = document.getElementById("toast");

// Main sections of the dashboard
const explorerSection = document.getElementById("explorer-section");
const sharedSection = document.getElementById("shared-section");
const trashSection = document.getElementById("trash-section");
const duplicatesSection = document.getElementById("duplicates-section");

// State variables used to track the current logged in user,
// the current folder, selected file, and folder history
let currentUser = null;
let currentFolderId = null;
let selectedFile = null;
let folderHistory = [];
let folderPathNames = ["Root"];

// Shows a temporary toast message to the user
function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove("hidden");
  setTimeout(() => {
    toast.classList.add("hidden");
  }, 2500);
}

// Builds the authentication headers needed for protected backend routes
// using the Firebase ID token of the current logged-in user
async function authHeaders() {
  if (!currentUser) {
    throw new Error("You must log in first.");
  }

  const token = await currentUser.getIdToken();
  return {
    Authorization: `Bearer ${token}`
  };
}

// Updates the folder path shown at the top of the page
function updatePathDisplay() {
  if (pathDisplay) {
    pathDisplay.textContent = folderPathNames.join(" > ");
  }
}

// Controls which main section is visible on the dashboard
// and updates the active sidebar button
function setActiveView(view) {
  navRootBtn?.classList.remove("active");
  navSharedBtn?.classList.remove("active");
  navTrashBtn?.classList.remove("active");
  navDuplicatesBtn?.classList.remove("active");

  explorerSection?.classList.add("hidden");
  sharedSection?.classList.add("hidden");
  trashSection?.classList.add("hidden");
  duplicatesSection?.classList.add("hidden");

  if (view === "root") {
    navRootBtn?.classList.add("active");
    explorerSection?.classList.remove("hidden");
  } else if (view === "shared") {
    navSharedBtn?.classList.add("active");
    sharedSection?.classList.remove("hidden");
  } else if (view === "trash") {
    navTrashBtn?.classList.add("active");
    trashSection?.classList.remove("hidden");
  } else if (view === "duplicates") {
    navDuplicatesBtn?.classList.add("active");
    duplicatesSection?.classList.remove("hidden");
  }
}

// Clears the file preview area when nothing is selected
function clearPreview() {
  selectedFile = null;
  if (!previewContent) return;

  previewContent.innerHTML = `
    <div class="preview-empty">
      <i class="ri-file-list-3-line"></i>
      <p>Select a file to preview its details</p>
    </div>
  `;
}

// Displays metadata about the selected file in the preview panel
function showFilePreview(file) {
  selectedFile = file;
  if (!previewContent) return;

  previewContent.innerHTML = `
    <div class="preview-file">
      <div class="preview-file-icon"><i class="ri-file-text-line"></i></div>
      <div class="preview-file-name">${file.filename}</div>
      <div class="preview-file-meta">Size: ${file.size} bytes</div>
      <div class="preview-file-meta">Type: ${file.content_type || "Unknown"}</div>
      <div class="preview-file-meta">Hash: ${file.file_hash || "Not available"}</div>
      <div class="preview-file-meta">Path: ${file.path || "Current folder"}</div>
      <div class="preview-file-meta">File ID: ${file._id}</div>
    </div>
  `;
}

// Renders the folders returned from the backend into folder cards
function renderFolders(folders) {
  if (!foldersGrid) return;
  foldersGrid.innerHTML = "";

  if (!folders.length) {
    foldersGrid.innerHTML = `<div class="empty-state">No folders found in this location.</div>`;
    return;
  }

  folders.forEach((folder) => {
    const card = document.createElement("div");
    card.className = "folder-card";
    card.innerHTML = `
      <div>
        <div class="folder-card-icon"><i class="ri-folder-3-fill"></i></div>
        <div class="folder-card-title">${folder.name}</div>
        <div class="folder-card-meta">Folder</div>
      </div>
      <div class="card-actions">
        <button class="primary-btn small-btn open-folder-btn" data-folder-id="${folder._id}" data-folder-name="${folder.name}">
          Open
        </button>
        <button class="danger-btn small-btn delete-folder-btn" data-folder-id="${folder._id}" data-folder-name="${folder.name}">
          Delete
        </button>
      </div>
    `;
    foldersGrid.appendChild(card);
  });

  // Open folder button updates current folder state and reloads the directory
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
      clearPreview();
      setActiveView("root");
      await loadDirectory();
    });
  });

  // Delete folder only sends the request. The backend decides if the folder is empty.
  document.querySelectorAll(".delete-folder-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const folderId = e.currentTarget.dataset.folderId;
      const folderName = e.currentTarget.dataset.folderName;

      const confirmed = window.confirm(
        `Delete "${folderName}"? This folder can only be deleted if it is empty.`
      );

      if (!confirmed) return;

      try {
        const headers = await authHeaders();
        const response = await fetch(`/folders/${folderId}`, {
          method: "DELETE",
          headers
        });

        const data = await response.json();
        showToast(data.detail || data.message || "Folder delete result");

        if (response.ok) {
          clearPreview();
          await loadDirectory();
        }
      } catch (error) {
        showToast(error.message);
      }
    });
  });
}

// Renders files into the main files table
// Also highlights duplicates in the current folder
function renderFiles(files) {
  if (!filesTableBody) return;
  filesTableBody.innerHTML = "";

  if (!files.length) {
    filesTableBody.innerHTML = `
      <tr>
        <td colspan="4">
          <div class="empty-state">No files found in this location.</div>
        </td>
      </tr>
    `;
    return;
  }

  // Count file hashes so duplicates in the same folder can be detected
  const hashCounts = {};
  files.forEach((file) => {
    if (file.file_hash) {
      hashCounts[file.file_hash] = (hashCounts[file.file_hash] || 0) + 1;
    }
  });

  files.forEach((file) => {
    const safeFile = JSON.stringify(file).replace(/'/g, "&apos;");
    const isDuplicate = file.file_hash && hashCounts[file.file_hash] > 1;

    const row = document.createElement("tr");
    row.className = isDuplicate ? "duplicate-row" : "";

    row.innerHTML = `
      <td>
        <div class="file-name-cell">
          <span class="file-table-icon"><i class="ri-file-text-line"></i></span>
          <span>${file.filename}</span>
          ${isDuplicate ? '<span class="duplicate-badge">Duplicate</span>' : ''}
        </div>
      </td>
      <td>${file.content_type || "File"}</td>
      <td>${file.size} bytes</td>
      <td>
        <div class="card-actions">
          <button class="secondary-btn small-btn preview-file-btn" data-file='${safeFile}'>Preview</button>
          <button class="secondary-btn small-btn download-file-btn" data-file-id="${file._id}">Download</button>
          <button class="primary-btn small-btn share-file-btn" data-file='${safeFile}'>Share</button>
          <button class="danger-btn small-btn delete-file-btn" data-file-id="${file._id}" data-file-name="${file.filename}">Delete</button>
        </div>
      </td>
    `;
    filesTableBody.appendChild(row);
  });

  // Preview selected file
  document.querySelectorAll(".preview-file-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const file = JSON.parse(e.currentTarget.dataset.file.replace(/&apos;/g, "'"));
      showFilePreview(file);
      setActiveView("root");
    });
  });

  // Select file for sharing
  document.querySelectorAll(".share-file-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const file = JSON.parse(e.currentTarget.dataset.file.replace(/&apos;/g, "'"));
      showFilePreview(file);
      if (shareEmailInput) shareEmailInput.focus();
      showToast(`Selected "${file.filename}" for sharing`);
    });
  });

  // Download file from backend
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
          showToast(data.detail || "Download failed");
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
        showToast(error.message);
      }
    });
  });

  // Move file to trash instead of deleting it immediately
  document.querySelectorAll(".delete-file-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const fileId = e.currentTarget.dataset.fileId;
      const fileName = e.currentTarget.dataset.fileName;

      const confirmed = window.confirm(
        `Are you sure you want to move "${fileName}" to Trash?`
      );

      if (!confirmed) return;

      try {
        const headers = await authHeaders();
        const response = await fetch(`/files/${fileId}`, {
          method: "DELETE",
          headers
        });

        const data = await response.json();
        showToast(data.message || "File moved to trash");

        if (response.ok) {
          clearPreview();
          await loadDirectory();
        }
      } catch (error) {
        showToast(error.message);
      }
    });
  });
}

// Renders files shared with the current user
function renderSharedFiles(sharedFiles) {
  if (!sharedFilesGrid) return;
  sharedFilesGrid.innerHTML = "";

  if (!sharedFiles.length) {
    sharedFilesGrid.innerHTML = `<div class="empty-state">No files shared with you.</div>`;
    return;
  }

  sharedFiles.forEach((item) => {
    const safeFile = JSON.stringify(item.file).replace(/'/g, "&apos;");

    const card = document.createElement("div");
    card.className = "shared-card";
    card.innerHTML = `
      <div>
        <div class="shared-card-icon"><i class="ri-share-forward-fill"></i></div>
        <div class="shared-card-title">${item.file.filename}</div>
        <div class="shared-card-meta">
          Shared by: ${item.shared_by}<br>
          Type: ${item.file.content_type || "File"}<br>
          Size: ${item.file.size} bytes
        </div>
      </div>
      <div class="card-actions">
        <button class="secondary-btn small-btn preview-shared-file-btn" data-file='${safeFile}'>
          Preview
        </button>
        <button class="primary-btn small-btn download-shared-file-btn" data-file-id="${item.file._id}">
          Download
        </button>
      </div>
    `;
    sharedFilesGrid.appendChild(card);
  });

  document.querySelectorAll(".preview-shared-file-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const file = JSON.parse(e.currentTarget.dataset.file.replace(/&apos;/g, "'"));
      showFilePreview(file);
    });
  });

  document.querySelectorAll(".download-shared-file-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const fileId = e.currentTarget.dataset.fileId;

      try {
        const headers = await authHeaders();
        const response = await fetch(`/shares/files/${fileId}/download`, {
          method: "GET",
          headers
        });

        if (!response.ok) {
          const data = await response.json();
          showToast(data.detail || "Download failed");
          return;
        }

        const blob = await response.blob();
        const contentDisposition = response.headers.get("Content-Disposition");
        let filename = "shared-download";

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
        showToast(error.message);
      }
    });
  });
}

// Renders the trash view with restore and permanent delete options
function renderTrash(data) {
  if (trashFoldersGrid) trashFoldersGrid.innerHTML = "";
  if (trashFilesTableBody) trashFilesTableBody.innerHTML = "";

  if (trashFoldersGrid) {
    trashFoldersGrid.innerHTML = `<div class="empty-state">Folders are permanently deleted and do not appear in Trash.</div>`;
  }

  if (trashFilesTableBody) {
    if (!data.files.length) {
      trashFilesTableBody.innerHTML = `
        <tr>
          <td colspan="3">
            <div class="empty-state">No deleted files.</div>
          </td>
        </tr>
      `;
    } else {
      data.files.forEach((file) => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${file.filename}</td>
          <td>${file.deleted_at || "-"}</td>
          <td>
            <div class="card-actions">
              <button class="success-btn small-btn restore-file-btn" data-file-id="${file._id}">
                Restore
              </button>
              <button class="danger-btn small-btn permanent-delete-file-btn" data-file-id="${file._id}" data-file-name="${file.filename}">
                Delete Permanently
              </button>
            </div>
          </td>
        `;
        trashFilesTableBody.appendChild(row);
      });
    }
  }

  // Restore file from trash
  document.querySelectorAll(".restore-file-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const fileId = e.currentTarget.dataset.fileId;

      try {
        const headers = await authHeaders();
        const response = await fetch(`/files/${fileId}/restore`, {
          method: "POST",
          headers
        });

        const data = await response.json();
        showToast(data.message || "File restored");

        if (response.ok) {
          await loadTrash();
        }
      } catch (error) {
        showToast(error.message);
      }
    });
  });

  // Permanently delete file from trash
  document.querySelectorAll(".permanent-delete-file-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const fileId = e.currentTarget.dataset.fileId;
      const fileName = e.currentTarget.dataset.fileName;

      const confirmed = window.confirm(
        `Are you sure you want to permanently delete "${fileName}"? This cannot be undone.`
      );

      if (!confirmed) return;

      try {
        const headers = await authHeaders();
        const response = await fetch(`/files/${fileId}/permanent`, {
          method: "DELETE",
          headers
        });

        const data = await response.json();
        showToast(data.message || "File permanently deleted");

        if (response.ok) {
          await loadTrash();
        }
      } catch (error) {
        showToast(error.message);
      }
    });
  });
}

// Renders duplicate groups found across the user's entire Dropbox
function renderDuplicateGroups(groups) {
  if (!duplicatesContainer) return;
  duplicatesContainer.innerHTML = "";

  if (!groups.length) {
    duplicatesContainer.innerHTML = `<div class="empty-state">No duplicates found across your Dropbox.</div>`;
    return;
  }

  groups.forEach((group, index) => {
    const card = document.createElement("div");
    card.className = "duplicate-group-card";

    const itemsHtml = group.files.map((file) => {
      const safeFile = JSON.stringify(file).replace(/'/g, "&apos;");
      return `
        <div class="duplicate-item">
          <div class="card-actions" style="justify-content: space-between; align-items: center;">
            <div>
              <strong>${file.filename}</strong>
              <div class="duplicate-path">${file.path}</div>
            </div>
            <button class="secondary-btn small-btn preview-duplicate-file-btn" data-file='${safeFile}'>
              Preview
            </button>
          </div>
        </div>
      `;
    }).join("");

    card.innerHTML = `
      <div class="duplicate-group-title">
        Duplicate Group ${index + 1} (${group.count} files)
      </div>
      ${itemsHtml}
    `;

    duplicatesContainer.appendChild(card);
  });

  document.querySelectorAll(".preview-duplicate-file-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const file = JSON.parse(e.currentTarget.dataset.file.replace(/&apos;/g, "'"));
      showFilePreview(file);
    });
  });
}

// Loads the current folder contents from the backend
async function loadDirectory() {
  try {
    const headers = await authHeaders();
    const url = currentFolderId
      ? `/directory?folder_id=${encodeURIComponent(currentFolderId)}`
      : `/directory`;

    const response = await fetch(url, { headers });
    const data = await response.json();

    if (!response.ok) {
      showToast(data.detail || "Failed to load directory");
      return;
    }

    renderFolders(data.folders || []);
    renderFiles(data.files || []);
  } catch (error) {
    showToast(error.message);
  }
}

// Loads files shared with the current user
async function loadSharedFiles() {
  try {
    const headers = await authHeaders();
    const response = await fetch("/shares/shared-with-me", { headers });
    const data = await response.json();

    if (!response.ok) {
      showToast(data.detail || "Failed to load shared files");
      return;
    }

    renderSharedFiles(data.shared_files || []);
  } catch (error) {
    showToast(error.message);
  }
}

// Loads deleted files from trash
async function loadTrash() {
  try {
    const headers = await authHeaders();
    const response = await fetch("/trash", { headers });
    const data = await response.json();

    if (!response.ok) {
      showToast(data.detail || "Failed to load trash");
      return;
    }

    renderTrash(data);
  } catch (error) {
    showToast(error.message);
  }
}

// Loads duplicate groups from the backend
async function loadDuplicates() {
  try {
    const headers = await authHeaders();
    const response = await fetch("/duplicates", { headers });
    const data = await response.json();

    if (!response.ok) {
      showToast(data.detail || "Failed to load duplicates");
      return;
    }

    renderDuplicateGroups(data.duplicate_groups || []);
  } catch (error) {
    showToast(error.message);
  }
}

// Uploads the selected file to the current folder
async function handleUpload() {
  const selected = fileInput?.files?.[0];

  if (!selected) {
    showToast("Please choose a file first.");
    return;
  }

  try {
    const headers = await authHeaders();
    const formData = new FormData();
    formData.append("file", selected);

    if (currentFolderId) {
      formData.append("folder_id", currentFolderId);
    }

    const response = await fetch("/files/upload", {
      method: "POST",
      headers,
      body: formData
    });

    const data = await response.json();

    if (!response.ok) {
      showToast(data.detail || "Upload failed");
      return;
    }

    if (fileInput) fileInput.value = "";
    showToast(data.message || "File uploaded");
    await loadDirectory();
  } catch (error) {
    showToast(error.message);
  }
}

// Shares the selected file with another user by email
async function shareSelectedFile() {
  if (!selectedFile) {
    showToast("Select a file first.");
    return;
  }

  const email = shareEmailInput?.value?.trim();
  if (!email) {
    showToast("Enter an email first.");
    return;
  }

  try {
    const headers = await authHeaders();
    const response = await fetch("/shares", {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        file_id: selectedFile._id,
        shared_with_email: email
      })
    });

    const data = await response.json();

    if (!response.ok) {
      showToast(data.detail || "Share failed");
      return;
    }

    if (shareEmailInput) shareEmailInput.value = "";
    showToast(data.message || "File shared");
  } catch (error) {
    showToast(error.message);
  }
}

// Logout current user and return to login page
logoutBtn?.addEventListener("click", async () => {
  try {
    await signOut(auth);
    window.location.href = "/login";
  } catch (error) {
    showToast(error.message);
  }
});

// Switch between the different dashboard views
navRootBtn?.addEventListener("click", async () => {
  setActiveView("root");
  await loadDirectory();
});

navSharedBtn?.addEventListener("click", async () => {
  setActiveView("shared");
  await loadSharedFiles();
});

navTrashBtn?.addEventListener("click", async () => {
  setActiveView("trash");
  clearPreview();
  await loadTrash();
});

navDuplicatesBtn?.addEventListener("click", async () => {
  setActiveView("duplicates");
  clearPreview();
  await loadDuplicates();
});

// Navigate back to the previous folder
backBtn?.addEventListener("click", async () => {
  if (folderHistory.length === 0) {
    currentFolderId = null;
    folderPathNames = ["Root"];
  } else {
    const previous = folderHistory.pop();
    currentFolderId = previous.folderId;
    folderPathNames = previous.pathNames;
  }

  updatePathDisplay();
  clearPreview();
  setActiveView("root");
  await loadDirectory();
});

// Return to root folder
goRootBtn?.addEventListener("click", async () => {
  currentFolderId = null;
  folderHistory = [];
  folderPathNames = ["Root"];
  updatePathDisplay();
  clearPreview();
  setActiveView("root");
  await loadDirectory();
});

// Refresh current directory view
refreshBtn?.addEventListener("click", async () => {
  await loadDirectory();
});

// Create a new folder in the current location
createFolderBtn?.addEventListener("click", async () => {
  const folderName = folderNameInput?.value?.trim();

  if (!folderName) {
    showToast("Please enter a folder name.");
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

    if (!response.ok) {
      showToast(data.detail || "Failed to create folder");
      return;
    }

    folderNameInput.value = "";
    showToast(data.message || "Folder created");
    await loadDirectory();
  } catch (error) {
    showToast(error.message);
  }
});

// Connect buttons to their main actions
uploadFileBtn?.addEventListener("click", handleUpload);
uploadFileBtnSide?.addEventListener("click", handleUpload);
loadSharedBtn?.addEventListener("click", loadSharedFiles);
loadDuplicatesBtn?.addEventListener("click", loadDuplicates);
shareFileBtnPanel?.addEventListener("click", shareSelectedFile);

// Watches Firebase auth state so only logged-in users can access the app page
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login";
    return;
  }

  currentUser = user;
  if (userEmailDisplay) {
    userEmailDisplay.textContent = user.email || "User";
  }
  updatePathDisplay();
  clearPreview();
  setActiveView("root");
  await loadDirectory();
});