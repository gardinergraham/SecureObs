# SecureObs Android release

Place the newly downloaded EAS APK in this directory. It can keep its generated
`application-....apk` filename, then run from the project root:

`npm run prepare-apk-release`

The command verifies the package, version code, production signing certificate,
backup setting and restricted permissions. It then renames the verified build to:

`SecureObs.apk`

It also calculates the size and SHA-256 checksum and updates `release.json` after
asking for the minimum supported version and release notes. The existing published
APK is not replaced if verification fails.

For a non-interactive run, use repeated `--note` options:

`npm run prepare-apk-release -- --minimum 0.1.7 --note "First change" --note "Second change"`

Keep the Android package name and production signing key unchanged so installations
can be upgraded in place.
