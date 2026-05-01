const CLIENT_ID = "723239144035-d81o0o8ce35p4aqpokqe1n8k19fq1n2o.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/drive.file";

let tokenClient;
let accessToken = null;
let fileId = null;
let data = [];
let view = "overview";
let editIndex = null;
let chart;

window.onload = async () => {
  await waitForGoogle();

  await new Promise(r => gapi.load("client", r));

  await gapi.client.init({
    discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"]
  });

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: t => accessToken = t.access_token
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

/* LOGIN */
document.getElementById("loginBtn").onclick = () =>
  tokenClient.requestAccessToken({ prompt: "consent" });

/* DRIVE */
async function getFile() {
  const res = await gapi.client.drive.files.list({
    q: "name='data.json'",
    fields: "files(id)"
  });

  if (res.result.files.length) fileId = res.result.files[0].id;
  else {
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

/* ADD */
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

/* EDIT */
function openEdit(i) {
  editIndex = i;
  const e = data[i];

  e_name.value = e.name;
  e_period.value = e.period;
  e_sales.value = e.sales;
  e_hearingAids.value = e.hearingAids;
  e_wax.value = e.wax;
  e_waxRevenue.value = e.waxRevenue;
  e_refunds.value = e.refunds;
  e_hhc.value = e.hhc;
  e_hce.value = e.hce;

  modal.classList.remove("hidden");
}

function saveEdit() {
  data[editIndex] = {
    name: e_name.value,
    period: +e_period.value,
    sales: +e_sales.value,
    hearingAids: +e_hearingAids.value,
    wax: +e_wax.value,
    waxRevenue: +e_waxRevenue.value,
    refunds: +e_refunds.value,
    hhc: +e_hhc.value,
    hce: +e_hce.value
  };

  closeModal();
  render();
}

function closeModal() {
  modal.classList.add("hidden");
}

/* DELETE */
function deleteEntry(i) {
  data.splice(i, 1);
  render();
}

/* CALC */
function calc(d) {
  return d.map(e => ({
    ...e,
    net: e.sales - e.refunds,
    hhcToHCE: e.hhc ? e.hce / e.hhc : 0,
    hceToSale: e.hce ? e.hearingAids / e.hce : 0
  }));
}

/* VIEW */
function setView(v) {
  view = v;
  render();
}

function render() {
  const d = calc(data);
  const el = document.getElementById("view");

  if (view === "overview") {
    const total = d.reduce((a,b)=>a+b.net,0);

    el.innerHTML = `
      <div class="card">
        <h2>Overview</h2>
        <p>Revenue: £${total.toFixed(2)}</p>
        <p>Records: ${d.length}</p>
      </div>
    `;
  }

  if (view === "table") {
    el.innerHTML = `
      <div class="card">
        <table>
          <tr>
            <th>Name</th>
            <th>Net</th>
            <th>Conversion</th>
            <th>Actions</th>
          </tr>

          ${d.map((e,i)=>`
            <tr>
              <td onclick="openEdit(${i})">${e.name}</td>
              <td>${e.net}</td>
              <td>${(e.hhcToHCE*100).toFixed(1)}%</td>
              <td><button onclick="deleteEntry(${i})">Delete</button></td>
            </tr>
          `).join("")}
        </table>
      </div>
    `;
  }

  if (view === "charts") {
    el.innerHTML = `<canvas id="chart"></canvas>`;

    setTimeout(() => {
      const ctx = document.getElementById("chart");

      if (chart) chart.destroy();

      chart = new Chart(ctx, {
        type: "bar",
        data: {
          labels: d.map(x=>x.name),
          datasets: [{
            label: "Revenue",
            data: d.map(x=>x.net)
          }]
        }
      });
    }, 100);
  }

  if (view === "insights") {
    const best = d.sort((a,b)=>b.net-a.net)[0];

    el.innerHTML = `
      <div class="card">
        <h2>Insights</h2>
        <p>Top performer: ${best?.name}</p>
      </div>
    `;
  }
}
