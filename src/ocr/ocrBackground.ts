import { OCR_FETCH_IMAGE_MESSAGE_TYPE } from "../utils/constants";

interface OcrFetchImageMessage {
  type: typeof OCR_FETCH_IMAGE_MESSAGE_TYPE;
  url: string;
}

interface OcrFetchImageResponse {
  ok: boolean;
  dataUrl?: string;
  error?: string;
}

function isOcrFetchImageMessage(message: unknown): message is OcrFetchImageMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as { type?: unknown }).type === OCR_FETCH_IMAGE_MESSAGE_TYPE &&
    typeof (message as { url?: unknown }).url === "string"
  );
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

async function fetchImageAsDataUrl(url: string): Promise<string> {
  const response = await fetch(url, {
    credentials: "include"
  });

  if (!response.ok) {
    throw new Error(`Image fetch failed: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "image/png";
  const buffer = await response.arrayBuffer();
  const base64 = arrayBufferToBase64(buffer);

  return `data:${contentType};base64,${base64}`;
}

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (!isOcrFetchImageMessage(message)) {
    return false;
  }

  void fetchImageAsDataUrl(message.url)
    .then((dataUrl) => {
      const response: OcrFetchImageResponse = {
        ok: true,
        dataUrl
      };
      sendResponse(response);
    })
    .catch((error: unknown) => {
      const response: OcrFetchImageResponse = {
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      };
      sendResponse(response);
    });

  return true;
});
