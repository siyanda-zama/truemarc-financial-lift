import { useState, useEffect } from "react";

const Loader = ({ onLoadComplete }: { onLoadComplete: () => void }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onLoadComplete, 300); // Allow fade out animation to complete
    }, 2500);

    return () => clearTimeout(timer);
  }, [onLoadComplete]);

  return (
    <div
      className={`fixed inset-0 bg-white z-50 flex items-center justify-center transition-opacity duration-300 ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="flex flex-col items-center">
        <div className="relative">
          <img
            src="/lovable-uploads/8db9213d-a0bf-4063-993a-00814c345c60.png"
            alt="Truemarc Consultants"
            className="h-32 w-auto animate-pulse"
            style={{
              animation: "colorToBlack 2s ease-in-out infinite alternate",
            }}
          />
        </div>
        <div className="mt-6">
          <div className="w-16 h-1 bg-primary rounded-full overflow-hidden">
            <div className="w-full h-full bg-secondary animate-pulse rounded-full"></div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes colorToBlack {
          0% {
            filter: none;
          }
          100% {
            filter: brightness(0);
          }
        }
      `}</style>
    </div>
  );
};

export default Loader;