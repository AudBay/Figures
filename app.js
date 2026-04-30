const CLIENT_ID = "723239144035-d81o0o8ce35p4aqpokqe1n8k19fq1n2o.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/drive.file";

let tokenClient, accessToken = null, fileId = null, data = [], view = "overview", editIndex = null, chart;

window.onload = async () => {
  await new Promise(r => gapi.load("client", r));
  await gapi.client.init({ discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"] });
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID, scope: SCOPES,
    callback: t => { accessToken = t.access_token; alert("Connected!"); }
  });
  render();
};

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

function setView(v) {
  view = v;
  document.querySelectorAll('.sidebar button').forEach(b => b.classList.remove('active'));
  document.getElementById(`nav-${v}`).classList.add('active');
  document.getElementById('view-controls').className = (v === 'charts') ? '' : 'hidden';
  render();
}

function render() {
  const d = calcMetrics(data);
  const container = document.getElementById("view");
  
  if (view === "overview") {
    const totalRev = d.reduce((acc, curr) => acc + curr.net, 0);
    const totalWax = d.reduce((acc, curr) => acc + curr.wax, 0);
    const totalHHC = d.reduce((acc, curr) => acc + curr.hhc, 0);

    container.innerHTML = `
      <div class="kpi-grid">
        <div class="kpi-card"><h4>Total Revenue (Net)</h4><p>£${totalRev.toLocaleString()}</p></div>
        <div class="kpi-card"><h4>Wax to HHC Conversion</h4><p>${totalWax ? ((totalHHC/totalWax)*100).toFixed(1) : 0}%</p></div>
        <div class="kpi-card"><h4>Total Records</h4><p>${d.length}</p></div>
      </div>
    `;
  }

  if (view === "table") {
    container.innerHTML = `
      <div class="card">
        <table>
          <thead>
            <tr><th>Name</th><th>Period</th><th>Net Rev</th><th>HHC \u2192 HCE %</th><th>HCE \u2192 Sale %</th><th>Actions</th></tr>
          </thead>
          <tbody>
            ${d.map((e, i) => `
              <tr>
                <td>${e.name}</td><td>${e.period}</td><td>£${e.net.toFixed(2)}</td>
                <td>${e.hhcToHce.toFixed(1)}%</td><td>${e.hceToSale.toFixed(1)}%</td>
                <td><button onclick="deleteEntry(${i})" class="btn-small">Delete</button></td>
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
      if (!grouped[key]) grouped[key] = { net: 0, sales: 0 };
      grouped[key].net += item.net;
      grouped[key].sales += item.sales;
    });

    container.innerHTML = `<div class="card"><canvas id="mainChart"></canvas></div>`;
    
    const ctx = document.getElementById('mainChart').getContext('2d');
    if (chart) chart.destroy();
    chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: Object.keys(grouped),
        datasets: [{
          label: 'Net Revenue (£)',
          data: Object.values(grouped).map(v => v.net),
          backgroundColor: '#2563eb'
        }]
      },
      options: { responsive: true, plugins: { title: { display: true, text: `Comparison by ${groupKey}` } } }
    });
  }
}

// Drive logic remains same as original but uses the fixed document.getElementById calls
