const CLIENT_ID = "723239144035-d81o0o8ce35p4aqpokqe1n8k19fq1n2o.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/drive.file";

let tokenClient, accessToken = null, fileId = null, data = [], view = "overview", editIndex = null, chart;

window.onload = async () => {
  await new Promise(r => gapi.load("client", r));
  await gapi.client.init({ discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"] });
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID, scope: SCOPES,
    callback: t => { accessToken = t.access_token; alert("Google Connected"); }
  });
  render();
};

/* --- GOOGLE OPERATIONS --- */
document.getElementById("loginBtn").onclick = () => tokenClient.requestAccessToken({ prompt: "consent" });

document.getElementById("loadBtn").onclick = async () => {
  if (!accessToken) return alert("Login first");
  const res = await gapi.client.drive.files.list({ q: "name='audiology_v3.json'" });
  if (res.result.files.length) {
    fileId = res.result.files[0].id;
    const file = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: "Bearer " + accessToken }
    });
    data = await file.json();
    render();
  }
};

document.getElementById("saveBtn").onclick = async () => {
  if (!accessToken) return alert("Login first");
  if (!fileId) {
    const res = await gapi.client.drive.files.create({
      resource: { name: "audiology_v3.json", mimeType: "application/json" },
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
  alert("Saved");
};

/* --- APP LOGIC --- */
function addEntry() {
  data.push({
    name: document.getElementById("name").value,
    period: +document.getElementById("period").value,
    sales: +document.getElementById("sales").value,
    hearingAids: +document.getElementById("hearingAids").value,
    wax: +document.getElementById("wax").value,
    waxRevenue: +document.getElementById("waxRevenue").value,
    refunds: +document.getElementById("refunds").value,
    hhc: +document.getElementById("hhc").value,
    hce: +document.getElementById("hce").value
  });
  render();
}

function calc(arr) {
  return arr.map(e => {
    const total = e.sales + e.waxRevenue;
    return {
      ...e,
      totalSales: total,
      net: total - e.refunds,
      waxToHhc: e.wax ? (e.hhc / e.wax) * 100 : 0,
      hhcToHce: e.hhc ? (e.hce / e.hhc) * 100 : 0,
      hceToSale: e.hce ? (e.hearingAids / e.hce) * 100 : 0
    };
  });
}

function openEdit(i) {
  editIndex = i;
  const e = data[i];
  document.getElementById("e_name").value = e.name;
  document.getElementById("e_period").value = e.period;
  document.getElementById("e_sales").value = e.sales;
  document.getElementById("e_hearingAids").value = e.hearingAids;
  document.getElementById("e_wax").value = e.wax;
  document.getElementById("e_waxRevenue").value = e.waxRevenue;
  document.getElementById("e_refunds").value = e.refunds;
  document.getElementById("e_hhc").value = e.hhc;
  document.getElementById("e_hce").value = e.hce;
  document.getElementById("modal").classList.remove("hidden");
}

function saveEdit() {
  data[editIndex] = {
    name: document.getElementById("e_name").value,
    period: +document.getElementById("e_period").value,
    sales: +document.getElementById("e_sales").value,
    hearingAids: +document.getElementById("e_hearingAids").value,
    wax: +document.getElementById("e_wax").value,
    waxRevenue: +document.getElementById("e_waxRevenue").value,
    refunds: +document.getElementById("e_refunds").value,
    hhc: +document.getElementById("e_hhc").value,
    hce: +document.getElementById("e_hce").value
  };
  closeModal();
  render();
}

function closeModal() { document.getElementById("modal").classList.add("hidden"); }

function setView(v) {
  view = v;
  document.querySelectorAll('.sidebar button').forEach(b => b.classList.remove('active'));
  document.getElementById(`nav-${v}`).classList.add('active');
  document.getElementById('view-controls').className = (v === 'charts') ? '' : 'hidden';
  render();
}

function render() {
  const d = calc(data);
  const el = document.getElementById("view");
  if (view === "overview") {
    const net = d.reduce((a,b)=>a+b.net, 0);
    el.innerHTML = `<div class="kpi-grid"><div class="kpi-card"><h4>Net Revenue</h4><p>£${net.toLocaleString()}</p></div></div>`;
  }
  if (view === "table") {
    el.innerHTML = `<table><tr><th>Name</th><th>Net</th><th>HHC\u2192HCE</th><th>Action</th></tr>
    ${d.map((e,i)=>`<tr><td>${e.name}</td><td>£${e.net}</td><td>${e.hhcToHce.toFixed(1)}%</td><td><button onclick="openEdit(${i})">Edit</button></td></tr>`).join('')}
    </table>`;
  }
  if (view === "charts") {
    const key = document.getElementById("groupBy").value;
    const grouped = {};
    d.forEach(x => { grouped[x[key]] = (grouped[x[key]] || 0) + x.net; });
    el.innerHTML = `<canvas id="c"></canvas>`;
    if (chart) chart.destroy();
    chart = new Chart(document.getElementById("c"), {
      type: 'bar', data: { labels: Object.keys(grouped), datasets: [{ label: 'Net Rev', data: Object.values(grouped), backgroundColor: '#2563eb' }] }
    });
  }
}
