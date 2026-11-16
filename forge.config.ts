import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerDMG } from "@electron-forge/maker-dmg";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { VitePlugin } from "@electron-forge/plugin-vite";
import { PublisherGithub } from "@electron-forge/publisher-github";
import type { ForgeConfig } from "@electron-forge/shared-types";
import { FuseV1Options, FuseVersion } from "@electron/fuses";
import fs from "node:fs";
import path from "node:path";

// import { globSync } from "node:fs";

const STRINGS = {
  author: "TYPUS",
  name: "TYPUS",
  execName: "typus-desktop",
  description: "TYPUS: plataforma de comunicação.",
};

const ASSET_DIR = "assets/desktop";

/**
 * Assinatura de código no Windows (opcional).
 * Sem estas variáveis o build sai sem assinatura e o SmartScreen mostra aviso.
 * - Certificado em arquivo (.pfx): WINDOWS_CERTIFICATE_FILE + WINDOWS_CERTIFICATE_PASSWORD
 * - Certificado em nuvem / token (Azure Artifact Signing, Certum SimplySign...):
 *   WINDOWS_SIGN_PARAMS com os parâmetros extras do signtool.exe
 */
const windowsSign =
  process.env.WINDOWS_CERTIFICATE_FILE || process.env.WINDOWS_SIGN_PARAMS
    ? {
        certificateFile: process.env.WINDOWS_CERTIFICATE_FILE,
        certificatePassword: process.env.WINDOWS_CERTIFICATE_PASSWORD,
        signWithParams: process.env.WINDOWS_SIGN_PARAMS,
        timestampServer:
          process.env.WINDOWS_TIMESTAMP_SERVER ??
          "http://timestamp.digicert.com",
      }
    : undefined;

/**
 * Build targets for the desktop app
 */
const makers: ForgeConfig["makers"] = [
  new MakerSquirrel({
    name: STRINGS.name,
    authors: STRINGS.author,
    // ícone em "Adicionar ou remover programas"
    iconUrl: `https://typus-shark.duckdns.org/assets/web/icon.ico`,
    // todo: loadingGif
    setupIcon: `${ASSET_DIR}/icon.ico`,
    description: STRINGS.description,
    exe: `${STRINGS.execName}.exe`,
    setupExe: `TYPUS-Setup.exe`,
    copyright:
      "Copyright (C) 2025 Revolt Platforms LTD; modificações (C) 2026 TYPUS. AGPL-3.0",
    windowsSign,
  }),
  // .zip on every system (on macOS it is also what the auto-updater downloads)
  new MakerZIP({}, ["win32", "darwin", "linux"]),

  // macOS: drag-to-Applications disk image (unsigned without an Apple account)
  new MakerDMG(
    {
      name: STRINGS.name,
      title: STRINGS.name,
      icon: `${ASSET_DIR}/icon.icns`,
      format: "ULFO",
    },
    ["darwin"],
  ),

  // Linux: .deb for Debian / Ubuntu and derivatives
  new MakerDeb(
    {
      options: {
        name: STRINGS.execName,
        productName: STRINGS.name,
        genericName: "Comunicação",
        description: STRINGS.description,
        bin: STRINGS.execName,
        icon: `${ASSET_DIR}/icon-1024.png`,
        categories: ["Network", "Chat"],
        section: "net",
        homepage: "https://github.com/ISAAC-MONTEIRO/typus-desktop",
        maintainer: "TYPUS",
        // xz: installs on every Debian / Ubuntu (zstd needs dpkg 1.21.18+)
        compression: "xz",
      },
    },
    ["linux"],
  ),
];

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    name: STRINGS.name,
    executableName: STRINGS.execName,
    windowsSign,
    // no extension: the packager picks icon.ico (Windows) or icon.icns (macOS,
    // generated from icon-1024.png by the release workflow)
    icon: `${ASSET_DIR}/icon`,
    // macOS bundle identity
    appBundleId: "chat.typus.desktop",
    appCategoryType: "public.app-category.social-networking",
    // extraResource: [
    //   // include all the asset files
    //   ...globSync(ASSET_DIR + "/**/*"),
    // ],
  },
  rebuildConfig: {},
  makers,
  hooks: {
    // Copy the node-pipewire dist to the app on linux
    packageAfterCopy: async (_config, buildPath, _version, platform) => {
      if (platform === "linux") {
        // Copy only the files we need to run the code, which is dist, LICENSE, and package.json
        fs.cpSync(
          "node_modules/node-pipewire/dist",
          path.join(buildPath, "node_modules/node-pipewire/dist"),
          { recursive: true },
        );
        fs.cpSync(
          "node_modules/node-pipewire/LICENSE",
          path.join(buildPath, "node_modules/node-pipewire/LICENSE"),
          { recursive: true },
        );
        fs.cpSync(
          "node_modules/node-pipewire/package.json",
          path.join(buildPath, "node_modules/node-pipewire/package.json"),
          { recursive: true },
        );
      }
    },
  },
  plugins: [
    {
      name: "@electron-forge/plugin-auto-unpack-natives",
      config: {},
    },
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: "src/main.ts",
          config: "vite.main.config.ts",
          target: "main",
        },
        {
          entry: "src/preload.ts",
          config: "vite.preload.config.ts",
          target: "preload",
        },
      ],
      renderer: [],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
  publishers: [
    new PublisherGithub({
      repository: {
        owner: "ISAAC-MONTEIRO",
        name: "typus-desktop",
      },
      // a release nasce como rascunho; publicar no GitHub libera a atualização
      draft: true,
    }),
  ],
};

export default config;
