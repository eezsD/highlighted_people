const socket = io();
let currentEbook = null;
let selectedText = "";
let selectionRange = null;
let currentUser = null;

// Initialize the application
document.addEventListener("DOMContentLoaded", function () {
    loadEbooks();
    checkAuthStatus();

    // Socket event listeners
    socket.on("newComment", (data) => {
        if (currentEbook && data.ebookId === currentEbook.id) {
            addCommentToPanel(data.comment);
            highlightCommentInText(data.comment);
        }
    });

    socket.on("userHighlight", (data) => {
        if (currentEbook && data.ebookId === currentEbook.id) {
            showOtherUserHighlight(data);
        }
    });

    socket.on("userTyping", (data) => {
        if (currentEbook && data.ebookId === currentEbook.id) {
            showTypingIndicator(data.userId);
            setTimeout(() => hideTypingIndicator(data.userId), 2000);
        }
    });
});

// Load and display ebooks
async function loadEbooks() {
    const res = await fetch("/ebooks");
    const ebooks = await res.json();
    const ebooksList = document.getElementById("ebooksList");
    ebooksList.innerHTML = "";
    ebooks.forEach((ebook) => {
        const div = document.createElement("div");
        div.className = "ebook-item";
        div.innerHTML = `<h3>${ebook.title}</h3>`;
        div.onclick = () => openEbook(ebook.id);
        ebooksList.appendChild(div);
    });
}

// Open and display ebook content
async function openEbook(ebookId) {
    const res = await fetch(`/ebook/${ebookId}`);
    const ebook = await res.json();
    currentEbook = ebook;
    document.getElementById("currentEbookTitle").textContent = ebook.title;
    document.getElementById("ebooksSection").style.display = "none";
    document.getElementById("readerSection").style.display = "block";
    displayTextContent(ebook.content);
    loadComments(ebookId);
}

// Display text content with selection handling
function displayTextContent(content) {
    const textContentDiv = document.getElementById("textContent");
    textContentDiv.innerHTML = formatTextContent(content);
    textContentDiv.onmouseup = handleTextSelection;
}

// Format text content into paragraphs, preserving whitespace and line breaks using CSS
function formatTextContent(content) {
    return content
        .split("\n")
        .map((paragraph) => `<p style="white-space: pre-wrap;">${paragraph}</p>`)
        .join("");
}

// Handle text selection
function handleTextSelection() {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
        selectedText = selection.toString();
        selectionRange = selection.getRangeAt(0);
        document.getElementById("selectedTextDisplay").textContent = selectedText;
        document.getElementById("commentModal").style.display = "block";
    }
}

// Get selection position for storing comments
function getSelectionPosition(range) {
    // For simplicity, just return start and end offsets
    return {
        start: range.startOffset,
        end: range.endOffset,
    };
}

// Add typing detection to comment input
document.addEventListener("DOMContentLoaded", function () {
    const commentInput = document.getElementById("commentInput");
    if (commentInput) {
        commentInput.addEventListener("input", () => {
            if (currentUser && currentEbook) {
                socket.emit("userTyping", {
                    userId: currentUser.id,
                    ebookId: currentEbook.id,
                });
            }
        });
    }
});

