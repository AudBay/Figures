const CLIENT_ID = "723239144035-d81o0o8ce35p4aqpokqe1n8k19fq1n2o.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/drive.file";

let tokenClient;
let accessToken = null;
let fileId = null;
let data = [];

/* ---------------------------
   WAIT FOR GOOGLE LIBRARIES
----------------------------*/
function waitForGoogle() {
  return new Promise(resolve => {
    const check = () => {
      if (window.google && window.google.accounts && window.gapi) {
        resolve();
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  });
}

/* ---------------------------
   INIT APP
----------------------------*/
async function init() {
  await waitForGoogle();

  await new Promise(resolve => {
    gapi.load("client", resolve);
  });

  await gapi.client.init({
    discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"]
  });

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: (tokenResponse) => {
      accessToken = tokenResponse.access_token;
      console.log("Login success");
      alert("Logged in");
    }
  });

  console.log("App ready");
}

init();

/* ---------------------------
   LOGIN (FIXED)
----------------------------*/
document.getElementById("loginBtn").onclick = () => {
  if (!tokenClient) {
    alert("Still loading Google services, try again");
    return;
  }

  tokenClient.requestAccessToken({ prompt: "consent" });
};

/* ---------------------------
   FIND OR CREATE FILE
----------------------------*/
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

/* ---------------------------
   LOAD
----------------------------*/
document.getElementById("loadBtn").onclick = async () => {
  if (!accessToken) return alert("Login first");

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

/* ---------------------------
   SAVE
----------------------------*/
document.getElementById("saveBtn").onclick = async () => {
  if (!accessToken) return alert("Login first");

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

  alert("Saved");
};

/* ---------------------------
   ADD ENTRY
----------------------------*/
function addEntry() {
  data.push({
    name: document.getElementById("name").value,
    period: Number(document.getElementById("period").value),
    sales: Number(document.getElementById("sales").value),
    hearingAids: Number(document.getElementById("hearingAids").value),
    wax: Number(document.getElementById("wax").value),
    waxRevenue: Number(document.getElementById("waxRevenue").value),
    refunds: Number(document.getElementById("refunds").value),
    hhc: Number(document.getElementById("hhc").value),
    hce: Number(document.getElementById("hce").value)
  });

  render();
}

/* ---------------------------
   METRICS
----------------------------*/
function render() {
  const output = data.map(e => ({
    ...e,
    waxToHHC: e.wax ? (e.hhc / e.wax) * 100 : 0,
    hhcToHCE: e.hhc ? (e.hce / e.hhc) * 100 : 0,
    hceToSale: e.hce ? (e.hearingAids / e.hce) * 100 : 0,
    avgSale: e.hearingAids ? e.sales / e.hearingAids : 0,
    net: e.sales - e.refunds
  }));

  document.getElementById("output").textContent =
    JSON.stringify(output, null, 2);
}
