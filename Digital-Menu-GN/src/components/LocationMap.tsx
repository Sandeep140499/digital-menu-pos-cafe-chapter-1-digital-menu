import { MapPin, Navigation, Clock, Star, Phone } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const LocationMap = () => {
  const restaurantLocation = {
    name: 'Cafe Chapter 1 Gautam Nagar Cafe',
    address: '135/3, Gautam Nagar, Yusuf Sarai, New Delhi, Delhi 110049',
    landmark: 'Cafe Chapter 1',
    phone: '+91 7800327061',
    hours: '10:00 AM - 01:00 AM',
    rating: 4.8,
    coordinates: '28.5546, 77.2076', // (optional: update if you have exact lat/lng)
  };

  const handleGetDirections = () => {
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
      restaurantLocation.address
    )}`;
    window.open(googleMapsUrl, '_blank');
  };

  const handleCallNow = () => {
    window.location.href = `tel:${restaurantLocation.phone}`;
  };

  return (
    <div className="mx-auto max-h-[80vh] w-full max-w-2xl space-y-6 overflow-y-auto px-1 sm:px-4">
      {/* Restaurant Info Card */}
      <Card className="w-full max-w-full rounded-2xl border-olive-200 bg-gradient-to-br from-green-50 to-olive-100 shadow-lg">
        <CardContent className="p-2 sm:p-6">
          {/* Info Section */}
          <div className="mb-3 flex flex-col items-start justify-between gap-2 sm:mb-4 sm:flex-row sm:items-center sm:gap-4">
            <div>
              <h3 className="mb-1 text-base font-bold text-olive-800 sm:mb-2 sm:text-2xl">
                {restaurantLocation.name}
              </h3>
              <div className="mb-1 flex items-center gap-1">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-500" />
                <span className="text-xs font-medium text-gray-700 sm:text-sm">
                  {restaurantLocation.rating} Rating
                </span>
              </div>
            </div>
            <div className="rounded-full bg-olive-600 p-2 shadow-md sm:p-3">
              <MapPin className="h-5 w-5 text-white sm:h-6 sm:w-6" />
            </div>
          </div>

          <div className="space-y-1 text-xs text-gray-700 sm:space-y-2 sm:text-sm">
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 text-olive-600" />
              <span className="font-semibold">{restaurantLocation.landmark}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-4" />
              <span>{restaurantLocation.address}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-olive-600" />
              <span>{restaurantLocation.hours}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-olive-600" />
              <span>
                <a
                  href={`tel:${restaurantLocation.phone}`}
                  className="transition hover:text-olive-800 hover:underline"
                >
                  {restaurantLocation.phone}
                </a>
              </span>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:mt-6 sm:flex-row sm:gap-3">
            <Button
              onClick={handleGetDirections}
              className="flex-1 bg-olive-600 text-xs text-white transition hover:bg-olive-700 sm:text-base"
            >
              <Navigation className="mr-2 h-4 w-4" />
              Get Directions
            </Button>
            <Button
              onClick={handleCallNow}
              variant="outline"
              className="flex-1 border-olive-600 text-xs text-olive-600 transition hover:bg-olive-50 sm:text-base"
            >
              <Phone className="mr-2 h-4 w-4" />
              Call Now
            </Button>
          </div>

          {/* Interactive Map Placeholder */}
          <div className="relative mt-6 h-40 w-full overflow-hidden rounded-2xl border border-olive-200 bg-gradient-to-br from-olive-100 to-green-100 shadow-lg sm:mt-8 sm:h-80">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="space-y-2 text-center sm:space-y-4">
                <div className="mx-auto w-fit rounded-full bg-olive-600 p-2 shadow sm:p-4">
                  <MapPin className="h-6 w-6 text-white sm:h-8 sm:w-8" />
                </div>
                <div>
                  <h4 className="mb-1 text-xs font-semibold text-olive-800 sm:text-lg">
                    {restaurantLocation.name} Location
                  </h4>
                  <p className="mb-1 text-xs font-semibold text-gray-700 sm:text-sm">
                    {restaurantLocation.landmark}
                  </p>
                  <p className="mx-auto mb-2 max-w-xs text-xs text-gray-600 sm:mb-3 sm:text-sm">
                    {restaurantLocation.address}
                  </p>
                  <Button
                    onClick={handleGetDirections}
                    size="sm"
                    className="bg-olive-600 text-xs hover:bg-olive-700 sm:text-sm"
                  >
                    <Navigation className="mr-2 h-4 w-4" />
                    Open in Maps
                  </Button>
                </div>
              </div>
            </div>
            {/* Decorative elements */}
            <div className="absolute top-2 left-2 h-2 w-2 rounded-full bg-olive-400 opacity-60 sm:h-3 sm:w-3"></div>
            <div className="absolute top-6 right-6 h-1.5 w-1.5 rounded-full bg-green-400 opacity-60 sm:h-2 sm:w-2"></div>
            <div className="absolute bottom-4 left-6 h-3 w-3 rounded-full bg-olive-300 opacity-40 sm:h-4 sm:w-4"></div>
            <div className="absolute right-2 bottom-2 h-2 w-2 rounded-full bg-green-300 opacity-40 sm:h-3 sm:w-3"></div>
          </div>
        </CardContent>
      </Card>

      {/* Additional Info */}
      <div className="px-1 text-center text-xs text-gray-600 sm:text-sm">
        <p>
          Tap <span className="font-semibold text-olive-700">Get Directions</span> to open the
          location in Google Maps, or <span className="font-semibold text-olive-700">Call Now</span>{' '}
          to contact us directly.
        </p>
      </div>
    </div>
  );
};

export default LocationMap;
