import { startFromManifest, type CentralUiManifest } from "@oondemand/oon-core-front";
import manifest from "../central.ui.json";
import ConfiguracoesCentral from "./ConfiguracoesCentral";

const uiManifest: CentralUiManifest = {
  ...(manifest as CentralUiManifest),
  pages: [
    ...((manifest as CentralUiManifest).pages || []),
    {
      id: "configuracoes-central",
      path: "/configuracoes",
      label: "Configurações",
      title: "Configurações",
      section: "Configurações",
      order: 99,
      component: "ConfiguracoesCentral",
      permissions: ["administrador"],
    },
  ],
};

startFromManifest(uiManifest, {
  apiBaseUrl: import.meta.env.VITE_API_URL ?? "http://localhost:4000",
  meusAppsUrl: import.meta.env.VITE_MEUS_APPS_URL,
  devToken: import.meta.env.DEV ? (import.meta.env.VITE_DEV_TOKEN ?? "dev-local") : undefined,
  customComponents: {
    ConfiguracoesCentral,
  },
});
