import {
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth } from "/static/js/firebase-config.js";

const logoutBtn = document.getElementById("logout-btn");
const navRootBtn = document.getElementById("nav-root-btn");
const navSharedBtn = document.getElementById("nav-shared-btn");
const navTrashBtn = document.getElementById("nav-trash-btn");

const backBtn = document.getElementById("back-btn");
const goRootBtn = document.getElementById("go-root-btn");
const refreshBtn = document.getElementById("refresh-btn");

const createFolderBtn = document.getElementById("create-folder-btn");
const uploadFileBtn = document.getElementById("upload-file-btn");
const uploadFileBtnSide = document.getElementById("upload-file-btn-side");
const loadSharedBtn = document.getElementById("load-shared-btn");
const shareFileBtnPanel = document.getElementById("share-file-btn-panel");

const folderNameInput = document.getElementById("folder-name");
const fileInput = document.getElementById("file-input");
const shareEmailInput = document.getElementById("share-email-input");

const userEmailDisplay = document.getElementById("user-email-display");
const pathDisplay = document.getElementById("path-display");

const foldersGrid = document.getElementById("folders-grid");
const filesTableBody = document.getElementById("files-table-body");
const sharedFilesGrid = document.getElementById("shared-files-grid");
const trashFoldersGrid = document.getElementById("trash-folders-grid");
const trashFilesTableBody = document.getElementById("trash-files-table-body");

const previewContent = document.getElementById("preview-content");
const toast = document.getElementById("toast");

const explorerSection = document.getElementById("explorer-section");
const sharedSection = document.getElementById("shared-section");
const trashSection = document.getElementById("trash-section");

let currentUser = null;
let currentFolderId = null;
let selectedFile = null;
let folderHistory = [];
let folderPathNames = ["Root"];

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove("hidden");
  setTimeout(() => {
    toast.classList.add("hidden");
  }, 2500);
}

async function authHeaders() {
  if (!currentUser) {
    throw new Error("You must log in first.");
  }

  const token = await currentUser.getIdToken();
  return {
    Authorization: `Bearer ${token}`
  };
}

function updatePathDisplay() {
  if (pathDisplay) {
    pathDisplay.textContent = folderPathNames.join(" > ");
  }
}

function setActiveView(view) {
  navRootBtn?.classList.remove("active");
  navSharedBtn?.classList.remove("active");
  navTrashBtn?.classList.remove("active");

  explorerSection?.classList.add("hidden");
  sharedSection?.classList.add("hidden");
  trashSection?.classList.add("hidden");

  if (view === "root") {
    navRootBtn?.classList.add("active");
    explorerSection?.classList.remove("hidden");
  } else if (view === "shared") {
    navSharedBtn?.classList.add("active");
    sharedSection?.classList.remove("hidden");
  } else if (view === "trash") {
    navTrashBtn?.classList.add("active");
    trashSection?.classList.remove("hidden");
  }
}

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

function showFilePreview(file) {
  selectedFile = file;
  if (!previewContent) return;

  previewContent.innerHTML = `
    <div class="preview-file">
      <div class="preview-file-icon"><i class="ri-file-text-line"></i></div>
      <div class="preview-file-name">${file.filename}</div>
      <div class="preview-file-meta">Size: ${file.size} bytes</div>
      <div class="preview-file-meta">Type: ${file.content_type || "Unknown"}</div>
      <div class="preview-file-meta">File ID: ${file._id}</div>
    </div>
  `;
}

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

  document.querySelectorAll(".delete-folder-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const folderId = e.currentTarget.dataset.folderId;
      const folderName = e.currentTarget.dataset.folderName;

      const confirmed = window.confirm(
        `Are you sure you want to permanently delete "${folderName}" and everything inside it? This cannot be undone.`
      );

      if (!confirmed) return;

      try {
        const headers = await authHeaders();
        const response = await fetch(`/folders/${folderId}`, {
          method: "DELETE",
          headers
        });

        const data = await response.json();
        showToast(data.message || "Folder permanently deleted");

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

  files.forEach((file) => {
    const safeFile = JSON.stringify(file).replace(/'/g, "&apos;");

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>
        <div class="file-name-cell">
          <span class="file-table-icon"><i class="ri-file-text-line"></i></span>
          <span>${file.filename}</span>
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

  document.querySelectorAll(".preview-file-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const file = JSON.parse(e.currentTarget.dataset.file.replace(/&apos;/g, "'"));
      showFilePreview(file);
      setActiveView("root");
    });
  });

  document.querySelectorAll(".share-file-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const file = JSON.parse(e.currentTarget.dataset.file.replace(/&apos;/g, "'"));
      showFilePreview(file);
      if (shareEmailInput) shareEmailInput.focus();
      showToast(`Selected "${file.filename}" for sharing`);
    });
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

logoutBtn?.addEventListener("click", async () => {
  try {
    await signOut(auth);
    window.location.href = "/login";
  } catch (error) {
    showToast(error.message);
  }
});

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

goRootBtn?.addEventListener("click", async () => {
  currentFolderId = null;
  folderHistory = [];
  folderPathNames = ["Root"];
  updatePathDisplay();
  clearPreview();
  setActiveView("root");
  await loadDirectory();
});

refreshBtn?.addEventListener("click", async () => {
  await loadDirectory();
});

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

uploadFileBtn?.addEventListener("click", handleUpload);
uploadFileBtnSide?.addEventListener("click", handleUpload);
loadSharedBtn?.addEventListener("click", loadSharedFiles);
shareFileBtnPanel?.addEventListener("click", shareSelectedFile);

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