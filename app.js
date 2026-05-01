const CLIENT_ID = "723239144035-d81o0o8ce35p4aqpokqe1n8k19fq1n2o.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/drive.file";

let tokenClient, accessToken = null, fileId = null, data = [], view = "overview", editIndex = null, chart;

window.onload = async () => {
  await new Promise(r => gapi.load("client", r));
  await gapi.client.init({ discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"] });
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID, scope: SCOPES,
    callback: t => { accessToken = t.access_token; document.getElementById("loginBtn").innerText = "Connected"; }
  });
  render();
};

/* --- DATA LOGIC --- */
function addEntry() {
  const newRecord = {
    name: document.getElementById("name").value || "Unknown",
    period: parseInt(document.getElementById("period").value) || 0,
    sales: parseFloat(document.getElementById("sales").value) || 0,
    hearingAids: parseInt(document.getElementById("hearingAids").value) || 0,
    wax: parseInt(document.getElementById("wax").value) || 0,
    waxRevenue: parseFloat(document.getElementById("waxRevenue").value) || 0,
    refunds: parseFloat(document.getElementById("refunds").value) || 0,
    hhc: parseInt(document.getElementById("hhc").value) || 0,
    hce: parseInt(document.getElementById("hce").value) || 0
  };
  data.push(newRecord);
  render();
  // Clear inputs after save
  document.querySelectorAll('.entry-card input').forEach(i => i.value = i.type === 'number' ? 0 : '');
}

function calcMetrics(arr) {
  return arr.map(e => {
    const totalSales = e.sales + e.waxRevenue;
    return {
      ...e,
      totalSales,
      net: totalSales - e.refunds,
      waxToHhc: e.wax ? (e.hhc / e.wax) * 100 : 0,
      hhcToHce: e.hhc ? (e.hce / e.hhc) * 100 : 0,
      hceToSale: e.hce ? (e.hearingAids / e.hce) * 100 : 0
    };
  });
}

/* --- MODAL LOGIC (FIXED) --- */
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
    period: parseInt(document.getElementById("e_period").value),
    sales: parseFloat(document.getElementById("e_sales").value),
    hearingAids: parseInt(document.getElementById("e_hearingAids").value),
    wax: parseInt(document.getElementById("e_wax").value),
    waxRevenue: parseFloat(document.getElementById("e_waxRevenue").value),
    refunds: parseFloat(document.getElementById("e_refunds").value),
    hhc: parseInt(document.getElementById("e_hhc").value),
    hce: parseInt(document.getElementById("e_hce").value)
  };
  closeModal();
  render();
}

function closeModal() {
  document.getElementById("modal").classList.add("hidden");
}

function deleteEntry(i) {
  if(confirm("Delete this record?")) {
    data.splice(i, 1);
    render();
  }
}

/* --- VIEW CONTROLS --- */
function setView(v) {
  view = v;
  document.querySelectorAll('.sidebar button').forEach(b => b.classList.remove('active'));
  document.getElementById(`nav-${v}`).classList.add('active');
  document.getElementById('view-controls').style.display = (v === 'charts') ? 'block' : 'none';
  render();
}

function render() {
  const d = calcMetrics(data);
  const container = document.getElementById("view");
  
  if (view === "overview") {
    const sums = d.reduce((a, b) => ({
      net: a.net + b.net,
      wax: a.wax + b.wax,
      hhc: a.hhc + b.hhc,
      sales: a.sales + b.sales
    }), {net:0, wax:0, hhc:0, sales:0});

    container.innerHTML = `
      <div class="kpi-grid">
        <div class="kpi-card"><h4>Total Net Revenue</h4><p>£${sums.net.toLocaleString()}</p></div>
        <div class="kpi-card"><h4>Wax to HHC Conversion</h4><p>${sums.wax ? ((sums.hhc/sums.wax)*100).toFixed(1) : 0}%</p></div>
        <div class="kpi-card"><h4>Audiology Sales</h4><p>£${sums.sales.toLocaleString()}</p></div>
      </div>
    `;
  }

  if (view === "table") {
    container.innerHTML = `
      <div class="card">
        <table>
          <thead><tr><th>Name</th><th>Period</th><th>Net Rev</th><th>Conv %</th><th>Actions</th></tr></thead>
          <tbody>
            ${d.map((e, i) => `
              <tr>
                <td>${e.name}</td><td>${e.period}</td><td>£${e.net.toFixed(2)}</td>
                <td>${e.hceToSale.toFixed(1)}%</td>
                <td>
                  <button onclick="openEdit(${i})" class="btn-small">Edit</button>
                  <button onclick="deleteEntry(${i})" class="btn-small btn-danger">Delete</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`;
  }

  if (view === "charts") {
    const groupKey = document.getElementById("groupBy").value;
    const grouped = {};
    d.forEach(item => {
      const key = item[groupKey];
      if (!grouped[key]) grouped[key] = 0;
      grouped[key] += item.net;
    });

    container.innerHTML = `<div class="card"><canvas id="mainChart"></canvas></div>`;
    const ctx = document.getElementById('mainChart').getContext('2d');
    if (chart) chart.destroy();
    chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: Object.keys(grouped),
        datasets: [{ label: 'Net Revenue by ' + groupKey, data: Object.values(grouped), backgroundColor: '#2563eb' }]
      }
    });
  }
}
