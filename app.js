const CLIENT_ID = "723239144035-d81o0o8ce35p4aqpokqe1n8k19fq1n2o.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/drive.file";

let tokenClient;
let accessToken = null;
let fileId = null;
let data = [];

// INIT
window.onload = () => {
  gapi.load("client", initGapi);

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: (tokenResponse) => {
      accessToken = tokenResponse.access_token;
      alert("Logged in successfully");
    }
  });
};

async function initGapi() {
  await gapi.client.init({
    discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"]
  });
}

// LOGIN
document.getElementById("loginBtn").onclick = () => {
  tokenClient.requestAccessToken();
};

// FIND OR CREATE FILE
async function getFile() {
  const res = await gapi.client.drive.files.list({
    q: "name='data.json'",
    fields: "files(id, name)"
  });

  if (res.result.files.length > 0) {
    fileId = res.result.files[0].id;
  } else {
    const file = await gapi.client.drive.files.create({
      resource: {
        name: "data.json",
        mimeType: "application/json"
      },
      media: {
        mimeType: "application/json",
        body: JSON.stringify([])
      }
    });

    fileId = file.result.id;
  }
}

// LOAD DATA
document.getElementById("loadBtn").onclick = async () => {
  await getFile();

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: {
        Authorization: "Bearer " + accessToken
      }
    }
  );

  data = await res.json();
  render();
};

// SAVE DATA
document.getElementById("saveBtn").onclick = async () => {
  const metadata = {
    name: "data.json",
    mimeType: "application/json"
  };

  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", new Blob([JSON.stringify(data)], { type: "application/json" }));

  await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`,
    {
      method: "PATCH",
      headers: {
        Authorization: "Bearer " + accessToken
      },
      body: form
    }
  );

  alert("Saved to Google Drive");
};

// ADD ENTRY
function addEntry() {
  const entry = {
    name: document.getElementById("name").value,
    period: Number(document.getElementById("period").value),
    sales: Number(document.getElementById("sales").value),
    hearingAids: Number(document.getElementById("hearingAids").value),
    wax: Number(document.getElementById("wax").value),
    waxRevenue: Number(document.getElementById("waxRevenue").value),
    refunds: Number(document.getElementById("refunds").value),
    hhc: Number(document.getElementById("hhc").value),
    hce: Number(document.getElementById("hce").value),
    timestamp: new Date().toISOString()
  };

  data.push(entry);
  render();
}

// CALCULATIONS
function calculateMetrics(d) {
  return d.map(e => ({
    ...e,
    waxToHHC: e.wax ? (e.hhc / e.wax) * 100 : 0,
    hhcToHCE: e.hhc ? (e.hce / e.hhc) * 100 : 0,
    hceToSale: e.hce ? (e.hearingAids / e.hce) * 100 : 0,
    avgSale: e.hearingAids ? e.sales / e.hearingAids : 0,
    netRevenue: e.sales - e.refunds
  }));
}

// RENDER
function render() {
  const calculated = calculateMetrics(data);

  document.getElementById("output").textContent =
    JSON.stringify(calculated, null, 2);
}
