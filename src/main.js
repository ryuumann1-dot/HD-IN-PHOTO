
import { removeBackground } from "@imgly/background-removal";

const $ = id => document.getElementById(id);

let scale = 2;
let hdFile = null;
let bgFile = null;
let hdOutput = null;
let bgOutput = null;
let demoHD = true;

function status(id, message) {
  $(id).textContent = message;
}

function showLoading(title, message) {
  $("loading").classList.remove("hidden");
  $("loadingTitle").textContent = title;
  $("loadingText").textContent = message;
  $("progressBar").style.width = "0%";
  $("progressLabel").textContent = "Sedang mempersiapkan...";
}

function updateProgress(percent, message) {
  $("progressBar").style.width = Math.max(0,Math.min(100,percent)) + "%";
  $("progressLabel").textContent = message;
}

function hideLoading() {
  $("loading").classList.add("hidden");
}

function setCompare(id, value) {
  $(id).style.setProperty("--split", value + "%");
}

$("hdSlider").addEventListener("input", e =>
  setCompare("hd", e.target.value)
);
$("bgSlider").addEventListener("input", e =>
  setCompare("bg", e.target.value)
);

// Tabs
document.querySelectorAll(".tab").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
    document.querySelectorAll(".page").forEach(x => x.classList.remove("active"));

    button.classList.add("active");
    $(button.dataset.page).classList.add("active");
  });
});

// Scale
document.querySelectorAll(".quality").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".quality").forEach(x => x.classList.remove("selected"));
    button.classList.add("selected");
    scale = Number(button.dataset.scale);
  });
});

// Upload
function preview(file, before, after) {
  const url = URL.createObjectURL(file);
  $(before).src = url;
  $(after).src = url;
  return url;
}

$("hdFile").addEventListener("change", e => {
  const file = e.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) return status("hdStatus","File bukan gambar.");

  hdFile = file;
  demoHD = false;
  preview(file,"hdBefore","hdAfter");
  status("hdStatus","Foto dipilih. Masukkan URL publik untuk memproses HD.");
});

$("bgFile").addEventListener("change", e => {
  const file = e.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) return status("bgStatus","File bukan gambar.");

  bgFile = file;
  preview(file,"bgBefore","bgAfter");
  status("bgStatus","Foto siap diproses.");
});

// Ultra HD
$("enhanceBtn").addEventListener("click", async () => {
  const url = $("hdUrl").value.trim();

  if (!url) {
    status("hdStatus","Masukkan URL publik gambar terlebih dahulu.");
    return;
  }

  try {
    const parsed = new URL(url);
    if (!["http:","https:"].includes(parsed.protocol)) throw new Error();
  } catch {
    status("hdStatus","URL gambar tidak valid.");
    return;
  }

  const button = $("enhanceBtn");
  button.disabled = true;
  showLoading("Ultra HD","Menghubungi server...");

  try {
    const response = await fetch("/api/enhance", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({url}),
      signal:AbortSignal.timeout(60000)
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || "API gagal: HTTP " + response.status);
    }

    const type = response.headers.get("content-type") || "";
    let resultURL;

    if (type.startsWith("image/")) {
      const blob = await response.blob();
      if (hdOutput) URL.revokeObjectURL(hdOutput);
      hdOutput = URL.createObjectURL(blob);
      resultURL = hdOutput;
    } else {
      const data = await response.json();
      resultURL = findImageURL(data);
      if (!resultURL) throw new Error("Hasil gambar tidak ditemukan.");
    }

    $("hdBefore").src = url;
    $("hdAfter").src = resultURL;
    status("hdStatus","Berhasil! Geser garis untuk membandingkan.");
    updateProgress(100,"Selesai!");

  } catch (error) {
    status("hdStatus","Gagal: " + error.message);
  } finally {
    button.disabled = false;
    hideLoading();
  }
});

