import { useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";

export default function QRScanner({
  onScan,
  onError,
}) {
  const scannerRef = useRef(null);
  const hasScannedRef = useRef(false);

  useEffect(() => {
    const scanner = new Html5Qrcode(
      "qr-reader"
    );

    scannerRef.current = scanner;

    let mounted = true;

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
          },
          async (decodedText) => {
            if (
              !mounted ||
              hasScannedRef.current
            ) {
              return;
            }

            hasScannedRef.current = true;

            const ticketId =
              decodedText.trim();

            try {
              await scanner.stop();
            } catch (error) {
              console.warn(
                "Scanner stop warning:",
                error
              );
            }

            if (mounted) {
              onScan(ticketId);
            }
          },
          () => {
            // Normal QR scanning failures
            // are ignored.
          }
        );
      } catch (error) {
        console.error(
          "Camera initialization error:",
          error
        );

        if (mounted && onError) {
          onError(
            "Unable to access the camera. Please allow camera permission and try again."
          );
        }
      }
    };

    startScanner();

    return () => {
      mounted = false;
      hasScannedRef.current = true;

      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .catch(() => {})
          .finally(() => {
            scannerRef.current
              ?.clear()
              .catch(() => {});
          });
      }
    };
  }, [onScan, onError]);

  return (
    <div className="scanner-wrapper">

      <div id="qr-reader"></div>

      <p className="scanner-hint">
        Point the camera at the ticket QR code
      </p>

    </div>
  );
}
