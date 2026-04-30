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
    callback: t => {
      accessToken = t.access_token;
      document.getElementById("loginBtn").textContent = "Logged In";
      document.getElementById("loginBtn").style.backgroundColor = "var(--success)";
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

/* LOGIN & DRIVE */
document.getElementById("loginBtn").onclick = () => tokenClient.requestAccessToken({ prompt: "consent" });

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
  alert("Data loaded successfully.");
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
  alert("Data saved to Drive.");
};

/* ADD ENTRY */
function addEntry() {
  data.push({
    name: document.getElementById("name").value,
    period: +document.getElementById("period").value || 0,
    sales: +document.getElementById("sales").value || 0,
    hearingAids: +document.getElementById("hearingAids").value || 0,
    wax: +document.getElementById("wax").value || 0,
    waxRevenue: +document.getElementById("waxRevenue").value || 0,
    refunds: +document.getElementById("refunds").value || 0,
    hhc: +document.getElementById("hhc").value || 0,
    hce: +document.getElementById("hce").value || 0
  });
  
  // Clear inputs
  document.querySelectorAll('.input-group input').forEach(input => input.value = '');
  render();
}

/* EDIT & DELETE */
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

function closeModal() {
  document.getElementById("modal").classList.add("hidden");
}

function deleteEntry(i) {
  if(confirm("Are you sure you want to delete this record?")) {
    data.splice(i, 1);
    render();
  }
}

/* CALCULATIONS */
function calc(d) {
  return d.map(e => {
    const totalSales = e.sales + e.waxRevenue;
    return {
      ...e,
      totalSales: totalSales,
      net: totalSales - e.refunds,
      waxToHhcConv: e.wax ? (e.hhc / e.wax) * 100 : 0,
      hhcToHceConv: e.hhc ? (e.hce / e.hhc) * 100 : 0,
      hceToSaleConv: e.hce ? (e.hearingAids / e.hce) * 100 : 0
    };
  });
}

/* VIEW SWITCHER & RENDER */
function setView(v) {
  view = v;
  document.querySelectorAll('.sidebar-nav button').forEach(btn => btn.classList.remove('active'));
  document.getElementById(`nav-${v}`).classList.add('active');
  render();
}