// Save comment
async function saveComment() {
    const commentInput = document.getElementById("commentInput");
    const comment = commentInput.value.trim();
    if (!comment || !selectedText || !selectionRange) {
        alert("에러가 발생했습니다");
        return;
    }
    const position = getSelectionPosition(selectionRange);
    const token = localStorage.getItem("authToken");
    const res = await fetch(`/comments/${currentEbook.id}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
            selectedText,
            comment,
            position,
        }),
    });
    if (res.ok) {
        commentInput.value = "";
        closeCommentModal();
        loadComments(currentEbook.id);
    } else {
        alert("댓글을 남기는 데 실패했습니다");
    }
}

// Load existing comments
async function loadComments(ebookId) {
    const res = await fetch(`/comments/${ebookId}`);
    const comments = await res.json();
    const commentsList = document.getElementById("commentsList");
    commentsList.innerHTML = "";
    comments.forEach(addCommentToPanel);
    // Highlight all commented text
    comments.forEach(highlightCommentInText);
}

// Add comment to the comments panel
function addCommentToPanel(comment) {
    const commentsList = document.getElementById("commentsList");
    const div = document.createElement("div");
    div.className = "comment-item";
    div.innerHTML = `
        <div class="comment-header">
            <span class="comment-author">${comment.user.name}</span>
            <span class="comment-time">${new Date(comment.createdAt).toLocaleString()}</span>
        </div>
        <div class="comment-selected-text">${comment.selectedText}</div>
        <div class="comment-body">${comment.comment}</div>
    `;
    div.onmouseenter = () => highlightTextTemporarily(comment.selectedText);
    div.onmouseleave = removeTemporaryHighlight;
    commentsList.appendChild(div);
}

// Temporarily highlight text on comment hover
function highlightTextTemporarily(text) {
    const textContentDiv = document.getElementById("textContent");
    if (!text) return;
    const regex = new RegExp(escapeRegExp(text), "g");
    textContentDiv.innerHTML = textContentDiv.innerHTML.replace(
        regex,
        `<span class="temp-highlight">${text}</span>`
    );
}

// Remove temporary highlight
function removeTemporaryHighlight() {
    const textContentDiv = document.getElementById("textContent");
    textContentDiv.innerHTML = textContentDiv.innerHTML.replace(
        /<span class="temp-highlight">(.*?)<\/span>/g,
        "$1"
    );
}

// Highlight commented text in the content
function highlightCommentInText(comment) {
    const textContentDiv = document.getElementById("textContent");
    if (!comment.selectedText) return;
    const regex = new RegExp(escapeRegExp(comment.selectedText), "g");
    textContentDiv.innerHTML = textContentDiv.innerHTML.replace(
        regex,
        `<span class="highlighted-text">${comment.selectedText}</span>`
    );
}

// Escape special regex characters
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Show notification
function showNotification(message) {
    // Implement as needed
    alert(message);
}

// Show other user's highlight temporarily
function showOtherUserHighlight(data) {
    highlightTextTemporarily(data.selectedText);
    setTimeout(removeTemporaryHighlight, 1500);
}

// Typing indicators
let typingTimeout;
function showTypingIndicator(userId) {
    // Implement as needed
}
function hideTypingIndicator(userId) {
    // Implement as needed
}
function createTypingIndicator() {
    // Implement as needed
}

// Close comment modal
function closeCommentModal() {
    document.getElementById("commentModal").style.display = "none";
    selectedText = "";
    selectionRange = null;
    document.getElementById("selectedTextDisplay").textContent = "";
}

// Go back to library
function backToLibrary() {
    document.getElementById("readerSection").style.display = "none";
    document.getElementById("ebooksSection").style.display = "block";
    currentEbook = null;
}

// Close modal when clicking outside
window.onclick = function (event) {
    const modal = document.getElementById("commentModal");
    if (event.target === modal) {
        closeCommentModal();
    }
};

// Authentication functions
let authToken = localStorage.getItem("authToken");

async function checkAuthStatus() {
    const token = localStorage.getItem("authToken");
    if (!token) {
        showLoginButton();
        return;
    }
    const res = await fetch("/auth/user", {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
        const user = await res.json();
        currentUser = user;
        showUserProfile(user);
    } else {
        showLoginButton();
    }
}

function showUserProfile(user) {
    document.getElementById("googleLoginBtn").style.display = "none";
    const userProfile = document.getElementById("userProfile");
    userProfile.style.display = "flex";
    userProfile.innerHTML = `
        <img src="${user.photo}" alt="User Photo" style="width:32px;height:32px;border-radius:50%;margin-right:8px;">
        <span>${user.name}</span>
        <button onclick="logout()">Logout</button>
    `;
}

function showLoginButton() {
    const btn = document.getElementById("googleLoginBtn");
    btn.style.display = "flex";
    btn.innerHTML = `<img class="google-icon" src="https://developers.google.com/identity/images/g-logo.png" width="18" height="18" alt="Google logo"/>Login with Google`;
    btn.onclick = loginWithGoogle;
    document.getElementById("userProfile").style.display = "none";
}

async function loginWithGoogle() {
    // Get Google Client ID from backend
    const { clientId } = await fetch("/auth/google-client-id").then(res => res.json());
    google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
            // Send credential to backend for verification
            const res = await fetch("/auth/google", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ credential: response.credential }),
            });
            const data = await res.json();
            if (data.token) {
                localStorage.setItem("authToken", data.token);
                currentUser = data.user;
                showUserProfile(data.user);
            } else {
                alert("구글 로그인에 실패했습니다");
            }
        }
    });
    google.accounts.id.prompt();
}

async function logout() {
    const token = localStorage.getItem("authToken");
    await fetch("/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
    });
    localStorage.removeItem("authToken");
    currentUser = null;
    showLoginButton();
}

// Check authentication status on page load
document.addEventListener("DOMContentLoaded", function () {
    checkAuthStatus();
});