"use client";

import { useEffect, useRef, useState } from "react";
import { X, ZoomIn, ZoomOut, RotateCw, Loader2, Download } from "lucide-react";
import Cookies from "js-cookie";

interface ImageModalProps {
  imageUrl: string;
  fileName: string;
  onClose: () => void;
}

export function ImageModal({ imageUrl, fileName, onClose }: ImageModalProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  // Load image with authentication
  useEffect(() => {
    const loadImage = async () => {
      try {
        setIsLoading(true);
        setLoadError(false);
        
        // Get token from cookies
        const token = Cookies.get('accessToken');
        
        if (!token) {
          setLoadError(true);
          setIsLoading(false);
          return;
        }
        
        // Fetch image with authentication
        const response = await fetch(imageUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          credentials: 'include',
        });
        
        if (!response.ok) {
          throw new Error(`Failed to load image: ${response.status}`);
        }
        
        // Convert to blob URL
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to load image in modal:', error);
        setLoadError(true);
        setIsLoading(false);
      }
    };
    
    loadImage();
    
    // Cleanup blob URL on unmount or imageUrl change
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        setBlobUrl(null);
      }
    };
  }, [imageUrl]);

  // Reset zoom when image changes
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [blobUrl]);

  // Zoom in/out with mouse wheel
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) return;
      e.preventDefault();
      
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const newScale = Math.max(0.5, Math.min(5, scale + delta));
      setScale(newScale);
      
      // Adjust position to zoom towards mouse position
      if (imageRef.current) {
        const rect = imageRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        setPosition(prev => ({
          x: prev.x - x * delta,
          y: prev.y - y * delta,
        }));
      }
    };

    const container = containerRef.current;
    container?.addEventListener("wheel", handleWheel, { passive: false });
    return () => container?.removeEventListener("wheel", handleWheel);
  }, [scale]);

  const handleZoomIn = () => {
    setScale(prev => Math.min(5, prev + 0.25));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(0.5, prev - 0.25));
  };

  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch handlers for mobile
  const lastTouchDistance = useRef<number | null>(null);
  
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && scale > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y,
      });
    } else if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      lastTouchDistance.current = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDragging && scale > 1) {
      setPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      });
    } else if (e.touches.length === 2 && lastTouchDistance.current !== null) {
      // Pinch to zoom
      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const currentDistance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      const ratio = currentDistance / lastTouchDistance.current;
      setScale(prev => {
        const newScale = prev * ratio;
        return Math.max(0.5, Math.min(5, newScale));
      });
      lastTouchDistance.current = currentDistance;
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    lastTouchDistance.current = null;
  };

  const handleDownload = async () => {
    if (!blobUrl) return;
    
    try {
      // Fetch the blob URL
      const response = await fetch(blobUrl);
      const blob = await response.blob();
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Cleanup
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download image:', error);
    }
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm"
      onClick={(e) => {
        // Close when clicking outside the image
        if (e.target === containerRef.current) {
          onClose();
        }
      }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-[101] p-3 rounded-full bg-black/60 hover:bg-black/80 text-white transition-all hover:scale-110 active:scale-95"
        aria-label="Close"
      >
        <X size={24} />
      </button>

      {/* Zoom controls */}
      <div className="absolute top-4 left-4 z-[101] flex items-center gap-2">
        <button
          onClick={handleZoomIn}
          className="p-3 rounded-full bg-black/60 hover:bg-black/80 text-white transition-all hover:scale-110 active:scale-95 disabled:opacity-50"
          disabled={scale >= 5}
          aria-label="Zoom in"
        >
          <ZoomIn size={20} />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-3 rounded-full bg-black/60 hover:bg-black/80 text-white transition-all hover:scale-110 active:scale-95 disabled:opacity-50"
          disabled={scale <= 0.5}
          aria-label="Zoom out"
        >
          <ZoomOut size={20} />
        </button>
        <button
          onClick={handleReset}
          className="p-3 rounded-full bg-black/60 hover:bg-black/80 text-white transition-all hover:scale-110 active:scale-95"
          aria-label="Reset zoom"
        >
          <RotateCw size={20} />
        </button>
        <span className="px-3 py-2 rounded-full bg-black/60 text-white text-sm font-medium">
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={handleDownload}
          disabled={!blobUrl || isLoading}
          className="p-3 rounded-full bg-black/60 hover:bg-black/80 text-white transition-all hover:scale-110 active:scale-95 disabled:opacity-50"
          aria-label="Tải về"
          title="Tải về"
        >
          <Download size={20} />
        </button>
      </div>

      {/* Image */}
      <div
        className="relative max-w-full max-h-full flex items-center justify-center overflow-hidden"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          cursor: scale > 1 ? (isDragging ? "grabbing" : "grab") : "default",
        }}
      >
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20">
            <Loader2 size={48} className="text-white animate-spin" />
            <p className="text-white text-sm">Đang tải ảnh...</p>
          </div>
        ) : loadError || !blobUrl ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20">
            <X size={48} className="text-red-400" />
            <p className="text-white text-sm">Không thể tải ảnh</p>
          </div>
        ) : (
          <img
            ref={imageRef}
            src={blobUrl}
            alt={fileName}
            className="max-w-full max-h-[90vh] object-contain select-none"
            style={{
              transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
              transition: isDragging ? "none" : "transform 0.2s ease-out",
            }}
            draggable={false}
            onClick={(e) => e.stopPropagation()}
          />
        )}
      </div>

      {/* File name */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-black/60 text-white text-sm font-medium max-w-[80%] truncate">
        {fileName}
      </div>
    </div>
  );
}