function render() {
  const d = calc(data);
  const el = document.getElementById("view");

  if (view === "overview") {
    // Aggregate totals
    const sums = d.reduce((acc, curr) => ({
      sales: acc.sales + curr.sales,
      waxRevenue: acc.waxRevenue + curr.waxRevenue,
      totalSales: acc.totalSales + curr.totalSales,
      refunds: acc.refunds + curr.refunds,
      net: acc.net + curr.net,
      wax: acc.wax + curr.wax,
      hhc: acc.hhc + curr.hhc,
      hce: acc.hce + curr.hce,
      hearingAids: acc.hearingAids + curr.hearingAids
    }), {sales:0, waxRevenue:0, totalSales:0, refunds:0, net:0, wax:0, hhc:0, hce:0, hearingAids:0});

    const globalWaxToHhc = sums.wax ? (sums.hhc / sums.wax) * 100 : 0;
    const globalHhcToHce = sums.hhc ? (sums.hce / sums.hhc) * 100 : 0;
    const globalHceToSale = sums.hce ? (sums.hearingAids / sums.hce) * 100 : 0;

    el.innerHTML = `
      <div class="kpi-grid">
        <div class="kpi-card highlight">
          <h4>Total Sales</h4>
          <p>£${sums.totalSales.toLocaleString('en-GB', {minimumFractionDigits: 2})}</p>
        </div>
        <div class="kpi-card highlight">
          <h4>Net Revenue</h4>
          <p>£${sums.net.toLocaleString('en-GB', {minimumFractionDigits: 2})}</p>
        </div>
        <div class="kpi-card">
          <h4>Audiology Sales</h4>
          <p>£${sums.sales.toLocaleString('en-GB', {minimumFractionDigits: 2})}</p>
        </div>
        <div class="kpi-card">
          <h4>Wax Removal Revenue</h4>
          <p>£${sums.waxRevenue.toLocaleString('en-GB', {minimumFractionDigits: 2})}</p>
        </div>
        <div class="kpi-card">
          <h4>Total Refunds</h4>
          <p class="text-danger">£${sums.refunds.toLocaleString('en-GB', {minimumFractionDigits: 2})}</p>
        </div>
      </div>

      <h2 class="section-title">Clinical Metrics & Conversions</h2>
      <div class="kpi-grid">
        <div class="kpi-card">
          <h4>Wax Removals</h4>
          <p>${sums.wax}</p>
        </div>
        <div class="kpi-card">
          <h4>HHC (Health Checks)</h4>
          <p>${sums.hhc}</p>
        </div>
        <div class="kpi-card">
          <h4>HCE (Examinations)</h4>
          <p>${sums.hce}</p>
        </div>
      </div>
      
      <div class="kpi-grid" style="margin-top: 15px;">
        <div class="kpi-card conversion">
          <h4>Wax to HHC Conversion</h4>
          <p>${globalWaxToHhc.toFixed(1)}%</p>
          <span>${sums.hhc} HHCs from ${sums.wax} Removals</span>
        </div>
        <div class="kpi-card conversion">
          <h4>HHC to HCE Conversion</h4>
          <p>${globalHhcToHce.toFixed(1)}%</p>
          <span>${sums.hce} HCEs from ${sums.hhc} HHCs</span>
        </div>
        <div class="kpi-card conversion">
          <h4>HCE to Sale Conversion</h4>
          <p>${globalHceToSale.toFixed(1)}%</p>
          <span>${sums.hearingAids} Sales from ${sums.hce} HCEs</span>
        </div>
      </div>
    `;
  }

  if (view === "table") {
    el.innerHTML = `
      <div class="card table-container">
        <table>
          <tr>
            <th>Name</th>
            <th>Period</th>
            <th>Total Sales</th>
            <th>Net Revenue</th>
            <th>Wax \u2192 HHC</th>
            <th>HHC \u2192 HCE</th>
            <th>HCE \u2192 Sale</th>
            <th>Actions</th>
          </tr>
          ${d.map((e,i)=>`
            <tr>
              <td><strong>${e.name}</strong></td>
              <td>${e.period}</td>
              <td>£${e.totalSales.toLocaleString()}</td>
              <td>£${e.net.toLocaleString()}</td>
              <td>${e.waxToHhcConv.toFixed(1)}%</td>
              <td>${e.hhcToHceConv.toFixed(1)}%</td>
              <td>${e.hceToSaleConv.toFixed(1)}%</td>
              <td>
                <button class="btn-small" onclick="openEdit(${i})">Edit</button>
                <button class="btn-small btn-danger" onclick="deleteEntry(${i})">Delete</button>
              </td>
            </tr>
          `).join("")}
        </table>
      </div>
    `;
  }

  if (view === "charts") {
    el.innerHTML = `<div class="card"><canvas id="chart"></canvas></div>`;
    setTimeout(() => {
      const ctx = document.getElementById("chart");
      if (chart) chart.destroy();
      chart = new Chart(ctx, {
        type: "bar",
        data: {
          labels: d.map(x=>x.name),
          datasets: [
            { label: "Audiology Sales", data: d.map(x=>x.sales), backgroundColor: "#3b82f6" },
            { label: "Wax Revenue", data: d.map(x=>x.waxRevenue), backgroundColor: "#10b981" }
          ]
        },
        options: { responsive: true, scales: { x: { stacked: true }, y: { stacked: true } } }
      });
    }, 100);
  }

  if (view === "insights") {
    const bestSales = [...d].sort((a,b)=>b.net-a.net)[0];
    const bestConv = [...d].sort((a,b)=>b.hceToSaleConv-a.hceToSaleConv)[0];
    el.innerHTML = `
      <div class="kpi-grid">
        <div class="kpi-card highlight">
          <h4>Top Revenue Generator</h4>
          <p>${bestSales ? bestSales.name : 'N/A'}</p>
          <span>£${bestSales ? bestSales.net.toLocaleString() : '0'} Net</span>
        </div>
        <div class="kpi-card highlight">
          <h4>Top Closer (HCE to Sale)</h4>
          <p>${bestConv ? bestConv.name : 'N/A'}</p>
          <span>${bestConv ? bestConv.hceToSaleConv.toFixed(1) : '0'}% Conversion</span>
        </div>
      </div>
    `;
  }
}
