const CLIENT_ID = "723239144035-d81o0o8ce35p4aqpokqe1n8k19fq1n2o.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/drive.file";

let tokenClient;
let accessToken = null;
let fileId = null;
let data = [];
let currentView = "overview";

/* ---------------- INIT ---------------- */
async function init() {
  await waitForGoogle();

  await new Promise(r => gapi.load("client", r));

  await gapi.client.init({
    discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"]
  });

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: (t) => {
      accessToken = t.access_token;
      alert("Logged in");
    }
  });

  render();
}

init();

function waitForGoogle() {
  return new Promise(r => {
    const i = setInterval(() => {
      if (window.google && window.gapi) {
        clearInterval(i);
        r();
      }
    }, 100);
  });
}

/* ---------------- LOGIN ---------------- */
document.getElementById("loginBtn").onclick = () => {
  tokenClient.requestAccessToken({ prompt: "consent" });
};

/* ---------------- DRIVE ---------------- */
async function getFile() {
  const res = await gapi.client.drive.files.list({
    q: "name='data.json'",
    fields: "files(id)"
  });

  if (res.result.files.length) {
    fileId = res.result.files[0].id;
  } else {
    const file = await gapi.client.drive.files.create({
      resource: { name: "data.json", mimeType: "application/json" },
      media: { mimeType: "application/json", body: "[]" }
    });
    fileId = file.result.id;
  }
}

document.getElementById("loadBtn").onclick = async () => {
  await getFile();

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: "Bearer " + accessToken } }
  );

  data = await res.json();
  render();
};

document.getElementById("saveBtn").onclick = async () => {
  const form = new FormData();

  form.append("file",
    new Blob([JSON.stringify(data)], { type: "application/json" })
  );

  await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
    {
      method: "PATCH",
      headers: { Authorization: "Bearer " + accessToken },
      body: form
    }
  );

  alert("Saved");
};

/* ---------------- DATA ---------------- */
function addEntry() {
  data.push({
    name: name.value,
    period: +period.value,
    sales: +sales.value,
    hearingAids: +hearingAids.value,
    wax: +wax.value,
    waxRevenue: +waxRevenue.value,
    refunds: +refunds.value,
    hhc: +hhc.value,
    hce: +hce.value
  });

  render();
}

/* ---------------- METRICS ---------------- */
function enrich(d) {
  return d.map(e => ({
    ...e,
    waxToHHC: e.wax ? (e.hhc / e.wax) * 100 : 0,
    hhcToHCE: e.hhc ? (e.hce / e.hhc) * 100 : 0,
    hceToSale: e.hce ? (e.hearingAids / e.hce) * 100 : 0,
    avgSale: e.hearingAids ? e.sales / e.hearingAids : 0,
    net: e.sales - e.refunds,
    revenuePerHHC: e.hhc ? e.sales / e.hhc : 0
  }));
}

/* ---------------- VIEWS ---------------- */
function setView(v) {
  currentView = v;
  render();
}

function render() {
  const d = enrich(data);
  const el = document.getElementById("view");

  if (currentView === "overview") {
    el.innerHTML = `
      <div class="card">
        <h2>Overview</h2>
        <pre>${JSON.stringify(d, null, 2)}</pre>
      </div>
    `;
  }

  if (currentView === "table") {
    el.innerHTML = `
      <div class="card">
        <h2>Table</h2>
        <table>
          <tr>
            <th>Name</th><th>Period</th><th>Sales</th><th>Net</th><th>HHC→HCE%</th>
          </tr>
          ${d.map(e => `
            <tr>
              <td>${e.name}</td>
              <td>${e.period}</td>
              <td>${e.sales}</td>
              <td>${e.net}</td>
              <td>${e.hhcToHCE.toFixed(1)}%</td>
            </tr>
          `).join("")}
        </table>
      </div>
    `;
  }

  if (currentView === "leaderboard") {
    const ranked = [...d].sort((a,b)=>b.net-a.net);

    el.innerHTML = `
      <div class="card">
        <h2>Leaderboard</h2>
        ${ranked.map((e,i)=>`
          <p>#${i+1} ${e.name} - £${e.net}</p>
        `).join("")}
      </div>
    `;
  }

  if (currentView === "insights") {
    el.innerHTML = `
      <div class="card">
        <h2>Insights</h2>
        <p>Top performer: ${d.sort((a,b)=>b.net-a.net)[0]?.name || "-"}</p>
        <p>Lowest conversion: ${d.sort((a,b)=>a.hhcToHCE-b.hhcToHCE)[0]?.name || "-"}</p>
      </div>
    `;
  }
}
