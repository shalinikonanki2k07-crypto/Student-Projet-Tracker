
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
let mutationPending = false;

function showMessage(text) {
    message.textContent = text;
}

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

function updateMutationControls() {
    saveButton.disabled = mutationPending;
    cancelButton.disabled = mutationPending;

    projectList.querySelectorAll('button').forEach(button => {
        button.disabled = mutationPending;
    });
}

function resetForm() {
    form.reset();
    editingId = null;
    saveButton.textContent = 'Add';
    cancelButton.hidden = true;
}

async function loadProjects(showLoading = false) {
    if (showLoading) {
        showMessage('Loading projects...');
        if (emptyState) emptyState.hidden = true;
    }

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

        if (
            editingId !== null &&
            !projects.some(project => String(project.id) === String(editingId))
        ) {
            resetForm();
            showMessage('The project being edited no longer exists.');
        }

        renderProjects();

        if (projects.length === 0) {
            showMessage('No projects yet. Add your first project.');
        } else if (showLoading) {
            showMessage('');
        }

        return true;
    } catch (error) {
        showMessage(
            error instanceof TypeError
                ? 'Could not connect to the server. Check that it is running and try again.'
                : error.message || 'Could not load projects.'
        );

        // Do not show an empty collection when loading failed.
        if (showLoading && emptyState) {
            emptyState.hidden = true;
        }

        return false;
    }
}

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
        editButton.disabled = mutationPending;

        editButton.addEventListener('click', () => {
            if (mutationPending) return;

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
        deleteButton.disabled = mutationPending;

        deleteButton.addEventListener('click', async () => {
            if (mutationPending) return;

            const confirmed = window.confirm(
                `Are you sure you want to delete "${project.name}"?`
            );

            if (!confirmed || mutationPending) return;

            mutationPending = true;
            updateMutationControls();
            showMessage('Deleting project...');

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
                mutationPending = false;
                updateMutationControls();
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
        emptyState.hidden = projects.length > 0 || mutationPending;
    }

    updateMutationControls();
}

form.addEventListener('submit', async event => {
    event.preventDefault();

    if (mutationPending) return;

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

    // Preserve the user's input in case the request fails.
    const savedName = nameInput.value;
    const savedStatus = statusInput.value;
    const wasEditing = editingId !== null;

    const url = wasEditing
        ? `/api/projects/${encodeURIComponent(editingId)}`
        : '/api/projects';

    const method = wasEditing ? 'PUT' : 'POST';

    mutationPending = true;
    updateMutationControls();
    showMessage(wasEditing ? 'Saving changes...' : 'Saving project...');

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

        resetForm();
        showMessage(
            wasEditing
                ? 'Project updated successfully.'
                : 'Project added successfully.'
        );

        await loadProjects();
        nameInput.focus();
    } catch (error) {
        nameInput.value = savedName;
        statusInput.value = savedStatus;

        showMessage(
            error instanceof TypeError
                ? 'Could not connect to the server. Your input has been kept; please try again.'
                : `${error.message || 'The project could not be saved.'} Your input has been kept.`
        );
    } finally {
        mutationPending = false;
        updateMutationControls();
    }
});

cancelButton.addEventListener('click', () => {
    if (mutationPending) return;

    resetForm();
    showMessage('Edit cancelled. No changes were saved.');
    nameInput.focus();
});

resetForm();
loadProjects(true);
