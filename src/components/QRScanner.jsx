import { useEffect, useRef } from "react";
import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
} from "html5-qrcode";

export default function QRScanner({ onScan, onError }) {
  const scannerRef = useRef(null);
  const startedRef = useRef(false);
  const handledRef = useRef(false);

  useEffect(() => {
    const scannerId = "event-qr-reader";

    const scanner = new Html5Qrcode(scannerId, {
      formatsToSupport: [
        Html5QrcodeSupportedFormats.QR_CODE,
      ],
      verbose: false,
    });

    scannerRef.current = scanner;

    const startScanner = async () => {
      try {
        await scanner.start(
          {
            facingMode: "environment",
          },
          {
            fps: 10,
            qrbox: {
              width: 250,
              height: 250,
            },
            aspectRatio: 1,
          },
          async (decodedText) => {
            if (handledRef.current) return;

            handledRef.current = true;

            try {
              await scanner.stop();
            } catch {
              // Scanner may already be stopped.
            }

            onScan(decodedText);
          },
          () => {
            // Ignore normal QR scanning failures.
          }
        );

        startedRef.current = true;
      } catch (error) {
        console.error("Scanner start error:", error);

        onError(
          "Unable to access the camera. Please allow camera permission and try again."
        );
      }
    };

    startScanner();

    return () => {
      const cleanup = async () => {
        try {
          if (startedRef.current) {
            await scanner.stop();
          }
        } catch {
          // Ignore cleanup errors.
        }

        try {
          await scanner.clear();
        } catch {
          // Ignore cleanup errors.
        }
      };

      cleanup();
    };
  }, [onScan, onError]);

  return (
    <div className="scanner-wrapper">
      <div
        id="event-qr-reader"
        className="qr-reader"
      />

      <div className="scanner-instruction">
        <strong>Point the camera at the QR code</strong>
        <span>
          The ticket will be checked automatically.
        </span>
      </div>
    </div>
  );
}
