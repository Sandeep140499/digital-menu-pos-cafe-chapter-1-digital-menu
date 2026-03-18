import { useLocation } from "react-router-dom";

const NotFound = () => {
  const location = useLocation();

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-olive-50 via-olive-100 to-olive-200 px-4">
      <div className="w-full max-w-md text-center rounded-2xl bg-white/90 px-6 py-8 shadow-lg ring-1 ring-black/5">
        <h1 className="text-5xl sm:text-6xl font-extrabold mb-3 text-emerald-800 tracking-tight">
          404
        </h1>
        <p className="text-base sm:text-lg text-gray-700 mb-4">
          Oops! The page you are looking for doesn't exist.
        </p>
        <p className="text-xs sm:text-sm text-gray-500 mb-6">
          Maybe you followed an old link or typed something wrong.
        </p>
        <a
          href="/"
          className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-6 py-3 text-sm sm:text-base font-semibold text-white shadow-md hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-50 transition"
        >
          Go back to the menu
        </a>
      </div>
    </div>
  );
};

export default NotFound;
