const CLIENT_ID = "723239144035-d81o0o8ce35p4aqpokqe1n8k19fq1n2o.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/drive.file";

let tokenClient;
let accessToken = null;
let fileId = null;
let data = [];
let view = "kpis";

/* ---------------- INIT ---------------- */
window.onload = async () => {
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
};

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
document.getElementById("loginBtn").onclick = () =>
  tokenClient.requestAccessToken({ prompt: "consent" });

/* ---------------- DRIVE FILE ---------------- */
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

/* ---------------- LOAD ---------------- */
document.getElementById("loadBtn").onclick = async () => {
  await getFile();

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: "Bearer " + accessToken } }
  );

  data = await res.json();
  render();
};

/* ---------------- SAVE ---------------- */
document.getElementById("saveBtn").onclick = async () => {
  await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
    {
      method: "PATCH",
      headers: { Authorization: "Bearer " + accessToken },
      body: new Blob([JSON.stringify(data)], { type: "application/json" })
    }
  );

  alert("Saved");
};

/* ---------------- ADD ENTRY ---------------- */
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

/* ---------------- METRICS ENGINE ---------------- */
function enrich(d) {
  return d.map(e => ({
    ...e,
    net: e.sales - e.refunds,
    waxToHHC: e.wax ? e.hhc / e.wax : 0,
    hhcToHCE: e.hhc ? e.hce / e.hhc : 0,
    hceToSale: e.hce ? e.hearingAids / e.hce : 0,
    avgSale: e.hearingAids ? e.sales / e.hearingAids : 0
  }));
}

/* ---------------- VIEWS ---------------- */
function setView(v) {
  view = v;
  render();
}

function render() {
  const d = enrich(data);
  const el = document.getElementById("view");

  if (view === "kpis") {
    const total = d.reduce((a,b)=>a+b.net,0);

    el.innerHTML = `
      <div class="card">
        <h2>KPIs</h2>
        <p>Total Revenue: £${total.toFixed(2)}</p>
        <p>Top Performer: ${d.sort((a,b)=>b.net-a.net)[0]?.name || "-"}</p>
      </div>
    `;
  }

  if (view === "table") {
    el.innerHTML = `
      <div class="card">
        <table>
          <tr><th>Name</th><th>Net</th><th>HHC→HCE</th></tr>
          ${d.map(e=>`
            <tr>
              <td>${e.name}</td>
              <td>${e.net}</td>
              <td>${(e.hhcToHCE*100).toFixed(1)}%</td>
            </tr>
          `).join("")}
        </table>
      </div>
    `;
  }

  if (view === "insights") {
    el.innerHTML = `
      <div class="card">
        <h2>Insights</h2>
        <p>Best: ${d.sort((a,b)=>b.net-a.net)[0]?.name}</p>
        <p>Worst conversion: ${d.sort((a,b)=>a.hhcToHCE-b.hhcToHCE)[0]?.name}</p>
      </div>
    `;
  }

  if (view === "charts") {
    el.innerHTML = `<div class="card"><p>Charts ready for upgrade (next step)</p></div>`;
  }
}
