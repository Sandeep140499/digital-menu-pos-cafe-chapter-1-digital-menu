import { useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Download, QrCode } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const CAFE_NAME = "Cafe Chapter 1";

const QRCodeGenerator = () => {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const currentUrl = typeof window !== "undefined" ? window.location.origin : "";
  const qrCodeUrl = useMemo(
    () =>
      currentUrl
        ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(currentUrl)}`
        : "",
    [currentUrl]
  );

  // Draws cafe name + QR code on a canvas for download
  const prepareCanvas = async () => {
    if (!qrCodeUrl || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const width = 340;
    const height = 400;
    canvas.width = width;
    canvas.height = height;

    // Fill background white
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);

    // Draw cafe name
    ctx.font = "bold 28px Arial";
    ctx.fillStyle = "#d97706"; // orange-600
    ctx.textAlign = "center";
    ctx.fillText(CAFE_NAME, width / 2, 44);

    // Draw QR code image
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = qrCodeUrl;
    await new Promise((resolve) => {
      img.onload = resolve;
    });
    ctx.drawImage(img, 20, 60, 300, 300);
  };

  const downloadQR = async () => {
    await prepareCanvas();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = "chapter1-cafe-qr-code.png";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "QR Code Downloaded!",
      description: "Your QR code with cafe name has been saved.",
    });
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      toast({
        title: "URL Copied!",
        description: "Menu URL has been copied to clipboard.",
      });
    } catch (err) {
      toast({
        title: "Copy Failed",
        description: "Could not copy URL to clipboard.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <CardHeader className="text-center pb-4">
        <CardTitle className="flex items-center justify-center gap-2 text-2xl font-bold text-gray-800">
          <QrCode className="w-6 h-6 text-orange-600" />
          Digital Menu QR Code
        </CardTitle>
        <p className="text-gray-600 text-sm">
          Scan this code to instantly access our digital menu.
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* QR Code Display */}
        <div className="flex justify-center">
          <div className="p-4 bg-white rounded-2xl shadow-lg border-4 border-orange-100">
            {qrCodeUrl ? (
              <img
                src={qrCodeUrl}
                alt="Menu QR Code"
                className="max-w-full h-auto object-contain"
                style={{ width: "min(300px, 100%)" }}
              />
            ) : (
              <div className="w-64 h-64 bg-gray-100 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <QrCode className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500">Generating QR Code...</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Hidden canvas for download */}
        <canvas ref={canvasRef} style={{ display: "none" }} />

        {/* URL Display */}
        <div className="bg-gray-50 p-4 rounded-xl">
          <p className="text-sm text-gray-600 mb-2">Menu URL:</p>
          <p className="text-xs text-gray-800 font-mono bg-white p-2 rounded border break-all">
            {currentUrl}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            onClick={copyToClipboard}
            className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
          >
            <Copy className="w-4 h-4 mr-2" />
            Copy URL
          </Button>

          <Button
            onClick={downloadQR}
            variant="outline"
            className="flex-1 border-orange-600 text-orange-600 hover:bg-orange-50"
          >
            <Download className="w-4 h-4 mr-2" />
            Download QR
          </Button>
        </div>

        {/* Instructions */}
        {/* <div className="bg-orange-50 p-4 rounded-xl">
          <h4 className="font-semibold text-orange-800 mb-2">How to use:</h4>
          <ol className="text-sm text-orange-700 space-y-1 list-decimal list-inside">
            <li>Download or print the QR code with your cafe name.</li>
            <li>Place it on tables or display boards in your cafe.</li>
            <li>Customers scan the code using their phone camera.</li>
            <li>They will instantly access your digital menu.</li>
          </ol>
        </div> */}
      </CardContent>
    </div>
  );
};

export default QRCodeGenerator;
