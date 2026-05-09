const STORAGE_KEY = "professional-notes";

let notes = [];
let currentNoteId = null;
let saveTimer = null;
let toastTimer = null;

const els = {};

function initApp() {
    cacheElements();
    notes = loadNotes();
    bindEvents();
    renderNotes();

    if (notes.length > 0) {
        selectNote(notes[0].id);
    } else {
        showEmptyState();
    }
}

function cacheElements() {
    els.sidebar = document.getElementById("sidebar");
    els.searchInput = document.getElementById("searchInput");
    els.notesContainer = document.getElementById("notesContainer");
    els.noteCount = document.getElementById("noteCount");
    els.titleInput = document.getElementById("noteTitleInput");
    els.contentInput = document.getElementById("noteContent");
    els.emptyState = document.getElementById("emptyState");
    els.saveStatus = document.getElementById("saveStatus");
    els.wordCount = document.getElementById("wordCount");
    els.toast = document.getElementById("toast");
    els.mobileToggle = document.querySelector(".mobile-toggle");
}

function bindEvents() {
    els.searchInput.addEventListener("input", () => renderNotes(els.searchInput.value));
    els.titleInput.addEventListener("input", scheduleAutoSave);
    els.contentInput.addEventListener("input", () => {
        updateWordCount();
        scheduleAutoSave();
    });

    document.addEventListener("click", (event) => {
        const clickedOutsideSidebar = !els.sidebar.contains(event.target);
        const clickedOutsideToggle = !els.mobileToggle.contains(event.target);

        if (window.innerWidth <= 860 && clickedOutsideSidebar && clickedOutsideToggle && els.sidebar.classList.contains("show")) {
            toggleSidebar(false);
        }
    });

    window.addEventListener("resize", () => {
        if (window.innerWidth > 860) {
            toggleSidebar(false);
        }
    });
}

function loadNotes() {
    const storedNotes = localStorage.getItem(STORAGE_KEY);

    if (storedNotes) {
        try {
            return JSON.parse(storedNotes);
        } catch {
            localStorage.removeItem(STORAGE_KEY);
        }
    }

    return [
        {
            id: Date.now(),
            title: "Welcome to Notes",
            content: "This is your writing space. Create notes, search quickly, and your changes will be saved in this browser automatically.",
            lastModified: new Date().toISOString()
        },
        {
            id: Date.now() - 1,
            title: "Project Plan",
            content: "Goals\n- Finalize design direction\n- Build the first version\n- Test on mobile and desktop\n\nNext step: turn the rough ideas into clear tasks.",
            lastModified: new Date(Date.now() - 86400000).toISOString()
        }
    ];
}

function persistNotes() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

function renderNotes(searchQuery = "") {
    const query = searchQuery.trim().toLowerCase();
    const filteredNotes = notes.filter((note) => {
        return note.title.toLowerCase().includes(query) || note.content.toLowerCase().includes(query);
    });

    els.noteCount.textContent = `${notes.length} ${notes.length === 1 ? "note" : "notes"}`;

    if (filteredNotes.length === 0) {
        els.notesContainer.innerHTML = `
            <div class="empty-list">
                <div class="note-title">No notes found</div>
                <div class="note-preview">Try a different search or create a new note.</div>
            </div>
        `;
        return;
    }

    els.notesContainer.innerHTML = filteredNotes.map((note) => {
        const preview = note.content.trim() || "No content yet";
        const formattedDate = new Date(note.lastModified).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });

        return `
            <button class="note-item ${currentNoteId === note.id ? "active" : ""}" type="button" onclick="selectNote(${note.id})">
                <div class="note-title">${escapeHtml(note.title || "Untitled note")}</div>
                <div class="note-preview">${escapeHtml(preview)}</div>
                <div class="note-date">${formattedDate}</div>
            </button>
        `;
    }).join("");
}

function selectNote(noteId) {
    const note = notes.find((item) => item.id === noteId);

    if (!note) {
        showEmptyState();
        return;
    }

    currentNoteId = noteId;
    els.titleInput.value = note.title;
    els.contentInput.value = note.content;
    els.contentInput.style.display = "block";
    els.emptyState.style.display = "none";
    setSaveStatus("All changes saved");
    updateWordCount();
    renderNotes(els.searchInput.value);

    if (window.innerWidth <= 860) {
        toggleSidebar(false);
    }
}

function createNewNote() {
    const newNote = {
        id: Date.now(),
        title: "Untitled note",
        content: "",
        lastModified: new Date().toISOString()
    };

    notes.unshift(newNote);
    persistNotes();
    els.searchInput.value = "";
    selectNote(newNote.id);
    els.titleInput.focus();
    els.titleInput.select();
    showToast("New note created");
}

function saveNote(showToastOnSave = false) {
    if (!currentNoteId) {
        return;
    }

    const note = notes.find((item) => item.id === currentNoteId);

    if (!note) {
        return;
    }

    note.title = els.titleInput.value.trim() || "Untitled note";
    note.content = els.contentInput.value;
    note.lastModified = new Date().toISOString();

    notes = notes.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
    persistNotes();
    renderNotes(els.searchInput.value);
    setSaveStatus("All changes saved");

    if (showToastOnSave) {
        showToast("Note saved");
    }
}

function scheduleAutoSave() {
    if (!currentNoteId) {
        return;
    }

    window.clearTimeout(saveTimer);
    setSaveStatus("Saving...");
    saveTimer = window.setTimeout(() => saveNote(false), 500);
}

function deleteNote() {
    if (!currentNoteId) {
        return;
    }

    const currentNote = notes.find((item) => item.id === currentNoteId);
    const confirmed = window.confirm(`Delete "${currentNote?.title || "this note"}"?`);

    if (!confirmed) {
        return;
    }

    notes = notes.filter((item) => item.id !== currentNoteId);
    persistNotes();
    showToast("Note deleted");

    if (notes.length > 0) {
        selectNote(notes[0].id);
    } else {
        showEmptyState();
    }

    renderNotes(els.searchInput.value);
}

function showEmptyState() {
    currentNoteId = null;
    els.titleInput.value = "";
    els.contentInput.value = "";
    els.contentInput.style.display = "none";
    els.emptyState.style.display = "flex";
    setSaveStatus("No note selected");
    updateWordCount();
}

function toggleSidebar(forceState) {
    const shouldShow = typeof forceState === "boolean" ? forceState : !els.sidebar.classList.contains("show");
    els.sidebar.classList.toggle("show", shouldShow);
    els.mobileToggle.setAttribute("aria-expanded", String(shouldShow));
}

function updateWordCount() {
    const words = els.contentInput.value.trim().split(/\s+/).filter(Boolean).length;
    els.wordCount.textContent = `${words} ${words === 1 ? "word" : "words"}`;
}

function setSaveStatus(message) {
    els.saveStatus.textContent = message;
    els.saveStatus.style.color = message === "Saving..." ? "var(--success)" : "var(--muted)";
}

function showToast(message) {
    window.clearTimeout(toastTimer);
    els.toast.textContent = message;
    els.toast.classList.add("show");

    toastTimer = window.setTimeout(() => {
        els.toast.classList.remove("show");
    }, 2200);
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

document.addEventListener("DOMContentLoaded", initApp);
