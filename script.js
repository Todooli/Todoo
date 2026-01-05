// =========================
// VARIABLES GLOBALES
// =========================

const days = document.querySelectorAll("#week-container .day");
const progressText = document.getElementById("progress-text");
const progressFill = document.getElementById("progress-fill");

const hamburger = document.getElementById("hamburger");
const settingsPanel = document.getElementById("settings-panel");

const darkToggle = document.getElementById("darkmode-toggle");
const hourModeToggle = document.getElementById("hour-mode-toggle");
const startHourInput = document.getElementById("start-hour");
const endHourInput = document.getElementById("end-hour");

// Structure de base sauvegardée
let savedData = JSON.parse(localStorage.getItem("todoo-data")) || {
    darkMode: false,
    hourMode: false,
    startHour: 8,
    endHour: 22,
    currentWeek: null,
    archives: [],
    tasks: {
        lundi:   { normal: [], hourly: {} },
        mardi:   { normal: [], hourly: {} },
        mercredi:{ normal: [], hourly: {} },
        jeudi:   { normal: [], hourly: {} },
        vendredi:{ normal: [], hourly: {} },
        samedi:  { normal: [], hourly: {} },
        dimanche:{ normal: [], hourly: {} }
    }
};

// Sécurité si l'ancien localStorage n'avait pas toutes les clés
const dayKeys = ["lundi","mardi","mercredi","jeudi","vendredi","samedi","dimanche"];
dayKeys.forEach(d => {
    if (!savedData.tasks[d]) {
        savedData.tasks[d] = { normal: [], hourly: {} };
    }
});

// =========================
// OUTILS
// =========================

function save() {
    localStorage.setItem("todoo-data", JSON.stringify(savedData));
}
function getWeekStartDate() {
    const now = new Date();
    const day = now.getDay(); // 0 = dimanche
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    return monday.toISOString().split("T")[0];
}
function archiveOldWeek() {

    // 1) Si mode horaire → pas d'archive
    if (savedData.hourMode) {
        console.log("Archivage ignoré : mode horaire activé.");

        // On vide les cases horaires chaque semaine
        dayKeys.forEach(d => {
            savedData.tasks[d].hourly = {}; 
        });

        save();
        return;
    }

    // 2) Si pas de semaine précédente → rien à archiver
    if (!savedData.currentWeek) return;

    // 3) ARCHIVER normalement
    const archive = {
        weekStart: savedData.currentWeek,
        tasks: JSON.parse(JSON.stringify(savedData.tasks))
    };

    savedData.archives.push(archive);

    // 4) Réinitialiser la semaine (décocher mais garder les tâches)
    dayKeys.forEach(d => {
        savedData.tasks[d].normal.forEach(t => {
            t.completed = false;
        });
    });

    save();
}


// Récupère le nom du jour à partir de l'attribut data-day
function getDayKey(dayElement) {
    return dayElement.dataset.day; // ex: "lundi"
}
function calculateWeekProductivity(weekData) {
    let totalTasks = 0;
    let completedTasks = 0;

    dayKeys.forEach(day => {
        weekData.tasks[day].normal.forEach(t => {
            totalTasks++;
            if (t.completed) completedTasks++;
        });
    });

    if (totalTasks === 0) return 0;
    return Math.round((completedTasks / totalTasks) * 100);
}
let evolutionChart = null;

function renderEvolutionChart() {
    const ctx = document.getElementById("evolution-chart").getContext("2d");

    const labels = [];
    const data = [];

    savedData.archives.forEach(archive => {
        labels.push(archive.weekStart);
        data.push(calculateWeekProductivity(archive));
    });

    if (evolutionChart) {
        evolutionChart.destroy();
    }

    evolutionChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [{
                label: "Productivité (%)",
                data: data,
                borderColor: "#4CAF50",
                backgroundColor: "rgba(76, 175, 80, 0.2)",
                borderWidth: 2,
                tension: 0.3
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100
                }
            }
        }
    });
}

