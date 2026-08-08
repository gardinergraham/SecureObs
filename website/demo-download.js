const status = document.querySelector("#demo-release-status");
const meta = document.querySelector("#demo-release-meta");
const button = document.querySelector("#demo-apk-download");
const notes = document.querySelector("#demo-release-notes");
const checksum = document.querySelector("#demo-release-checksum");

async function loadDemoRelease() {
  try {
    const response = await fetch(`demo-downloads/release.json?checked=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Release unavailable");
    const release = await response.json();
    status.textContent = `Current release: SecureObs Demo ${release.version}`;
    meta.textContent = `Version ${release.version} · ${release.size || "APK preparation in progress"}`;
    notes.replaceChildren(...release.releaseNotes.map((note) => Object.assign(document.createElement("li"), { textContent: note })));
    checksum.textContent = release.sha256 ? `APK SHA-256: ${release.sha256}` : "The verification checksum will appear with the first Demo APK.";
    if (!release.downloadUrl) return;
    const url = new URL(release.downloadUrl);
    if (url.protocol !== "https:" || !url.hostname.endsWith(".public.blob.vercel-storage.com")) throw new Error("Invalid download URL");
    button.href = url.href;
    button.textContent = `Download SecureObs Demo ${release.version}`;
    button.classList.remove("download-button-disabled");
    button.removeAttribute("aria-disabled");
  } catch {
    status.textContent = "The Demo release is temporarily unavailable.";
  }
}

void loadDemoRelease();
