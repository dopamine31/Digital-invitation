import QRCode from "qrcode";

export function makeQrDataUrl(text: string, size = 320): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: size,
    color: { dark: "#1B1B1B", light: "#FFFFFFFF" },
  });
}

export function makeQrSvg(text: string): Promise<string> {
  return QRCode.toString(text, { type: "svg", errorCorrectionLevel: "M", margin: 1 });
}