// =========================
// PROGRESSION (MODE NORMAL)
// =========================

function updateProgress(dayElement) {
    // En mode horaire, pour l'instant on ne calcule pas de progression
    if (hourModeToggle.checked) {
        progressText.textContent = "Mode horaire activé";
        progressFill.style.width = "0%";
        return;
    }

    const tasks = dayElement.querySelectorAll("li");
    const completed = dayElement.querySelectorAll("li.completed");

    if (tasks.length === 0) {
        progressText.textContent = "Aucune tâche";
        progressFill.style.width = "0%";
        return;
    }

    const percent = Math.round((completed.length / tasks.length) * 100);
    progressText.textContent = `Accomplissement : ${percent}%`;
    progressFill.style.width = percent + "%";
}

// =========================
// RENDU DES JOURS / TÂCHES
// =========================

function renderWeek() {
    const hourMode = hourModeToggle.checked;
    const start = parseInt(startHourInput.value);
    const end = parseInt(endHourInput.value);

    days.forEach(day => {
        const dayKey = getDayKey(day);
        const taskList = day.querySelector(".task-list");
        taskList.innerHTML = ""; // réinitialise toujours l'affichage

        // MODE HORAIRE
        if (hourMode) {
            const hourlyDiv = document.createElement("div");
            hourlyDiv.classList.add("hourly-container");

            for (let h = start; h <= end; h++) {
                const slot = document.createElement("div");
                slot.classList.add("hour-slot");

                const value =
                    savedData.tasks[dayKey].hourly[h] !== undefined
                        ? savedData.tasks[dayKey].hourly[h]
                        : "";

                slot.innerHTML = `
                    <span>${h}h</span>
                    <input type="text" placeholder="Tâche..." value="${value}">
                `;

                const input = slot.querySelector("input");
                input.addEventListener("input", (e) => {
                    savedData.tasks[dayKey].hourly[h] = e.target.value;
                    save();
                });

                hourlyDiv.appendChild(slot);
            }

            taskList.appendChild(hourlyDiv);
            return; // on ne rend pas les tâches normales en mode horaire
        }

        // MODE NORMAL
        const normalTasks = savedData.tasks[dayKey].normal;

        normalTasks.forEach((t, index) => {
            const li = document.createElement("li");
            if (t.completed) {
                li.classList.add("completed");
            }
            li.innerHTML = `
                <span>${t.text}</span>
                <button class="delete">X</button>
            `;
            taskList.appendChild(li);
        });

        // Gestion des clics sur les tâches (cocher / supprimer)
        taskList.addEventListener("click", (e) => {
            // Supprimer
            if (e.target.classList.contains("delete")) {
                const li = e.target.closest("li");
                const span = li.querySelector("span");
                const text = span.textContent;

                // Supprime aussi du savedData
                const idx = savedData.tasks[dayKey].normal.findIndex(t => t.text === text);
                if (idx !== -1) {
                    savedData.tasks[dayKey].normal.splice(idx, 1);
                    save();
                }

                li.remove();
                updateProgress(day);
                return;
            }

            // Cocher/décocher si on clique ailleurs que sur le bouton
            if (e.target.tagName !== "BUTTON" && e.target.closest("li")) {
                const li = e.target.closest("li");
                li.classList.toggle("completed");

                const span = li.querySelector("span");
                const text = span.textContent;
                const taskObj = savedData.tasks[dayKey].normal.find(t => t.text === text);
                if (taskObj) {
                    taskObj.completed = li.classList.contains("completed");
                    save();
                }

                updateProgress(day);
            }
        });

        // Mise à jour de la progression pour ce jour (après rendu)
        updateProgress(day);
    });
}

// =========================
// ÉVÉNEMENTS PAR JOUR
// =========================