function findImageURL(data) {
  if (typeof data === "string") {
    return /^(https?:\/\/|data:image\/)/i.test(data) ? data : null;
  }

  if (!data || typeof data !== "object") return null;

  for (const key of ["url","image","imageUrl","result","output","downloadUrl","output_url"]) {
    const found = findImageURL(data[key]);
    if (found) return found;
  }

  for (const value of Object.values(data)) {
    const found = findImageURL(value);
    if (found) return found;
  }

  return null;
}

// Background Remover
$("removeBtn").addEventListener("click", async () => {
  if (!bgFile) {
    status("bgStatus","Upload foto terlebih dahulu.");
    return;
  }

  const button = $("removeBtn");
  button.disabled = true;

  showLoading("AI Background Remover","Memuat model AI. Pertama kali mungkin lebih lama.");

  try {
    const result = await removeBackground(bgFile, {
      model:"isnet_fp16",
      output:{
        format:"image/png",
        quality:1
      },
      progress:(key,current,total) => {
        if (total > 0) {
          const percent = Math.round(current / total * 100);
          updateProgress(percent,"Memuat model AI: " + key);
        } else {
          updateProgress(5,"AI sedang memproses foto...");
        }
      }
    });

    if (!(result instanceof Blob) || result.size === 0) {
      throw new Error("Hasil PNG kosong.");
    }

    if (bgOutput) URL.revokeObjectURL(bgOutput);
    bgOutput = URL.createObjectURL(result);

    $("bgAfter").src = bgOutput;

    await new Promise((resolve,reject) => {
      $("bgAfter").onload = resolve;
      $("bgAfter").onerror = reject;
    });

    updateProgress(100,"Background berhasil dihapus.");
    status("bgStatus","Berhasil! Geser garis untuk melihat perbedaan.");

  } catch (error) {
    console.error(error);
    status("bgStatus","Gagal: " + (error.message || "Model AI tidak dapat dimuat."));
  } finally {
    button.disabled = false;
    setTimeout(hideLoading,500);
  }
});

// Download
async function download(src, filename) {
  if (!src) return alert("Belum ada hasil gambar.");

  try {
    const response = await fetch(src);
    if (!response.ok) throw new Error("Download gagal.");

    const blob = await response.blob();
    const objectURL = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = objectURL;
    a.download = filename;
    a.click();

    setTimeout(() => URL.revokeObjectURL(objectURL),2000);
  } catch (error) {
    alert("Tidak bisa mengunduh gambar: " + error.message);
  }
}

$("downloadHD").addEventListener("click", () =>
  download(hdOutput,"ryuu-ultra-hd.png")
);

$("downloadBG").addEventListener("click", () =>
  download(bgOutput,"ryuu-background-removed.png")
);

// Dust animation
const dust = document.createElement("canvas");
$("dust").appendChild(dust);
const ctx = dust.getContext("2d");
let particles = [];

function resize() {
  const ratio = Math.min(devicePixelRatio || 1,2);
  dust.width = innerWidth * ratio;
  dust.height = innerHeight * ratio;
  dust.style.width = innerWidth + "px";
  dust.style.height = innerHeight + "px";
  ctx.setTransform(ratio,0,0,ratio,0,0);

  particles = Array.from({length:55}, () => ({
    x:Math.random()*innerWidth,
    y:Math.random()*innerHeight,
    size:Math.random()*1.5+.3,
    speed:Math.random()*.25+.05,
    alpha:Math.random()*.35+.1
  }));
}

function animate() {
  ctx.clearRect(0,0,innerWidth,innerHeight);

  for (const p of particles) {
    p.y -= p.speed;
    p.x += Math.sin(p.y*.008)*.1;

    if (p.y < -5) {
      p.y = innerHeight+5;
      p.x = Math.random()*innerWidth;
    }

    ctx.beginPath();
    ctx.arc(p.x,p.y,p.size,0,Math.PI*2);
    ctx.fillStyle = `rgba(255,255,255,${p.alpha})`;
    ctx.fill();
  }

  requestAnimationFrame(animate);
}

window.addEventListener("resize",resize);
resize();
animate(
