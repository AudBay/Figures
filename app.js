const CLIENT_ID = "723239144035-d81o0o8ce35p4aqpokqe1n8k19fq1n2o.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/drive.file";

let tokenClient, accessToken = null, fileId = null, data = [], view = "overview", chart;

// Helper to update our status console
function logStatus(msg) {
    console.log(msg);
    document.getElementById("statusLog").innerText = "Status: " + msg;
}

window.onload = () => {
    logStatus("Loading Google Scripts...");
    try {
        gapi.load("client", async () => {
            await gapi.client.init({
                discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"]
            });
            logStatus("GAPI Initialized.");
        });

        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: (tokenResponse) => {
                if (tokenResponse.access_token) {
                    accessToken = tokenResponse.access_token;
                    logStatus("Login Successful!");
                    document.getElementById("loginBtn").style.background = "#10b981";
                    document.getElementById("loginBtn").innerText = "Google Connected";
                }
            },
        });
        
        attachButtonEvents(); // Force attach listeners
        render();
    } catch (e) {
        logStatus("Error during init: " + e.message);
    }
};

function attachButtonEvents() {
    // We use this to make sure the buttons actually have actions assigned to them
    const login = document.getElementById("loginBtn");
    const load = document.getElementById("loadBtn");
    const save = document.getElementById("saveBtn");

    if (login) login.onclick = () => {
        logStatus("Opening Login Pop-up...");
        tokenClient.requestAccessToken({ prompt: "consent" });
    };

    if (load) load.onclick = async () => {
        if (!accessToken) {
            logStatus("Error: Login first!");
            return alert("Please login to Google first.");
        }
        logStatus("Searching for data file...");
        await loadFromDrive();
    };

    if (save) save.onclick = async () => {
        if (!accessToken) {
            logStatus("Error: Login first!");
            return alert("Please login to Google first.");
        }
        logStatus("Saving to Drive...");
        await saveToDrive();
    };
}

async function loadFromDrive() {
    try {
        const res = await gapi.client.drive.files.list({ q: "name='audiology_v2.json'" });
        if (res.result.files.length > 0) {
            fileId = res.result.files[0].id;
            const file = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
                headers: { Authorization: "Bearer " + accessToken }
            });
            data = await file.json();
            render();
            logStatus("Data Loaded.");
        } else {
            logStatus("No file found on Drive yet.");
        }
    } catch (err) {
        logStatus("Load Error: " + err.message);
    }
}

async function saveToDrive() {
    try {
        if (!fileId) {
            const res = await gapi.client.drive.files.create({
                resource: { name: "audiology_v2.json", mimeType: "application/json" },
                media: { mimeType: "application/json", body: JSON.stringify(data) }
            });
            fileId = res.result.id;
        } else {
            await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
                method: "PATCH",
                headers: { Authorization: "Bearer " + accessToken },
                body: new Blob([JSON.stringify(data)], { type: "application/json" })
            });
        }
        logStatus("Save Successful!");
    } catch (err) {
        logStatus("Save Error: " + err.message);
    }
}

/* KEEP YOUR EXISTING: addEntry, calcMetrics, setView, and render functions HERE */