// Boutons "Ajouter une tâche" (mode normal)
days.forEach(day => {
    const dayKey = getDayKey(day);
    const addBtn = day.querySelector(".add-btn");
    const taskList = day.querySelector(".task-list");

    // Ajout de tâche
    addBtn.addEventListener("click", () => {
        if (hourModeToggle.checked) {
            alert("Désactive le mode horaire pour ajouter des tâches classiques.");
            return;
        }

        const task = prompt("Nouvelle tâche :");
        if (task && task.trim() !== "") {
            const li = document.createElement("li");
            li.innerHTML = `
                <span>${task}</span>
                <button class="delete">X</button>
            `;
            taskList.appendChild(li);

            // Ajout dans savedData
            savedData.tasks[dayKey].normal.push({
                text: task,
                completed: false
            });
            save();

            updateProgress(day);
        }
    });

    // Clique sur le jour → met à jour la barre de progression
    day.addEventListener("click", () => {
        if (!hourModeToggle.checked) {
            updateProgress(day);
        } else {
            progressText.textContent = "Mode horaire activé";
            progressFill.style.width = "0%";
        }
    });
});

// =========================
// MODE SOMBRE
// =========================

darkToggle.addEventListener("change", () => {
    const isDark = darkToggle.checked;
    document.body.classList.toggle("dark", isDark);
    savedData.darkMode = isDark;
    save();
});

// =========================
// PANNEAU PARAMÈTRES
// =========================

hamburger.addEventListener("click", (e) => {
    e.stopPropagation();
    settingsPanel.classList.toggle("open");
});

settingsPanel.addEventListener("click", (e) => {
    e.stopPropagation();
});

document.addEventListener("click", () => {
    settingsPanel.classList.remove("open");
});
const showArchivesBtn = document.getElementById("show-archives");
const archivesList = document.getElementById("archives-list");
const archivesPanel = document.getElementById("archives-panel");

showArchivesBtn.addEventListener("click", () => {
    archivesPanel.classList.toggle("hidden");
    renderArchives();
    renderEvolutionChart();
});
const showGraphBtn = document.getElementById("show-graph");
const graphPanel = document.getElementById("graph-panel");

showGraphBtn.addEventListener("click", () => {
    graphPanel.classList.toggle("hidden");
    renderEvolutionChart();
});

function renderArchives() {
    archivesList.innerHTML = "";

    savedData.archives.forEach(archive => {
        const li = document.createElement("li");
        li.innerHTML = `
            <strong>Semaine du ${archive.weekStart}</strong>
            <button class="open-archive">Voir</button>
        `;

        li.querySelector(".open-archive").addEventListener("click", () => {
            alert(JSON.stringify(archive.tasks, null, 2));
        });

        archivesList.appendChild(li);
    });
}

// MODE HORAIRE : LISTENERS
// =========================

hourModeToggle.addEventListener("change", () => {

    if (hourModeToggle.checked) {
        alert("Attention : l'historique n'est pas disponible en mode horaire.");
    }

    savedData.hourMode = hourModeToggle.checked;
    save();
    renderWeek();
});

startHourInput.addEventListener("change", () => {
    if (parseInt(startHourInput.value) >= parseInt(endHourInput.value)) {
        startHourInput.value = endHourInput.value - 1;
    }
    savedData.startHour = parseInt(startHourInput.value);
    save();
    renderWeek();
});

endHourInput.addEventListener("change", () => {
    if (parseInt(endHourInput.value) <= parseInt(startHourInput.value)) {
        endHourInput.value = parseInt(startHourInput.value) + 1;
    }
    savedData.endHour = parseInt(endHourInput.value);
    save();
    renderWeek();
});

// =========================
// INITIALISATION
// =========================

// Appliquer les réglages sauvegardés
darkToggle.checked = savedData.darkMode;
document.body.classList.toggle("dark", savedData.darkMode);

hourModeToggle.checked = savedData.hourMode;
startHourInput.value = savedData.startHour;
endHourInput.value = savedData.endHour;

// Premier rendu
const thisWeek = getWeekStartDate();

if (savedData.currentWeek !== thisWeek) {
    archiveOldWeek();
    savedData.currentWeek = thisWeek;
    save();
}

renderWeek();

