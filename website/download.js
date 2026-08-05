const releaseStatus = document.querySelector("#release-status");
const releaseMeta = document.querySelector("#release-meta");
const downloadButton = document.querySelector("#apk-download");
const releaseNotes = document.querySelector("#release-notes");
const releaseChecksum = document.querySelector("#release-checksum");

async function loadRelease() {
  try {
    const response = await fetch(`downloads/release.json?checked=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Release information is unavailable");
    const release = await response.json();
    releaseStatus.textContent = `Current release: SecureObs ${release.version}`;
    releaseMeta.textContent = `Version ${release.version} · Published ${new Date(`${release.publishedAt}T12:00:00`).toLocaleDateString("en-GB")} · ${release.size}`;
    releaseNotes.innerHTML = "";
    release.releaseNotes.forEach((note) => {
      const item = document.createElement("li");
      item.textContent = note;
      releaseNotes.appendChild(item);
    });
    releaseChecksum.textContent = release.sha256
      ? `APK SHA-256: ${release.sha256}${release.signingCertificateSha256 ? ` · Signing certificate: ${release.signingCertificateSha256}` : ""}`
      : "The SHA-256 verification code will appear when the signed APK is uploaded.";

    const fileResponse = await fetch(release.downloadUrl, { method: "HEAD", cache: "no-store" });
    if (!fileResponse.ok) throw new Error("APK_NOT_UPLOADED");
    downloadButton.href = release.downloadUrl;
    downloadButton.textContent = `Download SecureObs ${release.version}`;
    downloadButton.classList.remove("download-button-disabled");
    downloadButton.removeAttribute("aria-disabled");
    downloadButton.setAttribute("download", "SecureObs.apk");
  } catch (error) {
    if (error instanceof Error && error.message !== "APK_NOT_UPLOADED") {
      releaseStatus.textContent = "Release information is temporarily unavailable.";
    }
    downloadButton.textContent = "Download being prepared";
    downloadButton.classList.add("download-button-disabled");
    downloadButton.setAttribute("aria-disabled", "true");
    downloadButton.removeAttribute("href");
  }
}

void loadRelease();
