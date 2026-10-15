
const form = document.querySelector('#project-form');
const nameInput = document.querySelector('#name');
const statusInput = document.querySelector('#status');
const projectList = document.querySelector('#project-list');
const emptyState = document.querySelector('#empty-state');
const saveButton = document.querySelector('#save-button');
const cancelButton = document.querySelector('#cancel-button');
const message = document.querySelector('#message');

let projects = [];
let editingId = null;

// Display a clear message to the user.
function showMessage(text) {
    message.textContent = text;
}

// Read an API error message when available.
async function readError(response) {
    try {
        const data = await response.json();
        if (typeof data.error === 'string' && data.error.trim()) {
            return data.error;
        }
    } catch {
        // The response may not contain JSON.
    }

    return `Request failed (${response.status} ${response.statusText}).`;
}

// Reset the form to Add mode.
function resetForm() {
    form.reset();
    editingId = null;
    saveButton.textContent = 'Add';
    cancelButton.hidden = true;
}

// Load the current collection from the API and render it.
async function loadProjects() {
    try {
        const response = await fetch('/api/projects');

        if (!response.ok) {
            throw new Error(await readError(response));
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
            throw new Error('The API returned an invalid project list.');
        }

        projects = data;

        // If the project being edited no longer exists, leave edit mode.
        if (
            editingId !== null &&
            !projects.some(project => String(project.id) === String(editingId))
        ) {
            resetForm();
            showMessage('The project being edited no longer exists.');
        }

        renderProjects();
        return true;
    } catch (error) {
        showMessage(
            error instanceof TypeError
                ? 'Could not connect to the server. Check that it is running and try again.'
                : error.message || 'Could not load projects.'
        );
        return false;
    }
}

// Display all projects returned by the API.
function renderProjects() {
    projectList.replaceChildren();

    projects.forEach(project => {
        const listItem = document.createElement('li');

        const projectName = document.createElement('span');
        projectName.textContent = project.name;

        const projectStatus = document.createElement('span');
        projectStatus.textContent = ` — ${project.status} `;

        const editButton = document.createElement('button');
        editButton.type = 'button';
        editButton.textContent = 'Edit';

        editButton.addEventListener('click', () => {
            editingId = project.id;
            nameInput.value = project.name;
            statusInput.value = project.status;

            saveButton.textContent = 'Save changes';
            cancelButton.hidden = false;

            showMessage('');
            nameInput.focus();
        });

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.textContent = 'Delete';

        deleteButton.addEventListener('click', async () => {
            const confirmed = window.confirm(
                `Are you sure you want to delete "${project.name}"?`
            );

            if (!confirmed) {
                return;
            }

            deleteButton.disabled = true;

            try {
                const response = await fetch(
                    `/api/projects/${encodeURIComponent(project.id)}`,
                    { method: 'DELETE' }
                );

                if (!response.ok) {
                    throw new Error(await readError(response));
                }

                if (String(editingId) === String(project.id)) {
                    resetForm();
                }

                showMessage('Project deleted successfully.');
                await loadProjects();
            } catch (error) {
                showMessage(
                    error instanceof TypeError
                        ? 'Could not connect to the server. The project was not deleted.'
                        : error.message || 'Could not delete the project.'
                );
            } finally {
                deleteButton.disabled = false;
            }
        });

        listItem.append(
            projectName,
            projectStatus,
            editButton,
            deleteButton
        );

        projectList.appendChild(listItem);
    });

    if (emptyState) {
        emptyState.hidden = projects.length > 0;
    }
}

// Add a project or save edits through the API.
form.addEventListener('submit', async event => {
    event.preventDefault();

    const name = nameInput.value.trim();
    const status = statusInput.value;

    if (name === '') {
        showMessage('Please enter a project name.');
        nameInput.focus();
        return;
    }

    if (name.length > 80) {
        showMessage('Project names must be 80 characters or fewer.');
        nameInput.focus();
        return;
    }

    if (!['Planned', 'In Progress', 'Completed'].includes(status)) {
        showMessage('Please select a valid project status.');
        return;
    }

    const wasEditing = editingId !== null;
    const url = wasEditing
        ? `/api/projects/${encodeURIComponent(editingId)}`
        : '/api/projects';
    const method = wasEditing ? 'PUT' : 'POST';

    saveButton.disabled = true;
    cancelButton.disabled = true;

    try {
        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, status })
        });

        if (!response.ok) {
            throw new Error(await readError(response));
        }

        // Do not reset the form until the API mutation succeeds.
        showMessage(
            wasEditing
                ? 'Project updated successfully.'
                : 'Project added successfully.'
        );

        resetForm();
        await loadProjects();
        nameInput.focus();
    } catch (error) {
        showMessage(
            error instanceof TypeError
                ? 'Could not connect to the server. Your input has been kept; please try again.'
                : error.message || 'The project could not be saved. Your input has been kept.'
        );
    } finally {
        saveButton.disabled = false;
        cancelButton.disabled = false;
    }
});

// Cancel editing without sending an API request.
cancelButton.addEventListener('click', () => {
    resetForm();
    showMessage('Edit cancelled. No changes were saved.');
    nameInput.focus();
});

// Load projects when the page starts.
resetForm();
loadProjects();
