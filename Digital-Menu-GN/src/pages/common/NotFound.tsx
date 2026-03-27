import { useLocation } from 'react-router-dom';

const NotFound = () => {
  const location = useLocation();

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-olive-50 via-olive-100 to-olive-200 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white/90 px-6 py-8 text-center shadow-lg ring-1 ring-black/5">
        <h1 className="mb-3 text-5xl font-extrabold tracking-tight text-emerald-800 sm:text-6xl">
          404
        </h1>
        <p className="mb-4 text-base text-gray-700 sm:text-lg">
          Oops! The page you are looking for doesn't exist.
        </p>
        <p className="mb-6 text-xs text-gray-500 sm:text-sm">
          Maybe you followed an old link or typed something wrong.
        </p>
        <a
          href="/"
          className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-50 focus-visible:outline-none sm:text-base"
        >
          Go back to the menu
        </a>
      </div>
    </div>
  );
};

export default NotFound;
