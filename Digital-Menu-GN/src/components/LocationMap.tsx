import { MapPin, Navigation, Clock, Star, Phone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const LocationMap = () => {
  const restaurantLocation = {
    name: "Cafe Chapter 1 Gautam Nagar Cafe",
    address: "135/3, Gautam Nagar, Yusuf Sarai, New Delhi, Delhi 110049",
    landmark: "Cafe Chapter 1",
    phone: "+91 7800327061",
    hours: "10:00 AM - 01:00 AM",
    rating: 4.8,
    coordinates: "28.5546, 77.2076", // (optional: update if you have exact lat/lng)
  };

  const handleGetDirections = () => {
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
      restaurantLocation.address
    )}`;
    window.open(googleMapsUrl, "_blank");
  };

  const handleCallNow = () => {
    window.location.href = `tel:${restaurantLocation.phone}`;
  };

  return (
    <div className="space-y-6 w-full max-w-2xl mx-auto px-1 sm:px-4 overflow-y-auto max-h-[80vh]">
      {/* Restaurant Info Card */}
      <Card className="bg-gradient-to-br from-green-50 to-olive-100 border-olive-200 shadow-lg rounded-2xl w-full max-w-full">
        <CardContent className="p-2 sm:p-6">
          {/* Info Section */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 sm:mb-4 gap-2 sm:gap-4">
            <div>
              <h3 className="text-base sm:text-2xl font-bold text-olive-800 mb-1 sm:mb-2">
                {restaurantLocation.name}
              </h3>
              <div className="flex items-center gap-1 mb-1">
                <Star className="w-4 h-4 text-yellow-500 fill-yellow-400" />
                <span className="text-xs sm:text-sm font-medium text-gray-700">
                  {restaurantLocation.rating} Rating
                </span>
              </div>
            </div>
            <div className="p-2 sm:p-3 bg-olive-600 rounded-full shadow-md">
              <MapPin className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
          </div>

          <div className="space-y-1 sm:space-y-2 text-gray-700 text-xs sm:text-sm">
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 mt-0.5 text-olive-600" />
              <span className="font-semibold">{restaurantLocation.landmark}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-4" />
              <span>{restaurantLocation.address}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-olive-600" />
              <span>{restaurantLocation.hours}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-olive-600" />
              <span>
                <a
                  href={`tel:${restaurantLocation.phone}`}
                  className="hover:underline hover:text-olive-800 transition"
                >
                  {restaurantLocation.phone}
                </a>
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-4 sm:mt-6">
            <Button
              onClick={handleGetDirections}
              className="flex-1 bg-olive-600 hover:bg-olive-700 text-white transition text-xs sm:text-base"
            >
              <Navigation className="w-4 h-4 mr-2" />
              Get Directions
            </Button>
            <Button
              onClick={handleCallNow}
              variant="outline"
              className="flex-1 border-olive-600 text-olive-600 hover:bg-olive-50 transition text-xs sm:text-base"
            >
              <Phone className="w-4 h-4 mr-2" />
              Call Now
            </Button>
          </div>

          {/* Interactive Map Placeholder */}
          <div className="relative w-full h-40 sm:h-80 bg-gradient-to-br from-olive-100 to-green-100 rounded-2xl overflow-hidden border border-olive-200 shadow-lg mt-6 sm:mt-8">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center space-y-2 sm:space-y-4">
                <div className="p-2 sm:p-4 bg-olive-600 rounded-full mx-auto w-fit shadow">
                  <MapPin className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-lg font-semibold text-olive-800 mb-1">
                    {restaurantLocation.name} Location
                  </h4>
                  <p className="text-xs sm:text-sm text-gray-700 font-semibold mb-1">
                    {restaurantLocation.landmark}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-600 mb-2 sm:mb-3 max-w-xs mx-auto">
                    {restaurantLocation.address}
                  </p>
                  <Button
                    onClick={handleGetDirections}
                    size="sm"
                    className="bg-olive-600 hover:bg-olive-700 text-xs sm:text-sm"
                  >
                    <Navigation className="w-4 h-4 mr-2" />
                    Open in Maps
                  </Button>
                </div>
              </div>
            </div>
            {/* Decorative elements */}
            <div className="absolute top-2 left-2 w-2 h-2 sm:w-3 sm:h-3 bg-olive-400 rounded-full opacity-60"></div>
            <div className="absolute top-6 right-6 w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-400 rounded-full opacity-60"></div>
            <div className="absolute bottom-4 left-6 w-3 h-3 sm:w-4 sm:h-4 bg-olive-300 rounded-full opacity-40"></div>
            <div className="absolute bottom-2 right-2 w-2 h-2 sm:w-3 sm:h-3 bg-green-300 rounded-full opacity-40"></div>
          </div>
        </CardContent>
      </Card>

      {/* Additional Info */}
      <div className="text-center text-xs sm:text-sm text-gray-600 px-1">
        <p>
          Tap{" "}
          <span className="font-semibold text-olive-700">Get Directions</span> to
          open the location in Google Maps, or{" "}
          <span className="font-semibold text-olive-700">Call Now</span> to
          contact us directly.
        </p>
      </div>
    </div>
  );
};

export default LocationMap;
