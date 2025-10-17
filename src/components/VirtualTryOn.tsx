import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X, Camera, Upload, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface VirtualTryOnProps {
  product: any;
  onClose: () => void;
}

export const VirtualTryOn = ({ product, onClose }: VirtualTryOnProps) => {
  const [image, setImage] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
      }
    } catch (error) {
      toast.error("Could not access camera");
    }
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(videoRef.current, 0, 0);
      setImage(canvas.toDataURL("image/jpeg"));
      stopCamera();
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      setIsCameraActive(false);
    }
  };

  const processVirtualTryOn = async () => {
    if (!image) {
      toast.error("Please upload or capture an image first");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("virtual-tryon", {
        body: {
          userImage: image,
          productImage: product.images[0],
          productName: product.name,
        },
      });

      if (error) throw error;
      
      setResult(data.resultImage);
      toast.success("Virtual try-on complete!");
    } catch (error) {
      console.error("Virtual try-on error:", error);
      toast.error("Failed to process virtual try-on");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="max-w-4xl w-full max-h-[90vh] overflow-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Virtual Try-On - {product.name}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Input Section */}
          <div className="space-y-4">
            <h3 className="font-semibold">Your Photo</h3>
            
            {!isCameraActive && !image && (
              <div className="space-y-4">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Photo
                </Button>
                <Button variant="outline" className="w-full" onClick={startCamera}>
                  <Camera className="mr-2 h-4 w-4" />
                  Use Camera
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>
            )}

            {isCameraActive && (
              <div className="space-y-4">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full rounded-lg"
                />
                <div className="flex gap-2">
                  <Button onClick={capturePhoto} className="flex-1">
                    Capture Photo
                  </Button>
                  <Button variant="outline" onClick={stopCamera}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {image && !isCameraActive && (
              <div className="space-y-4">
                <img src={image} alt="Your photo" className="w-full rounded-lg" />
                <Button
                  variant="outline"
                  onClick={() => setImage(null)}
                  className="w-full"
                >
                  Choose Different Photo
                </Button>
              </div>
            )}

            {image && !loading && !result && (
              <Button
                variant="premium"
                className="w-full"
                onClick={processVirtualTryOn}
              >
                Apply Virtual Try-On
              </Button>
            )}
          </div>

          {/* Result Section */}
          <div className="space-y-4">
            <h3 className="font-semibold">Try-On Result</h3>
            
            {loading && (
              <div className="flex items-center justify-center h-64 bg-muted rounded-lg">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                  <p className="text-sm text-muted-foreground">
                    Processing your virtual try-on...
                  </p>
                </div>
              </div>
            )}

            {result && (
              <div className="space-y-4">
                <img src={result} alt="Try-on result" className="w-full rounded-lg" />
                <Button variant="premium" className="w-full">
                  Add to Cart
                </Button>
              </div>
            )}

            {!loading && !result && (
              <div className="flex items-center justify-center h-64 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Upload or capture a photo to see the try-on result
                </p>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};
