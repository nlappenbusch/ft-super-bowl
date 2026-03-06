"use client";

import { useEffect } from "react";

type PreviewConfig = {
  id: string;
  url: string;
};

const previews: PreviewConfig[] = [
  { id: "shortcode-preview-1", url: "/api/package" },
  { id: "shortcode-preview-2", url: "/api/package-advanced" },
  { id: "shortcode-preview-3", url: "/api/faqs" },
];

const setError = (containerId: string) => {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '<div class="text-center text-red-600 p-4">Fehler beim Laden</div>';
};

const executeScripts = (container: HTMLElement) => {
  const scripts = Array.from(container.querySelectorAll("script"));
  scripts.forEach((script) => {
    const newScript = document.createElement("script");

    if (script.type) {
      newScript.type = script.type;
    }

    if (script.src) {
      newScript.src = script.src;
      newScript.async = true;
    } else {
      newScript.text = script.textContent ?? "";
    }

    if (newScript.type === "application/ld+json") {
      document.head.appendChild(newScript);
    } else {
      document.body.appendChild(newScript);
    }

    script.remove();
  });
};

const loadPreview = async ({ id, url }: PreviewConfig) => {
  try {
    const response = await fetch(url);
    const data = await response.json();

    if (!data?.success || !data?.html) {
      setError(id);
      return;
    }

    const container = document.getElementById(id);
    if (!container) return;

    container.innerHTML = data.html;
    executeScripts(container);
  } catch (error) {
    console.error(`Fehler beim Laden von ${url}`, error);
    setError(id);
  }
};

export default function ShortcodePreviewLoader() {
  useEffect(() => {
    previews.forEach((preview) => {
      void loadPreview(preview);
    });
  }, []);

  return null;
}
